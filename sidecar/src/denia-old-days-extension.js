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

  function touch(node, className) {
    if (!node) return null;
    node.classList.add(className);
    touchedNodes.add(node);
    return node;
  }

  function visible(node) {
    if (!(node instanceof HTMLElement)) return false;
    const box = node.getBoundingClientRect();
    const computed = getComputedStyle(node);
    return box.width > 0 && box.height > 0 && computed.display !== "none" && computed.visibility !== "hidden";
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
    layer.classList.remove("is-active", "is-leaving");
    delete layer.dataset.deniaArtFamily;
    delete layer.dataset.deniaArtGeneration;
    layer.style.removeProperty("--denia-state-art-opacity");
  }

  function configureStateArtLayer(layer, spec, generation) {
    clearStateArtLayer(layer);
    layer.dataset.deniaArtFamily = spec.family;
    layer.dataset.deniaArtGeneration = String(generation);
    layer.style.setProperty("--denia-state-art-opacity", spec.opacity);
  }

  function syncStateArt(formState) {
    const spec = stateArtSpecs[formState] || stateArtSpecs.staged;
    const rail = ensureStateArt(ensureChrome());
    rail.dataset.deniaArtState = formState;

    if (!state.artFamily) {
      state.artGeneration += 1;
      configureStateArtLayer(state.artCurrent, spec, state.artGeneration);
      state.artCurrent.classList.add("is-active");
      state.artFamily = spec.family;
      return;
    }

    if (state.artFamily === spec.family) {
      state.artCurrent.style.setProperty("--denia-state-art-opacity", spec.opacity);
      state.artCurrent.classList.remove("is-leaving");
      state.artCurrent.classList.add("is-active");
      return;
    }

    state.artGeneration += 1;
    const outgoing = state.artCurrent;
    const incoming = state.artNext;
    configureStateArtLayer(incoming, spec, state.artGeneration);
    incoming.getBoundingClientRect();

    if (state.reducedMotion) {
      clearStateArtLayer(outgoing);
      incoming.classList.add("is-active");
    } else {
      outgoing.classList.remove("is-active");
      outgoing.classList.add("is-leaving");
      incoming.classList.add("is-active");
    }

    state.artCurrent = incoming;
    state.artNext = outgoing;
    state.artFamily = spec.family;
  }

  function ensureSidebarBrand() {
    let brand = document.getElementById("denia-old-days-ds-sidebar-brand");
    if (brand?.isConnected) return brand;
    const sidebar = document.querySelector('[data-testid="sidebar"], [data-slot="sidebar"], aside, nav');
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

  function ensureSuggestionDeck() {
    let deck = document.getElementById("denia-old-days-ds-card-deck");
    const nativeButtons = nativeSuggestionButtons();
    if (nativeButtons.length !== 4) {
      if (deck) {
        ownedNodes.delete(deck);
        deck.remove();
      }
      for (const node of touchedNodes) {
        node.classList?.remove("denia-old-days-ds-native-card", "denia-old-days-ds-native-suggestions");
      }
      return null;
    }
    const nativeContainer = nativeButtons[0].parentElement;
    if (nativeContainer) touch(nativeContainer, "denia-old-days-ds-native-suggestions");
    nativeButtons.forEach((button) => touch(button, "denia-old-days-ds-native-card"));
    if (deck?.isConnected) {
      [...deck.querySelectorAll("button")].forEach((button, index) => {
        button.disabled = Boolean(nativeButtons[index]?.disabled);
      });
      return deck;
    }

    deck = own(document.createElement("div"));
    deck.id = "denia-old-days-ds-card-deck";
    deck.className = "denia-old-days-ds-card-deck";
    manifest.ui.cardLabels.forEach((label, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.id = `denia-old-days-ds-card-${index + 1}`;
      button.dataset.deniaOldDaysCard = String(index);
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
    const hero = ensureHomeHero();
    hero?.insertAdjacentElement("afterend", deck);
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
    return [...document.querySelectorAll('[role="alert"]')]
      .some((node) => visible(node) && /error|failed|failure|错误|失败/iu.test(node.textContent || node.getAttribute("aria-label") || ""));
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
      node.dataset.deniaObservationLabel = "观察记录";
    });

    const assistants = [...document.querySelectorAll('[data-content-search-unit-key$=":assistant"]')];
    assistants.forEach((node) => {
      node.classList.remove("denia-old-days-ds-final-card");
      touchedNodes.add(node);
    });
    if (state.formState === "complete") touch(assistants.at(-1), "denia-old-days-ds-final-card");
  }

  function removeHomeNodes() {
    for (const id of ["denia-old-days-ds-hero-copy", "denia-old-days-ds-card-deck"]) {
      const node = document.getElementById(id);
      if (!node) continue;
      ownedNodes.delete(node);
      node.remove();
    }
  }

  function refresh() {
    state.metrics.refreshes += 1;
    ensureChrome();
    decorateComposer();
    const home = isHomeView();
    root.classList.toggle("denia-old-days-ds-home", home);
    root.classList.toggle("denia-old-days-ds-task", !home);
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
    root.dataset.deniaFormState = state.formState;
    syncStateArt(state.formState);
  }

  function scheduleRefresh() {
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      refresh();
    });
  }

  function on(target, name, handler) {
    target.addEventListener(name, handler);
    listeners.push([target, name, handler]);
  }

  function cleanup() {
    state.observer?.disconnect();
    if (state.frame) cancelAnimationFrame(state.frame);
    for (const [target, name, handler] of listeners) target.removeEventListener(name, handler);
    for (const node of ownedNodes) node.remove();
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
    for (const name of ["bright", "task-warm", "task-approval", "task-error", "task-complete"]) {
      root.style.removeProperty(`--denia-old-days-art-${name}`);
    }
    for (const artUrl of Object.values(artUrls)) URL.revokeObjectURL(artUrl);
    if (window[stateKey] === state) delete window[stateKey];
    return true;
  }

  on(window, "popstate", scheduleRefresh);
  on(window, "hashchange", scheduleRefresh);
  if (typeof motionPreference.addEventListener === "function") {
    on(motionPreference, "change", (event) => {
      state.reducedMotion = event.matches;
      if (event.matches) {
        clearStateArtLayer(state.artNext);
        state.artCurrent?.classList.remove("is-leaving");
        state.artCurrent?.classList.add("is-active");
      }
    });
  }
  state.observer = new MutationObserver(scheduleRefresh);
  state.observer.observe(document.body || root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-busy", "data-state", "data-status", "class"],
  });
  refresh();
  return { id: state.id, version: state.version, installed: true };
})();
