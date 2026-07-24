(() => {
  const manifest = __DENIA_OLD_DAYS_EXTENSION_MANIFEST_JSON__;
  const cssText = __DENIA_OLD_DAYS_EXTENSION_CSS_JSON__;
  const brightArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_BRIGHT_ART_JSON__;
  const taskWarmArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_WARM_ART_JSON__;
  const taskApprovalArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_APPROVAL_ART_JSON__;
  const taskErrorArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_ERROR_ART_JSON__;
  const taskCompleteArtDataUrl = __DENIA_OLD_DAYS_EXTENSION_TASK_COMPLETE_ART_JSON__;
  const stateKey = "__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__";
  const styleId = "denia-old-days-dream-skin-extension-style";
  const rootClass = "denia-old-days-ds-extension";
  const root = document.documentElement;
  const touchedNodes = new Set();
  const ownedNodes = new Set();
  const listeners = [];
  let nativeSidebarPanel = null;
  const nativeSidebarGroups = new Set();
  const nativeSidebarRows = new Set();
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const stateArtSpecs = Object.freeze({
    staged: Object.freeze({ family: "taskWarm", opacity: ".11" }),
    working: Object.freeze({ family: "taskWarm", opacity: ".20" }),
    approval: Object.freeze({ family: "taskApproval", opacity: ".43" }),
    error: Object.freeze({ family: "taskError", opacity: ".56" }),
    complete: Object.freeze({ family: "taskComplete", opacity: ".28" }),
  });
  const removableClasses = [
    "denia-old-days-ds-native-card",
    "denia-old-days-ds-native-suggestions",
    "denia-old-days-ds-composer",
    "denia-old-days-ds-send",
    "denia-old-days-ds-attachment",
    "denia-old-days-ds-observation",
    "denia-old-days-ds-final-card",
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
    taskWarm: dataUrlToObjectUrl(taskWarmArtDataUrl),
    taskApproval: dataUrlToObjectUrl(taskApprovalArtDataUrl),
    taskError: dataUrlToObjectUrl(taskErrorArtDataUrl),
    taskComplete: dataUrlToObjectUrl(taskCompleteArtDataUrl),
  });
  root.classList.add(rootClass);
  root.dataset.deniaOldDaysExtensionVersion = manifest.version;
  root.style.setProperty("--denia-old-days-art-bright", `url("${artUrls.bright}")`);
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
    suggestionSlotHeight: 0,
    metrics: { refreshes: 0, createdNodes: 0 },
    observer: null,
    frame: 0,
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
    state.metrics.createdNodes += 1;
    return node;
  }

  function isOwnedNode(node) {
    for (let current = node; current; current = current.parentElement) {
      if (ownedNodes.has(current) || current.id?.startsWith("denia-old-days-ds-")) return true;
    }
    return false;
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

  function normalizedNodeLabel(node) {
    return (node?.getAttribute?.("aria-label")
      || node?.getAttribute?.("title")
      || node?.textContent
      || "")
      .replace(/\s+/gu, " ")
      .trim();
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
      "main",
      '[role="main"]',
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
    const sidePass = !mainRect || rect.left >= mainRect.right - 12;
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
    const toggle = [...document.querySelectorAll("button")].find((button) =>
      visible(button) && /(?:显示\/隐藏侧边栏|show\/hide sidebar|toggle sidebar)/iu.test(normalizedNodeLabel(button))
    ) || null;
    if (!toggle) return sidebarDetectionResult("unknown", "none", "none", null, null);

    const mainRect = measuredRect(findMain());
    const expanded = toggle.getAttribute("aria-expanded");
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

  function syncNativeRightSidebar(home) {
    const result = detectNativeRightSidebar();
    let nextPanel = null;
    const nextGroups = new Set();
    const nextRows = new Set();
    if (result.state === "open" && result.confidence === "high" && result.panel && result.panelRect) {
      const { panel, panelRect } = result;
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
    };
    setDatasetValue(root, "deniaSidebarState", result.state);
    setDatasetValue(root, "deniaSidebarConfidence", result.confidence);
    void home;
  }

  function findMain() {
    return document.querySelector('[role="main"]') || document.querySelector("main");
  }

  function findComposer() {
    const input = document.querySelector("textarea") || document.querySelector('[contenteditable="true"]');
    if (!input) return null;
    return input.closest(".composer-surface-chrome") || input.closest("form") || input.parentElement?.parentElement || input.parentElement;
  }

  function nativeSuggestionButtons() {
    const approved = [
      /explore|understand|解释|理解|翻阅/iu,
      /build|implement|feature|构建|实现|写下/iu,
      /review|修改建议|审查|校对/iu,
      /fix|debug|修复|失败|问题/iu,
    ];
    const candidates = [...document.querySelectorAll("button")].filter((button) => {
      if (!visible(button) || button.closest("#denia-old-days-ds-card-deck")) return false;
      if (button.closest("aside, nav, .composer-surface-chrome")) return false;
      const text = (button.innerText || button.textContent || "").trim();
      return text.length > 2 && text.length < 180 && approved.some((pattern) => pattern.test(text));
    });
    const semanticButtons = [];
    for (const pattern of approved) {
      const button = candidates.find((candidate) => {
        if (semanticButtons.includes(candidate)) return false;
        const text = (candidate.innerText || candidate.textContent || "").trim();
        return pattern.test(text);
      });
      if (!button) return [];
      semanticButtons.push(button);
    }
    return semanticButtons;
  }

  function isHomeView() {
    const main = findMain();
    if (!main) return false;
    if (main.matches(".dream-skin-home") || main.querySelector(".dream-skin-home")) return true;
    const assistants = document.querySelectorAll('[data-content-search-unit-key$=":assistant"]');
    return assistants.length === 0 && nativeSuggestionButtons().length >= 3;
  }

  function ensureChrome() {
    let chrome = document.getElementById("denia-old-days-ds-chrome");
    if (!chrome) {
      chrome = own(document.createElement("div"));
      chrome.id = "denia-old-days-ds-chrome";
      chrome.className = "denia-old-days-ds-chrome";
      chrome.setAttribute("aria-hidden", "true");
      document.body.append(chrome);
    }
    if (!chrome.querySelector(".denia-old-days-ds-state-bubble")) {
      const bubble = document.createElement("span");
      bubble.className = "denia-old-days-ds-state-bubble";
      bubble.setAttribute("aria-hidden", "true");
      chrome.append(bubble);
    }
    ensureStateArt(chrome);
    return chrome;
  }

  function ensureStateArt(chrome) {
    let rail = document.getElementById("denia-old-days-ds-state-art");
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

  function ensureSidebarBrand() {
    let brand = document.getElementById("denia-old-days-ds-sidebar-brand");
    const mainRect = measuredRect(findMain());
    const sidebar = [
      ...document.querySelectorAll('[data-testid="sidebar"], [data-slot="sidebar"], aside, nav'),
    ].find((candidate) => leftDockedSidebar(candidate, mainRect)) || null;
    if (brand?.isConnected && sidebar?.contains(brand)) return brand;
    if (brand) {
      ownedNodes.delete(brand);
      brand.remove();
      brand = null;
    }
    if (!sidebar) return null;
    brand = own(document.createElement("div"));
    brand.id = "denia-old-days-ds-sidebar-brand";
    brand.className = "denia-old-days-ds-sidebar-brand";
    const mark = document.createElement("span");
    mark.className = "denia-old-days-ds-brand-mark";
    mark.setAttribute("aria-hidden", "true");
    const copy = document.createElement("span");
    copy.className = "denia-old-days-ds-brand-copy";
    const title = document.createElement("strong");
    title.textContent = manifest.ui.brandName;
    const subtitle = document.createElement("small");
    subtitle.textContent = manifest.ui.sidebarSubtitle;
    copy.append(title, subtitle);
    brand.append(mark, copy);
    sidebar.prepend(brand);
    return brand;
  }

  function removeSidebarBrand() {
    const brand = document.getElementById("denia-old-days-ds-sidebar-brand");
    if (!brand) return;
    ownedNodes.delete(brand);
    brand.remove();
  }

  function ensureHomeHero() {
    let hero = document.getElementById("denia-old-days-ds-hero-copy");
    if (hero?.isConnected) return hero;
    const main = findMain();
    if (!main) return null;
    hero = own(document.createElement("section"));
    hero.id = "denia-old-days-ds-hero-copy";
    hero.className = "denia-old-days-ds-hero denia-old-days-ds-intro";
    hero.setAttribute("aria-labelledby", "denia-old-days-ds-headline");

    const copy = document.createElement("div");
    copy.className = "denia-old-days-ds-hero-text";
    const eyebrow = document.createElement("div");
    eyebrow.className = "denia-old-days-ds-eyebrow";
    eyebrow.textContent = manifest.ui.eyebrow;
    const headline = document.createElement("h1");
    headline.id = "denia-old-days-ds-headline";
    headline.textContent = manifest.ui.headline;
    const description = document.createElement("p");
    description.textContent = manifest.ui.description;
    const status = document.createElement("span");
    status.className = "denia-old-days-ds-status";
    status.textContent = manifest.ui.statusText;
    copy.append(eyebrow, headline, description, status);

    const photo = document.createElement("div");
    photo.className = "denia-old-days-ds-photo";
    photo.setAttribute("aria-hidden", "true");
    photo.innerHTML = '<span class="denia-old-days-ds-photo-front"></span>';
    const bubbles = document.createElement("span");
    bubbles.className = "denia-old-days-ds-memory-bubbles";
    bubbles.setAttribute("aria-hidden", "true");
    bubbles.innerHTML = "<i></i><i></i><i></i>";
    hero.append(copy, photo, bubbles);

    const firstContent = [...main.children].find((node) => !node.classList?.contains("denia-old-days-ds-hero"));
    main.insertBefore(hero, firstContent || null);
    return hero;
  }

  function ensureSuggestionSlot() {
    let slot = document.getElementById("denia-old-days-ds-suggestion-slot");
    const hero = ensureHomeHero();
    if (!hero) return null;
    if (slot?.isConnected && slot.parentElement === hero.parentElement) return slot;
    if (slot) {
      ownedNodes.delete(slot);
      slot.remove();
    }
    slot = own(document.createElement("div"));
    slot.id = "denia-old-days-ds-suggestion-slot";
    slot.className = "denia-old-days-ds-suggestion-slot";
    if (state.suggestionSlotHeight > 0) {
      setStyleProperty(slot, "--denia-old-days-suggestion-slot-height", `${state.suggestionSlotHeight}px`);
    }
    hero.insertAdjacentElement("afterend", slot);
    return slot;
  }

  function retainSuggestionSlotHeight(slot, deck) {
    const height = Math.ceil(deck.getBoundingClientRect().height);
    if (!Number.isFinite(height) || height <= 0 || state.suggestionSlotHeight === height) return;
    state.suggestionSlotHeight = height;
    setStyleProperty(slot, "--denia-old-days-suggestion-slot-height", `${height}px`);
  }

  function ensureSuggestionDeck() {
    const slot = ensureSuggestionSlot();
    let deck = document.getElementById("denia-old-days-ds-card-deck");
    const nativeButtons = nativeSuggestionButtons();
    if (nativeButtons.length !== 4) {
      if (deck) {
        ownedNodes.delete(deck);
        deck.remove();
      }
      for (const node of touchedNodes) {
        syncClass(node, "denia-old-days-ds-native-card", false);
        syncClass(node, "denia-old-days-ds-native-suggestions", false);
      }
      return null;
    }
    if (!slot) return null;
    const nativeContainer = nativeButtons[0].parentElement;
    if (nativeContainer) touch(nativeContainer, "denia-old-days-ds-native-suggestions");
    nativeButtons.forEach((button) => touch(button, "denia-old-days-ds-native-card"));
    if (deck?.isConnected) {
      if (deck.parentElement !== slot) slot.append(deck);
      [...deck.querySelectorAll("button")].forEach((button, index) => {
        button.disabled = Boolean(nativeButtons[index]?.disabled);
      });
      retainSuggestionSlotHeight(slot, deck);
      return deck;
    }

    deck = own(document.createElement("div"));
    deck.id = "denia-old-days-ds-card-deck";
    deck.className = "denia-old-days-ds-card-deck";
    manifest.ui.cardLabels.forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.id = `denia-old-days-ds-card-${index + 1}`;
      setDatasetValue(button, "deniaOldDaysCard", String(index));
      button.disabled = Boolean(nativeButtons[index]?.disabled);
      const number = document.createElement("span");
      number.className = "denia-old-days-ds-card-number";
      number.textContent = `0${index + 1}`;
      const text = document.createElement("span");
      text.textContent = label;
      button.append(number, text);
      button.addEventListener("click", () => nativeSuggestionButtons()[index]?.click());
      deck.append(button);
    });
    slot.append(deck);
    retainSuggestionSlotHeight(slot, deck);
    return deck;
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

  function errorVisible() {
    const stableMarkers = document.querySelectorAll('[data-state="error"], [data-status="error"], [data-testid*="error"]');
    if ([...stableMarkers].some(visible)) return true;
    if ([...document.querySelectorAll('[role="alert"]')]
      .some((node) => visible(node) && /error|failed|failure|错误|失败/iu.test(node.textContent || node.getAttribute("aria-label") || ""))) return true;
    return explicitCommandFailureVisible();
  }

  function explicitCommandFailureVisible() {
    const latestAssistant = [...document.querySelectorAll('[data-content-search-unit-key$=":assistant"]')].at(-1);
    if (!latestAssistant) return false;
    return [...latestAssistant.querySelectorAll("p")].some((paragraph) => {
      if (!visible(paragraph)
        || paragraph.closest('pre, code, [data-content-search-unit-key$=":user"]')
        || paragraph.querySelector("pre, code")) return false;
      const text = (paragraph.textContent || "").replace(/\s+/gu, " ").trim();
      if (!text || text.length > 240) return false;
      if (!/^(?:测试错误已触发[:：]|命令执行失败[:：]|command failed:)/iu.test(text)) return false;
      if (!/(?:command not found|命令未找到)/iu.test(text)) return false;
      const status = /(?:退出码为|exit code|exited with status)\s*(\d+)(?![\p{L}\p{N}_])/iu.exec(text)?.[1];
      return status != null && Number.parseInt(status, 10) !== 0;
    });
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

  function workingVisible() {
    const statusNode = document.querySelector('[aria-busy="true"], [data-state="loading"], [data-status="running"], [role="progressbar"]');
    if (statusNode && visible(statusNode)) return true;
    return [...document.querySelectorAll("button")]
      .some((button) => visible(button) && /^(stop|cancel|停止|取消)/iu.test((button.textContent || button.getAttribute("aria-label") || "").trim()));
  }

  function deriveFormState() {
    if (errorVisible()) return "error";
    if (approvalVisible()) return "approval";
    if (workingVisible()) return "working";
    if (document.querySelector('[data-content-search-unit-key$=":assistant"]')) return "complete";
    return "staged";
  }

  function decorateTask() {
    const observations = document.querySelectorAll([
      '[data-content-search-unit-key*="tool"]',
      '[data-content-search-unit-key*="reasoning"]',
      '[data-testid*="tool"]',
      '[data-testid*="reasoning"]',
      "details",
    ].join(","));
    observations.forEach((node) => {
      touch(node, "denia-old-days-ds-observation");
      setDatasetValue(node, "deniaObservationLabel", "观察记录");
    });

    const assistants = [...document.querySelectorAll('[data-content-search-unit-key$=":assistant"]')];
    assistants.forEach((node, index) => {
      syncClass(node, "denia-old-days-ds-final-card", state.formState === "complete" && index === assistants.length - 1);
      touchedNodes.add(node);
    });
  }

  function removeHomeNodes() {
    for (const id of ["denia-old-days-ds-hero-copy", "denia-old-days-ds-suggestion-slot", "denia-old-days-ds-card-deck"]) {
      const node = document.getElementById(id);
      if (!node) continue;
      ownedNodes.delete(node);
      node.remove();
    }
    state.suggestionSlotHeight = 0;
  }

  function refresh() {
    state.metrics.refreshes += 1;
    ensureChrome();
    decorateComposer();
    const home = isHomeView();
    syncClass(root, "denia-old-days-ds-home", home);
    syncClass(root, "denia-old-days-ds-task", !home);
    syncNativeRightSidebar(home);
    if (home) {
      ensureSidebarBrand();
      state.formState = "staged";
      ensureHomeHero();
      ensureSuggestionDeck();
    } else {
      removeSidebarBrand();
      removeHomeNodes();
      state.formState = deriveFormState();
      decorateTask();
    }
    setDatasetValue(root, "deniaFormState", state.formState);
    syncStateArt(state.formState);
  }

  function scheduleRefresh() {
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      refresh();
    });
  }

  function extensionClassDeltaOnly(record) {
    const oldTokens = new Set((record.oldValue || "").split(/\s+/u).filter(Boolean));
    const currentTokens = new Set((record.target.className || "").split(/\s+/u).filter(Boolean));
    const changedTokens = new Set([
      ...[...oldTokens].filter((token) => !currentTokens.has(token)),
      ...[...currentTokens].filter((token) => !oldTokens.has(token)),
    ]);
    return [...changedTokens].every((token) => token.startsWith("denia-old-days-ds-"));
  }

  function mutationIsThemeOnly(record) {
    if (isOwnedNode(record.target)) return true;
    if (record.type === "attributes") {
      return record.attributeName === "class" && extensionClassDeltaOnly(record);
    }
    if (record.type === "childList") {
      return [...record.addedNodes, ...record.removedNodes].every(isOwnedNode);
    }
    return false;
  }

  function on(target, name, handler) {
    target.addEventListener(name, handler);
    listeners.push([target, name, handler]);
  }

  function cleanup() {
    state.observer?.disconnect();
    if (state.frame) cancelAnimationFrame(state.frame);
    for (const [target, name, handler] of listeners) target.removeEventListener(name, handler);
    clearNativeRightSidebarClasses();
    for (const node of ownedNodes) node.remove();
    state.suggestionSlotHeight = 0;
    for (const node of touchedNodes) {
      for (const className of removableClasses) node.classList?.remove(className);
      if (node.dataset) {
        delete node.dataset.deniaObservationLabel;
        delete node.dataset.deniaOldDaysCard;
      }
    }
    style.remove();
    root.classList.remove(rootClass, "denia-old-days-ds-home", "denia-old-days-ds-task");
    delete root.dataset.deniaOldDaysExtensionVersion;
    delete root.dataset.deniaFormState;
    delete root.dataset.deniaSidebarState;
    delete root.dataset.deniaSidebarConfidence;
    for (const name of ["bright", "task-warm", "task-approval", "task-error", "task-complete"]) {
      root.style.removeProperty(`--denia-old-days-art-${name}`);
    }
    for (const artUrl of Object.values(artUrls)) URL.revokeObjectURL(artUrl);
    if (window[stateKey] === state) delete window[stateKey];
    return true;
  }

  on(window, "popstate", scheduleRefresh);
  on(window, "hashchange", scheduleRefresh);
  on(window, "resize", scheduleRefresh);
  if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
    on(window.visualViewport, "resize", scheduleRefresh);
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
  state.observer = new MutationObserver((records) => {
    if (records.some((record) => !mutationIsThemeOnly(record))) scheduleRefresh();
  });
  state.observer.observe(document.body || root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: [
      "aria-busy",
      "aria-controls",
      "aria-expanded",
      "aria-hidden",
      "hidden",
      "data-state",
      "data-status",
      "data-testid",
      "style",
      "class",
    ],
  });
  refresh();
  return { id: state.id, version: state.version, installed: true };
})();
