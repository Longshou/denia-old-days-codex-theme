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
const taskWarmPath = path.resolve(extensionDir, manifest.assets.taskWarmArtwork);
const taskDarkPath = path.resolve(extensionDir, manifest.assets.taskDarkArtwork);
const taskCompletePath = path.resolve(extensionDir, manifest.assets.taskCompleteArtwork);
const [
  styleRealPath,
  runtimeRealPath,
  brightRealPath,
  taskWarmRealPath,
  taskDarkRealPath,
  taskCompleteRealPath,
] = await Promise.all([
  resolveExtensionFile(stylePath, manifest.entrypoints.style),
  resolveExtensionFile(runtimePath, manifest.entrypoints.runtime),
  resolveExtensionFile(brightPath, manifest.assets.runtimeWallpaper),
  resolveExtensionFile(taskWarmPath, manifest.assets.taskWarmArtwork),
  resolveExtensionFile(taskDarkPath, manifest.assets.taskDarkArtwork),
  resolveExtensionFile(taskCompletePath, manifest.assets.taskCompleteArtwork),
]);
const [cssText, runtimeTemplate, bright, taskWarm, taskDark, taskComplete] = await Promise.all([
  fs.readFile(styleRealPath, "utf8"),
  fs.readFile(runtimeRealPath, "utf8"),
  fs.readFile(brightRealPath),
  fs.readFile(taskWarmRealPath),
  fs.readFile(taskDarkRealPath),
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
  taskWarm: "__DENIA_OLD_DAYS_EXTENSION_TASK_WARM_ART_JSON__",
  taskDark: "__DENIA_OLD_DAYS_EXTENSION_TASK_DARK_ART_JSON__",
  taskComplete: "__DENIA_OLD_DAYS_EXTENSION_TASK_COMPLETE_ART_JSON__",
});
const templateSentinels = Object.freeze({
  manifest: "@@DENIA_RUNTIME_MANIFEST_7F3A@@",
  css: "@@DENIA_RUNTIME_CSS_7F3A@@",
  bright: "@@DENIA_RUNTIME_BRIGHT_ART_7F3A@@",
  taskWarm: "@@DENIA_RUNTIME_TASK_WARM_ART_7F3A@@",
  taskDark: "@@DENIA_RUNTIME_TASK_DARK_ART_7F3A@@",
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
  .replace(templatePlaceholders.taskWarm, templateSentinels.taskWarm)
  .replace(templatePlaceholders.taskDark, templateSentinels.taskDark)
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
  [templateSentinels.taskWarm, JSON.stringify(imageDataUrl(taskWarmPath, taskWarm))],
  [templateSentinels.taskDark, JSON.stringify(imageDataUrl(taskDarkPath, taskDark))],
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
    'denia-old-days-ds-hero-copy',
    'denia-old-days-ds-hero-badge',
    'denia-old-days-ds-stage-pass',
    'denia-old-days-ds-custom-card',
    'denia-old-days-ds-card-deck',
    'denia-old-days-ds-state-art',
  ]) document.getElementById(id)?.remove();
  root.classList.remove('denia-old-days-ds-extension', 'denia-old-days-ds-home', 'denia-old-days-ds-task');
  delete root.dataset.deniaOldDaysExtensionVersion;
  delete root.dataset.deniaFormState;
  root.style.removeProperty('--denia-old-days-art-bright');
  root.style.removeProperty('--denia-old-days-art-task-warm');
  root.style.removeProperty('--denia-old-days-art-task-dark');
  root.style.removeProperty('--denia-old-days-art-task-complete');
  document.querySelectorAll('.denia-old-days-ds-hero').forEach((node) => {
    for (const property of ['background-image', 'background-position', 'background-size', 'background-repeat', 'background-color']) node.style.removeProperty(property);
  });
  for (const name of ['mode-button', 'native-hero-copy', 'hero', 'suggestions', 'home-main']) {
    document.querySelectorAll('.denia-old-days-ds-' + name).forEach((node) => node.classList.remove('denia-old-days-ds-' + name));
  }
  for (const className of [
    'denia-old-days-ds-native-card',
    'denia-old-days-ds-native-suggestions',
    'denia-old-days-ds-composer',
    'denia-old-days-ds-send',
    'denia-old-days-ds-attachment',
    'denia-old-days-ds-observation',
    'denia-old-days-ds-final-card',
  ]) document.querySelectorAll('.' + className).forEach((node) => node.classList.remove(className));
  document.querySelectorAll('[data-denia-observation-label], [data-denia-old-days-card]').forEach((node) => {
    delete node.dataset.deniaObservationLabel;
    delete node.dataset.deniaOldDaysCard;
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
  const hero = document.querySelector('.denia-old-days-ds-hero');
  const photoFront = document.querySelector('.denia-old-days-ds-photo-front');
  const runtimeArt = getComputedStyle(root).getPropertyValue('--denia-old-days-art-bright').trim();
  const runtimeArtUrl = /url\\(["']?([^"')]+)["']?\\)/.exec(runtimeArt)?.[1] || '';
  const heroBackgroundImage = hero ? getComputedStyle(hero).backgroundImage : '';
  const photoFrontBackgroundImage = photoFront ? getComputedStyle(photoFront).backgroundImage : '';
  const stateArt = getComputedStyle(root).getPropertyValue('--denia-old-days-art-dark').trim();
  const stateArtUrl = /url\\(["']?([^"')]+)["']?\\)/.exec(stateArt)?.[1] || '';
  const taskRailStyle = chrome ? getComputedStyle(chrome, '::after') : null;
  const suggestions = document.getElementById('denia-old-days-ds-card-deck');
  const composer = document.querySelector('.composer-surface-chrome');
  const composerBeforeStyle = composer ? getComputedStyle(composer, '::before') : null;
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
  const cards = suggestions ? [...suggestions.querySelectorAll('button[data-denia-old-days-card]')].map((button) => {
    const item = box(button);
    if (!item) return null;
    const r = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    item.clickable = Boolean(top && (top === button || button.contains(top)));
    item.id = button.id || null;
    item.display = style.display;
    item.visibility = style.visibility;
    item.opacity = style.opacity;
    item.disabled = Boolean(button.disabled);
    item.parentClass = button.parentElement?.className || null;
    item.ancestors = [];
    for (let node = button.parentElement; node && node !== suggestions; node = node.parentElement) {
      const ancestorStyle = getComputedStyle(node);
      item.ancestors.push({
        className: typeof node.className === 'string' ? node.className : '',
        ...box(node),
        display: ancestorStyle.display,
        overflow: ancestorStyle.overflow,
        transform: ancestorStyle.transform,
      });
    }
    return item;
  }).filter(Boolean) : [];
  const suggestionsStyle = suggestions ? getComputedStyle(suggestions) : null;
  const result = {
    id: state?.id || null,
    version: state?.version || null,
    artReady: Boolean(state?.artReady),
    fastArtPresent: Boolean(runtimeArt),
    heroUsesRuntimeArt: Boolean(!home || (runtimeArtUrl && photoFrontBackgroundImage.includes(runtimeArtUrl))),
    heroBackgroundImage,
    photoFrontBackgroundImage,
    metrics: state?.metrics || null,
    installed: root.classList.contains('denia-old-days-ds-extension'),
    stylePresent: Boolean(document.getElementById('denia-old-days-dream-skin-extension-style')),
    chromePresent: Boolean(chrome),
    sidebarBrand: box(document.getElementById('denia-old-days-ds-sidebar-brand')),
    home,
    taskMode: root.classList.contains('denia-old-days-ds-task'),
    formState: state?.formState || root.dataset.deniaFormState || null,
    heroCopy: box(document.getElementById('denia-old-days-ds-hero-copy')),
    cards,
    suggestions: suggestions ? {
      ...box(suggestions),
      display: suggestionsStyle.display,
      gridTemplateColumns: suggestionsStyle.gridTemplateColumns,
      childCount: suggestions.children.length,
    } : null,
    visibleCardCount: cards.filter((card) => card.visible).length,
    clickableCardCount: cards.filter((card) => card.clickable).length,
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
      rail: taskRailStyle ? {
        backgroundImage: taskRailStyle.backgroundImage,
        display: taskRailStyle.display,
        opacity: Number(taskRailStyle.opacity || 0),
        visible: taskRailStyle.display !== 'none'
          && taskRailStyle.visibility !== 'hidden'
          && Number(taskRailStyle.opacity || 0) > 0
          && Boolean(stateArtUrl && taskRailStyle.backgroundImage.includes(stateArtUrl)),
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
  const basePass = result.id === 'denia-old-days' && result.installed && result.stylePresent && result.chromePresent && result.artReady && result.fastArtPresent && Boolean(result.sidebarBrand?.visible) && Boolean(result.composer?.visible) && composerDecorationDisabled && !result.overflowX;
  const homePass = !home || (result.heroUsesRuntimeArt && Boolean(result.heroCopy?.visible) && result.visibleCardCount === 4 && result.clickableCardCount === 4);
  const validTaskState = ['staged', 'working', 'approval', 'error', 'complete'].includes(result.formState);
  const activeRailState = ['approval', 'error'].includes(result.formState);
  const railHiddenForViewport = innerWidth <= 919;
  const railMatchesState = home || (activeRailState && !railHiddenForViewport
    ? result.task?.rail?.visible === true
    : Number(result.task?.rail?.opacity || 0) === 0 || result.task?.rail?.display === 'none');
  const observationsPass = home || result.task?.nativeObservationCount === 0
    || result.task?.decoratedObservationCount >= result.task?.nativeObservationCount;
  const finalCardPass = home || (result.formState === 'complete'
    ? Boolean(result.task?.finalCard?.visible) && result.task?.finalCardIsLatestAssistant === true
    : !result.task?.finalCard);
  const taskPass = home || (result.taskMode && validTaskState && result.task?.stateArtPresent === true
    && railMatchesState && observationsPass && finalCardPass);
  result.taskPass = Boolean(taskPass);
  result.pass = Boolean(basePass && homePass && result.taskPass);
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
  if (clicked) {
    let stableSamples = 0;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await delay(100);
      const ready = await session.evaluate(`(() => {
        const home = document.querySelector('[role="main"].dream-skin-home');
        const deck = document.getElementById('denia-old-days-ds-card-deck');
        const cards = deck ? [...deck.querySelectorAll('button[data-denia-old-days-card]')] : [];
        return Boolean(home && cards.length === 4 && cards.every((button) => {
          const box = button.getBoundingClientRect();
          const style = getComputedStyle(button);
          return box.width > 0 && box.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;
        }));
      })()`);
      stableSamples = ready ? stableSamples + 1 : 0;
      if (stableSamples >= 2) break;
    }
  }
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
