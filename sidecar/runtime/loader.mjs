import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultExtensionDir = path.resolve(here, "..");
const args = process.argv.slice(2);

const has = (flag) => args.includes(flag);
const value = (flag, fallback = "") => {
  const index = args.indexOf(flag);
  if (index < 0) return fallback;
  const found = args[index + 1];
  if (!found || found.startsWith("--")) throw new Error(`${flag} requires a value`);
  return found;
};

const mode = ["--watch", "--once", "--remove-once", "--verify"].find(has);
if (!mode) throw new Error("Choose one mode: --watch, --once, --remove-once, or --verify");

const extensionDir = path.resolve(value("--extension-dir", defaultExtensionDir));
const port = Number(value("--port", "9341"));
const statePath = value("--state", "");
const screenshotPath = value("--screenshot", "");
const openHome = has("--open-home");
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("--port must be a valid local TCP port");

let extensionRealDir;
try {
  extensionRealDir = await fs.realpath(extensionDir);
} catch (error) {
  throw new Error(`Could not resolve extension package directory: ${extensionDir}`, { cause: error });
}

const resolveExtensionFile = async (candidate, label) => {
  if (!candidate.startsWith(`${extensionDir}${path.sep}`)) throw new Error(`Extension path escapes package directory: ${label}`);
  let realPath;
  try {
    realPath = await fs.realpath(candidate);
  } catch (error) {
    throw new Error(`Could not resolve extension package file: ${label}`, { cause: error });
  }
  if (!realPath.startsWith(`${extensionRealDir}${path.sep}`)) throw new Error(`Extension real path escapes package directory: ${label}`);
  return realPath;
};

const manifestPath = path.resolve(extensionDir, "extension.json");
const manifestRealPath = await resolveExtensionFile(manifestPath, "extension.json");
const manifest = JSON.parse(await fs.readFile(manifestRealPath, "utf8"));
if (manifest.schemaVersion !== 1 || manifest.id !== "denia-old-days") {
  throw new Error("Unsupported or unexpected extension manifest");
}
const stylePath = path.resolve(extensionDir, manifest.entrypoints.style);
const runtimePath = path.resolve(extensionDir, manifest.entrypoints.runtime);
const brightPath = path.resolve(extensionDir, manifest.assets.runtimeWallpaper);
const darkHomePath = path.resolve(extensionDir, manifest.assets.darkHomeArtwork);
const taskWarmPath = path.resolve(extensionDir, manifest.assets.taskWarmArtwork);
const taskApprovalPath = path.resolve(extensionDir, manifest.assets.taskApprovalArtwork);
const taskErrorPath = path.resolve(extensionDir, manifest.assets.taskErrorArtwork);
const taskCompletePath = path.resolve(extensionDir, manifest.assets.taskCompleteArtwork);
const [
  styleRealPath,
  runtimeRealPath,
  brightRealPath,
  darkHomeRealPath,
  taskWarmRealPath,
  taskApprovalRealPath,
  taskErrorRealPath,
  taskCompleteRealPath,
] = await Promise.all([
  resolveExtensionFile(stylePath, manifest.entrypoints.style),
  resolveExtensionFile(runtimePath, manifest.entrypoints.runtime),
  resolveExtensionFile(brightPath, manifest.assets.runtimeWallpaper),
  resolveExtensionFile(darkHomePath, manifest.assets.darkHomeArtwork),
  resolveExtensionFile(taskWarmPath, manifest.assets.taskWarmArtwork),
  resolveExtensionFile(taskApprovalPath, manifest.assets.taskApprovalArtwork),
  resolveExtensionFile(taskErrorPath, manifest.assets.taskErrorArtwork),
  resolveExtensionFile(taskCompletePath, manifest.assets.taskCompleteArtwork),
]);
const [cssText, runtimeTemplate, bright, darkHome, taskWarm, taskApproval, taskError, taskComplete] = await Promise.all([
  fs.readFile(styleRealPath, "utf8"),
  fs.readFile(runtimeRealPath, "utf8"),
  fs.readFile(brightRealPath),
  fs.readFile(darkHomeRealPath),
  fs.readFile(taskWarmRealPath),
  fs.readFile(taskApprovalRealPath),
  fs.readFile(taskErrorRealPath),
  fs.readFile(taskCompleteRealPath),
]);

const imageDataUrl = (filePath, bytes) => {
  const extension = path.extname(filePath).toLowerCase();
  const mime = extension === ".png" ? "image/png"
    : extension === ".webp" ? "image/webp" : "image/jpeg";
  return `data:${mime};base64,${bytes.toString("base64")}`;
};

const templatePlaceholders = Object.freeze({
  manifest: "__DENIA_OLD_DAYS_EXTENSION_MANIFEST_JSON__",
  css: "__DENIA_OLD_DAYS_EXTENSION_CSS_JSON__",
  bright: "__DENIA_OLD_DAYS_EXTENSION_BRIGHT_ART_JSON__",
  dark: "__DENIA_OLD_DAYS_EXTENSION_DARK_HOME_ART_JSON__",
  taskWarm: "__DENIA_OLD_DAYS_EXTENSION_TASK_WARM_ART_JSON__",
  taskApproval: "__DENIA_OLD_DAYS_EXTENSION_TASK_APPROVAL_ART_JSON__",
  taskError: "__DENIA_OLD_DAYS_EXTENSION_TASK_ERROR_ART_JSON__",
  taskComplete: "__DENIA_OLD_DAYS_EXTENSION_TASK_COMPLETE_ART_JSON__",
});
const templateSentinels = Object.freeze({
  manifest: "@@DENIA_RUNTIME_MANIFEST_7F3A@@",
  css: "@@DENIA_RUNTIME_CSS_7F3A@@",
  bright: "@@DENIA_RUNTIME_BRIGHT_ART_7F3A@@",
  dark: "@@DENIA_RUNTIME_DARK_HOME_ART_7F3A@@",
  taskWarm: "@@DENIA_RUNTIME_TASK_WARM_ART_7F3A@@",
  taskApproval: "@@DENIA_RUNTIME_TASK_APPROVAL_ART_7F3A@@",
  taskError: "@@DENIA_RUNTIME_TASK_ERROR_ART_7F3A@@",
  taskComplete: "@@DENIA_RUNTIME_TASK_COMPLETE_ART_7F3A@@",
});
const expectedTemplatePlaceholders = Object.values(templatePlaceholders);
const expectedTemplateSentinels = Object.values(templateSentinels);
if (new Set(expectedTemplateSentinels).size !== expectedTemplatePlaceholders.length) {
  throw new Error("Denia runtime template sentinels must be unique");
}
const templatePlaceholderMatches = runtimeTemplate.match(/__DENIA_OLD_DAYS_EXTENSION_[A-Z0-9_]+__/gu) || [];
for (const placeholder of expectedTemplatePlaceholders) {
  const count = templatePlaceholderMatches.filter((match) => match === placeholder).length;
  if (count !== 1) throw new Error(`Denia runtime template placeholder must appear exactly once: ${placeholder} (found ${count})`);
}
const unexpectedTemplatePlaceholders = [...new Set(templatePlaceholderMatches.filter((match) => !expectedTemplatePlaceholders.includes(match)))];
if (unexpectedTemplatePlaceholders.length) {
  throw new Error(`Unexpected Denia runtime template placeholder(s): ${unexpectedTemplatePlaceholders.join(", ")}`);
}
for (const sentinel of expectedTemplateSentinels) {
  if (runtimeTemplate.includes(sentinel)) throw new Error(`Denia runtime template contains reserved sentinel: ${sentinel}`);
}

const stagedRuntimeTemplate = runtimeTemplate
  .replace(templatePlaceholders.manifest, templateSentinels.manifest)
  .replace(templatePlaceholders.css, templateSentinels.css)
  .replace(templatePlaceholders.bright, templateSentinels.bright)
  .replace(templatePlaceholders.dark, templateSentinels.dark)
  .replace(templatePlaceholders.taskWarm, templateSentinels.taskWarm)
  .replace(templatePlaceholders.taskApproval, templateSentinels.taskApproval)
  .replace(templatePlaceholders.taskError, templateSentinels.taskError)
  .replace(templatePlaceholders.taskComplete, templateSentinels.taskComplete);
const unstagedTemplatePlaceholders = expectedTemplatePlaceholders.filter((placeholder) => stagedRuntimeTemplate.includes(placeholder));
if (unstagedTemplatePlaceholders.length) {
  throw new Error(`Unresolved Denia runtime template token(s): ${unstagedTemplatePlaceholders.join(", ")}`);
}
for (const sentinel of expectedTemplateSentinels) {
  const count = stagedRuntimeTemplate.split(sentinel).length - 1;
  if (count !== 1) throw new Error(`Denia runtime template sentinel must appear exactly once after staging: ${sentinel} (found ${count})`);
}

const sentinelPayloads = new Map([
  [templateSentinels.manifest, JSON.stringify(manifest)],
  [templateSentinels.css, JSON.stringify(cssText)],
  [templateSentinels.bright, JSON.stringify(imageDataUrl(brightPath, bright))],
  [templateSentinels.dark, JSON.stringify(imageDataUrl(darkHomePath, darkHome))],
  [templateSentinels.taskWarm, JSON.stringify(imageDataUrl(taskWarmPath, taskWarm))],
  [templateSentinels.taskApproval, JSON.stringify(imageDataUrl(taskApprovalPath, taskApproval))],
  [templateSentinels.taskError, JSON.stringify(imageDataUrl(taskErrorPath, taskError))],
  [templateSentinels.taskComplete, JSON.stringify(imageDataUrl(taskCompletePath, taskComplete))],
]);
const sentinelPattern = new RegExp([...sentinelPayloads.keys()].join("|"), "gu");
const installPayload = stagedRuntimeTemplate.replace(sentinelPattern, (sentinel) => sentinelPayloads.get(sentinel));
const unresolvedSentinels = [...sentinelPayloads.keys()].filter((sentinel) => installPayload.includes(sentinel));
if (unresolvedSentinels.length) {
  throw new Error(`Unresolved Denia runtime template sentinel(s): ${unresolvedSentinels.join(", ")}`);
}

const cleanupExpression = `(() => {
  const state = window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  if (state?.cleanup) return state.cleanup();
  const root = document.documentElement;
  for (const id of [
    'denia-old-days-dream-skin-extension-style',
    'denia-old-days-ds-chrome',
    'denia-old-days-ds-sidebar-brand',
    'denia-old-days-ds-home-visuals',
    'denia-old-days-ds-hero-copy',
    'denia-old-days-ds-hero-badge',
    'denia-old-days-ds-stage-pass',
    'denia-old-days-ds-custom-card',
    'denia-old-days-ds-state-art',
  ]) document.getElementById(id)?.remove();
  root.classList.remove('denia-old-days-ds-extension', 'denia-old-days-ds-home', 'denia-old-days-ds-task');
  delete root.dataset.deniaOldDaysExtensionVersion;
  delete root.dataset.deniaTheme;
  delete root.dataset.deniaFormState;
  delete root.dataset.deniaSidebarState;
  delete root.dataset.deniaSidebarConfidence;
  delete root.dataset.deniaSidebarToggleState;
  delete root.dataset.deniaSummaryState;
  delete root.dataset.deniaBottomPanelState;
  delete root.dataset.deniaWorkSurfaceState;
  root.style.removeProperty('--denia-native-sidebar-width');
  root.style.removeProperty('--denia-thread-content-width');
  const artworkProperties = [
    '--denia-old-days-art-bright',
    '--denia-old-days-art-dark',
    '--denia-old-days-art-task-warm',
    '--denia-old-days-art-task-approval',
    '--denia-old-days-art-task-error',
    '--denia-old-days-art-task-dark',
    '--denia-old-days-art-task-complete',
  ];
  const fallbackBlobArtUrls = new Set();
  for (const property of artworkProperties) {
    const value = root.style.getPropertyValue(property);
    const blobUrl = /^url\\(\\s*["']?(blob:[^"')\\s]+)["']?\\s*\\)$/u.exec(value)?.[1];
    if (blobUrl) fallbackBlobArtUrls.add(blobUrl);
  }
  for (const property of artworkProperties) root.style.removeProperty(property);
  for (const blobUrl of fallbackBlobArtUrls) URL.revokeObjectURL(blobUrl);
  document.querySelectorAll('.denia-old-days-ds-hero').forEach((node) => {
    for (const property of ['background-image', 'background-position', 'background-size', 'background-repeat', 'background-color']) node.style.removeProperty(property);
  });
  for (const name of ['mode-button', 'native-hero-copy', 'hero', 'home-main']) {
    document.querySelectorAll('.denia-old-days-ds-' + name).forEach((node) => node.classList.remove('denia-old-days-ds-' + name));
  }
  for (const className of [
    'denia-old-days-ds-native-home-prompt',
    'denia-old-days-ds-native-home-suggestions',
    'denia-old-days-ds-composer',
    'denia-old-days-ds-send',
    'denia-old-days-ds-attachment',
    'denia-old-days-ds-observation',
    'denia-old-days-ds-final-card',
    'denia-old-days-ds-native-left-sidebar',
    'denia-old-days-ds-native-right-sidebar',
    'denia-old-days-ds-native-sidebar-group',
    'denia-old-days-ds-native-sidebar-row',
  ]) document.querySelectorAll('.' + className).forEach((node) => {
    node.classList.remove(className);
    if (className === 'denia-old-days-ds-native-home-prompt') {
      node.style.removeProperty('--denia-old-days-native-prompt-shift');
    }
  });
  document.querySelectorAll('[data-denia-observation-label]').forEach((node) => {
    delete node.dataset.deniaObservationLabel;
  });
  return true;
})()`;

const verifyExpression = `(() => {
  const box = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    const s = getComputedStyle(node);
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height), visible: r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity || 1) > 0 };
  };
  const state = window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const root = document.documentElement;
  const home = root.classList.contains('denia-old-days-ds-home');
  const chrome = document.getElementById('denia-old-days-ds-chrome');
  const homeVisuals = document.getElementById('denia-old-days-ds-home-visuals');
  const homeVisualsStyle = homeVisuals ? getComputedStyle(homeVisuals) : null;
  const hero = document.querySelector('.denia-old-days-ds-hero');
  const photoFront = document.querySelector('.denia-old-days-ds-photo-front');
  const mainSurface = document.querySelector('main.main-surface.dream-skin-home-shell');
  const brightRuntimeArt = getComputedStyle(root).getPropertyValue('--denia-old-days-art-bright').trim();
  const darkRuntimeArt = getComputedStyle(root).getPropertyValue('--denia-old-days-art-dark').trim();
  const brightRuntimeArtUrl = /url\\(["']?([^"')]+)["']?\\)/.exec(brightRuntimeArt)?.[1] || '';
  const darkRuntimeArtUrl = /url\\(["']?([^"')]+)["']?\\)/.exec(darkRuntimeArt)?.[1] || '';
  const darkHome = root.dataset.deniaTheme === 'dark';
  const heroBackgroundImage = hero ? getComputedStyle(hero).backgroundImage : '';
  const photoFrontBackgroundImage = photoFront ? getComputedStyle(photoFront).backgroundImage : '';
  const mainSurfaceBackgroundImage = mainSurface ? getComputedStyle(mainSurface).backgroundImage : '';
  const stateArtRail = document.getElementById('denia-old-days-ds-state-art');
  const activeStateArtLayer = stateArtRail?.querySelector('.denia-old-days-ds-state-art-layer.is-active') || null;
  const nativeSidebarPanels = [...document.querySelectorAll(".denia-old-days-ds-native-right-sidebar")];
  const visibleNativeSidebarPanels = nativeSidebarPanels.filter((node) => box(node)?.visible === true);
  const nativeSidebar = nativeSidebarPanels.length === 1 && visibleNativeSidebarPanels.length === 1
    ? visibleNativeSidebarPanels[0]
    : null;
  const nativeSidebarGroups = [...document.querySelectorAll(".denia-old-days-ds-native-sidebar-group")];
  const nativeSidebarRows = [...document.querySelectorAll(".denia-old-days-ds-native-sidebar-row")];
  const sidebarState = root.dataset.deniaSidebarState || "unknown";
  const sidebarConfidence = root.dataset.deniaSidebarConfidence || "none";
  const sidebarStateValid = ["open", "closed", "unknown"].includes(sidebarState);
  const sidebarConfidenceValid = ["high", "none"].includes(sidebarConfidence);
  const sidebarStateConfidencePass = sidebarStateValid && sidebarConfidenceValid && (
    (sidebarState === "open" && sidebarConfidence === "high")
    || (sidebarState === "closed" && sidebarConfidence === "high")
    || (sidebarState === "unknown" && sidebarConfidence === "none")
  );
  const sidebarOpen = sidebarState === "open";
  const sidebarArtVisible = box(stateArtRail)?.visible === true;
  const nativeMain = document.querySelector('[role="main"]') || document.querySelector("main");
  const chromeHostedByMain = Boolean(!home && chrome?.parentElement === nativeMain);
  const panelRect = nativeSidebar?.getBoundingClientRect?.() || null;
  const mainRect = nativeMain?.getBoundingClientRect?.() || null;
  const panelRight = panelRect && (Number.isFinite(panelRect.right) ? panelRect.right : panelRect.x + panelRect.width);
  const panelLeft = panelRect && (Number.isFinite(panelRect.left) ? panelRect.left : panelRect.x);
  const mainLeft = mainRect && (Number.isFinite(mainRect.left) ? mainRect.left : mainRect.x);
  const mainRight = mainRect && (Number.isFinite(mainRect.right) ? mainRect.right : mainRect.x + mainRect.width);
  const mainMeasurable = Boolean(mainRect && mainRect.width > 0 && mainRect.height > 0);
  const uniqueVisiblePanelPass = nativeSidebarPanels.length === 1 && visibleNativeSidebarPanels.length === 1;
  const sidebarSkinsContained = Boolean(nativeSidebar
    && [...nativeSidebarGroups, ...nativeSidebarRows].every((node) => nativeSidebar.contains(node)));
  const nativeGeometryPass = !sidebarOpen || Boolean(
    uniqueVisiblePanelPass
      && panelRect
      && Math.abs(panelRight - innerWidth) <= 12
      && panelRect.height >= Math.max(240, innerHeight * .35)
      && (!mainMeasurable || panelLeft >= mainRight - 12 || Boolean(
        panelLeft >= mainLeft + mainRect.width * .62
          && panelLeft < mainRight - 12
          && Math.abs(panelRight - mainRight) <= 12
      ))
  );
  const sidebarToggle = [...document.querySelectorAll("button")].find((button) => {
    if (box(button)?.visible !== true) return false;
    const label = button.getAttribute?.("aria-label")
      || button.getAttribute?.("title")
      || button.title
      || button.textContent
      || "";
    return /(?:显示\\/隐藏侧边栏|show\\/hide sidebar|toggle sidebar)/iu.test(label.replace(/\\s+/gu, " ").trim());
  }) || null;
  const toggleRect = sidebarToggle?.getBoundingClientRect?.() || null;
  const toggleTarget = toggleRect
    ? document.elementFromPoint?.(toggleRect.x + toggleRect.width / 2, toggleRect.y + toggleRect.height / 2)
    : null;
  const toggleHitTargetPass = !sidebarOpen || Boolean(
    sidebarToggle && toggleTarget && (toggleTarget === sidebarToggle || sidebarToggle.contains(toggleTarget))
  );
  const sidebar = {
    state: sidebarState,
    confidence: sidebarConfidence,
    panelVisible: box(nativeSidebar)?.visible === true,
    skinApplied: Boolean(nativeSidebarPanels.length || nativeSidebarGroups.length || nativeSidebarRows.length),
    groupCount: nativeSidebarGroups.length,
    rowCount: nativeSidebarRows.length,
    artVisible: sidebarArtVisible,
    homeNoCharacterPass: !home || !sidebarArtVisible,
    taskReadabilityPass: home || !sidebarOpen || Boolean(
      uniqueVisiblePanelPass && nativeGeometryPass && sidebarSkinsContained
    ),
    nativeGeometryPass,
    toggleHitTargetPass,
  };
  const expectedArtFamilies = {
    staged: 'taskWarm',
    working: 'taskWarm',
    approval: 'taskApproval',
    error: 'taskError',
    complete: 'taskComplete',
  };
  const expectedArtProperties = {
    taskWarm: '--denia-old-days-art-task-warm',
    taskApproval: '--denia-old-days-art-task-approval',
    taskError: '--denia-old-days-art-task-error',
    taskComplete: '--denia-old-days-art-task-complete',
  };
  const formState = state?.formState || root.dataset.deniaFormState || null;
  const expectedArtFamily = expectedArtFamilies[formState] || null;
  const expectedArtProperty = expectedArtProperties[expectedArtFamily] || '';
  const stateArt = expectedArtProperty ? getComputedStyle(root).getPropertyValue(expectedArtProperty).trim() : '';
  const stateArtUrl = /url\\(["']?([^"')]+)["']?\\)/.exec(stateArt)?.[1] || '';
  const taskRailStyle = stateArtRail ? getComputedStyle(stateArtRail) : null;
  const taskArtLayerStyle = activeStateArtLayer ? getComputedStyle(activeStateArtLayer) : null;
  const nativeHomePrompts = [...document.querySelectorAll('.denia-old-days-ds-native-home-prompt')];
  const nativeHomePrompt = nativeHomePrompts[0] || null;
  const nativeHomePromptStyle = nativeHomePrompt ? getComputedStyle(nativeHomePrompt) : null;
  const nativeHomeSuggestionTargets = [
    ...document.querySelectorAll('.denia-old-days-ds-native-home-suggestions'),
  ];
  const nativeHomeSuggestionsHidden =
    nativeHomeSuggestionTargets.every((node) => getComputedStyle(node).display === 'none');
  const homeScroller = document.querySelector('.dream-skin-home');
  const homeScrollerStyle = homeScroller ? getComputedStyle(homeScroller) : null;
  const composer = document.querySelector('.composer-surface-chrome');
  const composerBeforeStyle = composer ? getComputedStyle(composer, '::before') : null;
  const sidebarBrandNode = document.getElementById('denia-old-days-ds-sidebar-brand');
  const nativeObservations = [...document.querySelectorAll([
    '[data-content-search-unit-key*="tool"]',
    '[data-content-search-unit-key*="reasoning"]',
    '[data-testid*="tool"]',
    '[data-testid*="reasoning"]',
    'details',
  ].join(','))].filter((node) => box(node)?.visible);
  const decoratedObservations = [...document.querySelectorAll('.denia-old-days-ds-observation')]
    .filter((node) => box(node)?.visible);
  const assistants = [...document.querySelectorAll('[data-content-search-unit-key$=":assistant"]')];
  const finalCard = document.querySelector('.denia-old-days-ds-final-card');
  const result = {
    id: state?.id || null,
    version: state?.version || null,
    artReady: Boolean(state?.artReady),
    fastArtPresent: Boolean(brightRuntimeArt),
    darkHomeArtPresent: Boolean(darkRuntimeArt),
    heroUsesRuntimeArt: Boolean(!home || (darkHome
      ? darkRuntimeArtUrl && mainSurfaceBackgroundImage.includes(darkRuntimeArtUrl)
      : brightRuntimeArtUrl && photoFrontBackgroundImage.includes(brightRuntimeArtUrl))),
    heroBackgroundImage,
    photoFrontBackgroundImage,
    mainSurfaceBackgroundImage,
    metrics: state?.metrics || null,
    installed: root.classList.contains('denia-old-days-ds-extension'),
    stylePresent: Boolean(document.getElementById('denia-old-days-dream-skin-extension-style')),
    chromePresent: Boolean(chrome),
    sidebarBrand: box(sidebarBrandNode),
    sidebar,
    home,
    taskMode: root.classList.contains('denia-old-days-ds-task'),
    formState,
    homeVisuals: homeVisualsStyle ? {
      ...box(homeVisuals),
      position: homeVisualsStyle.position,
      overflow: homeVisualsStyle.overflow,
      contain: homeVisualsStyle.contain,
      parentIsBody: homeVisuals.parentElement === document.body,
    } : null,
    heroCopy: box(document.getElementById('denia-old-days-ds-hero-copy')),
    nativeHomePrompt: nativeHomePrompt ? {
      ...box(nativeHomePrompt),
      display: nativeHomePromptStyle.display,
    } : null,
    nativeHomeSuggestions: {
      targetCount: nativeHomeSuggestionTargets.length,
      hidden: nativeHomeSuggestionsHidden,
    },
    homeScroll: homeScroller ? {
      scrollHeight: homeScroller.scrollHeight,
      clientHeight: homeScroller.clientHeight,
      scrollTop: homeScroller.scrollTop,
      overflowY: homeScrollerStyle.overflowY,
    } : null,
    composer: box(composer),
    composerBefore: composerBeforeStyle ? {
      content: composerBeforeStyle.content,
      display: composerBeforeStyle.display,
      width: composerBeforeStyle.width,
      height: composerBeforeStyle.height,
      position: composerBeforeStyle.position,
    } : null,
    task: !home ? {
      stateArtPresent: Boolean(stateArtUrl),
      chromeHostedByMain,
      rail: taskRailStyle ? {
        ...box(stateArtRail),
        display: taskRailStyle.display,
        family: activeStateArtLayer?.dataset.deniaArtFamily || null,
        expectedFamily: expectedArtFamily,
        backgroundImage: taskArtLayerStyle?.backgroundImage || '',
        usesExpectedArt: Boolean(stateArtUrl && taskArtLayerStyle?.backgroundImage.includes(stateArtUrl)),
      } : null,
      nativeObservationCount: nativeObservations.length,
      decoratedObservationCount: decoratedObservations.length,
      finalCard: box(finalCard),
      finalCardIsLatestAssistant: Boolean(finalCard && assistants.at(-1) === finalCard),
    } : null,
    viewport: { width: innerWidth, height: innerHeight },
    overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
  const composerDecorationDisabled = !result.composerBefore
    || result.composerBefore.display === 'none'
    || result.composerBefore.content === 'none'
    || result.composerBefore.content === 'normal';
  result.homeLayoutPreserved = !home || Boolean(
    homeVisuals
      && homeVisualsStyle?.position === 'fixed'
      && homeVisualsStyle?.overflow === 'hidden'
      && homeVisuals.parentElement === document.body
      && document.getElementById('denia-old-days-ds-hero-copy')?.parentElement === homeVisuals
      && nativeHomePrompts.length === 1
      && box(nativeHomePrompt)?.visible === true
      && nativeHomePromptStyle?.display !== 'none'
      && homeScroller
      && homeScroller.scrollHeight <= homeScroller.clientHeight + 1
      && homeScroller.scrollTop === 0
      && homeScrollerStyle?.overflowY === 'hidden'
  );
  const composerRect = composer?.getBoundingClientRect?.() || null;
  result.composerViewportPass = !home || Boolean(
    composerRect
      && composerRect.top >= 0
      && composerRect.bottom <= innerHeight - 8
  );
  const brandMarkerAbsent = !sidebarBrandNode;
  const basePass = result.id === 'denia-old-days' && result.installed && result.stylePresent && result.chromePresent && result.artReady && result.fastArtPresent && brandMarkerAbsent && Boolean(result.composer?.visible) && composerDecorationDisabled && !result.overflowX;
  const homePass = !home || (
    result.homeLayoutPreserved
      && result.heroUsesRuntimeArt
      && Boolean(result.heroCopy?.visible)
      && result.nativeHomeSuggestions.hidden
  );
  const validTaskState = ['staged', 'working', 'approval', 'error', 'complete'].includes(result.formState);
  const railMustBeHidden = innerWidth <= 919;
  const railMatchesState = home || (railMustBeHidden
    ? result.task?.rail?.display === 'none' || result.task?.rail?.visible === false
    : result.task?.rail?.visible === true
      && result.task?.rail?.family === result.task?.rail?.expectedFamily
      && result.task?.rail?.usesExpectedArt === true);
  const noSidebarSkin = nativeSidebarPanels.length === 0
    && nativeSidebarGroups.length === 0
    && nativeSidebarRows.length === 0;
  const sidebarPass = sidebarStateConfidencePass && (sidebarOpen
    ? uniqueVisiblePanelPass
      && result.sidebar.panelVisible
      && result.sidebar.skinApplied
      && sidebarSkinsContained
      && result.sidebar.nativeGeometryPass
      && result.sidebar.toggleHitTargetPass
      && result.sidebar.homeNoCharacterPass
      && result.sidebar.taskReadabilityPass
    : sidebarState === 'closed'
      ? noSidebarSkin && (home || railMatchesState)
      : noSidebarSkin && result.sidebar.homeNoCharacterPass && (home || railMatchesState));
  const observationsPass = home || result.task?.nativeObservationCount === 0
    || result.task?.decoratedObservationCount >= result.task?.nativeObservationCount;
  const finalCardPass = home || (result.formState === 'complete'
    ? Boolean(result.task?.finalCard?.visible) && result.task?.finalCardIsLatestAssistant === true
    : !result.task?.finalCard);
  const taskPass = home || (result.taskMode && validTaskState && result.task?.stateArtPresent === true
    && result.task?.chromeHostedByMain === true
    && railMatchesState && sidebarPass && observationsPass && finalCardPass);
  result.taskPass = Boolean(taskPass);
  result.pass = Boolean(basePass && homePass && sidebarPass && result.taskPass);
  return result;
})()`;

class CdpSession {
  constructor(target) {
    this.target = target;
    this.socket = null;
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
  }

  async connect() {
    this.socket = new WebSocket(this.target.webSocketDebuggerUrl);
    this.socket.onmessage = ({ data }) => {
      const message = JSON.parse(data);
      if (message.id) {
        if (!this.pending.has(message.id)) return;
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(message.error.message || "CDP request failed"));
        else resolve(message.result);
        return;
      }
      for (const listener of this.listeners.get(message.method) || []) listener(message.params || {});
    };
    this.socket.onclose = () => {
      this.closed = true;
      for (const { reject } of this.pending.values()) reject(new Error("CDP session closed"));
      this.pending.clear();
    };
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timed out connecting to Codex renderer")), 5000);
      this.socket.onopen = () => { clearTimeout(timeout); resolve(); };
      this.socket.onerror = () => { clearTimeout(timeout); reject(new Error("Could not connect to Codex renderer")); };
    });
    await this.send("Runtime.enable");
    await this.send("Page.enable");
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) || [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error("CDP session is not open");
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      const description = result.result?.description || result.exceptionDetails.text || "Renderer evaluation failed";
      throw new Error(description);
    }
    return result.result?.value;
  }

  close() {
    this.closed = true;
    try { this.socket?.close(); } catch {}
  }
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function listTargets() {
  const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Dream Skin CDP endpoint returned HTTP ${response.status}`);
  const targets = await response.json();
  return targets.filter((target) =>
    target.type === "page" &&
    target.url === manifest.protocol.target &&
    typeof target.webSocketDebuggerUrl === "string" &&
    target.webSocketDebuggerUrl.startsWith(`ws://127.0.0.1:${port}/`));
}

async function connectBrowserEventStream(onSignal, onClose) {
  const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Dream Skin CDP version endpoint returned HTTP ${response.status}`);
  const version = await response.json();
  const url = new URL(version.webSocketDebuggerUrl || "");
  if (url.protocol !== "ws:" || url.hostname !== "127.0.0.1" || Number(url.port) !== port || !url.pathname.startsWith("/devtools/browser/")) {
    throw new Error("Rejected non-loopback browser CDP endpoint");
  }
  const socket = new WebSocket(url.href);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timed out connecting to browser CDP events")), 5000);
    socket.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
    socket.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Could not connect to browser CDP events")); }, { once: true });
  });
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (["Target.targetCreated", "Target.targetDestroyed", "Target.targetInfoChanged"].includes(message.method)) onSignal();
  });
  socket.addEventListener("close", onClose, { once: true });
  socket.send(JSON.stringify({ id: 1, method: "Target.setDiscoverTargets", params: { discover: true } }));
  return socket;
}

async function connectTarget(target) {
  const session = new CdpSession(target);
  await session.connect();
  return session;
}

async function openHomeRoute(session) {
  await session.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  await session.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 });
  const clicked = await session.evaluate(`(() => {
    const candidate = [...document.querySelectorAll('button,a')].find((node) =>
      /^(new task|new chat|新建任务|新聊天)/i.test((node.innerText || '').trim()));
    if (!candidate) return false;
    candidate.click();
    return true;
  })()`);
  let stableSamples = 0;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await delay(100);
    const ready = await session.evaluate(`(() => {
      const home = document.querySelector('[role="main"].dream-skin-home');
      if (home) home.scrollTop = home.scrollHeight;
      const composer = document.querySelector('.composer-surface-chrome');
      const box = composer?.getBoundingClientRect();
      const visuals = document.getElementById('denia-old-days-ds-home-visuals');
      return Boolean(home
        && box?.width > 0
        && box?.height > 0
        && box.bottom <= innerHeight - 8
        && visuals?.parentElement === document.body
        && getComputedStyle(visuals).position === 'fixed'
        && document.getElementById('denia-old-days-ds-hero-copy')?.parentElement === visuals);
    })()`);
    stableSamples = ready ? stableSamples + 1 : 0;
    if (stableSamples >= 3) break;
  }
  await session.evaluate(`(() => {
    const home = document.querySelector('[role="main"].dream-skin-home');
    if (home) home.scrollTop = home.scrollHeight;
  })()`);
  await delay(150);
}

async function captureScreenshot(session, outputPath) {
  await session.send("Page.enable");
  const result = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, Buffer.from(result.data, "base64"));
}

async function writeRuntimeState(state) {
  if (!statePath) return;
  await fs.mkdir(path.dirname(statePath), { recursive: true, mode: 0o700 });
  const temporary = `${statePath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, statePath);
  await fs.chmod(statePath, 0o600);
}

async function runOnce(operation) {
  const targets = await listTargets();
  if (!targets.length) throw new Error("No verified Codex renderer target is available");
  const results = [];
  for (const target of targets) {
    const session = await connectTarget(target);
    try {
      if (operation === "install") {
        results.push({ targetId: target.id, result: await session.evaluate(installPayload) });
      } else if (operation === "remove") {
        results.push({ targetId: target.id, removed: await session.evaluate(cleanupExpression) });
      } else if (operation === "verify") {
        if (openHome) await openHomeRoute(session);
        const result = await session.evaluate(verifyExpression);
        if (openHome && (!result?.home || !result?.homeLayoutPreserved || !result?.composerViewportPass)) {
          throw new Error("Home verification requires preserved native layout and an in-viewport composer");
        }
        if (screenshotPath) await captureScreenshot(session, path.resolve(screenshotPath));
        results.push({ targetId: target.id, result });
      }
    } finally {
      session.close();
    }
  }
  return results;
}

if (mode === "--once") {
  console.log(JSON.stringify({ mode: "once", extension: manifest.id, targets: await runOnce("install") }, null, 2));
} else if (mode === "--remove-once") {
  console.log(JSON.stringify({ mode: "remove", extension: manifest.id, targets: await runOnce("remove") }, null, 2));
} else if (mode === "--verify") {
  const targets = await runOnce("verify");
  const output = { mode: "verify", extension: manifest.id, version: manifest.version, targets };
  console.log(JSON.stringify(output, null, 2));
  if (!targets.length || targets.some((target) => !target.result?.pass)) process.exitCode = 1;
} else {
  let stopping = false;
  const sessions = new Map();
  let browserEvents = null;
  let pendingWake = true;
  let wakeResolver = null;
  let wakeTimer = null;
  const startedAt = new Date().toISOString();

  const wake = () => {
    pendingWake = true;
    if (!wakeResolver) return;
    const resolve = wakeResolver;
    wakeResolver = null;
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = null;
    pendingWake = false;
    resolve();
  };
  const waitForWake = (milliseconds) => {
    if (pendingWake) {
      pendingWake = false;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      wakeResolver = resolve;
      wakeTimer = setTimeout(() => {
        wakeResolver = null;
        wakeTimer = null;
        resolve();
      }, milliseconds);
    });
  };
  const requestStop = () => { stopping = true; wake(); };
  process.on("SIGTERM", requestStop);
  process.on("SIGINT", requestStop);
  process.on("SIGHUP", requestStop);

  const ensureInstalled = async (session, force = false) => {
    if (session.closed) return;
    if (session.installing) return session.installing;
    session.installing = (async () => {
      if (!force) {
        const current = await session.evaluate(`window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__?.version === ${JSON.stringify(manifest.version)}`);
        if (current) return;
      }
      await session.evaluate(installPayload);
    })().finally(() => { session.installing = null; });
    return session.installing;
  };

  const scheduleReinject = (session) => {
    setTimeout(async () => {
      for (const wait of [0, 32, 96]) {
        if (wait) await delay(wait);
        try {
          await ensureInstalled(session, true);
          return;
        } catch {}
      }
      wake();
    }, 0);
  };

  const syncTargets = async () => {
    const targets = await listTargets();
    const targetIds = new Set(targets.map((target) => target.id));
    for (const [targetId, session] of sessions) {
      if (targetIds.has(targetId) && !session.closed) continue;
      session.close();
      sessions.delete(targetId);
    }
    for (const target of targets) {
      let session = sessions.get(target.id);
      if (!session) {
        session = await connectTarget(target);
        session.on("Page.loadEventFired", () => scheduleReinject(session));
        sessions.set(target.id, session);
        await ensureInstalled(session, true);
        continue;
      }
      try {
        await ensureInstalled(session);
      } catch {
        session.close();
        sessions.delete(target.id);
      }
    }
  };

  const ensureBrowserEvents = async () => {
    if (browserEvents?.readyState === WebSocket.OPEN) return true;
    try {
      let socket;
      socket = await connectBrowserEventStream(wake, () => {
        if (browserEvents === socket) browserEvents = null;
        wake();
      });
      browserEvents = socket;
      return true;
    } catch (error) {
      console.error(`[denia-old-days] target events unavailable, using poll fallback: ${error.message}`);
      browserEvents = null;
      return false;
    }
  };

  await writeRuntimeState({ schemaVersion: 1, extension: manifest.id, version: manifest.version, pid: process.pid, port, status: "starting", startedAt, targets: [] });

  try {
    while (!stopping) {
      const eventDriven = await ensureBrowserEvents();
      try {
        await syncTargets();
      } catch (error) {
        if (!stopping) {
          console.error(`[denia-old-days] target sync failed: ${error.message}`);
        }
      }
      await writeRuntimeState({ schemaVersion: 1, extension: manifest.id, version: manifest.version, pid: process.pid, port, status: "running", startedAt, discovery: eventDriven ? "target-events" : "poll-fallback", targets: [...sessions.keys()] });
      await waitForWake(eventDriven ? 5000 : 500);
    }
  } finally {
    if (wakeTimer) clearTimeout(wakeTimer);
    try { browserEvents?.close(); } catch {}
    for (const session of sessions.values()) {
      try { await session.evaluate(cleanupExpression); } catch {}
      session.close();
    }
    await writeRuntimeState({ schemaVersion: 1, extension: manifest.id, version: manifest.version, pid: process.pid, port, status: "stopped", stoppedAt: new Date().toISOString(), targets: [] }).catch(() => {});
  }
}
