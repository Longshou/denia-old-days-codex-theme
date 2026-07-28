(() => {
  const manifest = __DENIA_OLD_DAYS_EXTENSION_MANIFEST_JSON__;
  const cssText = __DENIA_OLD_DAYS_EXTENSION_CSS_JSON__;
  const brightArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_BRIGHT_ART_JSON__;
  const darkHomeArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_DARK_HOME_ART_JSON__;
  const taskWarmArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_WARM_ART_JSON__;
  const taskApprovalArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_APPROVAL_ART_JSON__;
  const taskErrorArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_ERROR_ART_JSON__;
  const taskCompleteArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_COMPLETE_ART_JSON__;
  const stateKey = "__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__";
  const styleId = "denia-old-days-dream-skin-extension-style";
  const rootClass = "denia-old-days-ds-extension";
  const nativeHomePromptShiftProperty = "--denia-old-days-native-prompt-shift";
  const root = document.documentElement;
  const touchedNodes = new Set();
  const ownedNodes = new Set();
  const ownedNodeHistory = new WeakSet();
  const listeners = [];
  let nativeLeftSidebarPanel = null;
  let nativeSidebarPanel = null;
  let nativeHomePrompt = null;
  let taskChrome = null;
  const nativeHomeSuggestionTargets = new Set();
  let cachedComposer = null;
  const nativeSidebarGroups = new Set();
  const nativeSidebarRows = new Set();
  const cachedToggles = new Map();
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const nativeSidebarTogglePattern = /(?:显示\/隐藏侧边栏|show\/hide sidebar|toggle sidebar)/iu;
  const nativeSummaryTogglePattern = /(?:切换(?:置顶)?摘要|toggle (?:pinned )?summary)/iu;
  const nativeBottomPanelTogglePattern = /(?:切换底部面板显示|toggle bottom panel)/iu;
  const observationSelector = [
    '[data-content-search-unit-key*="tool"]',
    '[data-content-search-unit-key*="reasoning"]',
    '[data-testid*="tool"]',
    '[data-testid*="reasoning"]',
    "details",
  ].join(",");
  const assistantSelector = '[data-content-search-unit-key$=":assistant"]';
  const DIRTY = Object.freeze({
    ROUTE: 1 << 0,
    COMPOSER: 1 << 1,
    SIDEBAR: 1 << 2,
    LAYOUT: 1 << 3,
    WORK_SURFACES: 1 << 4,
    HOME: 1 << 5,
    TASK_STATE: 1 << 6,
    TASK_DECORATION: 1 << 7,
    ART: 1 << 8,
    ALL: (1 << 9) - 1,
  });
  const STYLE_DIRTY = DIRTY.SIDEBAR
    | DIRTY.LAYOUT
    | DIRTY.WORK_SURFACES
    | DIRTY.HOME
    | DIRTY.TASK_STATE
    | DIRTY.ART;
  const TASK_MUTATION_DIRTY = DIRTY.ROUTE
    | DIRTY.TASK_STATE
    | DIRTY.TASK_DECORATION
    | DIRTY.ART;
  const STRUCTURE_DIRTY = DIRTY.ROUTE
    | DIRTY.COMPOSER
    | DIRTY.SIDEBAR
    | DIRTY.LAYOUT
    | DIRTY.WORK_SURFACES;
  const stateArtSpecs = Object.freeze({
    staged: Object.freeze({ family: "taskWarm", opacity: ".11" }),
    working: Object.freeze({ family: "taskWarm", opacity: ".20" }),
    approval: Object.freeze({ family: "taskApproval", opacity: ".43" }),
    error: Object.freeze({ family: "taskError", opacity: ".56" }),
    complete: Object.freeze({ family: "taskComplete", opacity: ".28" }),
  });
  const removableClasses = [
    "denia-old-days-ds-native-home-prompt",
    "denia-old-days-ds-native-home-suggestions",
    "denia-old-days-ds-composer",
    "denia-old-days-ds-send",
    "denia-old-days-ds-attachment",
    "denia-old-days-ds-observation",
    "denia-old-days-ds-final-card",
    "denia-old-days-ds-native-left-sidebar",
    "denia-old-days-ds-native-right-sidebar",
    "denia-old-days-ds-native-sidebar-group",
    "denia-old-days-ds-native-sidebar-row",
  ];

  window[stateKey]?.cleanup?.();

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = cssText;
  document.head.append(style);

  const artUrls = Object.freeze({
    bright: dataUrlToObjectUrl(brightArtDataUrl),
    dark: dataUrlToObjectUrl(darkHomeArtDataUrl),
    taskWarm: dataUrlToObjectUrl(taskWarmArtDataUrl),
    taskApproval: dataUrlToObjectUrl(taskApprovalArtDataUrl),
    taskError: dataUrlToObjectUrl(taskErrorArtDataUrl),
    taskComplete: dataUrlToObjectUrl(taskCompleteArtDataUrl),
  });
  root.classList.add(rootClass);
  root.dataset.deniaOldDaysExtensionVersion = manifest.version;
  root.style.setProperty("--denia-old-days-art-bright", `url("${artUrls.bright}")`);
  root.style.setProperty("--denia-old-days-art-dark", `url("${artUrls.dark}")`);
  root.style.setProperty("--denia-old-days-art-task-warm", `url("${artUrls.taskWarm}")`);
  root.style.setProperty("--denia-old-days-art-task-approval", `url("${artUrls.taskApproval}")`);
  root.style.setProperty("--denia-old-days-art-task-error", `url("${artUrls.taskError}")`);
  root.style.setProperty("--denia-old-days-art-task-complete", `url("${artUrls.taskComplete}")`);

  const state = {
    id: manifest.id,
    version: manifest.version,
    artReady: Object.values(artUrls).every(Boolean),
    reducedMotion: motionPreference.matches,
    formState: "staged",
    artGeneration: 0,
    artFamily: "",
    artCurrent: null,
    artNext: null,
    finalAssistantCard: null,
    pendingDirty: 0,
    pendingDecorationRoots: new Set(),
    pendingStyleDirty: 0,
    pendingStyleDecorationRoots: new Set(),
    metrics: {
      refreshes: 0,
      createdNodes: 0,
      lastRefreshDurationMs: 0,
      domainRuns: {
        route: 0,
        composer: 0,
        sidebar: 0,
        layout: 0,
        workSurfaces: 0,
        home: 0,
        taskState: 0,
        taskDecoration: 0,
        art: 0,
      },
    },
    observer: null,
    nativeTheme: null,
    frame: 0,
    styleRefreshTimer: 0,
    homeActive: false,
    homeScrollMain: null,
    ownedNodes,
    refresh,
    cleanup,
  };
  window[stateKey] = state;

  function dataUrlToObjectUrl(value) {
    const comma = value.indexOf(",");
    if (comma < 0) throw new Error("Invalid Denia artwork data URL");
    const header = value.slice(0, comma);
    const mime = /^data:([^;,]+)/u.exec(header)?.[1] || "application/octet-stream";
    const encoded = value.slice(comma + 1);
    const binary = header.includes(";base64") ? atob(encoded) : decodeURIComponent(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }

  function own(node) {
    ownedNodes.add(node);
    ownedNodeHistory.add(node);
    state.metrics.createdNodes += 1;
    return node;
  }

  function isOwnedSubtree(node) {
    for (let current = node; current; current = current.parentElement) {
      if (ownedNodes.has(current)) return true;
    }
    return false;
  }

  function isOwnedRecordNode(node) {
    return ownedNodeHistory.has(node);
  }

  function syncClass(node, className, present) {
    if (!node?.classList || node.classList.contains(className) === present) return false;
    node.classList.toggle(className, present);
    return true;
  }

  function setDatasetValue(node, name, value) {
    if (!node?.dataset || node.dataset[name] === value) return false;
    node.dataset[name] = value;
    return true;
  }

  function removeDatasetValue(node, name) {
    if (!node?.dataset || !(name in node.dataset)) return false;
    delete node.dataset[name];
    return true;
  }

  function setStyleProperty(node, name, value) {
    if (!node?.style || node.style.getPropertyValue(name) === value) return false;
    node.style.setProperty(name, value);
    return true;
  }

  function removeStyleProperty(node, name) {
    if (!node?.style || !node.style.getPropertyValue(name)) return false;
    node.style.removeProperty(name);
    return true;
  }

  function touch(node, className) {
    if (!node) return null;
    syncClass(node, className, true);
    touchedNodes.add(node);
    return node;
  }

  function detectNativeTheme(classList, previousTheme) {
    const hasDark = classList.contains("electron-dark");
    const hasLight = classList.contains("electron-light");
    if (hasDark !== hasLight) return hasDark ? "dark" : "light";
    return previousTheme === "dark" || previousTheme === "light"
      ? previousTheme
      : "light";
  }

  function nativeThemeCopy(theme) {
    if (theme === "dark") {
      return {
        eyebrow: manifest.ui.darkEyebrow,
        headline: manifest.ui.darkHeadline,
        status: manifest.ui.darkStatusText,
      };
    }
    return {
      eyebrow: manifest.ui.eyebrow,
      headline: manifest.ui.headline,
      status: manifest.ui.statusText,
    };
  }

  function setTextContent(node, value) {
    if (!node || node.textContent === value) return false;
    node.textContent = value;
    return true;
  }

  function syncNativeTheme() {
    const nextTheme = detectNativeTheme(root.classList, state.nativeTheme);
    state.nativeTheme = nextTheme;
    let changed = setDatasetValue(root, "deniaTheme", nextTheme);
    const copy = nativeThemeCopy(nextTheme);
    changed = setTextContent(
      document.querySelector(".denia-old-days-ds-hero-eyebrow"),
      copy.eyebrow,
    ) || changed;
    changed = setTextContent(
      document.querySelector(".denia-old-days-ds-hero-headline"),
      copy.headline,
    ) || changed;
    changed = setTextContent(
      document.querySelector(".denia-old-days-ds-hero-status"),
      copy.status,
    ) || changed;
    return changed;
  }

  function visible(node) {
    if (!(node instanceof HTMLElement)) return false;
    const box = node.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    for (let current = node; current instanceof HTMLElement; current = current.parentElement) {
      if (current.getAttribute("aria-hidden") === "true") return false;
      const computed = getComputedStyle(current);
      const opacity = Number.parseFloat(computed.opacity);
      if (computed.display === "none"
        || computed.visibility === "hidden"
        || (Number.isFinite(opacity) && opacity <= 0)) return false;
    }
    return true;
  }

  function layoutVisible(node) {
    if (!(node instanceof HTMLElement)) return false;
    const box = node.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return false;
    for (let current = node; current instanceof HTMLElement; current = current.parentElement) {
      if (current.getAttribute("aria-hidden") === "true") return false;
      const computed = getComputedStyle(current);
      if (computed.display === "none" || computed.visibility === "hidden") return false;
    }
    return true;
  }

  function normalizedNodeLabel(node) {
    return (node?.getAttribute?.("aria-label")
      || node?.getAttribute?.("title")
      || node?.textContent
      || "")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function toggleSemanticallyValid(toggle, pattern) {
    return Boolean(toggle?.isConnected
      && toggle.matches?.("button")
      && pattern.test(normalizedNodeLabel(toggle))
      && visible(toggle));
  }

  function findNativeToggle(pattern, kind) {
    const cached = cachedToggles.get(kind);
    if (toggleSemanticallyValid(cached, pattern)) return cached;
    const toggle = [...document.querySelectorAll("button")]
      .filter((button) => pattern.test(normalizedNodeLabel(button)) && visible(button))
      .sort((first, second) => measuredRect(second).right - measuredRect(first).right)[0]
      || null;
    if (toggle) cachedToggles.set(kind, toggle);
    else cachedToggles.delete(kind);
    return toggle;
  }

  function invalidateToggleCache(kind) {
    if (kind) cachedToggles.delete(kind);
    else cachedToggles.clear();
  }

  function nativeToggleState(toggle) {
    if (!toggle) return "closed";
    const values = [
      toggle.getAttribute("aria-pressed"),
      toggle.getAttribute("aria-expanded"),
      toggle.getAttribute("data-state"),
    ].filter(Boolean).map((value) => value.toLowerCase());
    if (values.some((value) => ["true", "open", "opened", "on", "checked"].includes(value))) return "open";
    if (values.some((value) => ["false", "closed", "off", "unchecked"].includes(value))) return "closed";
    return "unknown";
  }

  function measuredRect(node) {
    if (!(node instanceof HTMLElement)) return null;
    const rect = node.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
      top: rect.top,
      left: rect.left,
    };
  }

  function isExcludedSidebarCandidate(node) {
    const excludedAncestor = node?.closest?.([
      "dialog",
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[role="menu"]',
      '[role="listbox"]',
      '[role="tooltip"]',
      "[popover]",
      '[role="status"]',
      '[data-testid*="toast"]',
    ].join(","));
    const composer = findComposer();
    return !node
      || node.isConnected === false
      || node === document.body
      || node === root
      || ownedNodes.has(node)
      || Boolean(excludedAncestor)
      || Boolean(composer?.contains(node))
      || node.closest?.("#denia-old-days-ds-chrome")
      || node.matches?.('main, [role="main"], dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [role="tooltip"]');
  }

  function rightDockedPanel(node, mainRect) {
    if (isExcludedSidebarCandidate(node) || !visible(node)) return false;
    const rect = measuredRect(node);
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const rightEdgePass = Math.abs(rect.right - viewportWidth) <= 12;
    const heightPass = rect.height >= Math.max(240, viewportHeight * 0.35);
    const sidePass = !mainRect
      || rect.left >= mainRect.left + mainRect.width * 0.62;
    return rightEdgePass && heightPass && sidePass;
  }

  function panelCenterHit(node) {
    const rect = measuredRect(node);
    if (!rect) return false;
    const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return Boolean(hit && (hit === node || node.contains(hit)));
  }

  function leftDockedSidebar(node, mainRect) {
    if (isExcludedSidebarCandidate(node)
      || node === nativeSidebarPanel
      || !visible(node)
      || rightDockedPanel(node, mainRect)) return false;
    const rect = measuredRect(node);
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const leftEdgePass = rect.left <= 12 && rect.right > 0;
    const heightPass = rect.height >= Math.max(240, viewportHeight * 0.35);
    return leftEdgePass && heightPass;
  }

  function visibleInteractiveCount(node) {
    return [...node.querySelectorAll('button, a, [role="button"]')]
      .filter((candidate) => visible(candidate) && !ownedNodes.has(candidate))
      .length;
  }

  function sidebarDetectionResult(stateName, confidence, anchorKind, panel, toggle) {
    return {
      state: stateName,
      confidence,
      anchorKind,
      panel,
      panelRect: panel ? measuredRect(panel) : null,
      toggle,
    };
  }

  function detectNativeRightSidebar() {
    const toggle = findNativeToggle(nativeSidebarTogglePattern, "sidebar");
    if (!toggle) return sidebarDetectionResult("unknown", "none", "none", null, null);

    const mainRect = measuredRect(findMain());
    const toggleState = nativeToggleState(toggle);
    const expanded = toggleState === "open" ? "true" : toggleState === "closed" ? "false" : null;
    const controlledIds = (toggle.getAttribute("aria-controls") || "").trim().split(/\s+/u).filter(Boolean);
    const controlledPanels = controlledIds.map((id) => document.getElementById(id)).filter(Boolean);
    if (controlledPanels.length) {
      const dockedControlled = controlledPanels.filter((panel) => rightDockedPanel(panel, mainRect));
      if (dockedControlled.length === 1) {
        if (!panelCenterHit(dockedControlled[0])) {
          return sidebarDetectionResult("unknown", "none", "aria-controls", null, toggle);
        }
        if (expanded === "false") {
          return sidebarDetectionResult("unknown", "none", "aria-controls", null, toggle);
        }
        return sidebarDetectionResult("open", "high", "aria-controls", dockedControlled[0], toggle);
      }
      if (dockedControlled.length > 1) {
        return sidebarDetectionResult("unknown", "none", "aria-controls", null, toggle);
      }
      if (expanded === "false") {
        return sidebarDetectionResult("closed", "high", "aria-controls", null, toggle);
      }
      if (expanded === "true") {
        return sidebarDetectionResult("unknown", "none", "aria-controls", null, toggle);
      }
      return sidebarDetectionResult("closed", "high", "aria-controls", null, toggle);
    }
    if (controlledIds.length && expanded === "true") {
      return sidebarDetectionResult("unknown", "none", "aria-controls", null, toggle);
    }

    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const viewportHeight = window.visualViewport?.height || window.innerHeight;
    const semanticHits = new Map();
    const geometryHits = new Map();
    for (const yRatio of [0.25, 0.5, 0.75]) {
      const hit = document.elementFromPoint(viewportWidth - 6, viewportHeight * yRatio);
      let semanticPanel = null;
      for (let node = hit; node; node = node.parentElement) {
        if (node.matches?.('aside, [role="complementary"]') && rightDockedPanel(node, mainRect)) {
          semanticPanel = node;
          break;
        }
      }
      if (semanticPanel) {
        semanticHits.set(semanticPanel, (semanticHits.get(semanticPanel) || 0) + 1);
        continue;
      }
      for (let node = hit; node; node = node.parentElement) {
        if (!rightDockedPanel(node, mainRect) || visibleInteractiveCount(node) < 2) continue;
        geometryHits.set(node, (geometryHits.get(node) || 0) + 1);
        break;
      }
    }

    const semanticPanels = [...semanticHits.keys()];
    const geometryPanels = [...geometryHits.entries()]
      .filter(([, hitCount]) => hitCount >= 2)
      .map(([panel]) => panel);
    const hitPanels = [...new Set([...semanticPanels, ...geometryPanels])];
    if (hitPanels.length === 1) {
      if (expanded === "false") {
        return sidebarDetectionResult("unknown", "none", "right-edge-hit", null, toggle);
      }
      return sidebarDetectionResult("open", "high", "right-edge-hit", hitPanels[0], toggle);
    }
    if (hitPanels.length > 1 || expanded === "true") {
      return sidebarDetectionResult("unknown", "none", "none", null, toggle);
    }
    return sidebarDetectionResult("closed", "high", "none", null, toggle);
  }

  function nearestCommonAncestor(first, second, panel) {
    const firstAncestors = new Set();
    for (let node = first.parentElement; node && panel.contains(node); node = node.parentElement) {
      firstAncestors.add(node);
      if (node === panel) break;
    }
    for (let node = second.parentElement; node && panel.contains(node); node = node.parentElement) {
      if (firstAncestors.has(node)) return node;
      if (node === panel) break;
    }
    return null;
  }

  function detectNativeLeftSidebar() {
    const mainRect = measuredRect(findMain());
    return [...document.querySelectorAll('[data-testid="sidebar"], [data-slot="sidebar"], aside, nav')]
      .find((candidate) => leftDockedSidebar(candidate, mainRect))
      || null;
  }

  function syncNativeLeftSidebar() {
    const nextPanel = detectNativeLeftSidebar();
    if (nativeLeftSidebarPanel !== nextPanel) {
      syncClass(nativeLeftSidebarPanel, "denia-old-days-ds-native-left-sidebar", false);
      nativeLeftSidebarPanel = nextPanel
        ? touch(nextPanel, "denia-old-days-ds-native-left-sidebar")
        : null;
      return;
    }
    if (nextPanel && !nextPanel.classList.contains("denia-old-days-ds-native-left-sidebar")) {
      touch(nextPanel, "denia-old-days-ds-native-left-sidebar");
    }
  }

  function clearNativeRightSidebarClasses() {
    syncClass(nativeSidebarPanel, "denia-old-days-ds-native-right-sidebar", false);
    for (const group of nativeSidebarGroups) syncClass(group, "denia-old-days-ds-native-sidebar-group", false);
    for (const row of nativeSidebarRows) syncClass(row, "denia-old-days-ds-native-sidebar-row", false);
    nativeSidebarPanel = null;
    nativeSidebarGroups.clear();
    nativeSidebarRows.clear();
  }

  function syncNativeSidebarPanel(nextPanel) {
    if (nativeSidebarPanel !== nextPanel) {
      syncClass(nativeSidebarPanel, "denia-old-days-ds-native-right-sidebar", false);
      nativeSidebarPanel = nextPanel
        ? touch(nextPanel, "denia-old-days-ds-native-right-sidebar")
        : null;
      return;
    }
    if (nextPanel && !nextPanel.classList.contains("denia-old-days-ds-native-right-sidebar")) {
      touch(nextPanel, "denia-old-days-ds-native-right-sidebar");
    }
  }

  function syncNativeSidebarClassSet(currentNodes, nextNodes, className) {
    for (const node of currentNodes) {
      if (!nextNodes.has(node)) syncClass(node, className, false);
    }
    for (const node of nextNodes) {
      if (!currentNodes.has(node) || !node.classList.contains(className)) touch(node, className);
    }
    currentNodes.clear();
    for (const node of nextNodes) currentNodes.add(node);
  }

  function syncTaskLayoutMetrics() {
    const main = findMain();
    const threadScroll = main?.querySelector?.(".thread-scroll-container");
    const mainRect = measuredRect(main);
    const threadScrollRect = measuredRect(threadScroll);
    const threadClientWidth = Number(threadScroll?.clientWidth);
    if (!mainRect
      || !threadScrollRect
      || !Number.isFinite(threadClientWidth)
      || threadClientWidth <= 0) return;
    const viewportWidth = window.visualViewport?.width || window.innerWidth;
    const scrollbarGutter = Math.max(0, threadScrollRect.width - threadClientWidth);
    const fullContentWidth = Math.max(0, viewportWidth - mainRect.left - scrollbarGutter);
    const roundedWidth = Math.round(fullContentWidth * 1000) / 1000;
    root.style.setProperty("--denia-thread-content-width", `${roundedWidth}px`);
  }

  function syncNativeRightSidebar(home) {
    const result = detectNativeRightSidebar();
    const toggleState = result.toggle ? nativeToggleState(result.toggle) : "unknown";
    let nextPanel = null;
    const nextGroups = new Set();
    const nextRows = new Set();
    if (result.state === "open" && result.confidence === "high" && result.panel && result.panelRect) {
      const { panel, panelRect } = result;
      root.style.setProperty("--denia-native-sidebar-width", `${panelRect.width}px`);
      nextPanel = panel;
      const rowCandidates = [...panel.querySelectorAll('button, a, [role="button"]')].filter((node) => {
        if (!visible(node) || ownedNodes.has(node)) return false;
        const rect = measuredRect(node);
        return rect.width >= Math.min(160, panelRect.width * 0.55)
          && rect.height >= 20
          && rect.height <= 64
          && rect.y >= panelRect.y + 44;
      });
      for (const row of rowCandidates) nextRows.add(row);
      for (let firstIndex = 0; firstIndex < rowCandidates.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < rowCandidates.length; secondIndex += 1) {
          const group = nearestCommonAncestor(rowCandidates[firstIndex], rowCandidates[secondIndex], panel);
          const groupRect = measuredRect(group);
          if (!group
            || group === panel
            || !visible(group)
            || groupRect.width < panelRect.width * 0.6
            || ownedNodes.has(group)
            || group.closest?.("#denia-old-days-ds-chrome")
            || group.closest?.('webview, [role="tabpanel"], dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [popover], [role="status"], [data-testid*="toast"]')) continue;
          nextGroups.add(group);
        }
      }
    }
    syncNativeSidebarPanel(nextPanel);
    syncNativeSidebarClassSet(
      nativeSidebarGroups,
      nextGroups,
      "denia-old-days-ds-native-sidebar-group",
    );
    syncNativeSidebarClassSet(
      nativeSidebarRows,
      nextRows,
      "denia-old-days-ds-native-sidebar-row",
    );
    state.sidebar = {
      state: result.state,
      confidence: result.confidence,
      anchorKind: result.anchorKind,
      panelVisible: result.state === "open",
      skinApplied: result.state === "open" && Boolean(result.panel),
      groupCount: nativeSidebarGroups.size,
      rowCount: nativeSidebarRows.size,
      togglePresent: Boolean(result.toggle),
      toggleState,
    };
    setDatasetValue(root, "deniaSidebarState", result.state);
    setDatasetValue(root, "deniaSidebarConfidence", result.confidence);
    setDatasetValue(root, "deniaSidebarToggleState", toggleState);
    void home;
  }

  function syncNativeWorkSurfaces() {
    const summaryToggle = findNativeToggle(nativeSummaryTogglePattern, "summary");
    const bottomPanelToggle = findNativeToggle(nativeBottomPanelTogglePattern, "bottom");
    const summary = nativeToggleState(summaryToggle);
    const bottomPanel = nativeToggleState(bottomPanelToggle);
    const sidebarObscures = Boolean(state.sidebar?.togglePresent)
      && state.sidebar.state !== "closed";
    const workSurface = summary === "open"
      || sidebarObscures
      ? "open"
      : "closed";
    state.workSurfaces = {
      summary,
      bottomPanel,
      rightSidebar: state.sidebar?.state || "closed",
      open: workSurface === "open",
    };
    setDatasetValue(root, "deniaSummaryState", summary);
    setDatasetValue(root, "deniaBottomPanelState", bottomPanel);
    setDatasetValue(root, "deniaWorkSurfaceState", workSurface);
  }

  function findMain() {
    return document.querySelector('[role="main"]') || document.querySelector("main");
  }

  function composerSemanticallyValid(composer) {
    if (!composer?.isConnected) return false;
    if (composer.matches?.(".composer-surface-chrome")) return layoutVisible(composer);
    if (!composer.matches?.("form")) return false;
    const input = [...composer.querySelectorAll('textarea, [contenteditable="true"]')]
      .find((candidate) =>
        !candidate.closest('.xterm, [id^="terminal-panel-"], [role="tabpanel"], dialog, [role="dialog"], aside, nav'));
    return Boolean(input);
  }

  function invalidateComposerCache() {
    const composer = cachedComposer;
    cachedComposer = null;
    if (!composer || composerSemanticallyValid(composer)) return;
    syncClass(composer, "denia-old-days-ds-composer", false);
    for (const button of composer.querySelectorAll?.("button") || []) {
      syncClass(button, "denia-old-days-ds-send", false);
      syncClass(button, "denia-old-days-ds-attachment", false);
    }
  }

  function findComposer() {
    if (composerSemanticallyValid(cachedComposer)) return cachedComposer;
    const nativeComposer = [...document.querySelectorAll(".composer-surface-chrome")]
      .find(layoutVisible);
    if (nativeComposer) {
      cachedComposer = nativeComposer;
      return cachedComposer;
    }
    const input = [...document.querySelectorAll('textarea, [contenteditable="true"]')]
      .find((candidate) =>
        !candidate.closest('.xterm, [id^="terminal-panel-"], [role="tabpanel"], dialog, [role="dialog"], aside, nav')
        && Boolean(candidate.closest("form")));
    cachedComposer = input?.closest("form") || null;
    return cachedComposer;
  }

  function clearNativeHomeSuggestions() {
    for (const target of nativeHomeSuggestionTargets) {
      syncClass(target, "denia-old-days-ds-native-home-suggestions", false);
    }
    nativeHomeSuggestionTargets.clear();
  }

  function findHomeSuggestionActions() {
    const main = findMain();
    if (!main) return [];
    const title = findNativeHomeTitle();
    const patterns = [
      /explore|understand|探索|理解|解释|翻阅/iu,
      /build|implement|feature|构建|实现|新功能|应用|工具/iu,
      /review|suggest changes|审查|修改建议|校对/iu,
      /fix|debug|修复|失败|问题|故障/iu,
    ];
    const managed = (button) => [...nativeHomeSuggestionTargets]
      .some((target) => target === button || target.contains?.(button));
    const candidates = [...main.querySelectorAll("button")].filter((button) => {
      if (isOwnedSubtree(button) || button.closest("aside, nav, .composer-surface-chrome")) return false;
      if (title?.contains(button)) return false;
      const text = (button.innerText || button.textContent || "").replace(/\s+/gu, " ").trim();
      return text.length > 2
        && text.length < 180
        && (managed(button) || layoutVisible(button))
        && patterns.some((pattern) => pattern.test(text));
    }).sort((first, second) =>
      Number(managed(second)) - Number(managed(first))
      || Number(layoutVisible(second)) - Number(layoutVisible(first)));
    const actions = [];
    for (const pattern of patterns) {
      const action = candidates.find((candidate) =>
        !actions.includes(candidate)
        && pattern.test((candidate.innerText || candidate.textContent || "").trim()));
      if (!action) return [];
      actions.push(action);
    }
    return actions;
  }

  function syncNativeHomeSuggestions() {
    const actions = findHomeSuggestionActions();
    if (actions.length !== 4) {
      clearNativeHomeSuggestions();
      return [];
    }
    const main = findMain();
    const title = findNativeHomeTitle();
    const composer = findComposer();
    const commonParent = actions[0].parentElement;
    const safeCommonParent = commonParent
      && commonParent !== main
      && actions.every((action) => action.parentElement === commonParent)
      && !commonParent.contains(title)
      && !commonParent.contains(composer);
    const nextTargets = new Set(safeCommonParent ? [commonParent] : actions);
    for (const target of nativeHomeSuggestionTargets) {
      if (!nextTargets.has(target)) {
        syncClass(target, "denia-old-days-ds-native-home-suggestions", false);
      }
    }
    nativeHomeSuggestionTargets.clear();
    for (const target of nextTargets) {
      nativeHomeSuggestionTargets.add(touch(target, "denia-old-days-ds-native-home-suggestions"));
    }
    return actions;
  }

  function clearNativeHomePrompt() {
    syncClass(nativeHomePrompt, "denia-old-days-ds-native-home-prompt", false);
    removeStyleProperty(nativeHomePrompt, nativeHomePromptShiftProperty);
    nativeHomePrompt = null;
  }

  function syncNativeHomePromptPosition(prompt, title) {
    const heroRect = measuredRect(document.getElementById("denia-old-days-ds-hero-copy"));
    const titleRect = measuredRect(title);
    const composer = document.querySelector(".composer-surface-chrome");
    let composerBoundary = composer;
    for (let current = composer; current && current !== findMain(); current = current.parentElement) {
      const computed = getComputedStyle(current);
      const zIndex = Number.parseFloat(computed.zIndex);
      if (computed.position !== "static" && Number.isFinite(zIndex) && zIndex > 0) {
        composerBoundary = current;
      }
    }
    const composerRect = measuredRect(composerBoundary);
    if (!heroRect || !titleRect || !composerRect) {
      removeStyleProperty(prompt, nativeHomePromptShiftProperty);
      return;
    }

    const currentShift = Number.parseFloat(prompt.style.getPropertyValue(nativeHomePromptShiftProperty)) || 0;
    const naturalTop = titleRect.top - currentShift;
    const minimumTop = heroRect.bottom + 16;
    const inputAlignedTop = composerRect.top - titleRect.height - 24;
    const shift = Math.max(0, Math.round(Math.max(minimumTop, inputAlignedTop) - naturalTop));
    setStyleProperty(prompt, nativeHomePromptShiftProperty, `${shift}px`);
  }

  function findNativeHomeTitle() {
    const promptPattern = /(?:what should we build in|what would you like to build|我们该构建什么|想在.+中构建什么|要在.+中构建什么)/iu;
    return [...document.querySelectorAll("span, h1, h2, h3, [role='heading']")]
      .find((node) => {
        if (isOwnedSubtree(node)) return false;
        const directText = [...node.childNodes]
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent || "")
          .join(" ")
          .replace(/\s+/gu, " ")
        .trim();
        return promptPattern.test(directText);
      }) || null;
  }

  function syncNativeHomePrompt() {
    const title = findNativeHomeTitle();
    if (!title) {
      clearNativeHomePrompt();
      return null;
    }

    const titleText = normalizedNodeLabel(title);
    let prompt = title;
    while (prompt.parentElement
      && normalizedNodeLabel(prompt.parentElement) === titleText) {
      prompt = prompt.parentElement;
    }
    if (nativeHomePrompt && nativeHomePrompt !== prompt) clearNativeHomePrompt();
    nativeHomePrompt = touch(prompt, "denia-old-days-ds-native-home-prompt");
    syncNativeHomePromptPosition(nativeHomePrompt, title);
    return nativeHomePrompt;
  }

  function isHomeView() {
    const main = findMain();
    if (!main) return false;
    if (main.matches(".dream-skin-home, .dream-skin-home-shell")
      || main.querySelector(".dream-skin-home")) return true;
    const assistants = main.querySelectorAll(assistantSelector);
    return assistants.length === 0 && Boolean(findNativeHomeTitle());
  }

  function isHomePaintReady() {
    const main = findMain();
    return Boolean(main
      && (main.matches(".dream-skin-home, .dream-skin-home-shell")
        || main.querySelector(".dream-skin-home")));
  }

  function clearHomeViewportBinding() {
    state.homeScrollMain = null;
  }

  function syncHomeViewport(main) {
    if (!main || !state.homeActive) return;
    state.homeScrollMain = main;
    if (main.scrollTop !== 0) main.scrollTop = 0;
  }

  function ensureChrome() {
    const host = state.homeActive ? document.body : findMain();
    let chrome = taskChrome || document.getElementById("denia-old-days-ds-chrome");
    if (!chrome) {
      chrome = own(document.createElement("div"));
      chrome.id = "denia-old-days-ds-chrome";
      chrome.className = "denia-old-days-ds-chrome";
      chrome.setAttribute("aria-hidden", "true");
    }
    taskChrome = chrome;
    if (host && chrome.parentElement !== host) host.append(chrome);
    if (!host && document.body.contains(chrome)) chrome.remove();
    ensureStateArt(chrome);
    return chrome;
  }

  function ensureStateArt(chrome) {
    let rail = chrome.querySelector("#denia-old-days-ds-state-art")
      || document.getElementById("denia-old-days-ds-state-art");
    if (rail && !chrome.contains(rail)) rail.remove();
    if (!rail || !chrome.contains(rail)) {
      rail = document.createElement("div");
      rail.id = "denia-old-days-ds-state-art";
      rail.className = "denia-old-days-ds-state-art";
      rail.setAttribute("aria-hidden", "true");

      const current = document.createElement("span");
      current.className = "denia-old-days-ds-state-art-layer denia-old-days-ds-state-art-current";
      const next = document.createElement("span");
      next.className = "denia-old-days-ds-state-art-layer denia-old-days-ds-state-art-next";
      const tint = document.createElement("span");
      tint.className = "denia-old-days-ds-state-art-tint";
      rail.append(current, next, tint);
      chrome.append(rail);

      for (const layer of [current, next]) {
        on(layer, "transitionend", (event) => {
          if (event.propertyName && event.propertyName !== "opacity") return;
          if (layer === state.artCurrent || !layer.classList.contains("is-leaving")) return;
          clearStateArtLayer(layer);
        });
      }
    }

    if (!state.artCurrent || !rail.contains(state.artCurrent)) {
      const current = rail.querySelector(".denia-old-days-ds-state-art-current");
      const next = rail.querySelector(".denia-old-days-ds-state-art-next");
      const active = rail.querySelector(".denia-old-days-ds-state-art-layer.is-active");
      state.artCurrent = active || current;
      state.artNext = state.artCurrent === current ? next : current;
      state.artFamily = active?.dataset.deniaArtFamily || "";
    }
    return rail;
  }

  function clearStateArtLayer(layer) {
    if (!layer) return;
    syncClass(layer, "is-active", false);
    syncClass(layer, "is-leaving", false);
    removeDatasetValue(layer, "deniaArtFamily");
    removeDatasetValue(layer, "deniaArtGeneration");
    removeStyleProperty(layer, "--denia-state-art-opacity");
  }

  function configureStateArtLayer(layer, spec, generation) {
    clearStateArtLayer(layer);
    setDatasetValue(layer, "deniaArtFamily", spec.family);
    setDatasetValue(layer, "deniaArtGeneration", String(generation));
    setStyleProperty(layer, "--denia-state-art-opacity", spec.opacity);
  }

  function syncStateArt(formState) {
    const spec = stateArtSpecs[formState] || stateArtSpecs.staged;
    const rail = ensureStateArt(ensureChrome());
    setDatasetValue(rail, "deniaArtState", formState);

    if (!state.artFamily) {
      state.artGeneration += 1;
      configureStateArtLayer(state.artCurrent, spec, state.artGeneration);
      syncClass(state.artCurrent, "is-active", true);
      state.artFamily = spec.family;
      return;
    }

    if (state.artFamily === spec.family) {
      setStyleProperty(state.artCurrent, "--denia-state-art-opacity", spec.opacity);
      syncClass(state.artCurrent, "is-leaving", false);
      syncClass(state.artCurrent, "is-active", true);
      return;
    }

    state.artGeneration += 1;
    const outgoing = state.artCurrent;
    const incoming = state.artNext;
    configureStateArtLayer(incoming, spec, state.artGeneration);
    incoming.getBoundingClientRect();

    if (state.reducedMotion) {
      clearStateArtLayer(outgoing);
      syncClass(incoming, "is-active", true);
    } else {
      syncClass(outgoing, "is-active", false);
      syncClass(outgoing, "is-leaving", true);
      syncClass(incoming, "is-active", true);
    }

    state.artCurrent = incoming;
    state.artNext = outgoing;
    state.artFamily = spec.family;
  }

  function ensureHomeVisuals() {
    let visuals = document.getElementById("denia-old-days-ds-home-visuals");
    if (visuals?.isConnected && visuals.parentElement === document.body) return visuals;
    if (visuals) {
      visuals.remove();
      ownedNodes.delete(visuals);
    }
    visuals = own(document.createElement("div"));
    visuals.id = "denia-old-days-ds-home-visuals";
    visuals.className = "denia-old-days-ds-home-visuals";
    document.body.append(visuals);
    return visuals;
  }

  function syncHomeVisualFrame(main) {
    const visuals = document.getElementById("denia-old-days-ds-home-visuals");
    const rect = measuredRect(main);
    if (!visuals || !rect) return;
    setStyleProperty(visuals, "--denia-home-visual-top", `${rect.top}px`);
    setStyleProperty(visuals, "--denia-home-visual-left", `${rect.left}px`);
    setStyleProperty(visuals, "--denia-home-visual-width", `${rect.width}px`);
    setStyleProperty(visuals, "--denia-home-visual-height", `${rect.height}px`);
  }

  function ensureHomeHero() {
    let hero = document.getElementById("denia-old-days-ds-hero-copy");
    const visuals = ensureHomeVisuals();
    if (!visuals) return null;
    if (hero?.isConnected) {
      if (hero.parentElement !== visuals) visuals.append(hero);
      return hero;
    }
    hero = own(document.createElement("section"));
    hero.id = "denia-old-days-ds-hero-copy";
    hero.className = "denia-old-days-ds-hero denia-old-days-ds-intro";
    hero.setAttribute("aria-labelledby", "denia-old-days-ds-headline");
    const themeCopy = nativeThemeCopy(root.dataset.deniaTheme);

    const copy = document.createElement("div");
    copy.className = "denia-old-days-ds-hero-text";
    const eyebrow = document.createElement("div");
    eyebrow.className = "denia-old-days-ds-eyebrow denia-old-days-ds-hero-eyebrow";
    eyebrow.textContent = themeCopy.eyebrow;
    const headline = document.createElement("h1");
    headline.id = "denia-old-days-ds-headline";
    headline.className = "denia-old-days-ds-hero-headline";
    headline.textContent = themeCopy.headline;
    const status = document.createElement("span");
    status.className = "denia-old-days-ds-status denia-old-days-ds-hero-status";
    status.textContent = themeCopy.status;
    copy.append(eyebrow, headline, status);

    const photo = document.createElement("div");
    photo.className = "denia-old-days-ds-photo";
    photo.setAttribute("aria-hidden", "true");
    photo.innerHTML = '<span class="denia-old-days-ds-photo-front"></span>';
    const bubbles = document.createElement("span");
    bubbles.className = "denia-old-days-ds-memory-bubbles";
    bubbles.setAttribute("aria-hidden", "true");
    bubbles.innerHTML = "<i></i><i></i><i></i>";
    hero.append(copy, photo, bubbles);

    visuals.append(hero);
    return hero;
  }

  function decorateComposer() {
    const composer = findComposer();
    if (!composer) return null;
    touch(composer, "denia-old-days-ds-composer");
    const buttons = [...composer.querySelectorAll("button")];
    for (const button of buttons) {
      const label = `${button.getAttribute("aria-label") || ""} ${button.title || ""}`;
      if (/send|submit|发送|提交/iu.test(label)) touch(button, "denia-old-days-ds-send");
      if (/attach|upload|file|附件|上传|文件/iu.test(label)) touch(button, "denia-old-days-ds-attachment");
    }
    return composer;
  }

  function nativeTurnState() {
    const main = findMain();
    const latestAssistant = main ? [...main.querySelectorAll(assistantSelector)].at(-1) : null;
    const turnNode = latestAssistant?.closest("[data-turn-key]")
      || (main ? [...main.querySelectorAll("[data-turn-key]")].at(-1) : null);
    const fiberKey = turnNode && Object.keys(turnNode).find((key) => key.startsWith("__reactFiber$"));
    let fiber = fiberKey ? turnNode[fiberKey] : null;
    let turn = null;
    for (let depth = 0; fiber && depth < 8 && !turn; depth += 1, fiber = fiber.return) {
      const props = fiber.memoizedProps;
      turn = [props?.entry?.turn, props?.turn, props?.mcpTurn]
        .find((candidate) => candidate && typeof candidate === "object" && candidate.status != null) || null;
    }
    if (!turn) return null;
    const normalizeStatus = (value) => String(value || "").replace(/[\s_-]+/gu, "").toLowerCase();
    const status = normalizeStatus(turn.status);
    const running = ["inprogress", "pending", "running"].includes(status);
    return {
      running,
      terminal: !running && ["completed", "failed", "error", "interrupted", "cancelled", "canceled"].includes(status),
      failed: !running && (
        ["failed", "error", "interrupted", "cancelled", "canceled"].includes(status)
        || Boolean(turn.error)
      ),
    };
  }

  function errorVisible(turnState) {
    const stableMarkers = document.querySelectorAll('[data-state="error"], [data-status="error"], [data-testid*="error"]');
    if ([...stableMarkers].some(visible)) return true;
    if ([...document.querySelectorAll('[role="alert"]')]
      .some((node) => visible(node) && /error|failed|failure|错误|失败/iu.test(node.textContent || node.getAttribute("aria-label") || ""))) return true;
    return turnState?.failed === true;
  }

  function approvalVisible() {
    const stableMarkers = document.querySelectorAll([
      '[data-state*="approval"]',
      '[data-status*="approval"]',
      '[data-state*="permission"]',
      '[data-status*="permission"]',
      '[data-testid*="approval"]',
      '[data-testid*="permission"]',
    ].join(","));
    if ([...stableMarkers].some(visible)) return true;
    const approvalAction = [...document.querySelectorAll("button")].find((button) => {
      if (!visible(button)) return false;
      const text = (button.innerText || button.textContent || button.getAttribute("aria-label") || "")
        .replace(/\s+/gu, " ")
        .trim();
      return /^(allow once|always allow|允许一次|始终允许)$/iu.test(text);
    });
    if (approvalAction) return true;
    return [...document.querySelectorAll('[role="dialog"], [role="alertdialog"]')]
      .some((node) => visible(node) && /approve|allow|confirm|review changes|批准|允许|确认|审阅更改/iu.test(node.textContent || node.getAttribute("aria-label") || ""));
  }

  function workingVisible(turnState) {
    if (turnState?.running) return true;
    const statusNode = document.querySelector('[aria-busy="true"], [data-state="loading"], [data-status="running"], [role="progressbar"]');
    if (statusNode && visible(statusNode)) return true;
    return [...document.querySelectorAll("button")]
      .some((button) => visible(button) && /^(stop|cancel|停止|取消)/iu.test((button.textContent || button.getAttribute("aria-label") || "").trim()));
  }

  function deriveFormState() {
    const turnState = nativeTurnState();
    if (errorVisible(turnState)) return "error";
    if (approvalVisible()) return "approval";
    if (workingVisible(turnState)) return "working";
    if (turnState?.terminal) return "complete";
    if (findMain()?.querySelector(assistantSelector)) return "complete";
    return "staged";
  }

  function decorateTaskRoots(roots) {
    const main = findMain();
    if (!main) return;
    for (const decorationRoot of roots) {
      if (!decorationRoot?.isConnected
        || (decorationRoot !== main && !main.contains(decorationRoot))) continue;
      if (decorationRoot?.matches?.(observationSelector)) {
        touch(decorationRoot, "denia-old-days-ds-observation");
        setDatasetValue(decorationRoot, "deniaObservationLabel", "观察记录");
      }
      for (const node of decorationRoot?.querySelectorAll?.(observationSelector) || []) {
        touch(node, "denia-old-days-ds-observation");
        setDatasetValue(node, "deniaObservationLabel", "观察记录");
      }
    }
  }

  function syncFinalAssistantCard() {
    const main = findMain();
    const assistants = main ? [...main.querySelectorAll(assistantSelector)] : [];
    const nextCard = state.formState === "complete" ? assistants.at(-1) || null : null;
    if (state.finalAssistantCard && state.finalAssistantCard !== nextCard) {
      syncClass(state.finalAssistantCard, "denia-old-days-ds-final-card", false);
    }
    if (nextCard) {
      syncClass(nextCard, "denia-old-days-ds-final-card", true);
      touchedNodes.add(nextCard);
    }
    state.finalAssistantCard = nextCard;
  }

  function removeHomeNodes() {
    clearNativeHomeSuggestions();
    clearNativeHomePrompt();
    for (const id of [
      "denia-old-days-ds-hero-copy",
      "denia-old-days-ds-home-visuals",
    ]) {
      const node = document.getElementById(id);
      if (!node) continue;
      node.remove();
      ownedNodes.delete(node);
    }
  }

  function syncPageDomain(home) {
    if (home) {
      state.formState = "staged";
      ensureHomeHero();
      syncNativeHomeSuggestions();
      syncNativeHomePrompt();
      syncHomeVisualFrame(findMain());
      syncHomeViewport(findMain());
    } else {
      clearHomeViewportBinding();
      removeHomeNodes();
      state.formState = deriveFormState();
    }
    setDatasetValue(root, "deniaFormState", state.formState);
  }

  function runRefresh(mask, decorationRoots) {
    const refreshStartedAt = globalThis.performance?.now?.() ?? Date.now();
    try {
      state.metrics.refreshes += 1;
      let currentMask = mask;
      if (currentMask & DIRTY.ROUTE) {
        state.metrics.domainRuns.route += 1;
        const home = isHomeView();
        const routeChanged = state.homeActive !== home;
        state.homeActive = home;
        syncClass(root, "denia-old-days-ds-home", home);
        syncClass(root, "denia-old-days-ds-task", !home);
        if (routeChanged) {
          currentMask |= DIRTY.ALL & ~DIRTY.ROUTE;
          decorationRoots.add(findMain() || document.body);
        }
      }
      if (currentMask & DIRTY.COMPOSER) {
        state.metrics.domainRuns.composer += 1;
        decorateComposer();
      }
      if (currentMask & DIRTY.SIDEBAR) {
        state.metrics.domainRuns.sidebar += 1;
        syncNativeLeftSidebar();
        syncNativeRightSidebar(state.homeActive);
      }
      if (currentMask & DIRTY.LAYOUT) {
        state.metrics.domainRuns.layout += 1;
        syncTaskLayoutMetrics();
        if (state.homeActive) {
          syncHomeVisualFrame(findMain());
          syncHomeViewport(findMain());
        }
      }
      if (currentMask & DIRTY.WORK_SURFACES) {
        state.metrics.domainRuns.workSurfaces += 1;
        syncNativeWorkSurfaces();
      }
      if (state.homeActive && (currentMask & DIRTY.HOME)) {
        state.metrics.domainRuns.home += 1;
        syncPageDomain(true);
      } else if (!state.homeActive && (currentMask & DIRTY.TASK_STATE)) {
        state.metrics.domainRuns.taskState += 1;
        syncPageDomain(false);
      }
      if (!state.homeActive && (currentMask & DIRTY.TASK_DECORATION)) {
        state.metrics.domainRuns.taskDecoration += 1;
        decorateTaskRoots(decorationRoots);
      }
      if (currentMask & DIRTY.TASK_STATE) {
        syncFinalAssistantCard();
      }
      if (currentMask & DIRTY.ART) {
        state.metrics.domainRuns.art += 1;
        syncStateArt(state.formState);
      }
    } finally {
      const refreshFinishedAt = globalThis.performance?.now?.() ?? Date.now();
      state.metrics.lastRefreshDurationMs = Math.max(0, refreshFinishedAt - refreshStartedAt);
    }
  }

  function refresh() {
    runRefresh(DIRTY.ALL, new Set([findMain() || document.body]));
  }

  function addPendingRoots(target, decorationRoots) {
    for (const decorationRoot of decorationRoots || []) {
      if (decorationRoot?.querySelectorAll) target.add(decorationRoot);
    }
  }

  function scheduleRefresh(mask = DIRTY.ALL, decorationRoots = []) {
    if (state.styleRefreshTimer) {
      state.pendingStyleDirty |= mask;
      addPendingRoots(state.pendingStyleDecorationRoots, decorationRoots);
      return;
    }
    state.pendingDirty |= mask;
    addPendingRoots(state.pendingDecorationRoots, decorationRoots);
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      const pendingMask = state.pendingDirty;
      const pendingRoots = new Set(state.pendingDecorationRoots);
      state.pendingDirty = 0;
      state.pendingDecorationRoots.clear();
      runRefresh(pendingMask, pendingRoots);
    });
  }

  function cancelStyleRefresh() {
    if (!state.styleRefreshTimer) return;
    clearTimeout(state.styleRefreshTimer);
    state.styleRefreshTimer = 0;
  }

  function scheduleStyleRefresh(mask = STYLE_DIRTY, decorationRoots = []) {
    state.pendingStyleDirty |= mask;
    addPendingRoots(state.pendingStyleDecorationRoots, decorationRoots);
    cancelStyleRefresh();
    state.styleRefreshTimer = setTimeout(() => {
      state.styleRefreshTimer = 0;
      const pendingMask = state.pendingStyleDirty;
      const pendingRoots = new Set(state.pendingStyleDecorationRoots);
      state.pendingStyleDirty = 0;
      state.pendingStyleDecorationRoots.clear();
      scheduleRefresh(pendingMask, pendingRoots);
    }, 80);
  }

  function changedClassTokens(record) {
    const oldTokens = new Set((record.oldValue || "").split(/\s+/u).filter(Boolean));
    const currentClass = record.target.getAttribute?.("class") || "";
    const currentTokens = new Set(currentClass.split(/\s+/u).filter(Boolean));
    return new Set([
      ...[...oldTokens].filter((token) => !currentTokens.has(token)),
      ...[...currentTokens].filter((token) => !oldTokens.has(token)),
    ]);
  }

  function extensionClassDeltaOnly(record) {
    const changedTokens = changedClassTokens(record);
    return [...changedTokens].every((token) => token.startsWith("denia-old-days-ds-"));
  }

  function mutationIsThemeOnly(record) {
    if (isOwnedSubtree(record.target)) return true;
    if (record.type === "attributes") {
      return record.attributeName === "class" && extensionClassDeltaOnly(record);
    }
    if (record.type === "childList") {
      return [...record.addedNodes, ...record.removedNodes].every(isOwnedRecordNode);
    }
    return false;
  }

  function hostThemeClassDelta(record) {
    if (record.type !== "attributes"
      || record.target !== root
      || record.attributeName !== "class") return null;
    return changedClassTokens(record);
  }

  function mutationTouchesHostTheme(record) {
    const changedTokens = hostThemeClassDelta(record);
    return Boolean(changedTokens
      && [...changedTokens].some((token) =>
        token === "electron-dark" || token === "electron-light"));
  }

  function mutationIsHostThemeOnly(record) {
    const changedTokens = hostThemeClassDelta(record);
    return Boolean(changedTokens
      && changedTokens.size > 0
      && [...changedTokens].every((token) =>
        token === "electron-dark" || token === "electron-light"));
  }

  function mutationIsTerminalChurn(record) {
    return Boolean(record.target?.closest?.('.xterm, [id^="terminal-panel-"]'));
  }

  function mutationIsEditorColorProbe(record) {
    if (record.type !== "childList" || record.target !== document.body) return false;
    const nodes = [...record.addedNodes, ...record.removedNodes];
    return nodes.length > 0 && nodes.every((node) =>
      node?.tagName === "DIV"
      && !node.id
      && !String(node.className || "").trim()
      && !String(node.textContent || "").trim()
      && node.children?.length === 0
      && node.style?.getPropertyValue("display") === "none"
      && node.style?.getPropertyValue("background-color") === "var(--color-token-editor-background)");
  }

  function mutationIsNativeSidebarToggleState(record) {
    return record.type === "attributes"
      && ["aria-expanded", "aria-pressed", "data-state"].includes(record.attributeName)
      && toggleKindForNode(record.target) === "sidebar";
  }

  function mutationIsNativeWorkSurfaceToggleState(record) {
    const kind = toggleKindForNode(record.target);
    return record.type === "attributes"
      && ["aria-expanded", "aria-pressed", "data-state"].includes(record.attributeName)
      && Boolean(kind)
      && cachedToggles.get(kind) === record.target;
  }

  function toggleKindForNode(node) {
    if (!node?.matches?.("button")) return null;
    const label = normalizedNodeLabel(node);
    if (nativeSidebarTogglePattern.test(label)) return "sidebar";
    if (nativeSummaryTogglePattern.test(label)) return "summary";
    if (nativeBottomPanelTogglePattern.test(label)) return "bottom";
    return null;
  }

  function cachedToggleKind(node) {
    for (const [kind, toggle] of cachedToggles) {
      if (toggle === node) return kind;
    }
    return null;
  }

  function toggleDirtyMask(kind) {
    return kind === "sidebar"
      ? DIRTY.SIDEBAR | DIRTY.LAYOUT | DIRTY.WORK_SURFACES
      : DIRTY.WORK_SURFACES;
  }

  function cachedToggleSemanticChange(record) {
    if (record.type !== "attributes") return null;
    const kind = cachedToggleKind(record.target);
    if (!kind
      || !["aria-label", "title", "aria-hidden", "hidden", "class", "style"]
        .includes(record.attributeName)) return null;
    invalidateToggleCache(kind);
    return kind;
  }

  function childListContainsToggle(record, kind) {
    if (record.type !== "childList") return false;
    const pattern = kind === "sidebar"
      ? nativeSidebarTogglePattern
      : kind === "summary"
        ? nativeSummaryTogglePattern
        : nativeBottomPanelTogglePattern;
    return [...record.addedNodes, ...record.removedNodes].some((node) => {
      if (node?.matches?.("button") && pattern.test(normalizedNodeLabel(node))) return true;
      return [...node?.querySelectorAll?.("button") || []]
        .some((button) => pattern.test(normalizedNodeLabel(button)));
    });
  }

  function childListContainsComposer(record) {
    if (record.type !== "childList") return false;
    const changedNodes = [...record.addedNodes, ...record.removedNodes];
    if (changedNodes.some((node) => {
      if (cachedComposer && (node === cachedComposer || node?.contains?.(cachedComposer))) return true;
      if (node?.matches?.(".composer-surface-chrome")) return true;
      return Boolean(node?.querySelector?.(".composer-surface-chrome"));
    })) return true;
    const directInputChanged = changedNodes.some((node) =>
      node?.matches?.('textarea, [contenteditable="true"]'));
    if (!directInputChanged) return false;
    return record.target === cachedComposer
      || Boolean(cachedComposer?.contains?.(record.target))
      || Boolean(record.target?.matches?.("form"));
  }

  function childListTouchesCachedToggle(record, kind) {
    const cached = cachedToggles.get(kind);
    return Boolean(cached && [...record.addedNodes, ...record.removedNodes]
      .some((node) => node === cached || node?.contains?.(cached)));
  }

  function childListTouchesKnownSidebar(record) {
    const sidebarToggle = cachedToggles.get("sidebar");
    const anchors = [
      nativeLeftSidebarPanel,
      nativeSidebarPanel,
      sidebarToggle,
    ].filter(Boolean);
    if (anchors.some((anchor) =>
      record.target === anchor
      || anchor.contains?.(record.target)
      || [...record.addedNodes, ...record.removedNodes]
        .some((node) => node === anchor || node?.contains?.(anchor)))) return true;
    const controlledIds = new Set(
      (sidebarToggle?.getAttribute?.("aria-controls") || "")
        .trim()
        .split(/\s+/u)
        .filter(Boolean),
    );
    if (!controlledIds.size) return false;
    return [...record.addedNodes, ...record.removedNodes].some((node) =>
      controlledIds.has(node?.id)
      || [...node?.querySelectorAll?.("[id]") || []]
        .some((candidate) => controlledIds.has(candidate.id)));
  }

  function childListReplacesMain(record, main) {
    if (record.type !== "childList") return false;
    return [...record.addedNodes, ...record.removedNodes].some((node) =>
      node === main
      || node?.contains?.(main)
      || node?.matches?.('main, [role="main"]')
      || node?.querySelector?.('main, [role="main"]'));
  }

  function attributeTouchesCachedComposer(record) {
    if (record.type !== "attributes"
      || !cachedComposer
      || ![
        "aria-hidden",
        "aria-label",
        "class",
        "contenteditable",
        "hidden",
        "role",
        "style",
        "title",
      ].includes(record.attributeName)) return false;
    return record.target === cachedComposer || cachedComposer.contains?.(record.target);
  }

  const taskStateActionPattern = /^(?:allow once|always allow|stop|cancel|允许一次|始终允许|停止|取消)$/iu;

  function hasButtonContext(candidate) {
    return candidate?.matches?.("button") || Boolean(candidate?.closest?.("button"));
  }

  function elementIsTaskStateContainer(candidate) {
    if (!candidate?.matches) return false;
    const semanticValue = [
      candidate.getAttribute?.("data-state"),
      candidate.getAttribute?.("data-status"),
      candidate.getAttribute?.("data-testid"),
    ].filter(Boolean).join(" ");
    const role = candidate.getAttribute?.("role") || "";
    return ["alert", "dialog", "alertdialog", "progressbar"].includes(role)
      || candidate.getAttribute?.("aria-busy") === "true"
      || /(?:error|failed|approval|permission|loading|running)/iu.test(semanticValue);
  }

  function elementHasTaskStateSemantics(candidate) {
    if (elementIsTaskStateContainer(candidate)) return true;
    const label = normalizedNodeLabel(candidate);
    return candidate.matches?.("button")
      && taskStateActionPattern.test(label);
  }

  function nodeCarriesTaskStateSemantics(node, mutationTarget = null) {
    if (hasButtonContext(mutationTarget)
      && taskStateActionPattern.test(normalizedNodeLabel(node))) return true;
    if (!node?.matches) return false;
    return [
      node,
      ...node.querySelectorAll?.([
        "[aria-busy]",
        "[data-state]",
        "[data-status]",
        "[data-testid]",
        '[role="alert"]',
        '[role="alertdialog"]',
        '[role="dialog"]',
        '[role="progressbar"]',
        "button",
      ].join(",")) || [],
    ].some(elementHasTaskStateSemantics);
  }

  function targetOrExternalAncestorHasTaskStateSemantics(target) {
    for (let current = target;
      current && current !== document.body && current !== root;
      current = current.parentElement) {
      if (elementIsTaskStateContainer(current)) return true;
    }
    return false;
  }

  function oldAttributeCarriesTaskStateSemantics(record) {
    const oldValue = String(record.oldValue || "").replace(/\s+/gu, " ").trim();
    if (!oldValue) return false;
    if (record.attributeName === "role") {
      return /^(?:alert|dialog|alertdialog|progressbar)$/iu.test(oldValue);
    }
    if (record.attributeName === "aria-busy") return oldValue.toLowerCase() === "true";
    if (["data-state", "data-status", "data-testid"].includes(record.attributeName)) {
      return /(?:error|failed|approval|permission|loading|running)/iu.test(oldValue);
    }
    if (!["aria-label", "title"].includes(record.attributeName)) return false;
    return /(?:error|failed|failure|approval|permission)/iu.test(oldValue)
      || (hasButtonContext(record.target) && taskStateActionPattern.test(oldValue));
  }

  function recordTouchesExternalTaskState(record, main) {
    if (state.homeActive
      || !main
      || record.target === main
      || main.contains(record.target)) return false;
    if (record.type === "childList") {
      return targetOrExternalAncestorHasTaskStateSemantics(record.target)
        || [...record.addedNodes, ...record.removedNodes]
        .some((node) => nodeCarriesTaskStateSemantics(node, record.target));
    }
    if (record.type !== "attributes") return false;
    if (nodeCarriesTaskStateSemantics(record.target)) return true;
    return oldAttributeCarriesTaskStateSemantics(record);
  }

  function classifySemanticRecord(record, main, decorationRoots) {
    let mask = 0;
    const insideTaskMain = !state.homeActive
      && main
      && (record.target === main || main.contains(record.target));
    const externalTaskState = recordTouchesExternalTaskState(record, main);
    if (record.type === "childList") {
      mask |= DIRTY.ROUTE;
      for (const kind of ["sidebar", "summary", "bottom"]) {
        if (childListTouchesCachedToggle(record, kind)
          || (!insideTaskMain && childListContainsToggle(record, kind))) {
          invalidateToggleCache(kind);
        }
      }
      if (insideTaskMain) {
        mask |= TASK_MUTATION_DIRTY;
        for (const node of record.addedNodes) {
          if (node?.querySelectorAll) decorationRoots.add(node);
        }
        if (childListContainsComposer(record)) {
          invalidateComposerCache();
          mask |= DIRTY.COMPOSER;
        }
        if (childListTouchesKnownSidebar(record)) {
          mask |= DIRTY.SIDEBAR | DIRTY.LAYOUT | DIRTY.WORK_SURFACES;
        }
      } else {
        if (childListContainsComposer(record)) invalidateComposerCache();
        mask |= STRUCTURE_DIRTY;
        if (state.homeActive) mask |= DIRTY.HOME;
        if (externalTaskState) mask |= DIRTY.TASK_STATE | DIRTY.ART;
        if (childListReplacesMain(record, main)) {
          mask |= DIRTY.TASK_STATE | DIRTY.TASK_DECORATION | DIRTY.ART;
          if (main?.isConnected) decorationRoots.add(main);
        }
      }
      return mask;
    }
    if (record.type !== "attributes") return mask;
    const toggleKind = cachedToggleSemanticChange(record);
    if (toggleKind) return toggleDirtyMask(toggleKind);
    if (attributeTouchesCachedComposer(record)) {
      invalidateComposerCache();
      mask |= DIRTY.COMPOSER;
    }
    if (insideTaskMain) {
      return mask | (record.attributeName === "style"
        ? DIRTY.TASK_STATE | DIRTY.ART
        : DIRTY.ROUTE | DIRTY.TASK_STATE | DIRTY.ART);
    }
    if (externalTaskState) mask |= DIRTY.TASK_STATE | DIRTY.ART;
    if (record.attributeName === "style") return mask | STYLE_DIRTY;
    return mask | STRUCTURE_DIRTY | (state.homeActive ? DIRTY.HOME : 0);
  }

  function on(target, name, handler) {
    target.addEventListener(name, handler);
    listeners.push([target, name, handler]);
  }

  function cleanup() {
    state.observer?.disconnect();
    if (state.frame) cancelAnimationFrame(state.frame);
    cancelStyleRefresh();
    state.pendingDirty = 0;
    state.pendingDecorationRoots.clear();
    state.pendingStyleDirty = 0;
    state.pendingStyleDecorationRoots.clear();
    state.finalAssistantCard = null;
    invalidateComposerCache();
    invalidateToggleCache();
    clearHomeViewportBinding();
    for (const [target, name, handler] of listeners) target.removeEventListener(name, handler);
    syncClass(nativeLeftSidebarPanel, "denia-old-days-ds-native-left-sidebar", false);
    nativeLeftSidebarPanel = null;
    clearNativeRightSidebarClasses();
    removeHomeNodes();
    for (const node of [...ownedNodes]) {
      node.remove();
      ownedNodes.delete(node);
    }
    taskChrome = null;
    for (const node of touchedNodes) {
      for (const className of removableClasses) node.classList?.remove(className);
      removeStyleProperty(node, nativeHomePromptShiftProperty);
      if (node.dataset) {
        delete node.dataset.deniaObservationLabel;
      }
    }
    style.remove();
    root.classList.remove(rootClass, "denia-old-days-ds-home", "denia-old-days-ds-task");
    delete root.dataset.deniaOldDaysExtensionVersion;
    delete root.dataset.deniaTheme;
    delete root.dataset.deniaFormState;
    delete root.dataset.deniaSidebarState;
    delete root.dataset.deniaSidebarConfidence;
    delete root.dataset.deniaSidebarToggleState;
    delete root.dataset.deniaSummaryState;
    delete root.dataset.deniaBottomPanelState;
    delete root.dataset.deniaWorkSurfaceState;
    root.style.removeProperty("--denia-native-sidebar-width");
    root.style.removeProperty("--denia-thread-content-width");
    for (const name of ["bright", "dark", "task-warm", "task-approval", "task-error", "task-complete"]) {
      root.style.removeProperty(`--denia-old-days-art-${name}`);
    }
    for (const artUrl of Object.values(artUrls)) URL.revokeObjectURL(artUrl);
    if (window[stateKey] === state) delete window[stateKey];
    return true;
  }

  const scheduleRouteRefresh = () => scheduleRefresh(DIRTY.ALL, [findMain() || document.body]);
  const scheduleResizeRefresh = () => scheduleRefresh(
    DIRTY.SIDEBAR
      | DIRTY.LAYOUT
      | DIRTY.WORK_SURFACES
      | (state.homeActive ? DIRTY.HOME : DIRTY.TASK_STATE),
  );
  on(window, "popstate", scheduleRouteRefresh);
  on(window, "hashchange", scheduleRouteRefresh);
  on(window, "resize", scheduleResizeRefresh);
  if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
    on(window.visualViewport, "resize", scheduleResizeRefresh);
  }
  if (typeof motionPreference.addEventListener === "function") {
    on(motionPreference, "change", (event) => {
      state.reducedMotion = event.matches;
      if (event.matches) {
        clearStateArtLayer(state.artNext);
        syncClass(state.artCurrent, "is-leaving", false);
        syncClass(state.artCurrent, "is-active", true);
      }
    });
  }
  const childListAddsButton = (record, main) => record.type === "childList"
    && Boolean(main)
    && (record.target === main
      || main.contains?.(record.target)
      || [...record.addedNodes].some((node) => node === main || node?.contains?.(main)))
    && [...record.addedNodes].some((node) =>
      node?.matches?.("button") || node?.querySelector?.("button"));
  state.observer = new MutationObserver((records) => {
    if (records.some(mutationTouchesHostTheme)) syncNativeTheme();
    const relevantRecords = records.filter((record) =>
      !mutationIsHostThemeOnly(record)
      && !mutationIsThemeOnly(record)
      && !mutationIsTerminalChurn(record)
      && !mutationIsEditorColorProbe(record));
    const darkHomePaintReady = relevantRecords.length
      && root.dataset.deniaTheme === "dark"
      && isHomePaintReady()
      && isHomeView();
    if (darkHomePaintReady) {
      const homeMain = findMain();
      if (!state.homeActive) {
        syncClass(root, "denia-old-days-ds-home", true);
        syncClass(root, "denia-old-days-ds-task", false);
      }
      if (!state.homeActive
        || relevantRecords.some((record) => childListAddsButton(record, homeMain))) {
        syncNativeHomeSuggestions();
      }
    }
    if (relevantRecords.length && state.homeActive && !isHomeView()) {
      syncClass(root, "denia-old-days-ds-home", false);
      syncClass(root, "denia-old-days-ds-task", true);
      removeHomeNodes();
    }
    const toggleRecords = relevantRecords.filter(mutationIsNativeWorkSurfaceToggleState);
    if (toggleRecords.length) {
      for (const record of toggleRecords) {
        invalidateToggleCache(toggleKindForNode(record.target));
      }
      if (toggleRecords.some(mutationIsNativeSidebarToggleState)) {
        syncNativeRightSidebar(state.homeActive);
      }
      syncNativeWorkSurfaces();
    }
    const refreshRecords = relevantRecords.filter((record) =>
      !mutationIsNativeWorkSurfaceToggleState(record));
    const main = findMain();
    const decorationRoots = new Set();
    let mask = 0;
    let hasStyleRefresh = false;
    let hasSemanticRefresh = false;
    for (const record of refreshRecords) {
      const recordMask = classifySemanticRecord(record, main, decorationRoots);
      mask |= recordMask;
      if (record.type === "attributes" && record.attributeName === "style") {
        hasStyleRefresh = true;
      } else {
        hasSemanticRefresh = true;
      }
    }
    const toggleMask = toggleRecords.length
      ? DIRTY.SIDEBAR | DIRTY.LAYOUT | DIRTY.WORK_SURFACES
      : 0;
    if (hasStyleRefresh || (hasSemanticRefresh && toggleRecords.length)) {
      scheduleStyleRefresh(mask | toggleMask, decorationRoots);
    } else if (hasSemanticRefresh) {
      scheduleRefresh(mask, decorationRoots);
    } else if (toggleRecords.length) {
      scheduleStyleRefresh(toggleMask);
    }
  });
  syncNativeTheme();
  state.observer.observe(root, {
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["class"],
  });
  state.observer.observe(document.body || root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [
      "aria-busy",
      "aria-controls",
      "aria-disabled",
      "aria-expanded",
      "aria-hidden",
      "aria-label",
      "aria-pressed",
      "title",
      "hidden",
      "contenteditable",
      "role",
      "data-state",
      "data-status",
      "data-testid",
      "disabled",
      "style",
      "class",
    ],
  });
  refresh();
  return { id: state.id, version: state.version, installed: true };
})();
