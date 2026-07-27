import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(process.argv[2] || path.join(import.meta.dirname, ".."));
const realRoot = await fs.realpath(root);
const canonSourcesPath = path.join(root, "..", "canon", "sources.md");
let canonSources = null;
try {
  canonSources = await fs.readFile(canonSourcesPath, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const resolvePackageFile = async (relative) => {
  const file = path.resolve(root, relative);
  assert(file.startsWith(`${root}${path.sep}`), `path escapes package: ${relative}`);
  let realFile;
  try {
    realFile = await fs.realpath(file);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`missing sidecar/${relative}`);
    throw new Error(`could not resolve sidecar/${relative}`, { cause: error });
  }
  assert(realFile.startsWith(`${realRoot}${path.sep}`), `real path escapes package: ${relative}`);
  return { file, realFile };
};

const readRequired = async (relative) => {
  const { file, realFile } = await resolvePackageFile(relative);
  const stat = await fs.lstat(file);
  assert(!stat.isSymbolicLink(), `symbolic links are not allowed: ${relative}`);
  assert(stat.isFile() && stat.size > 0, `missing or empty sidecar/${relative}`);
  return await fs.readFile(realFile, "utf8");
};

const manifest = JSON.parse(await readRequired("extension.json"));
assert(manifest.schemaVersion === 1, "schemaVersion must be 1");
assert(manifest.id === "denia-old-days", "unexpected extension id");
assert(manifest.version === "0.1.0", "unexpected extension version");
assert(manifest.protocol?.kind === "codex-dream-skin-sidecar", "unexpected protocol kind");
assert(manifest.protocol?.transport === "cdp-loopback-v1", "transport must be loopback CDP");
assert(manifest.protocol?.target === "app://-/index.html", "renderer target must be exact");
assert(manifest.protocol?.minimumDreamSkinVersion === "1.2.0", "minimum Dream Skin version must be 1.2.0");
assert(manifest.entrypoints?.style === "src/denia-old-days-extension.css", "unexpected style entrypoint");
assert(manifest.entrypoints?.runtime === "src/denia-old-days-extension.js", "unexpected runtime entrypoint");
const expectedAssets = {
  runtimeWallpaper: "assets/denia-old-days-bright.webp",
  taskWarmArtwork: "assets/denia-task-warm.webp",
  taskApprovalArtwork: "assets/denia-task-approval.webp",
  taskErrorArtwork: "assets/denia-task-error.webp",
  taskCompleteArtwork: "assets/denia-task-complete.webp",
};
for (const [key, value] of Object.entries(expectedAssets)) {
  assert(manifest.assets?.[key] === value, `unexpected ${key}`);
}
assert(manifest.cleanup?.stateKey === "__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__", "unexpected cleanup stateKey");
assert(manifest.cleanup?.styleId === "denia-old-days-dream-skin-extension-style", "unexpected cleanup styleId");
assert(manifest.cleanup?.rootClass === "denia-old-days-ds-extension", "unexpected cleanup rootClass");
assert(Array.isArray(manifest.capabilities) && manifest.capabilities.includes("runtime.cleanup"), "runtime cleanup capability is required");
assert(manifest.capabilities.includes("runtime.multi-art-preload"), "multi-art preload capability is required");
assert(manifest.capabilities.includes("task.state-art-rail"), "state art rail capability is required");

if (canonSources) {
  const officialRows = new Map(
    canonSources.split("\n")
      .filter((line) => /^\| (?:Home|Legacy stage|Warm rail|Dark rail|Complete rail|Wide scene|Approval rail|Error rail) \|/u.test(line))
      .map((line) => [line.split("|")[1].trim(), line]),
  );
  const officialSourceUrls = {
    Home: ["https://www.kurobbs.com/mc/post/1507356224033308672"],
    "Legacy stage": ["https://www.kurobbs.com/mc/post/1508896679676882944"],
    "Warm rail": ["https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust"],
    "Dark rail": ["https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust"],
    "Complete rail": ["https://x.com/WW_JP_Official/status/2049081192532557960"],
    "Wide scene": ["https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust"],
    "Approval rail": ["https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust"],
    "Error rail": ["https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust"],
  };
  for (const [form, urls] of Object.entries(officialSourceUrls)) {
    const row = officialRows.get(form) || "";
    for (const url of urls) assert(row.includes(url), `${form} official source row must include ${url}`);
  }
  const exactSourceHashes = {
    "Approval rail": "3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0",
    "Error rail": "42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4",
  };
  for (const [form, hash] of Object.entries(exactSourceHashes)) {
    assert(officialRows.get(form)?.includes(`\`${hash}\``), `${form} official source row must include exact SHA-256 ${hash}`);
  }
}

const required = [
  manifest.entrypoints.style,
  manifest.entrypoints.runtime,
  ...new Set(Object.values(manifest.assets || {})),
  "runtime/loader.mjs",
  "scripts/common.sh",
  "scripts/install.sh",
  "scripts/start.sh",
  "scripts/status.sh",
  "scripts/stop.sh",
  "scripts/uninstall.sh",
  "scripts/verify.sh",
  "tests/validate.mjs",
  "package.sh",
  "README.md",
  "NOTICE.md",
  "LICENSE",
];

for (const relative of required) {
  assert(typeof relative === "string" && relative && !path.isAbsolute(relative) && !relative.split(path.sep).includes(".."), `unsafe manifest path: ${relative}`);
  await readRequired(relative);
}

const [loader, styles, runtime, packageReadme, packageNotice, ...scripts] = await Promise.all([
  readRequired("runtime/loader.mjs"),
  readRequired(manifest.entrypoints.style),
  readRequired(manifest.entrypoints.runtime),
  readRequired("README.md"),
  readRequired("NOTICE.md"),
  ...["common.sh", "install.sh", "start.sh", "status.sh", "stop.sh", "uninstall.sh", "verify.sh"]
    .map((name) => readRequired(`scripts/${name}`)),
]);
const combinedExtensionSource = [JSON.stringify(manifest), styles, runtime, loader].join("\n");
for (const removedToken of [
  "cardLabels",
  "home.suggestion-cards",
  "denia-old-days-ds-suggestion-slot",
  "denia-old-days-ds-card-deck",
  "denia-old-days-ds-native-card",
  "denia-old-days-ds-native-suggestions",
  "nativeSuggestionButtons",
  "ensureSuggestionDeck",
]) {
  assert(!combinedExtensionSource.includes(removedToken), `removed suggestion token must be absent: ${removedToken}`);
}
const startScript = scripts[2];
const launchBootstrapIndex = startScript.lastIndexOf('/bin/launchctl bootstrap "$LAUNCH_DOMAIN" "$LAUNCH_PLIST"');
const launchKickstartIndex = startScript.indexOf('/bin/launchctl kickstart -k "$LAUNCH_DOMAIN/$LAUNCH_LABEL"');
assert(
  launchBootstrapIndex >= 0 && launchKickstartIndex > launchBootstrapIndex,
  "start script must kickstart the LaunchAgent after bootstrap",
);
const packageDocumentation = `${packageReadme}\n${packageNotice}`;
assert(!/同一暗色图|approval\s*\/\s*error|approval\s+and\s+error[^.\n]*(?:same|shared)/iu.test(packageDocumentation), "README/NOTICE must not claim approval and error share one image");
for (const hash of [
  "3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0",
  "42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4",
]) {
  assert(packageNotice.includes(hash), `NOTICE must include official source SHA-256 ${hash}`);
}

const runtimeTokens = [
  "__DENIA_OLD_DAYS_EXTENSION_MANIFEST_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_CSS_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_BRIGHT_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_TASK_WARM_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_TASK_APPROVAL_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_TASK_ERROR_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_TASK_COMPLETE_ART_JSON__",
];
for (const token of runtimeTokens) {
  assert(runtime.split(token).length - 1 === 1, `runtime template must contain ${token} exactly once`);
  assert(loader.includes(token), `loader must stage ${token}`);
}
const runtimeReplacements = new Map([
  [runtimeTokens[0], JSON.stringify(manifest)],
  [runtimeTokens[1], JSON.stringify(styles)],
  ...runtimeTokens.slice(2).map((token) => [token, JSON.stringify("data:image/webp;base64,AA==")]),
]);
let runtimePayload = runtime;
for (const [token, replacement] of runtimeReplacements) runtimePayload = runtimePayload.replace(token, replacement);
assert(!/__DENIA_OLD_DAYS_EXTENSION_[A-Z_]+__/u.test(runtimePayload), "runtime payload must not retain template tokens");
assertNativeRightSidebarLifecycle(runtimePayload);
assertNativeWorkSurfaceLifecycle(runtimePayload);
assertComposerIsolation(runtimePayload);
assertRuntimeArtworkLifecycle(runtimePayload);
assertPublicStateUrlCollectionCoverage();
assertLiveVerificationArtworkTarget(loader);
assertLiveTaskVerification(loader);
assertFallbackCleanupBehavior(loader);
assertHomeLayoutPreservation(runtimePayload);
assertFormStateRecognition(runtimePayload);
assertStateArtRailLifecycle(runtimePayload);
assertIncrementalTaskDecoration(runtimePayload);
assertObserverStability(runtimePayload);
assertFinalReviewRegressions(runtimePayload);

assert(loader.includes("127.0.0.1"), "loader must bind to loopback");
assert(!loader.includes("0.0.0.0"), "loader must not use a wildcard host");
assert(loader.includes("Target.setDiscoverTargets"), "loader must subscribe to target discovery");
assert(loader.includes("__DENIA_OLD_DAYS_EXTENSION_CSS_JSON__"), "loader must inject CSS token");
assert(loader.includes("__DENIA_OLD_DAYS_EXTENSION_MANIFEST_JSON__"), "loader must inject manifest token");
for (const token of runtimeTokens.slice(2)) assert(loader.includes(token), `loader missing ${token}`);
for (const assetKey of Object.keys(expectedAssets)) {
  assert(loader.includes(`manifest.assets.${assetKey}`), `loader must resolve ${assetKey}`);
}
assert(loader.includes("--denia-old-days-art-bright"), "live verification must read bright artwork variable");
assert(loader.includes("denia-old-days-ds-home-visuals"), "loader cleanup and verification must recognize the out-of-flow home visual layer");
assert(loader.includes("homeLayoutPreserved"), "live verification must enforce native home layout preservation");
assert(loader.includes("composerViewportPass"), "live verification must keep the home composer inside the viewport");

for (const token of [
  "ensureSidebarBrand",
  "ensureHomeVisuals",
  "ensureHomeHero",
  "findNativeHomeTitle",
  "syncNativeHomePrompt",
  "ensureStateArt",
  "syncStateArt",
  "syncHomeViewport",
  "decorateComposer",
  "decorateTaskRoots",
  "syncFinalAssistantCard",
  "syncNativeLeftSidebar",
  "deriveFormState",
  "scheduleRefresh",
  "requestAnimationFrame",
  "MutationObserver",
  "prefers-reduced-motion",
  "transitionend",
  "cleanup",
]) assert(runtime.includes(token), `runtime missing ${token}`);

assert((runtime.match(/new MutationObserver\s*\(/gu) || []).length === 1, "runtime must create exactly one MutationObserver");
assert(runtime.includes("attributeOldValue: true"), "runtime observer must request attribute old values");
assert(!runtime.includes("setInterval("), "runtime must not use setInterval");
assert(runtime.includes("URL.revokeObjectURL"), "runtime cleanup must revoke object URL");
assert(runtime.includes("Object.freeze({"), "runtime must freeze artwork URL map");
assert(runtime.includes("Object.values(artUrls).every(Boolean)"), "runtime must require every artwork URL");
assert(runtime.includes("Object.values(artUrls)"), "runtime must clean every artwork URL");
for (const name of ["bright", "task-warm", "task-approval", "task-error", "task-complete"]) {
  assert(runtime.includes(`--denia-old-days-art-${name}`), `runtime missing ${name} artwork variable`);
}
assert(!runtime.includes("denia-old-days-ds-photo-back"), "home hero must not include generic photo-back markup");
assert(runtime.includes("denia-old-days-ds-memory-bubbles"), "home hero must own its memory bubbles");
assert(!runtime.includes("denia-old-days-ds-state-bubble"), "decorative bubbles must stay in background artwork, not foreground chrome");
assert(!runtime.includes("denia-old-days-ds-star"), "runtime must retire the star state mark");
assert(!runtime.includes("denia-old-days-ds-tape"), "P2 polaroid must not use generic tape");
assert(runtime.includes("data-content-search-unit-key"), "runtime must mark completed assistant units");
assert(!runtime.includes("fetch("), "injected runtime must not make network requests");
assert(
  runtime.includes(".filter((button) => pattern.test(normalizedNodeLabel(button)) && visible(button))"),
  "native toggle discovery must reject unrelated labels before geometry reads",
);

for (const color of ["#EAF7F7", "#8FD2DD", "#F29AAB", "#6FB8E7", "#F7D88A", "#263548", "#11162F", "#7556D9", "#E45AA8", "#C5415D"]) {
  assert(styles.toUpperCase().includes(color), `stylesheet missing ${color}`);
}
for (const token of [
  ".denia-old-days-ds-extension",
  "data-denia-form-state=\"working\"",
  "data-denia-form-state=\"approval\"",
  "data-denia-form-state=\"error\"",
  "max-width: 1199px",
  "max-width: 919px",
  "max-height: 759px",
  "prefers-reduced-motion: reduce",
  "pointer-events: none",
  ":focus-visible",
]) assert(styles.includes(token), `stylesheet missing ${token}`);

const cssSyntax = scanCssSyntax(styles);
const activeStyles = cssSyntax.source;
assert(!activeStyles.includes(".denia-old-days-ds-photo-back"), "default hero must not contain a dark reverse");
for (const token of [
  "--denia-old-days-art-bright",
  "--denia-old-days-art-task-warm",
  "--denia-old-days-art-task-approval",
  "--denia-old-days-art-task-error",
  "--denia-old-days-art-task-complete",
  ".denia-old-days-ds-photo-front",
  ".denia-old-days-ds-state-art",
  ".denia-old-days-ds-state-art-current",
  ".denia-old-days-ds-state-art-next",
  ".denia-old-days-ds-state-art-tint",
  ".denia-old-days-ds-native-left-sidebar",
  "prefers-reduced-transparency: reduce",
]) assert(activeStyles.includes(token), `stylesheet missing ${token}`);

const stylesheetRules = parseCssRules(cssSyntax);
for (const selector of [
  ".denia-old-days-ds-chrome::before",
  ".denia-old-days-ds-hero::before",
]) {
  assert(
    !stylesheetRules.some((rule) => rule.selectors.includes(selector)),
    `stylesheet must not define center-spine selector ${selector}`,
  );
}
assert(
  !stylesheetRules.some((rule) =>
    rule.selectors.includes(".denia-old-days-ds-extension ::selection")),
  "stylesheet must not apply selection styling to every renderer descendant",
);
assertCssScannerCoverage();
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero", {
  "grid-template-columns": "minmax(340px, .85fr) minmax(460px, 1.15fr)",
  "column-gap": "clamp(34px, 4.5vw, 64px)",
  width: "min(1120px, calc(100% - 32px))",
  margin: "clamp(16px, 3vh, 32px) auto 16px",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", {
  position: "relative",
  isolation: "isolate",
  "align-self": "center",
  width: "min(100%, 610px)",
  "aspect-ratio": "16 / 10",
  "min-height": "0",
  margin: "0",
  padding: "13px 13px 57px",
  "border-radius": "6px",
  transform: "rotate(-1.5deg)",
  "pointer-events": "none",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo-front", {
  position: "absolute",
  inset: "13px 13px 57px",
  background: "var(--denia-old-days-art-bright) center / cover no-repeat",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo::after", {
  "pointer-events": "none",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo::before", {
  content: '""',
  position: "absolute",
  "z-index": "-1",
  transform: "rotate(1.2deg)",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-memory-bubbles", {
  "pointer-events": "none",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-home-visuals", {
  position: "fixed",
  top: "var(--denia-home-visual-top, 0)",
  left: "var(--denia-home-visual-left, 0)",
  width: "var(--denia-home-visual-width, 100%)",
  height: "var(--denia-home-visual-height, 100%)",
  "min-height": "0",
  overflow: "hidden",
  contain: "layout paint style",
  "pointer-events": "none",
});
const homeSidebarOpeningVisualSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-denia-sidebar-state="unknown"][data-denia-sidebar-toggle-state="open"] .denia-old-days-ds-home-visuals';
const homeSidebarClosingVisualSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-denia-sidebar-state="unknown"][data-denia-sidebar-toggle-state="closed"] .denia-old-days-ds-home-visuals';
assertCssDeclarations(stylesheetRules, homeSidebarOpeningVisualSelector, {
  width: "calc(var(--denia-home-visual-width, 100%) - var(--denia-native-sidebar-width, 0px))",
  transition: "width 350ms ease",
});
assertCssDeclarations(stylesheetRules, homeSidebarClosingVisualSelector, {
  width: "calc(var(--denia-home-visual-width, 100%) + var(--denia-native-sidebar-width, 0px))",
  transition: "width 350ms ease",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-home .dream-skin-home", {
  "overflow-y": "hidden !important",
  "scrollbar-gutter": "auto !important",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-home .dream-skin-home > div:has(> .home-banners:empty)", {
  display: "none !important",
});
assertCssDeclarations(stylesheetRules, '.denia-old-days-ds-native-home-prompt [class*="heading-xl"]::after', {
  display: "none !important",
  content: "none !important",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-native-home-prompt", {
  position: "relative",
  "z-index": "1",
  translate: "0 var(--denia-old-days-native-prompt-shift, 0)",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-native-home-suggestions", {
  display: "none !important",
});
const composerPaintProperties = new Set([
  "background",
  "background-color",
  "background-image",
  "backdrop-filter",
  "-webkit-backdrop-filter",
  "border-color",
  "border-radius",
  "box-shadow",
  "color",
  "filter",
  "opacity",
]);
for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) => selector.includes(".denia-old-days-ds-composer"))) continue;
  assert(
    rule.selectors.every((selector) => !selector.includes("::")),
    "composer skin must not replace Codex native pseudo-elements",
  );
  for (const property of rule.declarations.keys()) {
    assert(
      composerPaintProperties.has(property),
      `composer skin must be paint-only and cannot set ${property}`,
    );
  }
}
assertArtworkVariableWhitelist(stylesheetRules, new Map([
  ["--denia-old-days-art-bright", {
    selector: ".denia-old-days-ds-photo-front",
    property: "background",
    atRuleFragments: [],
  }],
  ["--denia-old-days-art-task-warm", {
    selector: '.denia-old-days-ds-state-art-layer[data-denia-art-family="taskWarm"]',
    property: "--denia-state-art-image",
    atRuleFragments: [],
  }],
  ["--denia-old-days-art-task-approval", {
    selector: '.denia-old-days-ds-state-art-layer[data-denia-art-family="taskApproval"]',
    property: "--denia-state-art-image",
    atRuleFragments: [],
  }],
  ["--denia-old-days-art-task-error", {
    selector: '.denia-old-days-ds-state-art-layer[data-denia-art-family="taskError"]',
    property: "--denia-state-art-image",
    atRuleFragments: [],
  }],
  ["--denia-old-days-art-task-complete", {
    selector: '.denia-old-days-ds-state-art-layer[data-denia-art-family="taskComplete"]',
    property: "--denia-state-art-image",
    atRuleFragments: [],
  }],
]));
assert(
  !stylesheetRules.some((rule) => rule.selectors.some((selector) => selector.includes(":hover") && selector.includes("denia-old-days-ds-photo"))),
  "home photo must not use hover flip selectors",
);

const taskRailSelector = ".denia-old-days-ds-state-art";
assertCssDeclarations(stylesheetRules, taskRailSelector, {
  position: "absolute",
  inset: "46px 0 0 auto",
  width: "var(--denia-state-rail-width)",
  overflow: "hidden",
  isolation: "isolate",
  "pointer-events": "none",
  "border-inline-start": "1px solid rgba(89, 132, 145, .14)",
  "mask-image": "linear-gradient(90deg, transparent 0, #000 42px)",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-chrome", {
  "z-index": "2",
});
assert(!activeStyles.includes(".denia-old-days-ds-task .denia-old-days-ds-chrome::after"), "retired pseudo-element task rail must be removed");
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-state-art-layer", {
  position: "absolute",
  inset: "0",
  "background-image": "var(--denia-state-art-image)",
  "background-position": "center",
  "background-size": "cover",
  opacity: "0",
  transform: "translateX(12px) scale(.985)",
  transition: "opacity 300ms cubic-bezier(.22, 1, .36, 1), transform 360ms cubic-bezier(.22, 1, .36, 1), filter 360ms cubic-bezier(.22, 1, .36, 1)",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-state-art-layer.is-active", {
  opacity: "var(--denia-state-art-opacity)",
  transform: "none",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-state-art-layer.is-leaving", {
  opacity: "0",
  transform: "translateX(8px)",
  "transition-duration": "180ms",
  "transition-delay": "0ms",
});
for (const selector of ['.denia-old-days-ds-task [role="main"]', ".denia-old-days-ds-task main"]) {
  const rule = stylesheetRules.find((candidate) => candidate.selectors.includes(selector));
  assert(!rule?.declarations.has("z-index"), `task main must not create a theme stacking context: ${selector}`);
}
const sidebarPaintProperties = new Set([
  "background",
  "background-color",
  "background-image",
  "border-color",
  "border-radius",
  "box-shadow",
  "color",
  "outline-color",
  "transition",
  "transition-duration",
]);
const nativeSidebarClasses = [
  ".denia-old-days-ds-native-left-sidebar",
  ".denia-old-days-ds-native-right-sidebar",
  ".denia-old-days-ds-native-sidebar-group",
  ".denia-old-days-ds-native-sidebar-row",
];
for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) => nativeSidebarClasses.some((className) => selector.includes(className)))) continue;
  for (const property of rule.declarations.keys()) {
    assert(sidebarPaintProperties.has(property), `native sidebar selector must stay paint-only: ${property}`);
  }
  for (const value of rule.declarations.values()) {
    assert(!value.includes("--denia-old-days-art-"), "native sidebar surfaces must not use character artwork variables");
  }
}
assertCssDeclarations(stylesheetRules, '.denia-old-days-ds-extension:not([data-denia-sidebar-state="closed"]) .denia-old-days-ds-state-art', {
  opacity: "0",
  visibility: "hidden",
});
assertCssDeclarations(stylesheetRules, '.denia-old-days-ds-extension[data-denia-work-surface-state="open"] .denia-old-days-ds-state-art', {
  opacity: "0",
  visibility: "hidden",
});
const nativeSidebarPanelSelector = ".denia-old-days-ds-extension .denia-old-days-ds-native-right-sidebar";
const nativeSidebarGroupSelector = ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-group";
const nativeLeftSidebarHostSelector = "html.codex-dream-skin.denia-old-days-ds-extension[data-denia-form-state][data-denia-sidebar-state][data-denia-sidebar-confidence] aside.app-shell-left-panel.denia-old-days-ds-native-left-sidebar";
const nativeSidebarPanelRule = findCssRule(stylesheetRules, nativeSidebarPanelSelector);
const nativeSidebarGroupRule = findCssRule(stylesheetRules, nativeSidebarGroupSelector);
assert(
  !canonicalCssValue(nativeSidebarPanelRule.declarations.get("background")).includes("!important"),
  "native sidebar base shorthand must not lock background-image with !important",
);
assertCssDeclarations(stylesheetRules, nativeSidebarPanelSelector, {
  "background-color": "rgba(255, 252, 249, .992) !important",
  "background-image": "radial-gradient(circle at 88% 8%, rgba(242, 154, 171, .14), transparent 24%), radial-gradient(circle at 12% 22%, rgba(143, 210, 221, .15), transparent 28%), repeating-linear-gradient(0deg, transparent 0 31px, rgba(111, 184, 231, .052) 31px 32px)",
});
assertCssDeclarations(stylesheetRules, nativeLeftSidebarHostSelector, {
  color: "var(--denia-ink) !important",
  background: "radial-gradient(circle at 14% 8%, rgba(143, 210, 221, .15), transparent 24%), radial-gradient(circle at 92% 18%, rgba(242, 154, 171, .1), transparent 28%), repeating-linear-gradient(0deg, transparent 0 31px, rgba(111, 184, 231, .04) 31px 32px), rgb(255, 252, 249) !important",
  "box-shadow": "inset -2px 0 rgba(111, 184, 231, .3), inset -1px 0 rgba(255, 255, 255, .9), inset -10px 0 26px rgba(111, 184, 231, .045), 10px 0 30px rgba(38, 53, 72, .075) !important",
});
const nativeSidebarHomeRule = findCssRule(stylesheetRules, ".denia-old-days-ds-extension.denia-old-days-ds-home .denia-old-days-ds-native-right-sidebar");
assert(
  nativeSidebarHomeRule.sourceIndex > nativeSidebarPanelRule.sourceIndex
    && nativeSidebarHomeRule.declarations.has("background-image")
    && !canonicalCssValue(nativeSidebarHomeRule.declarations.get("background-image")).includes("!important"),
  "home sidebar background-image must follow and override the unlocked base image",
);
assert(
  rgbaAlpha(nativeSidebarPanelRule.declarations.get("background-color")) >= .97,
  "native sidebar panel surface must be at least .97 opaque",
);
assert(
  rgbaAlpha(nativeSidebarGroupRule.declarations.get("background")) >= .98,
  "native sidebar group surface must be at least .98 opaque",
);
const taskLayoutProperties = /^(?:width|min-width|max-width|margin(?:-.+)?|padding(?:-.+)?|grid(?:-.+)?|flex(?:-.+)?)$/u;
const taskContentAlignmentSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-sidebar-state="closed"][data-denia-work-surface-state="closed"] main .thread-scroll-container [class*="mx-auto"][class*="thread-content-max-width"]';
const taskClosedWorkSurfaceMotionSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-sidebar-state="closed"][data-denia-work-surface-state="closed"] main .thread-scroll-container > [class*="min-h-full"][class*="shrink-0"]';
const taskSidebarClosingAlignmentSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-sidebar-state="unknown"][data-denia-sidebar-toggle-state="closed"][data-denia-summary-state="closed"][data-denia-bottom-panel-state="closed"] main .thread-scroll-container [class*="mx-auto"][class*="thread-content-max-width"]';
const taskContentAlignmentRule = findCssRule(stylesheetRules, taskContentAlignmentSelector);
const taskSidebarClosingAlignmentRule = findCssRule(stylesheetRules, taskSidebarClosingAlignmentSelector);
assert(
  taskContentAlignmentRule?.selectors.length === 1,
  "task content alignment must use one closed-work-surface selector without grouped open-state fallbacks",
);
assert(
  taskSidebarClosingAlignmentRule?.selectors.length === 1,
  "task sidebar closing alignment must use one exact transition-state selector",
);
for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) => selector.includes(".denia-old-days-ds-task"))) continue;
  for (const property of rule.declarations.keys()) {
    if ((rule.selectors.includes(taskContentAlignmentSelector)
        || rule.selectors.includes(taskSidebarClosingAlignmentSelector))
      && ["margin-inline-start", "margin-inline-end"].includes(property)) continue;
    assert(!taskLayoutProperties.test(property), `task stylesheet must not override native layout property ${property}`);
  }
}
assertCssDeclarations(stylesheetRules, taskContentAlignmentSelector, {
  "margin-inline-start": "max(16px, calc((var(--denia-thread-content-width, 100cqw) - var(--thread-content-max-width) - var(--denia-state-rail-width)) / 2)) !important",
  "margin-inline-end": "auto !important",
});
assertCssDeclarations(stylesheetRules, taskClosedWorkSurfaceMotionSelector, {
  transform: "none !important",
  transition: "none !important",
});
assertCssDeclarations(stylesheetRules, taskSidebarClosingAlignmentSelector, {
  "margin-inline-start": "max(16px, calc((var(--denia-thread-content-width, 100cqw) - var(--thread-content-max-width) - var(--denia-state-rail-width)) / 2)) !important",
  "margin-inline-end": "auto !important",
  transition: "none !important",
  animation: "denia-old-days-sidebar-close-align 160ms cubic-bezier(.22, 1, .36, 1) both",
});
assertCssDeclarations(stylesheetRules, "from", {
  translate: "calc((var(--denia-state-rail-width) - var(--denia-native-sidebar-width, var(--denia-state-rail-width))) / 2) 0",
}, ["@keyframes denia-old-days-sidebar-close-align"]);
assertCssDeclarations(stylesheetRules, "to", {
  translate: "0 0",
}, ["@keyframes denia-old-days-sidebar-close-align"]);
assert(
  runtime.includes("if (home) {\n      ensureSidebarBrand();")
    && runtime.includes("syncHomeViewport(findMain());")
    && runtime.includes("clearHomeViewportBinding();\n      removeSidebarBrand();"),
  "sidebar brand must be created only on home and removed on task routes",
);
assert(!runtime.includes("sidebar.prepend(brand)"), "home branding must not become a horizontal sibling of the native sidebar column");
assert(
  runtime.includes('const brandHost = sidebar.matches("nav") ? sidebar : sidebar.querySelector("nav");')
    && runtime.includes("brandHost.insertBefore(brand, brandHost.children[1] || null);"),
  "home branding must mount inside the native vertical navigation column",
);
for (const [state, family, opacity] of [
  ["staged", "taskWarm", ".11"],
  ["working", "taskWarm", ".20"],
  ["approval", "taskApproval", ".43"],
  ["error", "taskError", ".56"],
  ["complete", "taskComplete", ".28"],
]) {
  assert(
    runtime.includes(`${state}: Object.freeze({ family: "${family}", opacity: "${opacity}" })`),
    `runtime state art mapping missing ${state} ${family} ${opacity}`,
  );
}
assert(!activeStyles.includes(".denia-old-days-ds-state-bubble"), "foreground chrome must not render decorative bubbles");
assertCssDeclarations(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="working"] .denia-old-days-ds-state-art-layer[data-denia-art-family="taskWarm"].is-active',
  { filter: "saturate(1) contrast(1.1)", transform: "translateX(-3px) scale(1.015)" },
);
assertCssDeclarations(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="error"] .denia-old-days-ds-state-art-layer[data-denia-art-family="taskError"].is-active',
  { filter: "brightness(.92) saturate(1.04) contrast(1.08)", transform: "translateX(-2px) scale(1.015)", "transition-duration": "220ms, 260ms, 260ms" },
);
assertCssDeclarations(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="error"] .denia-old-days-ds-state-art',
  { "border-inline-start-color": "rgba(228, 90, 168, .32)" },
);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-final-card::before", {
  background: "linear-gradient(100deg, var(--denia-gold), rgba(143, 210, 221, .28), var(--denia-pink))",
});

const compactMedia = ["max-width: 1199px", "max-height: 759px"];
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero", {
  width: "min(980px, calc(100% - 32px))",
}, compactMedia);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", {
  display: "block",
  "aspect-ratio": "16 / 10",
}, compactMedia);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo-front", {
  inset: "11px 11px 48px",
}, compactMedia);
const narrowMedia = ["max-width: 919px"];
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", {
  width: "min(100%, 640px)",
  "aspect-ratio": "16 / 8.6",
}, narrowMedia);
assertCssDeclarations(stylesheetRules, taskRailSelector, { display: "none" }, narrowMedia);
assertCssCascadeDeclarations(stylesheetRules, ".denia-old-days-ds-hero", {
  "grid-template-columns": "1fr",
  "column-gap": "0",
  width: "calc(100% - 32px)",
}, narrowMedia);
const compactHeroRule = findCssRule(stylesheetRules, ".denia-old-days-ds-hero", compactMedia);
const narrowHeroGridRule = stylesheetRules.find((rule) =>
  rule.selectors.includes(".denia-old-days-ds-hero")
    && rule.declarations.has("grid-template-columns")
    && narrowMedia.every((fragment) => rule.atRules.some((atRule) => atRule.includes(fragment))));
assert(
  narrowHeroGridRule
    && narrowHeroGridRule.sourceIndex > compactHeroRule.sourceIndex,
  "narrow breakpoint must follow compact breakpoint so the single-column hero wins the cascade",
);
const shortDesktopMedia = ["min-width: 1200px", "max-height: 919px"];
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero", {
  "grid-template-columns": "minmax(340px, .9fr) minmax(420px, 1.1fr)",
  "column-gap": "32px",
  width: "min(1120px, calc(100% - 32px))",
  "min-height": "0",
  margin: "12px auto",
  padding: "22px 32px",
}, shortDesktopMedia);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", {
  display: "block",
  width: "min(100%, 440px)",
  "aspect-ratio": "16 / 9.2",
  padding: "10px 10px 42px",
}, shortDesktopMedia);
assert(
  findCssRule(stylesheetRules, ".denia-old-days-ds-hero", shortDesktopMedia).sourceIndex
    > compactHeroRule.sourceIndex,
  "short desktop layout must override the generic low-height compact rules",
);

const transparencyMedia = ["prefers-reduced-transparency: reduce"];
for (const [selector, background] of [
  [".denia-old-days-ds-hero", "#f9ffff"],
  [".denia-old-days-ds-composer", "#f9ffff !important"],
  [".denia-old-days-ds-final-card", "#fffdf1 !important"],
  [".denia-old-days-ds-extension .denia-old-days-ds-native-right-sidebar", "#fffdf9 !important"],
  [".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-group", "#fffdf9 !important"],
  [".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-row", "#fffdf9 !important"],
]) assertCssDeclarations(stylesheetRules, selector, { background }, transparencyMedia);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-composer", {
  "backdrop-filter": "none",
}, transparencyMedia);
const transparentComposerRule = findCssRule(stylesheetRules, ".denia-old-days-ds-composer", transparencyMedia);
if (stylesheetRules.some((rule) => rule.declarations.has("-webkit-backdrop-filter"))) {
  assert(
    canonicalCssValue(transparentComposerRule.declarations.get("-webkit-backdrop-filter")) === "none",
    ".denia-old-days-ds-composer must set -webkit-backdrop-filter: none under reduced transparency",
  );
}
for (const selector of [
  ".denia-old-days-ds-extension *",
  ".denia-old-days-ds-extension *::before",
  ".denia-old-days-ds-extension *::after",
]) assertCssDeclarations(stylesheetRules, selector, {
  animation: "none !important",
  "transition-duration": "0.01ms !important",
}, ["prefers-reduced-motion: reduce"]);

const publicText = [JSON.stringify(manifest), loader, styles, runtime, ...scripts].join("\n");
assert(!/miku|hatsune|bocchi|hutao|tariz|初音|胡桃|孤独摇滚/iu.test(publicText), "public Sidecar contains another theme's branding");
assert(!/app\.asar|codesign\s|defaults\s+write\s+com\.openai\.codex/iu.test(publicText), "Sidecar must not patch Codex");
assert(!scripts.some((text) => /\/usr\/bin\/python3|(^|\s)eval(\s|$)|osascript/mu.test(text)), "lifecycle scripts must not use Python, eval, or AppleScript");

for (const relative of ["package.sh", ...["common.sh", "install.sh", "start.sh", "status.sh", "stop.sh", "uninstall.sh", "verify.sh"].map((name) => `scripts/${name}`)]) {
  const mode = (await fs.stat(path.join(root, relative))).mode;
  assert((mode & 0o111) !== 0, `sidecar/${relative} must be executable`);
}

for (const [key, relative] of Object.entries(manifest.assets || {})) {
  const { file: assetPath } = await resolvePackageFile(relative);
  const asset = await fs.lstat(assetPath);
  assert(!asset.isSymbolicLink() && asset.isFile(), `asset must be a regular file: ${key}`);
  assert(asset.size < 1024 * 1024, `asset must stay below 1 MiB: ${key}`);
}

await assertLoaderRejectsUnresolvedRuntimeTokens();
if (process.env.DENIA_VALIDATE_SKIP_STYLESHEET_FIXTURES !== "1") {
  await assertAcceptsUnicodeStylesheetFixture();
  await assertRejectsStylesheetMutations();
}
if (process.env.DENIA_VALIDATE_SKIP_MUTATION_FIXTURE !== "1") {
  await assertRejectsCommentedArtworkRevoke();
}
if (process.env.DENIA_VALIDATE_SKIP_SECURITY_FIXTURE !== "1") {
  await assertRejectsAncestorSymlinkPaths();
}

console.log(`Validated ${manifest.name} extension ${manifest.version}: ${required.length} required files, removable sidecar protocol.`);

async function assertLoaderRejectsUnresolvedRuntimeTokens() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "denia-loader-token-"));
  try {
    const fixtureRoot = path.join(temporaryRoot, "sidecar");
    await fs.cp(root, fixtureRoot, { recursive: true });
    const loaderPath = path.join(fixtureRoot, "runtime/loader.mjs");
    const loaderArgs = [loaderPath, "--verify", "--extension-dir", fixtureRoot, "--port", "65533"];
    const normalResult = spawnSync(process.execPath, loaderArgs, { encoding: "utf8", timeout: 7000 });
    const normalOutput = `${normalResult.stdout || ""}\n${normalResult.stderr || ""}`;
    assert(
      !normalOutput.includes("Unresolved Denia runtime template token")
        && /ECONNREFUSED 127\.0\.0\.1:65533|No verified Codex renderer target|"mode":\s*"verify"/u.test(normalOutput),
      "normal loader must finish token replacement before entering CDP verification",
    );

    const stylePath = path.join(fixtureRoot, manifest.entrypoints.style);
    await fs.appendFile(stylePath, "\n/* __DENIA_OLD_DAYS_EXTENSION_USER_NOTE__ */\n");
    const manifestPath = path.join(fixtureRoot, "extension.json");
    const fixtureManifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    fixtureManifest.description = `${fixtureManifest.description} __DENIA_OLD_DAYS_EXTENSION_MANIFEST_NOTE__`;
    await fs.writeFile(manifestPath, `${JSON.stringify(fixtureManifest, null, 2)}\n`);
    const tokenLikeResult = spawnSync(process.execPath, loaderArgs, { encoding: "utf8", timeout: 7000 });
    const tokenLikeOutput = `${tokenLikeResult.stdout || ""}\n${tokenLikeResult.stderr || ""}`;
    assert(
      !tokenLikeOutput.includes("Unresolved Denia runtime template token")
        && /ECONNREFUSED 127\.0\.0\.1:65533|No verified Codex renderer target|"mode":\s*"verify"/u.test(tokenLikeOutput),
      "loader must allow token-like user data to reach CDP verification",
    );

    const loaderSource = await fs.readFile(loaderPath, "utf8");
    const brightStagingReplacement = "  .replace(templatePlaceholders.bright, templateSentinels.bright)";
    assert(loaderSource.includes(brightStagingReplacement), "loader mutation fixture missing bright artwork staging replacement");
    await fs.writeFile(loaderPath, loaderSource.replace(brightStagingReplacement, `  // ${brightStagingReplacement.trim()}`));

    const mutatedResult = spawnSync(process.execPath, loaderArgs, { encoding: "utf8", timeout: 7000 });
    const mutatedOutput = `${mutatedResult.stdout || ""}\n${mutatedResult.stderr || ""}`;
    assert(
      mutatedResult.status !== 0
        && mutatedOutput.includes("Unresolved Denia runtime template token")
        && mutatedOutput.includes("__DENIA_OLD_DAYS_EXTENSION_BRIGHT_ART_JSON__")
        && !mutatedOutput.includes("ECONNREFUSED"),
      "loader must reject an unresolved artwork token before entering CDP",
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function assertRejectsCommentedArtworkRevoke() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "denia-validator-mutation-"));
  try {
    const fixtureRoot = path.join(temporaryRoot, "sidecar");
    await fs.cp(root, fixtureRoot, { recursive: true });
    const runtimePath = path.join(fixtureRoot, manifest.entrypoints.runtime);
    const runtimeSource = await fs.readFile(runtimePath, "utf8");
    const revokeLoop = "    for (const artUrl of Object.values(artUrls)) URL.revokeObjectURL(artUrl);";
    assert(runtimeSource.includes(revokeLoop), "mutation fixture missing artwork revoke loop");
    await fs.writeFile(runtimePath, runtimeSource.replace(revokeLoop, `    // ${revokeLoop.trim()}`));

    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), fixtureRoot], {
      encoding: "utf8",
      env: {
        ...process.env,
        DENIA_VALIDATE_SKIP_MUTATION_FIXTURE: "1",
        DENIA_VALIDATE_SKIP_STYLESHEET_FIXTURES: "1",
      },
    });
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    assert(
      result.status !== 0 && output.includes("artwork URLs"),
      "validator must reject runtime whose revoke loop is commented out",
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function assertRejectsAncestorSymlinkPaths() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "denia-validator-symlink-"));
  try {
    const fixtureRoot = path.join(temporaryRoot, "sidecar");
    const externalAssets = path.join(temporaryRoot, "outside-assets");
    await fs.cp(root, fixtureRoot, { recursive: true });
    await fs.cp(path.join(root, "assets"), externalAssets, { recursive: true });
    await fs.rm(path.join(fixtureRoot, "assets"), { recursive: true, force: true });
    await fs.symlink(externalAssets, path.join(fixtureRoot, "assets"), "dir");

    const environment = {
      ...process.env,
      DENIA_VALIDATE_SKIP_MUTATION_FIXTURE: "1",
      DENIA_VALIDATE_SKIP_SECURITY_FIXTURE: "1",
      DENIA_VALIDATE_SKIP_STYLESHEET_FIXTURES: "1",
    };
    const validatorResult = spawnSync(process.execPath, [fileURLToPath(import.meta.url), fixtureRoot], {
      encoding: "utf8",
      env: environment,
      timeout: 7000,
    });
    const validatorOutput = `${validatorResult.stdout || ""}\n${validatorResult.stderr || ""}`;
    const loaderResult = spawnSync(process.execPath, [
      path.join(fixtureRoot, "runtime/loader.mjs"),
      "--verify",
      "--extension-dir",
      fixtureRoot,
      "--port",
      "65534",
    ], {
      encoding: "utf8",
      env: environment,
      timeout: 7000,
    });
    const loaderOutput = `${loaderResult.stdout || ""}\n${loaderResult.stderr || ""}`;
    const missingGuards = [];
    if (validatorResult.status === 0 || !validatorOutput.includes("real path escapes package")) missingGuards.push("validator");
    if (loaderResult.status === 0 || !loaderOutput.includes("real path escapes package")) missingGuards.push("loader");
    assert(
      missingGuards.length === 0,
      `ancestor symlink realpath guard missing from: ${missingGuards.join(", ")}`,
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function assertRejectsStylesheetMutations() {
  const cases = [
    {
      prefix: "denia-validator-css-comments-",
      mutate: (source) => `${source}
.denia-css-string-open { content: "/*"; }
.denia-old-days-ds-photo-back { background: var(--denia-old-days-art-dark); }
.denia-css-string-close { content: "*/"; }
`,
      expected: "default hero must not contain a dark reverse",
      failure: "validator must not treat comment delimiters inside CSS strings as comments",
    },
    {
      prefix: "denia-validator-css-order-",
      mutate(source) {
        const compact = findCssBlockRange(source, "@media (max-width: 1199px), (max-height: 759px)");
        const narrow = findCssBlockRange(source, "@media (max-width: 919px)");
        assert(compact.start < narrow.start, "stylesheet mutation fixture expects compact media before narrow media");
        return source.slice(0, compact.start)
          + source.slice(narrow.start, narrow.end)
          + "\n\n"
          + source.slice(compact.start, narrow.start)
          + source.slice(narrow.end);
      },
      expected: "narrow breakpoint must follow compact breakpoint",
      failure: "validator must reject a narrow media block overridden by the later compact block",
    },
    {
      prefix: "denia-validator-css-bright-host-",
      target: ".denia-old-days-ds-photo-front {\n  position: absolute;",
      replacement: ".denia-old-days-ds-photo-front,\narticle {\n  position: absolute;",
      name: "bright artwork selector",
      expected: "artwork variable --denia-old-days-art-bright must stay on its approved selector",
      failure: "validator must reject bright artwork added to an article through a combined selector",
    },
    {
      prefix: "denia-validator-css-approval-host-",
      target: '.denia-old-days-ds-state-art-layer[data-denia-art-family="taskApproval"] {\n  --denia-state-art-image: var(--denia-old-days-art-task-approval);',
      replacement: '.denia-old-days-ds-state-art-layer[data-denia-art-family="taskApproval"],\nmain {\n  --denia-state-art-image: var(--denia-old-days-art-task-approval);',
      name: "approval artwork selector",
      expected: "artwork variable --denia-old-days-art-task-approval must stay on its approved selector",
      failure: "validator must reject approval artwork added to main through a combined selector",
    },
    {
      prefix: "denia-validator-css-transparency-",
      target: "    backdrop-filter: none;",
      replacement: "    backdrop-filter: blur(18px);",
      name: "reduced-transparency composer backdrop filter",
      expected: ".denia-old-days-ds-composer must set backdrop-filter: none",
      failure: "validator must reject composer blur under reduced transparency",
    },
    {
      prefix: "denia-validator-css-webkit-transparency-",
      target: "  backdrop-filter: blur(18px) saturate(1.05);",
      replacement: "  backdrop-filter: blur(18px) saturate(1.05);\n  -webkit-backdrop-filter: blur(18px) saturate(1.05);",
      name: "base composer webkit backdrop filter",
      expected: ".denia-old-days-ds-composer must set -webkit-backdrop-filter: none",
      failure: "validator must require a reduced-transparency override when composer uses webkit backdrop filtering",
    },
    {
      prefix: "denia-validator-css-motion-before-",
      target: "  .denia-old-days-ds-extension *::before,\n",
      replacement: "",
      name: "reduced-motion ::before selector",
      expected: ".denia-old-days-ds-extension *::before",
      failure: "validator must require the global ::before reduced-motion selector",
    },
    {
      prefix: "denia-validator-css-motion-after-",
      target: "  .denia-old-days-ds-extension *::before,\n  .denia-old-days-ds-extension *::after {",
      replacement: "  .denia-old-days-ds-extension *::before {",
      name: "reduced-motion ::after selector",
      expected: ".denia-old-days-ds-extension *::after",
      failure: "validator must require the global ::after reduced-motion selector",
    },
  ];
  for (const fixture of cases) {
    await assertRejectsStylesheetMutation(
      fixture.prefix,
      fixture.mutate || ((source) => replaceRequired(source, fixture.target, fixture.replacement, fixture.name)),
      fixture.expected,
      fixture.failure,
    );
  }
}

async function assertAcceptsUnicodeStylesheetFixture() {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "denia-validator-css-unicode-"));
  try {
    const fixtureRoot = path.join(temporaryRoot, "sidecar");
    await fs.cp(root, fixtureRoot, { recursive: true });
    const stylePath = path.join(fixtureRoot, manifest.entrypoints.style);
    const source = await fs.readFile(stylePath, "utf8");
    const unicodeProbe = String.raw`.unicode-probe { content: "😀 𝄞 escaped quote: \""; }
`;
    await fs.writeFile(stylePath, unicodeProbe + source);
    const result = spawnStylesheetFixture(fixtureRoot);
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    assert(
      result.status === 0 && output.includes("Validated 达妮娅 · 旧日斑斓 extension 0.1.0"),
      `validator must accept astral Unicode before critical CSS rules without shifting parser indices:\n${output.trim()}`,
    );
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function assertRejectsStylesheetMutation(prefix, mutate, expectedOutput, failureMessage) {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    const fixtureRoot = path.join(temporaryRoot, "sidecar");
    await fs.cp(root, fixtureRoot, { recursive: true });
    const stylePath = path.join(fixtureRoot, manifest.entrypoints.style);
    const source = await fs.readFile(stylePath, "utf8");
    await fs.writeFile(stylePath, mutate(source));
    const result = spawnStylesheetFixture(fixtureRoot);
    const output = `${result.stdout || ""}\n${result.stderr || ""}`;
    assert(result.status !== 0 && output.includes(expectedOutput), failureMessage);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

function replaceRequired(source, target, replacement, fixtureName) {
  assert(source.includes(target), `stylesheet mutation fixture missing ${fixtureName}`);
  return source.replace(target, replacement);
}

function findCssBlockRange(source, header) {
  const start = source.indexOf(header);
  assert(start >= 0, `stylesheet mutation fixture missing ${header}`);
  const syntax = scanCssSyntax(source);
  const opening = syntax.delimiters.find((delimiter) => delimiter.character === "{" && delimiter.index > start);
  assert(opening?.match > opening.index, `stylesheet mutation fixture could not resolve ${header}`);
  return { start, end: opening.match + 1 };
}

function spawnStylesheetFixture(fixtureRoot) {
  return spawnSync(process.execPath, [fileURLToPath(import.meta.url), fixtureRoot], {
    encoding: "utf8",
    env: {
      ...process.env,
      DENIA_VALIDATE_SKIP_MUTATION_FIXTURE: "1",
      DENIA_VALIDATE_SKIP_SECURITY_FIXTURE: "1",
      DENIA_VALIDATE_SKIP_STYLESHEET_FIXTURES: "1",
    },
    timeout: 7000,
  });
}

function assertNativeRightSidebarLifecycle(payload) {
  const appendTaskMain = (harness) => {
    const main = harness.document.createElement("main");
    main.setAttribute("role", "main");
    main.setRect({ x: 0, y: 46, width: 1178, height: 813 });
    harness.document.body.append(main);
    return main;
  };

  const appendToggle = (harness, attributes = {}) => {
    const toggle = harness.document.createElement("button");
    toggle.setAttribute("aria-label", "显示/隐藏侧边栏");
    toggle.setRect({ x: 1438, y: 8, width: 40, height: 32 });
    for (const [name, value] of Object.entries(attributes)) toggle.setAttribute(name, value);
    toggle.clickCount = 0;
    toggle.addEventListener("click", () => { toggle.clickCount += 1; });
    harness.document.body.append(toggle);
    return toggle;
  };

  const appendRightPanel = (harness, id = "") => {
    const panel = harness.document.createElement("aside");
    if (id) panel.id = id;
    panel.setAttribute("role", "complementary");
    panel.setRect({ x: 1178, y: 46, width: 334, height: 813 });
    harness.document.body.append(panel);
    return panel;
  };

  const snapshotNativeNode = (node, attributes) => ({
    rect: JSON.stringify(node.getBoundingClientRect()),
    attributes: attributes.map((name) => [name, node.getAttribute(name)]),
  });

  const assertNativeNodeUnchanged = (node, attributes, before, label) => {
    assert(JSON.stringify(node.getBoundingClientRect()) === before.rect, `${label} geometry must remain unchanged`);
    assert(
      JSON.stringify(attributes.map((name) => [name, node.getAttribute(name)])) === JSON.stringify(before.attributes),
      `${label} interaction attributes must remain unchanged`,
    );
  };

  const open = createRuntimeHarness((index) => `blob:sidebar-open-${index + 1}`);
  open.setViewport(1512, 859);
  const main = appendTaskMain(open);
  const threadScroll = open.document.createElement("div");
  threadScroll.classList.add("thread-scroll-container");
  threadScroll.clientWidth = 922;
  threadScroll.setRect({ x: 0, y: 46, width: 952, height: 813 });
  main.append(threadScroll);
  const toggle = appendToggle(open, { "aria-controls": "native-right-panel", "aria-expanded": "true" });
  const aside = appendRightPanel(open, "native-right-panel");
  const group = open.document.createElement("div");
  group.setRect({ x: 1194, y: 92, width: 302, height: 126 });
  const firstRow = open.document.createElement("button");
  firstRow.textContent = "Open in editor";
  firstRow.setRect({ x: 1202, y: 102, width: 286, height: 40 });
  const secondRow = open.document.createElement("a");
  secondRow.textContent = "Copy task link";
  secondRow.setRect({ x: 1202, y: 154, width: 286, height: 40 });
  group.append(firstRow, secondRow);
  aside.append(group);
  const leftAside = open.document.createElement("aside");
  leftAside.setRect({ x: 0, y: 46, width: 280, height: 813 });
  open.document.body.append(leftAside);
  const dialog = open.document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.setRect({ x: 1200, y: 80, width: 312, height: 520 });
  open.document.body.append(dialog);
  const composer = open.document.createElement("form");
  composer.setAttribute("aria-label", "Message composer");
  composer.setRect({ x: 280, y: 720, width: 760, height: 104 });
  const textarea = open.document.createElement("textarea");
  textarea.setAttribute("aria-label", "Message");
  composer.append(textarea);
  main.append(composer);
  const approval = open.document.createElement("section");
  approval.setAttribute("data-state", "approval");
  approval.setAttribute("aria-label", "Approval request");
  approval.setRect({ x: 300, y: 420, width: 720, height: 180 });
  main.append(approval);
  open.setPointTarget(firstRow);

  const nativeSnapshots = [
    [main, ["role"], snapshotNativeNode(main, ["role"]), "main"],
    [aside, ["id", "role", "aria-hidden"], snapshotNativeNode(aside, ["id", "role", "aria-hidden"]), "panel"],
    [toggle, ["aria-label", "aria-controls", "aria-expanded"], snapshotNativeNode(toggle, ["aria-label", "aria-controls", "aria-expanded"]), "toggle"],
    [composer, ["aria-label"], snapshotNativeNode(composer, ["aria-label"]), "composer"],
    [approval, ["data-state", "aria-label"], snapshotNativeNode(approval, ["data-state", "aria-label"]), "approval card"],
  ];

  vm.runInContext(payload, open.context, { timeout: 1000 });
  const state = open.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(state.sidebar?.state === "open", "a visible right-docked native aside must be detected as open");
  assert(state.sidebar.confidence === "high", "geometry plus right-edge hit testing must be high confidence");
  assert(state.sidebar.toggleState === "open", "open sidebar diagnostics must expose the native toggle state");
  assert(aside.classList.contains("denia-old-days-ds-native-right-sidebar"), "only the confirmed aside must receive the skin class");
  assert(open.root.dataset.deniaSidebarState === "open", "the root must expose the open sidebar state");
  assert(open.root.dataset.deniaSidebarConfidence === "high", "the root must expose high sidebar confidence");
  assert(open.root.dataset.deniaSidebarToggleState === "open", "the root must expose the open native toggle state");
  assert(
    open.root.style.getPropertyValue("--denia-native-sidebar-width") === "334px",
    "an open native sidebar must expose its measured stable width for close alignment",
  );
  assert(
    open.root.style.getPropertyValue("--denia-thread-content-width") === "1482px",
    "task layout must expose a stable full-width thread content measurement",
  );
  assert(group.classList.contains("denia-old-days-ds-native-sidebar-group"), "the smallest common row ancestor must receive the group class");
  assert(firstRow.classList.contains("denia-old-days-ds-native-sidebar-row"), "wide visible sidebar buttons must receive the row class");
  assert(secondRow.classList.contains("denia-old-days-ds-native-sidebar-row"), "wide visible sidebar links must receive the row class");
  assert(!leftAside.classList.contains("denia-old-days-ds-native-right-sidebar"), "left navigation must never be skinned as the right sidebar");
  assert(leftAside.classList.contains("denia-old-days-ds-native-left-sidebar"), "the left navigation must receive its dedicated high-contrast skin class");
  assert(!dialog.classList.contains("denia-old-days-ds-native-right-sidebar"), "dialogs and menus must never be classified as the right sidebar");
  assert(toggle.clickCount === 0, "sidebar detection must never trigger the native toggle");
  assert(
    Object.values(state.sidebar).every((value) => value === null || ["string", "boolean", "number"].includes(typeof value)),
    "public sidebar diagnostics must contain scalar values only",
  );
  for (const [node, attributes, before, label] of nativeSnapshots) {
    assertNativeNodeUnchanged(node, attributes, before, label);
  }

  const rightOnlyHome = createRuntimeHarness((index) => `blob:sidebar-home-right-only-${index + 1}`);
  const rightOnlyMain = appendTaskMain(rightOnlyHome);
  rightOnlyMain.classList.add("dream-skin-home");
  appendToggle(rightOnlyHome, { "aria-controls": "home-right-panel", "aria-expanded": "true" });
  const rightOnlyPanel = appendRightPanel(rightOnlyHome, "home-right-panel");
  const nativePanelChild = rightOnlyHome.document.createElement("button");
  nativePanelChild.textContent = "Native sidebar action";
  nativePanelChild.setRect({ x: 1202, y: 102, width: 286, height: 40 });
  rightOnlyPanel.append(nativePanelChild);
  rightOnlyHome.setPointTarget(nativePanelChild);
  const rightOnlyRect = JSON.stringify(rightOnlyPanel.getBoundingClientRect());
  const rightOnlyChildren = [...rightOnlyPanel.children];
  vm.runInContext(payload, rightOnlyHome.context, { timeout: 1000 });
  const rightOnlyBrand = rightOnlyHome.document.getElementById("denia-old-days-ds-sidebar-brand");
  assert(!rightOnlyBrand, "home with only a native right sidebar must not create a sidebar brand");
  assert(
    rightOnlyPanel.children.length === rightOnlyChildren.length
      && rightOnlyPanel.children.every((child, index) => child === rightOnlyChildren[index]),
    "home branding must not change native right sidebar children",
  );
  assert(JSON.stringify(rightOnlyPanel.getBoundingClientRect()) === rightOnlyRect, "home branding must not change native right sidebar geometry");

  const nestedPressed = createRuntimeHarness((index) => `blob:sidebar-nested-pressed-${index + 1}`);
  nestedPressed.setViewport(1512, 859);
  const nestedMain = nestedPressed.document.createElement("main");
  nestedMain.setAttribute("role", "main");
  nestedMain.setRect({ x: 317, y: 46, width: 1195, height: 813 });
  nestedPressed.document.body.append(nestedMain);
  appendToggle(nestedPressed, { "aria-pressed": "true" });
  const nestedPanel = nestedPressed.document.createElement("aside");
  nestedPanel.setAttribute("role", "complementary");
  nestedPanel.setRect({ x: 1192, y: 46, width: 320, height: 813 });
  const nestedAction = nestedPressed.document.createElement("button");
  nestedAction.setRect({ x: 1204, y: 112, width: 286, height: 40 });
  nestedPanel.append(nestedAction);
  nestedMain.append(nestedPanel);
  nestedPressed.setPointTarget(nestedAction);
  vm.runInContext(payload, nestedPressed.context, { timeout: 1000 });
  const nestedPressedState = nestedPressed.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(
    nestedPressedState.sidebar?.state === "open",
    "aria-pressed=true must detect a right sidebar nested inside the native main surface",
  );
  assert(
    nestedPanel.classList.contains("denia-old-days-ds-native-right-sidebar"),
    "a nested pressed sidebar must receive the opaque native sidebar skin",
  );
  assert(
    nestedPressedState.observer.options.attributeFilter.includes("aria-pressed"),
    "native aria-pressed changes must be observed",
  );
  nestedPressedState.cleanup();

  const leftHome = createRuntimeHarness((index) => `blob:sidebar-home-left-${index + 1}`);
  const leftHomeMain = appendTaskMain(leftHome);
  leftHomeMain.classList.add("dream-skin-home");
  const leftHomeSidebar = leftHome.document.createElement("nav");
  leftHomeSidebar.setRect({ x: 0, y: 46, width: 280, height: 813 });
  leftHome.document.body.append(leftHomeSidebar);
  vm.runInContext(payload, leftHome.context, { timeout: 1000 });
  const leftHomeBrand = leftHome.document.getElementById("denia-old-days-ds-sidebar-brand");
  assert(leftHomeBrand && leftHomeSidebar.contains(leftHomeBrand), "a high-confidence left sidebar must retain the home brand");
  assert(leftHomeSidebar.classList.contains("denia-old-days-ds-native-left-sidebar"), "home left navigation must receive its dedicated skin class");
  assert(
    leftHome.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar?.toggleState === "unknown",
    "missing native sidebar toggles must remain unknown instead of imitating a close transition",
  );

  open.clearMutationRecords();
  toggle.setAttribute("aria-expanded", "false");
  assert(open.flushMutations() === 1, "closing the sidebar toggle must reach the observer");
  assert(state.sidebar.state === "unknown", "a visible controlled panel with a closed toggle must remain unknown while collapsing");
  assert(state.sidebar.toggleState === "closed", "collapsing sidebar diagnostics must expose the closed native toggle state");
  assert(open.root.dataset.deniaSidebarToggleState === "closed", "the root must expose the closed toggle before geometry settles");
  assert(open.flushAnimationFrames() === 0, "sidebar toggle state must synchronize before the next animation frame");

  threadScroll.clientWidth = 1000;
  threadScroll.setRect({ width: 1030 });
  state.refresh();
  assert(
    open.root.style.getPropertyValue("--denia-thread-content-width") === "1482px",
    "thread content width snapshot must stay stable while the native sidebar collapses",
  );
  assert(
    open.root.style.getPropertyValue("--denia-native-sidebar-width") === "334px",
    "native sidebar width snapshot must retain the last trusted open geometry while collapsing",
  );

  aside.setRect({ width: 0, height: 0 });
  threadScroll.clientWidth = 1482;
  threadScroll.setRect({ width: 1512 });
  state.refresh();
  assert(state.sidebar.state === "closed", "aria-expanded=false with an invisible controlled panel must resolve closed");
  assert(
    open.root.style.getPropertyValue("--denia-thread-content-width") === "1482px",
    "thread content width snapshot must remain stable in the final closed layout",
  );
  assert(
    open.root.style.getPropertyValue("--denia-native-sidebar-width") === "334px",
    "final closed layout must retain the native width needed for the next close transition",
  );
  assert(!aside.classList.contains("denia-old-days-ds-native-right-sidebar"), "closing the sidebar must remove the old panel class");
  assert(!group.classList.contains("denia-old-days-ds-native-sidebar-group"), "closing the sidebar must remove old group classes");
  assert(!firstRow.classList.contains("denia-old-days-ds-native-sidebar-row"), "closing the sidebar must remove old row classes");

  aside.remove();
  const remounted = appendRightPanel(open, "native-right-panel");
  toggle.setAttribute("aria-expanded", "true");
  open.setPointTarget(remounted);
  state.refresh();
  assert(state.sidebar.state === "open", "a remounted visible controlled sidebar must resolve open");
  assert(remounted.classList.contains("denia-old-days-ds-native-right-sidebar"), "a remounted sidebar must receive the panel class");
  assert(!aside.classList.contains("denia-old-days-ds-native-right-sidebar"), "a remount must not restore the old panel class");

  state.cleanup();
  assert(!leftAside.classList.contains("denia-old-days-ds-native-left-sidebar"), "cleanup must remove the left sidebar skin class");
  assert(!remounted.classList.contains("denia-old-days-ds-native-right-sidebar"), "cleanup must remove the current native sidebar class");
  assert(!("deniaSidebarState" in open.root.dataset), "cleanup must remove the root sidebar state marker");
  assert(!("deniaSidebarConfidence" in open.root.dataset), "cleanup must remove the root sidebar confidence marker");
  assert(!("deniaSidebarToggleState" in open.root.dataset), "cleanup must remove the root sidebar toggle state marker");
  assert(!open.root.style.getPropertyValue("--denia-native-sidebar-width"), "cleanup must remove the native sidebar width snapshot");
  assert(!open.root.style.getPropertyValue("--denia-thread-content-width"), "cleanup must remove the thread content width snapshot");

  const closed = createRuntimeHarness((index) => `blob:sidebar-closed-${index + 1}`);
  appendTaskMain(closed);
  appendToggle(closed, { "aria-expanded": "false" });
  vm.runInContext(payload, closed.context, { timeout: 1000 });
  const closedState = closed.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar?.state;
  assert(closedState === "closed", "a visible sidebar toggle with no right-docked panel must resolve closed");

  const conflicting = createRuntimeHarness((index) => `blob:sidebar-conflict-${index + 1}`);
  appendTaskMain(conflicting);
  appendToggle(conflicting, { "aria-controls": "invisible-sidebar", "aria-expanded": "true" });
  appendRightPanel(conflicting, "invisible-sidebar").setRect({ width: 0, height: 0 });
  vm.runInContext(payload, conflicting.context, { timeout: 1000 });
  const conflictingState = conflicting.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar?.state;
  assert(conflictingState === "unknown", "aria-expanded=true with an invisible panel must resolve unknown");

  const ariaHidden = createRuntimeHarness((index) => `blob:sidebar-aria-hidden-${index + 1}`);
  appendTaskMain(ariaHidden);
  appendToggle(ariaHidden, { "aria-controls": "aria-hidden-sidebar", "aria-expanded": "true" });
  const ariaHiddenPanel = appendRightPanel(ariaHidden, "aria-hidden-sidebar");
  ariaHiddenPanel.setAttribute("aria-hidden", "true");
  ariaHidden.setPointTarget(ariaHiddenPanel);
  vm.runInContext(payload, ariaHidden.context, { timeout: 1000 });
  const ariaHiddenState = ariaHidden.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar;
  assert(ariaHiddenState?.state === "unknown", "aria-hidden=true controlled panel with expanded=true must resolve unknown");
  assert(ariaHiddenState.confidence === "none", "aria-hidden=true conflict must have no sidebar confidence");
  assert(!ariaHiddenPanel.classList.contains("denia-old-days-ds-native-right-sidebar"), "aria-hidden controlled panel must not be skinned");

  const transparent = createRuntimeHarness((index) => `blob:sidebar-transparent-${index + 1}`);
  appendTaskMain(transparent);
  appendToggle(transparent, { "aria-controls": "transparent-sidebar", "aria-expanded": "true" });
  const transparentPanel = appendRightPanel(transparent, "transparent-sidebar");
  transparentPanel.computedOpacity = "0";
  transparent.setPointTarget(transparentPanel);
  vm.runInContext(payload, transparent.context, { timeout: 1000 });
  const transparentState = transparent.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar;
  assert(transparentState?.state === "unknown", "zero-opacity controlled panel with expanded=true must resolve unknown");
  assert(transparentState.confidence === "none", "zero-opacity conflict must have no sidebar confidence");
  assert(!transparentPanel.classList.contains("denia-old-days-ds-native-right-sidebar"), "zero-opacity controlled panel must not be skinned");

  const covered = createRuntimeHarness((index) => `blob:sidebar-covered-${index + 1}`);
  appendTaskMain(covered);
  appendToggle(covered, { "aria-controls": "covered-sidebar", "aria-expanded": "true" });
  const coveredPanel = appendRightPanel(covered, "covered-sidebar");
  const coveringElement = covered.document.createElement("div");
  coveringElement.setRect({ x: 1178, y: 46, width: 334, height: 813 });
  covered.document.body.append(coveringElement);
  covered.setPointTarget(coveringElement);
  vm.runInContext(payload, covered.context, { timeout: 1000 });
  const coveredState = covered.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar;
  assert(coveredState?.state === "unknown", "a covered controlled panel with expanded=true must resolve unknown");
  assert(coveredState.confidence === "none", "covered controlled panel conflict must have no sidebar confidence");
  assert(!coveredPanel.classList.contains("denia-old-days-ds-native-right-sidebar"), "a covered controlled panel must not be skinned");

  const collapsedVisible = createRuntimeHarness((index) => `blob:sidebar-collapsed-visible-${index + 1}`);
  appendTaskMain(collapsedVisible);
  appendToggle(collapsedVisible, { "aria-controls": "visible-collapsed-sidebar", "aria-expanded": "false" });
  const visibleCollapsedPanel = appendRightPanel(collapsedVisible, "visible-collapsed-sidebar");
  collapsedVisible.setPointTarget(visibleCollapsedPanel);
  vm.runInContext(payload, collapsedVisible.context, { timeout: 1000 });
  const collapsedVisibleState = collapsedVisible.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar?.state;
  assert(collapsedVisibleState === "unknown", "aria-expanded=false with a visible controlled panel must resolve unknown");
  assert(!visibleCollapsedPanel.classList.contains("denia-old-days-ds-native-right-sidebar"), "conflicting expanded state must not skin the visible panel");

  const leftOnly = createRuntimeHarness((index) => `blob:sidebar-left-${index + 1}`);
  appendTaskMain(leftOnly);
  appendToggle(leftOnly);
  const onlyLeftAside = leftOnly.document.createElement("aside");
  onlyLeftAside.setRect({ x: 0, y: 46, width: 280, height: 813 });
  leftOnly.document.body.append(onlyLeftAside);
  leftOnly.setPointTarget(onlyLeftAside);
  vm.runInContext(payload, leftOnly.context, { timeout: 1000 });
  assert(!onlyLeftAside.classList.contains("denia-old-days-ds-native-right-sidebar"), "left navigation must never be skinned as the right sidebar");

  const dialogOnly = createRuntimeHarness((index) => `blob:sidebar-dialog-${index + 1}`);
  appendTaskMain(dialogOnly);
  appendToggle(dialogOnly);
  const onlyDialog = dialogOnly.document.createElement("div");
  onlyDialog.setAttribute("role", "dialog");
  onlyDialog.setRect({ x: 1178, y: 46, width: 334, height: 813 });
  dialogOnly.document.body.append(onlyDialog);
  dialogOnly.setPointTarget(onlyDialog);
  vm.runInContext(payload, dialogOnly.context, { timeout: 1000 });
  assert(!onlyDialog.classList.contains("denia-old-days-ds-native-right-sidebar"), "dialogs and menus must never be classified as the right sidebar");

  const nestedDialog = createRuntimeHarness((index) => `blob:sidebar-nested-dialog-${index + 1}`);
  appendTaskMain(nestedDialog);
  appendToggle(nestedDialog, { "aria-controls": "dialog-sidebar", "aria-expanded": "true" });
  const dialogContainer = nestedDialog.document.createElement("div");
  dialogContainer.setAttribute("role", "dialog");
  dialogContainer.setRect({ x: 1178, y: 46, width: 334, height: 813 });
  const dialogAside = nestedDialog.document.createElement("aside");
  dialogAside.id = "dialog-sidebar";
  dialogAside.setRect({ x: 1178, y: 46, width: 334, height: 813 });
  dialogContainer.append(dialogAside);
  nestedDialog.document.body.append(dialogContainer);
  nestedDialog.setPointTarget(dialogAside);
  vm.runInContext(payload, nestedDialog.context, { timeout: 1000 });
  assert(
    nestedDialog.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar?.state === "unknown",
    "a semantic panel nested inside a dialog must resolve unknown",
  );
  assert(!dialogAside.classList.contains("denia-old-days-ds-native-right-sidebar"), "a panel nested inside a dialog must never be skinned");

  const hitTested = createRuntimeHarness((index) => `blob:sidebar-hit-${index + 1}`);
  appendTaskMain(hitTested);
  appendToggle(hitTested);
  const geometryPanel = hitTested.document.createElement("div");
  geometryPanel.setRect({ x: 1178, y: 46, width: 334, height: 813 });
  const geometryFirst = hitTested.document.createElement("button");
  geometryFirst.setRect({ x: 1202, y: 102, width: 286, height: 40 });
  const geometrySecond = hitTested.document.createElement("button");
  geometrySecond.setRect({ x: 1202, y: 154, width: 286, height: 40 });
  geometryPanel.append(geometryFirst, geometrySecond);
  hitTested.document.body.append(geometryPanel);
  hitTested.setPointTarget(geometryFirst);
  vm.runInContext(payload, hitTested.context, { timeout: 1000 });
  const hitState = hitTested.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar;
  assert(hitState?.state === "open", "right-edge hit testing plus native controls must detect a non-semantic panel");
  assert(hitState.anchorKind === "right-edge-hit", "geometry fallback must report the right-edge-hit anchor");
  assert(geometryPanel.classList.contains("denia-old-days-ds-native-right-sidebar"), "geometry fallback must skin only its confirmed panel");

  const collapsedHit = createRuntimeHarness((index) => `blob:sidebar-collapsed-hit-${index + 1}`);
  appendTaskMain(collapsedHit);
  appendToggle(collapsedHit, { "aria-expanded": "false" });
  const collapsedHitPanel = appendRightPanel(collapsedHit);
  collapsedHit.setPointTarget(collapsedHitPanel);
  vm.runInContext(payload, collapsedHit.context, { timeout: 1000 });
  assert(
    collapsedHit.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar?.state === "unknown",
    "aria-expanded=false with a right-edge hit panel must resolve unknown",
  );
  assert(!collapsedHitPanel.classList.contains("denia-old-days-ds-native-right-sidebar"), "hit-test conflict must not skin the panel");

  const narrowGroup = createRuntimeHarness((index) => `blob:sidebar-narrow-group-${index + 1}`);
  appendTaskMain(narrowGroup);
  appendToggle(narrowGroup, { "aria-controls": "narrow-group-sidebar", "aria-expanded": "true" });
  const narrowGroupPanel = appendRightPanel(narrowGroup, "narrow-group-sidebar");
  const narrowWrapper = narrowGroup.document.createElement("div");
  narrowWrapper.setRect({ x: 1350, y: 92, width: 140, height: 126 });
  const narrowFirst = narrowGroup.document.createElement("button");
  narrowFirst.setRect({ x: 1202, y: 102, width: 190, height: 40 });
  const narrowSecond = narrowGroup.document.createElement("button");
  narrowSecond.setRect({ x: 1202, y: 154, width: 190, height: 40 });
  narrowWrapper.append(narrowFirst, narrowSecond);
  narrowGroupPanel.append(narrowWrapper);
  narrowGroup.setPointTarget(narrowFirst);
  vm.runInContext(payload, narrowGroup.context, { timeout: 1000 });
  assert(!narrowWrapper.classList.contains("denia-old-days-ds-native-sidebar-group"), "groups narrower than 60% of the panel must not be skinned");

  const stableMutation = createRuntimeHarness((index) => `blob:sidebar-stable-mutation-${index + 1}`);
  appendTaskMain(stableMutation);
  appendToggle(stableMutation, { "aria-controls": "stable-sidebar", "aria-expanded": "true" });
  const stablePanel = appendRightPanel(stableMutation, "stable-sidebar");
  stableMutation.setPointTarget(stablePanel);
  vm.runInContext(payload, stableMutation.context, { timeout: 1000 });
  stableMutation.clearMutationRecords();
  stablePanel.classList.add("native-sidebar-open");
  assert(stableMutation.flushMutations() === 1, "a native panel class change must be delivered to the runtime observer");
  assert(stableMutation.flushAnimationFrames() === 1, "a native panel class change must schedule exactly one refresh frame");
  assert(
    stableMutation.flushMutations() === 0,
    "a stable sidebar refresh must not emit extension-only class mutations that schedule another refresh",
  );
  assert(stablePanel.classList.contains("native-sidebar-open"), "sidebar synchronization must preserve native panel classes");
}

function assertRuntimeArtworkLifecycle(payload) {
  const propertyNames = ["bright", "task-warm", "task-approval", "task-error", "task-complete"]
    .map((name) => `--denia-old-days-art-${name}`);
  const successful = createRuntimeHarness((index) => `blob:denia-${index + 1}`);

  vm.runInContext(payload, successful.context, { timeout: 1000 });
  const firstState = successful.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const firstArtworkMaps = successful.freezeCalls.filter((value) =>
    Object.keys(value).join(",") === "bright,taskWarm,taskApproval,taskError,taskComplete");
  assert(successful.created.length === 5, "runtime install must create five artwork URLs");
  assert(firstArtworkMaps.length === 1 && Object.isFrozen(firstArtworkMaps[0]), "runtime must freeze the artwork URL map");
  assert(firstState?.artReady === true, "runtime artReady must be true when every artwork URL succeeds");
  assert(
    Number.isFinite(firstState?.metrics?.lastRefreshDurationMs)
      && firstState.metrics.lastRefreshDurationMs >= 0,
    "runtime metrics must expose the finite nonnegative duration of the latest runRefresh body",
  );
  assert(!publicStateContainsUrl(firstState), "runtime public state must not expose artwork URLs");
  assert(
    successful.events.filter((event) => propertyNames.some((property) => event.startsWith(`set:${property}:`))).length === 5,
    "runtime install must set exactly five CSS artwork variables",
  );
  for (const [index, property] of propertyNames.entries()) {
    assert(successful.root.style.getPropertyValue(property) === `url("blob:denia-${index + 1}")`, `runtime install must set ${property}`);
  }

  const firstInstallEventCount = successful.events.length;
  vm.runInContext(payload, successful.context, { timeout: 1000 });
  const secondState = successful.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const secondArtworkMaps = successful.freezeCalls.filter((value) =>
    Object.keys(value).join(",") === "bright,taskWarm,taskApproval,taskError,taskComplete");
  assert(successful.created.length === 10, "runtime reinstall must create five replacement artwork URLs");
  assert(secondArtworkMaps.length === 2 && secondArtworkMaps.every(Object.isFrozen), "runtime reinstall must freeze its replacement artwork URL map");
  assert(successful.revoked.join(",") === "blob:denia-1,blob:denia-2,blob:denia-3,blob:denia-4,blob:denia-5", "runtime reinstall must revoke previous artwork URLs");
  const firstReplacementCreate = successful.events.indexOf("create:blob:denia-6");
  const reinstallCleanupEvents = successful.events.slice(firstInstallEventCount, firstReplacementCreate);
  assert(propertyNames.every((property) => reinstallCleanupEvents.filter((event) => event === `remove:${property}`).length === 1), "runtime reinstall must remove each previous CSS artwork variable before creating replacements");
  assert(
    reinstallCleanupEvents.filter((event) => event.startsWith("revoke:")).join(",")
      === "revoke:blob:denia-1,revoke:blob:denia-2,revoke:blob:denia-3,revoke:blob:denia-4,revoke:blob:denia-5",
    "runtime reinstall must clean previous artwork URLs before creating replacements",
  );
  assert(
    successful.events.filter((event) => propertyNames.some((property) => event.startsWith(`set:${property}:`))).length === 10,
    "runtime reinstall must set exactly five replacement CSS artwork variables",
  );
  assert(secondState?.artReady === true && !publicStateContainsUrl(secondState), "runtime reinstall must retain ready state without exposing URLs");
  for (const [index, property] of propertyNames.entries()) {
    assert(successful.root.style.getPropertyValue(property) === `url("blob:denia-${index + 6}")`, `runtime reinstall must reset ${property}`);
  }

  const finalCleanupEventCount = successful.events.length;
  secondState.cleanup();
  const finalCleanupEvents = successful.events.slice(finalCleanupEventCount);
  assert(successful.revoked.join(",") === [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((number) => `blob:denia-${number}`).join(","), "runtime cleanup must revoke current artwork URLs");
  assert(propertyNames.every((property) => finalCleanupEvents.filter((event) => event === `remove:${property}`).length === 1), "runtime cleanup must remove each current CSS artwork variable exactly once");
  assert(
    finalCleanupEvents.filter((event) => event.startsWith("revoke:")).join(",")
      === "revoke:blob:denia-6,revoke:blob:denia-7,revoke:blob:denia-8,revoke:blob:denia-9,revoke:blob:denia-10",
    "runtime cleanup must revoke each current artwork URL exactly once",
  );
  assert(propertyNames.every((property) => successful.root.style.getPropertyValue(property) === ""), "runtime cleanup must remove every CSS artwork variable");
  assert(!successful.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__, "runtime cleanup must remove public state");

  const incomplete = createRuntimeHarness((index) => index === 2 ? "" : `blob:partial-${index + 1}`);
  vm.runInContext(payload, incomplete.context, { timeout: 1000 });
  const incompleteState = incomplete.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(incompleteState?.artReady === false, "runtime artReady must be false unless every artwork URL succeeds");
  assert(!publicStateContainsUrl(incompleteState), "incomplete runtime state must not expose artwork URLs");
  incompleteState.cleanup();
}

function assertNativeWorkSurfaceLifecycle(payload) {
  const harness = createRuntimeHarness((index) => `blob:work-surface-${index + 1}`);
  const main = harness.document.createElement("main");
  main.setAttribute("role", "main");
  const assistant = harness.document.createElement("article");
  assistant.setAttribute("data-content-search-unit-key", "task:assistant");
  main.append(assistant);
  harness.document.body.append(main);

  const appendToggle = (label, pressed) => {
    const button = harness.document.createElement("button");
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    button.setRect({ x: 1400, y: 8, width: 28, height: 28 });
    harness.document.body.append(button);
    return button;
  };
  const summaryToggle = appendToggle("切换置顶摘要", true);
  const bottomToggle = appendToggle("切换底部面板显示", false);
  appendToggle("显示/隐藏侧边栏", false);

  vm.runInContext(payload, harness.context, { timeout: 1000 });
  const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(harness.root.dataset.deniaSummaryState === "open", "pressed summary toggle must expose an open summary state");
  assert(harness.root.dataset.deniaBottomPanelState === "closed", "unpressed bottom toggle must expose a closed bottom panel state");
  assert(harness.root.dataset.deniaWorkSurfaceState === "open", "any open native work surface must hide foreground artwork");

  harness.clearMutationRecords();
  summaryToggle.setAttribute("aria-pressed", "false");
  assert(harness.flushMutations() === 1, "summary aria-pressed mutation must reach the observer");
  assert(harness.root.dataset.deniaSummaryState === "closed", "summary toggle state must synchronize before the next animation frame");
  assert(harness.root.dataset.deniaWorkSurfaceState === "closed", "closing the final native work surface must restore artwork");
  assert(harness.flushAnimationFrames() === 0, "summary toggle state must not schedule a full refresh");

  harness.clearMutationRecords();
  bottomToggle.setAttribute("aria-pressed", "true");
  assert(harness.flushMutations() === 1, "bottom panel aria-pressed mutation must reach the observer");
  assert(harness.root.dataset.deniaBottomPanelState === "open", "pressed bottom toggle must expose an open bottom panel state");
  assert(harness.root.dataset.deniaWorkSurfaceState === "open", "open bottom panel must hide foreground artwork");
  assert(harness.flushAnimationFrames() === 0, "bottom panel toggle state must not schedule a full refresh");

  harness.clearMutationRecords();
  bottomToggle.setAttribute("aria-pressed", "false");
  main.append(harness.document.createElement("section"));
  assert(harness.flushMutations() === 2, "a toggle and native panel remount may arrive in the same observer batch");
  assert(harness.root.dataset.deniaBottomPanelState === "closed", "a mixed toggle batch must still synchronize native state immediately");
  assert(harness.flushAnimationFrames() === 0, "a mixed panel-transition batch must not refresh on the next frame");
  assert(harness.pendingTimerCount() === 1, "a mixed panel-transition batch must schedule one trailing refresh");
  assert(harness.flushTimers() === 1, "the mixed panel-transition timer must fire once");
  assert(harness.flushAnimationFrames() === 1, "the mixed panel-transition timer must produce one ordinary refresh");

  state.cleanup();
  for (const key of ["deniaSummaryState", "deniaBottomPanelState", "deniaWorkSurfaceState"]) {
    assert(!(key in harness.root.dataset), `cleanup must remove ${key}`);
  }
}

function assertComposerIsolation(payload) {
  const makeTaskMain = (harness) => {
    const main = harness.document.createElement("main");
    main.setAttribute("role", "main");
    const assistant = harness.document.createElement("article");
    assistant.setAttribute("data-content-search-unit-key", "task:assistant");
    main.append(assistant);
    harness.document.body.append(main);
    return main;
  };

  const terminalFixture = createRuntimeHarness((index) => `blob:composer-terminal-${index + 1}`);
  const terminalMain = makeTaskMain(terminalFixture);
  const terminalScreen = terminalFixture.document.createElement("div");
  terminalScreen.classList.add("xterm-screen");
  const terminal = terminalFixture.document.createElement("div");
  terminal.classList.add("xterm");
  const terminalTextarea = terminalFixture.document.createElement("textarea");
  terminal.append(terminalTextarea);
  terminalScreen.append(terminal);
  const composer = terminalFixture.document.createElement("div");
  composer.classList.add("composer-surface-chrome");
  const editor = terminalFixture.document.createElement("div");
  editor.setAttribute("contenteditable", "true");
  composer.append(editor);
  terminalMain.append(terminalScreen, composer);

  vm.runInContext(payload, terminalFixture.context, { timeout: 1000 });
  const terminalState = terminalFixture.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(composer.classList.contains("denia-old-days-ds-composer"), "the visible native composer surface must receive composer decoration");
  assert(!terminal.classList.contains("denia-old-days-ds-composer"), "the terminal host must never receive composer decoration");
  assert(!terminalScreen.classList.contains("denia-old-days-ds-composer"), "the terminal screen must never receive composer decoration");
  terminalState.cleanup();

  const formFixture = createRuntimeHarness((index) => `blob:composer-form-${index + 1}`);
  const formMain = makeTaskMain(formFixture);
  const tabPanel = formFixture.document.createElement("section");
  tabPanel.setAttribute("role", "tabpanel");
  tabPanel.append(formFixture.document.createElement("textarea"));
  const form = formFixture.document.createElement("form");
  const textarea = formFixture.document.createElement("textarea");
  form.append(textarea);
  formMain.append(tabPanel, form);

  vm.runInContext(payload, formFixture.context, { timeout: 1000 });
  const formState = formFixture.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(form.classList.contains("denia-old-days-ds-composer"), "a plain form textarea must remain a supported composer fallback");
  formState.cleanup();

  const inputFixture = createRuntimeHarness((index) => `blob:composer-input-cache-${index + 1}`);
  const inputMain = makeTaskMain(inputFixture);
  const inputForm = inputFixture.document.createElement("form");
  inputMain.append(inputForm);
  vm.runInContext(payload, inputFixture.context, { timeout: 1000 });
  const inputState = inputFixture.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(!inputForm.classList.contains("denia-old-days-ds-composer"), "an empty form must not be cached as a composer");

  inputFixture.clearMutationRecords();
  const directInput = inputFixture.document.createElement("textarea");
  inputForm.append(directInput);
  assert(inputFixture.flushMutations() === 1, "a direct fallback input addition must reach the observer");
  assert(inputFixture.flushAnimationFrames() === 1, "a direct fallback input addition must schedule composer work");
  assert(inputForm.classList.contains("denia-old-days-ds-composer"), "adding a direct textarea must discover and decorate its form");

  inputFixture.clearMutationRecords();
  const classBaseline = inputState.metrics.domainRuns.composer;
  inputForm.classList.add("native-composer-state");
  assert(inputFixture.flushMutations() === 1, "a cached composer class change must reach the observer");
  assert(inputFixture.flushAnimationFrames() === 1, "a cached composer class change must schedule composer work");
  assert(
    inputState.metrics.domainRuns.composer === classBaseline + 1,
    "a cached composer class change must invalidate and rerun only composer discovery",
  );

  inputFixture.clearMutationRecords();
  const semanticBaseline = inputState.metrics.domainRuns.composer;
  directInput.setAttribute("aria-label", "Message editor");
  assert(inputState.observer.options.attributeFilter.includes("aria-label"), "composer semantics must observe aria-label changes");
  assert(inputState.observer.options.attributeFilter.includes("title"), "composer and toggle semantics must observe title changes");
  assert(inputFixture.flushMutations() === 1, "a cached composer semantic change must reach the observer");
  assert(inputFixture.flushAnimationFrames() === 1, "a cached composer semantic change must schedule composer work");
  assert(
    inputState.metrics.domainRuns.composer === semanticBaseline + 1,
    "a cached composer descendant semantic change must invalidate and rerun composer discovery",
  );

  inputFixture.clearMutationRecords();
  const styleBaseline = inputState.metrics.domainRuns.composer;
  inputForm.style.setProperty("min-height", "48px");
  assert(inputFixture.flushMutations() === 1, "a cached composer style change must reach the observer");
  assert(inputFixture.flushAnimationFrames() === 0, "cached composer style work must remain trailing");
  assert(inputFixture.flushTimers() === 1, "cached composer style work must use one trailing timer");
  assert(inputFixture.flushAnimationFrames() === 1, "cached composer style work must schedule one frame after the timer");
  assert(
    inputState.metrics.domainRuns.composer === styleBaseline + 1,
    "a cached composer style change must invalidate and rerun composer discovery",
  );

  inputFixture.clearMutationRecords();
  directInput.remove();
  assert(inputFixture.flushMutations() === 1, "removing the final fallback input must reach the observer");
  assert(inputFixture.flushAnimationFrames() === 1, "removing the final fallback input must schedule composer invalidation");
  assert(!inputForm.classList.contains("denia-old-days-ds-composer"), "removing the final input must clear stale composer decoration");
  inputState.cleanup();
}

function createRuntimeHarness(createObjectUrl) {
  const created = [];
  const revoked = [];
  const events = [];
  const freezeCalls = [];
  const mutationObservers = new Set();
  const animationFrames = new Map();
  const timers = new Map();
  let pointTarget = null;
  let nextAnimationFrame = 1;
  let nextTimer = 1;
  const classMutations = new Map();

  function recordAttributeMutation(target, attributeName, oldValue) {
    if (attributeName === "class") {
      const oldClasses = new Set(String(oldValue || "").split(/\s+/u).filter(Boolean));
      const currentClasses = new Set(String(target.className || "").split(/\s+/u).filter(Boolean));
      for (const className of new Set([...oldClasses, ...currentClasses])) {
        if (oldClasses.has(className) !== currentClasses.has(className)) {
          const counts = classMutations.get(target) || new Map();
          counts.set(className, (counts.get(className) || 0) + 1);
          classMutations.set(target, counts);
        }
      }
    }
    for (const observer of mutationObservers) {
      if (!observer.target || !observer.options?.attributes) continue;
      if (target !== observer.target && !(observer.options.subtree && observer.target.contains(target))) continue;
      if (observer.options.attributeFilter && !observer.options.attributeFilter.includes(attributeName)) continue;
      observer.records.push({
        type: "attributes",
        target,
        attributeName,
        oldValue: observer.options.attributeOldValue ? oldValue ?? null : null,
      });
    }
  }

  function recordChildListMutation(target, addedNodes = [], removedNodes = []) {
    for (const observer of mutationObservers) {
      if (!observer.target || !observer.options?.childList) continue;
      if (target !== observer.target && !(observer.options.subtree && observer.target.contains(target))) continue;
      observer.records.push({ type: "childList", target, addedNodes, removedNodes });
    }
  }

  class FakeStyle {
    constructor(owner) {
      this.owner = owner;
      this.values = new Map();
    }

    setProperty(name, value) {
      const oldValue = this.#serialized();
      this.values.set(name, value);
      events.push(`set:${name}:${value}`);
      recordAttributeMutation(this.owner, "style", oldValue);
    }

    removeProperty(name) {
      const oldValue = this.#serialized();
      this.values.delete(name);
      events.push(`remove:${name}`);
      recordAttributeMutation(this.owner, "style", oldValue);
    }

    getPropertyValue(name) {
      return this.values.get(name) || "";
    }

    #serialized() {
      return [...this.values.entries()].map(([name, value]) => `${name}: ${value};`).join(" ");
    }
  }

  class FakeClassList {
    constructor(owner) {
      this.owner = owner;
    }

    add(...names) {
      const values = this.#values();
      names.forEach((name) => values.add(name));
      this.#sync(values);
    }

    remove(...names) {
      const values = this.#values();
      names.forEach((name) => values.delete(name));
      this.#sync(values);
    }

    toggle(name, force) {
      const values = this.#values();
      const enabled = force === undefined ? !values.has(name) : Boolean(force);
      if (enabled) values.add(name);
      else values.delete(name);
      this.#sync(values);
      return enabled;
    }

    contains(name) {
      return this.#values().has(name);
    }

    #values() {
      return new Set(this.owner.className.split(/\s+/u).filter(Boolean));
    }

    #sync(values) {
      const oldValue = this.owner.className;
      const nextValue = [...values].join(" ");
      if (nextValue === oldValue) return;
      this.owner.className = nextValue;
      recordAttributeMutation(this.owner, "class", oldValue);
    }
  }

  class FakeElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.id = "";
      this.className = "";
      this.classList = new FakeClassList(this);
      this.attributes = new Map();
      this.dataset = new Proxy({}, {
        set: (values, key, value) => {
          const oldValue = Object.hasOwn(values, key) ? String(values[key]) : null;
          const nextValue = String(value);
          values[key] = nextValue;
          recordAttributeMutation(this, dataAttributeName(key), oldValue);
          return true;
        },
        deleteProperty: (values, key) => {
          if (!Object.hasOwn(values, key)) return true;
          const oldValue = String(values[key]);
          delete values[key];
          recordAttributeMutation(this, dataAttributeName(key), oldValue);
          return true;
        },
      });
      this.style = new FakeStyle(this);
      this.children = [];
      this.parentElement = null;
      this.isConnected = false;
      this.textContent = "";
      this.innerHTML = "";
      this.listeners = new Map();
      this.#disabled = false;
      Object.defineProperty(this, "disabled", {
        enumerable: true,
        get: () => this.#disabled,
        set: (value) => {
          const oldValue = this.#disabled ? "" : null;
          const nextValue = Boolean(value);
          this.#disabled = nextValue;
          recordAttributeMutation(this, "disabled", oldValue);
        },
      });
      this.rect = { x: 0, y: 0, width: 120, height: 36 };
    }

    append(...nodes) {
      for (const node of nodes) this.#attach(node, this.children.length);
    }

    prepend(...nodes) {
      [...nodes].reverse().forEach((node) => this.#attach(node, 0));
    }

    insertBefore(node, reference) {
      const index = reference ? this.children.indexOf(reference) : this.children.length;
      this.#attach(node, index < 0 ? this.children.length : index);
    }

    insertAdjacentElement(_position, node) {
      if (!this.parentElement) return;
      const index = this.parentElement.children.indexOf(this);
      this.parentElement.#attach(node, index + 1);
    }

    remove() {
      const parent = this.parentElement;
      if (parent) {
        parent.children = parent.children.filter((node) => node !== this);
        recordChildListMutation(parent, [], [this]);
      }
      this.parentElement = null;
      this.isConnected = false;
    }

    setAttribute(name, value) {
      const stringValue = String(value);
      const oldValue = this.getAttribute(name);
      if (name.startsWith("data-")) {
        this.dataset[dataAttributeKey(name)] = stringValue;
        return;
      }
      this.attributes.set(name, stringValue);
      if (name === "id") this.id = stringValue;
      if (name === "class") this.className = stringValue;
      if (oldValue !== stringValue) recordAttributeMutation(this, name, oldValue);
    }

    getAttribute(name) {
      if (name === "id") return this.id || null;
      if (name === "class") return this.className || null;
      if (name.startsWith("data-")) return this.dataset[dataAttributeKey(name)] || null;
      return this.attributes.get(name) || null;
    }

    removeAttribute(name) {
      const oldValue = this.getAttribute(name);
      if (oldValue == null) return;
      if (name.startsWith("data-")) {
        delete this.dataset[dataAttributeKey(name)];
        return;
      }
      this.attributes.delete(name);
      if (name === "id") this.id = "";
      if (name === "class") this.className = "";
      recordAttributeMutation(this, name, oldValue);
    }

    addEventListener(name, handler) {
      const handlers = this.listeners.get(name) || [];
      handlers.push(handler);
      this.listeners.set(name, handlers);
    }

    removeEventListener(name, handler) {
      this.listeners.set(name, (this.listeners.get(name) || []).filter((candidate) => candidate !== handler));
    }

    click() {
      if (this.disabled) return;
      for (const handler of this.listeners.get("click") || []) handler.call(this, { currentTarget: this, target: this });
    }

    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    querySelectorAll(selector) { return descendants(this).filter((node) => matchesSelector(node, selector)); }
    closest(selector) {
      for (let node = this; node; node = node.parentElement) if (matchesSelector(node, selector)) return node;
      return null;
    }
    matches(selector) { return matchesSelector(this, selector); }
    contains(candidate) { return candidate === this || descendants(this).includes(candidate); }
    setRect(rect) {
      this.rect = { ...this.rect, ...rect };
      return this;
    }
    getBoundingClientRect() {
      const { x, width, height } = this.rect;
      let shift = 0;
      for (let node = this; node; node = node.parentElement) {
        shift += Number.parseFloat(node.style.getPropertyValue("--denia-old-days-native-prompt-shift")) || 0;
      }
      const y = this.rect.y + shift;
      return {
        x,
        y,
        width,
        height,
        right: x + width,
        bottom: y + height,
        top: y,
        left: x,
      };
    }

    get childNodes() {
      const directText = this.textContent
        ? [{ nodeType: 3, textContent: this.textContent }]
        : [];
      return [...directText, ...this.children];
    }

    #attach(node, index) {
      node.remove();
      node.parentElement = this;
      node.isConnected = true;
      this.children.splice(index, 0, node);
      recordChildListMutation(this, [node]);
    }

    #disabled;
  }

  const documentElement = new FakeElement("html");
  const head = new FakeElement("head");
  const body = new FakeElement("body");
  documentElement.isConnected = true;
  head.isConnected = true;
  body.isConnected = true;
  const document = {
    documentElement,
    head,
    body,
    createElement: (tagName) => new FakeElement(tagName),
    elementFromPoint: () => pointTarget,
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) { return [head, body, ...descendants(head), ...descendants(body)].filter((node) => matchesSelector(node, selector)); },
    getElementById(id) {
      const pending = [head, body];
      while (pending.length) {
        const node = pending.shift();
        if (node.id === id) return node;
        pending.push(...node.children);
      }
      return null;
    },
  };

  function descendants(node) {
    return node.children.flatMap((child) => [child, ...descendants(child)]);
  }

  function dataAttributeKey(name) {
    return name.slice(5).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
  }

  function dataAttributeName(key) {
    return `data-${String(key).replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}`;
  }

  function attributeValue(node, name) {
    if (name === "id") return node.id;
    if (name === "class") return node.className;
    if (name.startsWith("data-")) return node.dataset[dataAttributeKey(name)];
    return node.attributes.get(name);
  }

  function matchesSelector(node, selectorList) {
    return selectorList.split(",").some((selector) => {
      const source = selector.trim();
      if (!source || /\s/u.test(source.replace(/\[[^\]]+\]/gu, ""))) return false;
      const tag = /^[a-z][a-z0-9-]*/iu.exec(source)?.[0];
      if (tag && node.tagName !== tag.toUpperCase()) return false;
      for (const id of source.matchAll(/#([a-z0-9_-]+)/giu)) if (node.id !== id[1]) return false;
      for (const className of source.matchAll(/\.([a-z0-9_-]+)/giu)) if (!node.classList.contains(className[1])) return false;
      for (const attribute of source.matchAll(/\[([^\]=*^$~|]+)(?:([*$^]?=)["']?([^\]"']*)["']?)?\]/gu)) {
        const actual = attributeValue(node, attribute[1]);
        if (!attribute[2] && actual == null) return false;
        if (attribute[2] === "=" && actual !== attribute[3]) return false;
        if (attribute[2] === "*=" && !String(actual || "").includes(attribute[3])) return false;
        if (attribute[2] === "^=" && !String(actual || "").startsWith(attribute[3])) return false;
        if (attribute[2] === "$=" && !String(actual || "").endsWith(attribute[3])) return false;
      }
      return true;
    });
  }
  const sandbox = {
    Blob,
    HTMLElement: FakeElement,
    Node: { TEXT_NODE: 3 },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.target = null;
        this.options = null;
        this.records = [];
        mutationObservers.add(this);
      }

      observe(target, options) {
        this.target = target;
        this.options = options;
      }

      disconnect() {
        this.target = null;
        this.options = null;
        this.records = [];
      }

      takeRecords() {
        const records = this.records;
        this.records = [];
        return records;
      }
    },
    URL: {
      createObjectURL(blob) {
        const value = createObjectUrl(created.length, blob);
        created.push(value);
        events.push(`create:${value}`);
        return value;
      },
      revokeObjectURL(value) {
        revoked.push(value);
        events.push(`revoke:${value}`);
      },
    },
    atob,
    cancelAnimationFrame: (id) => animationFrames.delete(id),
    console,
    decodeURIComponent,
    document,
    getComputedStyle: (node) => ({
      backgroundImage: node?.computedBackgroundImage || "none",
      display: node?.computedDisplay || "block",
      opacity: node?.computedOpacity || "1",
      position: node?.computedPosition || "static",
      visibility: node?.computedVisibility || "visible",
      zIndex: node?.computedZIndex || "auto",
      getPropertyValue: (name) => node?.style?.getPropertyValue(name) || "",
    }),
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: (callback) => {
      const id = nextAnimationFrame;
      nextAnimationFrame += 1;
      animationFrames.set(id, callback);
      return id;
    },
    setTimeout: (callback, delay = 0) => {
      const id = nextTimer;
      nextTimer += 1;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    addEventListener() {},
    removeEventListener() {},
    innerWidth: 1512,
    innerHeight: 859,
    visualViewport: {
      width: 1512,
      height: 859,
      addEventListener() {},
      removeEventListener() {},
    },
  };
  sandbox.window = sandbox;
  sandbox.window.matchMedia = sandbox.matchMedia;
  const context = vm.createContext(sandbox);
  sandbox.captureFreeze = (value) => freezeCalls.push(value);
  vm.runInContext("globalThis.originalFreeze = Object.freeze; Object.freeze = (value) => { captureFreeze(value); return originalFreeze(value); };", context);
  return {
    context,
    sandbox,
    root: documentElement,
    document,
    FakeElement,
    created,
    revoked,
    events,
    freezeCalls,
    classMutationCount(node, className) {
      return classMutations.get(node)?.get(className) || 0;
    },
    setPointTarget(node) {
      pointTarget = node;
    },
    setViewport(width, height) {
      sandbox.innerWidth = width;
      sandbox.innerHeight = height;
      sandbox.visualViewport.width = width;
      sandbox.visualViewport.height = height;
    },
    clearMutationRecords() {
      for (const observer of mutationObservers) observer.takeRecords();
    },
    takeMutationRecords() {
      return [...mutationObservers].flatMap((observer) => observer.takeRecords());
    },
    deliverMutationRecords(records) {
      let delivered = 0;
      for (const observer of mutationObservers) {
        if (!records.length || !observer.target) continue;
        delivered += records.length;
        observer.callback(records, observer);
      }
      return delivered;
    },
    flushMutations() {
      let delivered = 0;
      for (const observer of mutationObservers) {
        const records = observer.takeRecords();
        if (!records.length || !observer.target) continue;
        delivered += records.length;
        observer.callback(records, observer);
      }
      return delivered;
    },
    flushAnimationFrames() {
      const pending = [...animationFrames.entries()];
      animationFrames.clear();
      for (const [id, callback] of pending) callback(id);
      return pending.length;
    },
    flushTimers() {
      const pending = [...timers.entries()];
      timers.clear();
      for (const [, timer] of pending) timer.callback();
      return pending.length;
    },
    pendingTimerCount() {
      return timers.size;
    },
    pendingTimerIds() {
      return [...timers.keys()];
    },
    pendingTimerDelays() {
      return [...timers.values()].map((timer) => timer.delay);
    },
  };
}

function publicStateContainsUrl(value, seen = new Set()) {
  if (typeof value === "string") return /^(?:blob|data):/u.test(value);
  if (!value || typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const tag = Object.prototype.toString.call(value);
  if (tag === "[object Map]") {
    for (const [key, nested] of value.entries()) {
      if (publicStateContainsUrl(key, seen) || publicStateContainsUrl(nested, seen)) return true;
    }
    return false;
  }
  if (tag === "[object Set]") {
    for (const nested of value.values()) if (publicStateContainsUrl(nested, seen)) return true;
    return false;
  }
  return Object.values(value).some((nested) => publicStateContainsUrl(nested, seen));
}

function assertPublicStateUrlCollectionCoverage() {
  const collections = vm.runInNewContext(`(() => {
    const mapWithSet = new Map([["nested", new Set(["blob:cross-realm-map-set"])]]);
    const setWithMap = new Set([new Map([["nested", "data:image/webp;base64,AA=="]])]);
    const safeMap = new Map();
    const safeSet = new Set();
    safeMap.set("cycle", safeSet);
    safeSet.add(safeMap);
    return { mapWithSet, setWithMap, safeMap };
  })()`);
  assert(publicStateContainsUrl(collections.mapWithSet), "public state URL scan must inspect cross-realm Map and nested Set values");
  assert(publicStateContainsUrl(collections.setWithMap), "public state URL scan must inspect cross-realm Set and nested Map values");
  assert(!publicStateContainsUrl(collections.safeMap), "public state URL scan must terminate on collection cycles without URLs");
  assert(publicStateContainsUrl({ nested: ["blob:ordinary-object-array"] }), "public state URL scan must retain ordinary object and array coverage");
}

function assertLiveVerificationArtworkTarget(loaderSource) {
  const declarationStart = loaderSource.indexOf("const verifyExpression = `");
  const declarationEnd = loaderSource.indexOf("`;\n\nclass CdpSession", declarationStart);
  assert(declarationStart >= 0 && declarationEnd > declarationStart, "validator could not extract loader verifyExpression");
  const declaration = loaderSource.slice(declarationStart, declarationEnd + 2);
  const expression = vm.runInNewContext(`${declaration}\nverifyExpression`);

  const runCase = ({ heroBackgroundImage = "none", photoBackgroundImage = "none" }) => {
    const root = {
      classList: { contains: (name) => ["denia-old-days-ds-extension", "denia-old-days-ds-home"].includes(name) },
      clientWidth: 1200,
      dataset: {},
      scrollWidth: 1200,
    };
    const hero = {};
    const photoFront = {};
    const document = {
      documentElement: root,
      elementFromPoint: () => null,
      getElementById: () => null,
      querySelector(selector) {
        if (selector === ".denia-old-days-ds-hero") return hero;
        if (selector === ".denia-old-days-ds-photo-front") return photoFront;
        return null;
      },
      querySelectorAll: () => [],
    };
    const sandbox = {
      document,
      getComputedStyle(node) {
        if (node === root) return { getPropertyValue: () => 'url("blob:bright")' };
        if (node === hero) return { backgroundImage: heroBackgroundImage };
        if (node === photoFront) return { backgroundImage: photoBackgroundImage };
        return {};
      },
      innerHeight: 800,
      innerWidth: 1200,
      window: {
        __DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__: {
          id: "denia-old-days",
          version: "0.1.0",
          artReady: true,
        },
      },
    };
    return vm.runInNewContext(expression, sandbox);
  };

  assert(
    runCase({ heroBackgroundImage: 'url("blob:bright")' }).heroUsesRuntimeArt === false,
    "live verification must not accept artwork rendered only on the hero paper container",
  );
  assert(
    runCase({ photoBackgroundImage: 'url("blob:bright")' }).heroUsesRuntimeArt === true,
    "live verification must accept matching bright artwork on photo-front",
  );
  assert(
    runCase({}).heroUsesRuntimeArt === false,
    "live verification must reject a missing photo-front artwork URL",
  );
}

function assertLiveTaskVerification(loaderSource) {
  const declarationStart = loaderSource.indexOf("const verifyExpression = `");
  const declarationEnd = loaderSource.indexOf("`;\n\nclass CdpSession", declarationStart);
  assert(declarationStart >= 0 && declarationEnd > declarationStart, "validator could not extract loader verifyExpression for task cases");
  const declaration = loaderSource.slice(declarationStart, declarationEnd + 2);
  const expression = vm.runInNewContext(`${declaration}\nverifyExpression`);

  const makeNode = (classes = [], dataset = {}, rect = { x: 100, y: 100, width: 320, height: 80 }) => {
    const x = rect.x ?? rect.left ?? 0;
    const y = rect.y ?? rect.top ?? 0;
    const width = rect.width ?? 0;
    const height = rect.height ?? 0;
    const measured = {
      x,
      y,
      width,
      height,
      left: rect.left ?? x,
      top: rect.top ?? y,
      right: rect.right ?? x + width,
      bottom: rect.bottom ?? y + height,
    };
    return {
      classList: { contains: (name) => classes.includes(name) },
      contains: () => false,
      dataset,
      getAttribute: () => null,
      querySelector: () => null,
      getBoundingClientRect: () => measured,
    };
  };

  const familyForState = {
    staged: "taskWarm",
    working: "taskWarm",
    approval: "taskApproval",
    error: "taskError",
    complete: "taskComplete",
  };
  const artUrlForFamily = {
    taskWarm: "blob:warm",
    taskApproval: "blob:approval",
    taskError: "blob:error",
    taskComplete: "blob:complete",
  };

  const runCase = ({
    formState,
    artFamily = familyForState[formState],
    railDisplay = "block",
    sidebarState = "closed",
    sidebarConfidence = sidebarState === "unknown" ? "none" : "high",
    nativeSidebarPanel = sidebarState === "open",
    nativeSidebarPanelCount = nativeSidebarPanel ? 1 : 0,
    nativeSidebarGroupCount = nativeSidebarPanel ? 1 : 0,
    nativeSidebarRowCount = nativeSidebarPanel ? 1 : 0,
    nativeSidebarRect = { x: 880, y: 46, width: 320, height: 754 },
    skinsContained = true,
    mainRect = { x: 0, y: 46, width: 880, height: 754 },
    togglePresent = sidebarState === "open",
    toggleHitTarget = true,
    toggleRect = { x: 1140, y: 8, width: 40, height: 32 },
    home = false,
    includeSafeLeftHost = home,
    safeLeftHostRect = { x: 0, y: 46, width: 280, height: 754 },
    decorateObservation = true,
    includeFinalCard = false,
    includeSidebarBrand = home,
    sidebarBrandHost = includeSafeLeftHost ? "left" : "none",
    composerRect = { x: 100, y: 100, width: 320, height: 80 },
    hideNativeSuggestions = home,
  }) => {
    const rootClasses = ["denia-old-days-ds-extension", home ? "denia-old-days-ds-home" : "denia-old-days-ds-task"];
    const root = {
      classList: { contains: (name) => rootClasses.includes(name) },
      clientWidth: 1200,
      dataset: {
        deniaFormState: formState,
        deniaSidebarState: sidebarState,
        deniaSidebarConfidence: sidebarConfidence,
      },
      scrollWidth: 1200,
    };
    const style = makeNode();
    const chrome = makeNode();
    const stateArtLayer = makeNode(
      ["denia-old-days-ds-state-art-layer", "is-active"],
      { deniaArtFamily: artFamily },
    );
    const stateArtRail = makeNode(["denia-old-days-ds-state-art"]);
    stateArtRail.querySelector = (selector) =>
      selector === ".denia-old-days-ds-state-art-layer.is-active" ? stateArtLayer : null;
    const sidebar = makeNode();
    const safeLeftHost = includeSafeLeftHost ? makeNode([], {}, safeLeftHostRect) : null;
    if (safeLeftHost) {
      safeLeftHost.contains = (node) => includeSidebarBrand && sidebarBrandHost === "left" && node === sidebar;
    }
    const homeVisuals = home ? makeNode(["denia-old-days-ds-home-visuals"], {}, { x: 0, y: 0, width: 1200, height: 800 }) : null;
    const hero = home ? makeNode(["denia-old-days-ds-hero"]) : null;
    const heroCopy = hero;
    const photoFront = home ? makeNode(["denia-old-days-ds-photo-front"]) : null;
    const nativeHomePrompt = home
      ? makeNode(["denia-old-days-ds-native-home-prompt"], {}, { x: 220, y: 420, width: 760, height: 112 })
      : null;
    const nativeHomeSuggestions = home
      ? [makeNode(["denia-old-days-ds-native-home-suggestions"])]
      : [];
    const nativeSidebarPanels = Array.from(
      { length: nativeSidebarPanelCount },
      () => makeNode(["denia-old-days-ds-native-right-sidebar"], {}, nativeSidebarRect),
    );
    const nativeSidebar = nativeSidebarPanels[0] || null;
    const nativeSidebarGroups = Array.from(
      { length: nativeSidebarGroupCount },
      () => makeNode(["denia-old-days-ds-native-sidebar-group"]),
    );
    const nativeSidebarRows = Array.from(
      { length: nativeSidebarRowCount },
      () => makeNode(["denia-old-days-ds-native-sidebar-row"]),
    );
    for (const panel of nativeSidebarPanels) {
      panel.contains = (node) => (skinsContained && (nativeSidebarGroups.includes(node) || nativeSidebarRows.includes(node)))
        || (includeSidebarBrand && sidebarBrandHost === "right" && node === sidebar);
    }
    const body = makeNode();
    const main = makeNode(home ? ["dream-skin-home"] : [], {}, mainRect);
    main.scrollHeight = mainRect.height;
    main.clientHeight = mainRect.height;
    main.scrollTop = 0;
    if (homeVisuals) homeVisuals.parentElement = body;
    if (heroCopy) heroCopy.parentElement = homeVisuals;
    const toggle = togglePresent ? makeNode([], {}, toggleRect) : null;
    if (toggle) {
      toggle.getAttribute = (name) => name === "aria-label" ? "显示/隐藏侧边栏" : null;
      toggle.textContent = "";
    }
    const toggleOccluder = makeNode();
    const composer = makeNode([], {}, composerRect);
    const nativeObservation = makeNode();
    const observation = decorateObservation ? makeNode(["denia-old-days-ds-observation"]) : null;
    const assistant = makeNode(includeFinalCard ? ["denia-old-days-ds-final-card"] : []);
    const finalCard = includeFinalCard ? assistant : null;
    const document = {
      body,
      documentElement: root,
      elementFromPoint(x, y) {
        if (toggle) {
          const rect = toggle.getBoundingClientRect();
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
            return toggleHitTarget ? toggle : toggleOccluder;
          }
        }
        return null;
      },
      getElementById(id) {
        if (id === "denia-old-days-dream-skin-extension-style") return style;
        if (id === "denia-old-days-ds-chrome") return chrome;
        if (id === "denia-old-days-ds-state-art") return stateArtRail;
        if (id === "denia-old-days-ds-sidebar-brand") return includeSidebarBrand ? sidebar : null;
        if (id === "denia-old-days-ds-home-visuals") return homeVisuals;
        if (id === "denia-old-days-ds-hero-copy") return heroCopy;
        return null;
      },
      querySelector(selector) {
        if (selector === ".denia-old-days-ds-hero") return hero;
        if (selector === ".denia-old-days-ds-photo-front") return photoFront;
        if (selector === ".denia-old-days-ds-native-home-prompt") return nativeHomePrompt;
        if (selector === ".dream-skin-home") return home ? main : null;
        if (selector === ".composer-surface-chrome") return composer;
        if (selector === ".denia-old-days-ds-native-right-sidebar") return nativeSidebar;
        if (selector === '[role="main"]' || selector === "main") return main;
        if (selector === ".denia-old-days-ds-observation") return observation;
        if (selector === ".denia-old-days-ds-final-card") return finalCard;
        return null;
      },
      querySelectorAll(selector) {
        if (selector === "button") return toggle ? [toggle] : [];
        if (selector === '[data-testid="sidebar"], [data-slot="sidebar"], aside, nav') {
          return [...(safeLeftHost ? [safeLeftHost] : []), ...nativeSidebarPanels];
        }
        if (selector.includes('[data-content-search-unit-key*="tool"]')) return [nativeObservation];
        if (selector === ".denia-old-days-ds-observation") return observation ? [observation] : [];
        if (selector === ".denia-old-days-ds-native-right-sidebar") return nativeSidebarPanels;
        if (selector === ".denia-old-days-ds-native-sidebar-group") return nativeSidebarGroups;
        if (selector === ".denia-old-days-ds-native-sidebar-row") return nativeSidebarRows;
        if (selector === ".denia-old-days-ds-native-home-prompt") return nativeHomePrompt ? [nativeHomePrompt] : [];
        if (selector === ".denia-old-days-ds-native-home-suggestions") return nativeHomeSuggestions;
        if (selector === '[data-content-search-unit-key$=":assistant"]') return [assistant];
        return [];
      },
    };
    const sandbox = {
      document,
      getComputedStyle(node, pseudo) {
        if (node === root) {
          return {
            getPropertyValue: (name) => ({
              "--denia-old-days-art-bright": 'url("blob:bright")',
              "--denia-old-days-art-task-warm": 'url("blob:warm")',
              "--denia-old-days-art-task-approval": 'url("blob:approval")',
              "--denia-old-days-art-task-error": 'url("blob:error")',
              "--denia-old-days-art-task-complete": 'url("blob:complete")',
            }[name] || ""),
          };
        }
        if (node === stateArtRail) {
          return {
            backgroundImage: "none",
            display: railDisplay,
            opacity: "1",
            visibility: "visible",
          };
        }
        if (node === stateArtLayer) {
          return {
            backgroundImage: `url("${artUrlForFamily[artFamily]}")`,
            display: "block",
            opacity: ".4",
            visibility: "visible",
          };
        }
        if (node === photoFront) {
          return { backgroundImage: 'url("blob:bright")', display: "block", opacity: "1", visibility: "visible" };
        }
        if (node === homeVisuals) {
          return {
            contain: "layout paint style",
            display: "block",
            opacity: "1",
            overflow: "hidden",
            position: "fixed",
            visibility: "visible",
          };
        }
        if (node === nativeHomePrompt) {
          return { backgroundImage: "none", display: "flex", opacity: "1", visibility: "visible" };
        }
        if (nativeHomeSuggestions.includes(node)) {
          return {
            backgroundImage: "none",
            display: hideNativeSuggestions ? "none" : "grid",
            opacity: "1",
            visibility: "visible",
          };
        }
        if (node === main) {
          return {
            backgroundImage: "none",
            display: "flex",
            opacity: "1",
            overflowY: home ? "hidden" : "visible",
            visibility: "visible",
          };
        }
        if (node === composer && pseudo === "::before") {
          return { content: "none", display: "none", height: "auto", position: "static", width: "auto" };
        }
        return { backgroundImage: "none", display: "block", opacity: "1", visibility: "visible" };
      },
      innerHeight: 800,
      innerWidth: 1200,
      window: {
        __DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__: {
          id: "denia-old-days",
          version: "0.1.0",
          artReady: true,
          formState,
        },
      },
    };
    return vm.runInNewContext(expression, sandbox);
  };

  assert(
    runCase({ formState: "working" }).taskPass === true,
    "live task verification must accept a closed task sidebar with its visible warm rail",
  );
  assert(
    runCase({ formState: "working" }).pass === true,
    "live task verification must accept task routes without the home-only sidebar brand",
  );
  assert(
    runCase({ formState: "approval" }).taskPass === true,
    "live task verification must accept approval with its dedicated artwork",
  );
  assert(
    runCase({ formState: "error", artFamily: "taskWarm" }).taskPass === false,
    "live task verification must reject an error rail with mismatched smiling artwork",
  );
  assert(
    runCase({ formState: "working", decorateObservation: false }).taskPass === false,
    "live task verification must reject visible native observations that are not diary cards",
  );
  assert(
    runCase({ formState: "complete", includeFinalCard: true }).taskPass === true,
    "live task verification must accept complete state with its direct-gaze artwork and a final response card",
  );
  assert(
    runCase({ formState: "complete" }).taskPass === false,
    "live task verification must reject complete state without a final response card",
  );
  assert(
    runCase({ formState: "working", sidebarState: "open", railDisplay: "none" }).taskPass === true,
    "live task verification must accept an open skinned sidebar with hidden state artwork",
  );
  assert(
    runCase({ formState: "working", sidebarState: "open" }).taskPass === false,
    "live task verification must reject visible state artwork while the sidebar is open",
  );
  assert(
    runCase({ formState: "working", sidebarState: "unknown", railDisplay: "none" }).taskPass === true,
    "live task verification must accept unknown sidebar detection only when state artwork is hidden",
  );
  assert(
    runCase({ formState: "working", sidebarState: "unknown" }).taskPass === false,
    "live task verification must reject visible state artwork while sidebar detection is unknown",
  );
  assert(
    runCase({ formState: "working", sidebarState: "unknown", railDisplay: "none", nativeSidebarGroupCount: 1 }).taskPass === false,
    "live task verification must reject a stale group skin while sidebar detection is unknown",
  );
  assert(
    runCase({ formState: "working", sidebarState: "unknown", railDisplay: "none", nativeSidebarRowCount: 1 }).taskPass === false,
    "live task verification must reject a stale row skin while sidebar detection is unknown",
  );
  assert(
    runCase({ formState: "working", sidebarState: "closed", nativeSidebarGroupCount: 1 }).taskPass === false,
    "live task verification must reject a stale group skin while the sidebar is closed",
  );
  assert(
    runCase({ formState: "working", sidebarState: "closed", nativeSidebarRowCount: 1 }).taskPass === false,
    "live task verification must reject a stale row skin while the sidebar is closed",
  );
  assert(
    runCase({ formState: "working", sidebarState: "open", railDisplay: "none", nativeSidebarPanel: false }).taskPass === false,
    "live task verification must reject an open sidebar state without its panel skin",
  );
  for (const fixture of [
    { sidebarState: "opening", sidebarConfidence: "none", label: "an invalid sidebar state" },
    { sidebarState: "unknown", sidebarConfidence: "medium", label: "an invalid sidebar confidence" },
    { sidebarState: "open", sidebarConfidence: "none", label: "open without high confidence" },
    { sidebarState: "closed", sidebarConfidence: "none", label: "closed without high confidence" },
    { sidebarState: "unknown", sidebarConfidence: "high", label: "unknown with high confidence" },
  ]) {
    assert(
      runCase({
        formState: "staged",
        home: true,
        railDisplay: "none",
        sidebarState: fixture.sidebarState,
        sidebarConfidence: fixture.sidebarConfidence,
      }).pass === false,
      `live verification must reject ${fixture.label}`,
    );
  }
  assert(
    runCase({
      formState: "working",
      sidebarState: "open",
      railDisplay: "none",
      nativeSidebarPanelCount: 2,
    }).taskPass === false,
    "live task verification must reject duplicate open sidebar panels",
  );
  assert(
    runCase({
      formState: "working",
      sidebarState: "open",
      railDisplay: "none",
      nativeSidebarGroupCount: 1,
      nativeSidebarRowCount: 0,
      skinsContained: false,
    }).taskPass === false,
    "live task verification must reject an open group skin outside the unique panel",
  );
  assert(
    runCase({
      formState: "working",
      sidebarState: "open",
      railDisplay: "none",
      nativeSidebarGroupCount: 0,
      nativeSidebarRowCount: 1,
      skinsContained: false,
    }).taskPass === false,
    "live task verification must reject an open row skin outside the unique panel",
  );
  const offEdgeResult = runCase({
    formState: "working",
    sidebarState: "open",
    railDisplay: "none",
    nativeSidebarRect: { x: 760, y: 46, width: 320, height: 754 },
  });
  assert(
    offEdgeResult.sidebar.nativeGeometryPass === false && offEdgeResult.taskPass === false,
    "live task verification must reject an open panel away from the viewport right edge",
  );
  const shortPanelResult = runCase({
    formState: "working",
    sidebarState: "open",
    railDisplay: "none",
    nativeSidebarRect: { x: 880, y: 46, width: 320, height: 200 },
  });
  assert(
    shortPanelResult.sidebar.nativeGeometryPass === false && shortPanelResult.taskPass === false,
    "live task verification must reject an open panel below the minimum height",
  );
  const mainOverlapResult = runCase({
    formState: "working",
    sidebarState: "open",
    railDisplay: "none",
    nativeSidebarRect: { x: 820, y: 46, width: 380, height: 754 },
  });
  assert(
    mainOverlapResult.sidebar.nativeGeometryPass === false && mainOverlapResult.taskPass === false,
    "live task verification must reject an open panel that starts inside measurable main content",
  );
  const blockedToggleResult = runCase({
    formState: "working",
    sidebarState: "open",
    railDisplay: "none",
    toggleHitTarget: false,
  });
  assert(
    blockedToggleResult.sidebar.toggleHitTargetPass === false && blockedToggleResult.taskPass === false,
    "live task verification must reject an open sidebar whose toggle center is obscured",
  );
  assert(
    runCase({ formState: "staged", home: true, sidebarState: "open", railDisplay: "none" }).pass === true,
    "live verification must accept a skinned home sidebar with hidden state artwork",
  );
  assert(
    runCase({
      formState: "staged",
      home: true,
      sidebarState: "open",
      railDisplay: "none",
      hideNativeSuggestions: false,
    }).pass === false,
    "live verification must reject a home view whose native suggestion cards remain visible",
  );
  assert(
    runCase({
      formState: "staged",
      home: true,
      sidebarState: "open",
      railDisplay: "none",
      composerRect: { x: 100, y: 900, width: 320, height: 80 },
    }).composerViewportPass === false,
    "live verification must report a home composer pushed below the viewport",
  );
  assert(
    runCase({ formState: "staged", home: true, sidebarState: "open" }).pass === false,
    "live verification must reject visible state artwork while the home sidebar is open",
  );
  assert(
    runCase({ formState: "staged", home: true, sidebarState: "unknown", railDisplay: "none" }).pass === true,
    "live verification must accept unknown home sidebar detection with hidden state artwork and no skin",
  );
  assert(
    runCase({ formState: "staged", home: true, sidebarState: "unknown" }).pass === false,
    "live verification must reject visible state artwork while home sidebar detection is unknown",
  );
  assert(
    runCase({
      formState: "staged",
      home: true,
      sidebarState: "open",
      railDisplay: "none",
      includeSafeLeftHost: false,
      includeSidebarBrand: false,
    }).pass === true,
    "live verification must accept a right-only home without a left host or sidebar brand",
  );
  assert(
    runCase({
      formState: "staged",
      home: true,
      sidebarState: "open",
      railDisplay: "none",
      includeSafeLeftHost: true,
      includeSidebarBrand: false,
    }).pass === false,
    "live verification must require a visible brand when a safe left host exists",
  );
  assert(
    runCase({
      formState: "staged",
      home: true,
      sidebarState: "open",
      railDisplay: "none",
      includeSafeLeftHost: false,
      includeSidebarBrand: true,
      sidebarBrandHost: "right",
    }).pass === false,
    "live verification must reject a home brand inside the native right panel",
  );
  assert(
    runCase({
      formState: "staged",
      home: true,
      sidebarState: "open",
      railDisplay: "none",
      includeSafeLeftHost: true,
      includeSidebarBrand: true,
      sidebarBrandHost: "left",
    }).pass === true,
    "live verification must accept a visible home brand contained by its safe left host",
  );
}

function assertFallbackCleanupBehavior(loaderSource) {
  const declarationStart = loaderSource.indexOf("const cleanupExpression = `");
  const declarationEnd = loaderSource.indexOf("`;\n\nconst verifyExpression", declarationStart);
  assert(declarationStart >= 0 && declarationEnd > declarationStart, "validator could not extract loader cleanupExpression");
  const declaration = loaderSource.slice(declarationStart, declarationEnd + 2);
  const expression = vm.runInNewContext(`${declaration}\ncleanupExpression`);
  const harness = createRuntimeHarness((index) => `blob:cleanup-${index + 1}`);

  const ownedIds = [
    "denia-old-days-dream-skin-extension-style",
    "denia-old-days-ds-chrome",
    "denia-old-days-ds-sidebar-brand",
    "denia-old-days-ds-home-visuals",
    "denia-old-days-ds-hero-copy",
    "denia-old-days-ds-hero-badge",
    "denia-old-days-ds-stage-pass",
    "denia-old-days-ds-custom-card",
    "denia-old-days-ds-state-art",
  ];
  for (const id of ownedIds) {
    const node = harness.document.createElement("div");
    node.id = id;
    harness.document.body.append(node);
  }

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
  const touched = removableClasses.map((className) => {
    const node = harness.document.createElement("div");
    node.classList.add(className);
    node.dataset.deniaObservationLabel = "观察记录";
    harness.document.body.append(node);
    return node;
  });
  const nativeHomePrompt = touched[0];
  nativeHomePrompt.style.setProperty("--denia-old-days-native-prompt-shift", "246px");

  const hero = harness.document.createElement("div");
  hero.classList.add("denia-old-days-ds-hero");
  for (const property of ["background-image", "background-position", "background-size", "background-repeat", "background-color"]) {
    hero.style.setProperty(property, "legacy");
  }
  harness.document.body.append(hero);

  harness.root.classList.add("denia-old-days-ds-extension", "denia-old-days-ds-home", "denia-old-days-ds-task");
  harness.root.dataset.deniaOldDaysExtensionVersion = "0.1.0";
  harness.root.dataset.deniaFormState = "working";
  harness.root.dataset.deniaSidebarState = "open";
  harness.root.dataset.deniaSidebarConfidence = "high";
  harness.root.dataset.deniaSidebarToggleState = "open";
  harness.root.dataset.deniaSummaryState = "open";
  harness.root.dataset.deniaBottomPanelState = "open";
  harness.root.dataset.deniaWorkSurfaceState = "open";
  harness.root.style.setProperty("--denia-native-sidebar-width", "320px");
  harness.root.style.setProperty("--denia-thread-content-width", "1242px");
  for (const name of ["bright", "task-warm", "task-approval", "task-error", "task-complete"]) {
    harness.root.style.setProperty(`--denia-old-days-art-${name}`, `url(blob:${name})`);
  }

  assert(vm.runInContext(expression, harness.context) === true, "fallback cleanup must report success");
  for (const className of ["denia-old-days-ds-extension", "denia-old-days-ds-home", "denia-old-days-ds-task"]) {
    assert(!harness.root.classList.contains(className), `fallback cleanup must remove root class ${className}`);
  }
  assert(!("deniaOldDaysExtensionVersion" in harness.root.dataset), "fallback cleanup must remove the extension version marker");
  assert(!("deniaFormState" in harness.root.dataset), "fallback cleanup must remove the form state marker");
  assert(!("deniaSidebarState" in harness.root.dataset), "fallback cleanup must remove the sidebar state marker");
  assert(!("deniaSidebarConfidence" in harness.root.dataset), "fallback cleanup must remove the sidebar confidence marker");
  assert(!("deniaSidebarToggleState" in harness.root.dataset), "fallback cleanup must remove the sidebar toggle state marker");
  assert(!("deniaSummaryState" in harness.root.dataset), "fallback cleanup must remove the summary state marker");
  assert(!("deniaBottomPanelState" in harness.root.dataset), "fallback cleanup must remove the bottom panel state marker");
  assert(!("deniaWorkSurfaceState" in harness.root.dataset), "fallback cleanup must remove the work-surface state marker");
  assert(!harness.root.style.getPropertyValue("--denia-native-sidebar-width"), "fallback cleanup must remove the native sidebar width snapshot");
  assert(!harness.root.style.getPropertyValue("--denia-thread-content-width"), "fallback cleanup must remove the thread content width snapshot");
  for (const name of ["bright", "task-warm", "task-approval", "task-error", "task-complete"]) {
    assert(!harness.root.style.getPropertyValue(`--denia-old-days-art-${name}`), `fallback cleanup must remove ${name} artwork CSS variable`);
  }
  for (const id of ownedIds) assert(!harness.document.getElementById(id), `fallback cleanup must remove owned node ${id}`);
  removableClasses.forEach((className, index) => {
    assert(!touched[index].classList.contains(className), `fallback cleanup must remove touched class ${className}`);
    assert(!("deniaObservationLabel" in touched[index].dataset), `fallback cleanup must remove observation data from ${className}`);
  });
  assert(
    !nativeHomePrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift"),
    "fallback cleanup must remove native home prompt positioning",
  );
  for (const property of ["background-image", "background-position", "background-size", "background-repeat", "background-color"]) {
    assert(!hero.style.getPropertyValue(property), `fallback cleanup must remove legacy hero ${property}`);
  }
}

function assertHomeLayoutPreservation(payload) {
  const harness = createRuntimeHarness((index) => `blob:home-layout-${index + 1}`);
  const main = harness.document.createElement("main");
  main.setAttribute("role", "main");
  main.classList.add("dream-skin-home");
  main.scrollHeight = 1129;
  main.clientHeight = 767;
  main.scrollTop = 0;

  const nativePrompt = harness.document.createElement("div");
  nativePrompt.setRect({ x: 220, y: 373, width: 760, height: 112 });
  const nativePromptBody = harness.document.createElement("div");
  const nativeHeading = harness.document.createElement("div");
  const nativeTitle = harness.document.createElement("span");
  const inlineProjectButton = harness.document.createElement("button");
  const promptText = "What should we build in denia-old-days-codex-theme?";
  nativePrompt.textContent = promptText;
  nativePromptBody.textContent = promptText;
  nativeHeading.textContent = promptText;
  nativeTitle.textContent = promptText;
  nativeTitle.setRect({ x: 404, y: 443, width: 392, height: 42 });
  inlineProjectButton.textContent = "denia-old-days-codex-theme";
  nativeTitle.append(inlineProjectButton);
  nativeHeading.append(nativeTitle);
  nativePromptBody.append(nativeHeading);
  nativePrompt.append(nativePromptBody);
  const nativeButtons = ["Explore code", "Build feature", "Review changes", "Fix bug"].map((label) => {
    const button = harness.document.createElement("button");
    button.textContent = label;
    return button;
  });
  const nativeSuggestions = harness.document.createElement("div");
  nativeSuggestions.append(...nativeButtons);
  const composerBoundary = harness.document.createElement("div");
  composerBoundary.computedPosition = "relative";
  composerBoundary.computedZIndex = "20";
  composerBoundary.setRect({ x: 196, y: 755, width: 1120, height: 194 });
  const composer = harness.document.createElement("form");
  composer.classList.add("composer-surface-chrome");
  composer.setRect({ x: 220, y: 835, width: 760, height: 104 });
  const input = harness.document.createElement("textarea");
  composer.append(input);
  composerBoundary.append(composer);
  main.append(nativePrompt, nativeSuggestions, composerBoundary);
  harness.document.body.append(main);

  const nativeChildren = [...main.children];
  vm.runInContext(payload, harness.context, { timeout: 1000 });
  const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const visuals = harness.document.getElementById("denia-old-days-ds-home-visuals");
  const hero = harness.document.getElementById("denia-old-days-ds-hero-copy");
  hero.setRect({ x: 196, y: 121, width: 1120, height: 455 });

  assert(
    main.children.length === nativeChildren.length
      && nativeChildren.every((node, index) => main.children[index] === node),
    "fixed home visual layer must not add or reorder Codex native main-flow children",
  );
  assert(visuals?.parentElement === harness.document.body, "home visual layer must mount outside the native scrolling main");
  assert(hero?.parentElement === visuals, "home hero must stay contained by the out-of-flow visual layer");
  assert(!harness.document.getElementById("denia-old-days-ds-suggestion-slot"));
  assert(!harness.document.getElementById("denia-old-days-ds-card-deck"));
  assert(nativeButtons.every((button) =>
    !button.classList.contains("denia-old-days-ds-native-card")));
  assert(
    nativeSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"),
    "home theme must remove the four native suggestion cards without replacing their DOM",
  );
  assert(state.homeActive === true);
  assert(
    nativePrompt.classList.contains("denia-old-days-ds-native-home-prompt"),
    "home theme must retain and decorate the visible Codex native title",
  );
  assert(
    nativePrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift") === "246px",
    "the native home title must sit directly above the composer without overlapping the restored hero",
  );
  assert(
    nativePrompt.contains(inlineProjectButton) && inlineProjectButton.isConnected,
    "the visible native prompt must preserve its inline project button in the DOM",
  );
  assert(composer.classList.contains("denia-old-days-ds-composer"), "home composer may retain paint-only theme chrome");
  for (let frame = 0; frame < 60; frame += 1) harness.flushAnimationFrames();
  assert(main.scrollTop === 0, "home visual mount must keep the native home viewport at its non-scrolling origin");

  input.value = "typing must not create layout replacements";
  nativePrompt.setRect({ x: 196, y: 116, width: 1120, height: 465 });
  main.scrollHeight = 1200;
  state.refresh();
  for (let frame = 0; frame < 2; frame += 1) harness.flushAnimationFrames();
  assert(
    main.children.length === nativeChildren.length
      && nativeChildren.every((node, index) => main.children[index] === node),
    "typing-state refresh must preserve Codex native home geometry",
  );
  assert(main.scrollTop === 0, "typing must not move the home viewport away from its origin");
  assert(
    nativeTitle.getBoundingClientRect().bottom <= composerBoundary.getBoundingClientRect().top - 24,
    "typing must keep the native home title above the composer when its flex wrapper expands",
  );

  const replacementComposer = harness.document.createElement("form");
  replacementComposer.classList.add("composer-surface-chrome");
  replacementComposer.append(harness.document.createElement("textarea"));
  composer.remove();
  main.append(replacementComposer);
  main.scrollTop = 0;
  state.refresh();
  for (let frame = 0; frame < 60; frame += 1) harness.flushAnimationFrames();
  assert(
    main.scrollTop === 0,
    "a remounted home composer must remain in the non-scrolling viewport",
  );

  main.scrollTop = 0;
  for (const handler of main.listeners.get("scroll") || []) handler();
  state.refresh();
  for (let frame = 0; frame < 2; frame += 1) harness.flushAnimationFrames();
  assert(main.scrollTop === 0, "home refresh must keep the native viewport locked at the origin");
}

function assertObserverStability(payload) {
  const makeTaskHarness = () => {
    const harness = createRuntimeHarness((index) => `blob:observer-task-${index + 1}`);
    const main = harness.document.createElement("main");
    main.setAttribute("role", "main");
    const assistant = harness.document.createElement("article");
    assistant.setAttribute("data-content-search-unit-key", "task:assistant");
    const composer = harness.document.createElement("form");
    composer.classList.add("composer-surface-chrome");
    main.append(assistant, composer);
    harness.document.body.append(main);
    vm.runInContext(payload, harness.context, { timeout: 1000 });
    return {
      harness,
      main,
      composer,
      state: harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__,
    };
  };

  const fixture = makeTaskHarness();
  const { harness, main, composer, state } = fixture;
  const chrome = harness.document.getElementById("denia-old-days-ds-chrome");
  const rail = harness.document.getElementById("denia-old-days-ds-state-art");
  assert(state.observer.options.attributeOldValue === true, "the mutation observer must retain attribute old values for class-token filtering");

  harness.clearMutationRecords();
  main.classList.add("denia-old-days-ds-test-token");
  const [themeOnlyClassRecord] = harness.takeMutationRecords();
  assert(themeOnlyClassRecord?.oldValue === "", "the VM mutation harness must expose class oldValue when attributeOldValue is requested");
  assert(harness.deliverMutationRecords([themeOnlyClassRecord]) === 1, "the observer harness must allow one record to be delivered directly");
  assert(harness.flushAnimationFrames() === 0, "a class token delta containing only extension tokens must not schedule refresh");

  const svgClassTarget = {
    className: { baseVal: "denia-old-days-ds-svg-token" },
    parentElement: null,
    getAttribute: (name) => name === "class" ? "denia-old-days-ds-svg-token" : null,
  };
  assert(
    harness.deliverMutationRecords([{ type: "attributes", target: svgClassTarget, attributeName: "class", oldValue: "" }]) === 1,
    "the observer harness must deliver SVG-shaped class records",
  );
  assert(harness.flushAnimationFrames() === 0, "an SVG class delta containing only extension tokens must not schedule refresh");

  harness.clearMutationRecords();
  rail.classList.add("native-looking-owned-child-change");
  assert(harness.flushMutations() === 1, "an owned descendant class change must reach the observer callback");
  assert(harness.flushAnimationFrames() === 0, "class changes inside an owned node must not schedule refresh");

  harness.clearMutationRecords();
  rail.append(harness.document.createElement("span"));
  assert(harness.flushMutations() === 1, "an owned descendant child-list change must reach the observer callback");
  assert(harness.flushAnimationFrames() === 0, "child-list changes inside an owned node must not schedule refresh");

  const terminal = harness.document.createElement("div");
  terminal.classList.add("xterm");
  main.append(terminal);
  harness.clearMutationRecords();
  terminal.classList.add("xterm-focus");
  assert(harness.flushMutations() === 1, "terminal class churn must reach the observer callback");
  assert(harness.flushAnimationFrames() === 0, "terminal class churn must not refresh the theme");
  harness.clearMutationRecords();
  terminal.append(harness.document.createElement("span"));
  assert(harness.flushMutations() === 1, "terminal row churn must reach the observer callback");
  assert(harness.flushAnimationFrames() === 0, "terminal row churn must not refresh the theme");

  const terminalPanel = harness.document.createElement("div");
  terminalPanel.id = "terminal-panel-observer-test";
  main.append(terminalPanel);
  harness.clearMutationRecords();
  terminalPanel.style.setProperty("height", "240px");
  assert(harness.flushMutations() === 1, "terminal panel animation churn must reach the observer callback");
  assert(harness.flushAnimationFrames() === 0, "terminal panel animation churn must not refresh the theme");
  assert(harness.pendingTimerCount() === 0, "terminal panel animation churn must not leave a delayed refresh");

  const editorColorProbe = harness.document.createElement("div");
  editorColorProbe.style.setProperty("display", "none");
  editorColorProbe.style.setProperty("background-color", "var(--color-token-editor-background)");
  harness.clearMutationRecords();
  harness.document.body.append(editorColorProbe);
  editorColorProbe.remove();
  assert(harness.flushMutations() === 2, "the native editor color probe mount cycle must reach the observer callback");
  assert(harness.flushAnimationFrames() === 0, "the native editor color probe mount cycle must not refresh the theme");
  assert(harness.pendingTimerCount() === 0, "the native editor color probe must not leave a delayed refresh");

  const ordinaryHiddenNode = harness.document.createElement("div");
  ordinaryHiddenNode.style.setProperty("display", "none");
  ordinaryHiddenNode.style.setProperty("background-color", "var(--other-native-color)");
  harness.clearMutationRecords();
  harness.document.body.append(ordinaryHiddenNode);
  ordinaryHiddenNode.remove();
  assert(harness.flushMutations() === 2, "an ordinary hidden body node mount cycle must reach the observer callback");
  assert(harness.flushAnimationFrames() === 1, "the color-probe filter must not swallow ordinary hidden body nodes");

  const nestedProbeHost = harness.document.createElement("section");
  main.append(nestedProbeHost);
  const nestedProbeLookalike = harness.document.createElement("div");
  nestedProbeLookalike.style.setProperty("display", "none");
  nestedProbeLookalike.style.setProperty("background-color", "var(--color-token-editor-background)");
  harness.clearMutationRecords();
  nestedProbeHost.append(nestedProbeLookalike);
  nestedProbeLookalike.remove();
  assert(harness.flushMutations() === 2, "a nested color-probe lookalike mount cycle must reach the observer callback");
  assert(harness.flushAnimationFrames() === 1, "the color-probe filter must be limited to direct body mutations");

  harness.clearMutationRecords();
  assert(
    harness.deliverMutationRecords([{ type: "childList", target: main, addedNodes: [chrome], removedNodes: [] }]) === 1,
    "the observer harness must support explicit child-list record batches",
  );
  assert(harness.flushAnimationFrames() === 0, "a child-list record containing only owned nodes must not schedule refresh");

  const nativeRemountNode = harness.document.createElement("button");
  rail.append(nativeRemountNode);
  harness.clearMutationRecords();
  assert(
    harness.deliverMutationRecords([{
      type: "childList",
      target: main,
      addedNodes: [nativeRemountNode],
      removedNodes: [nativeRemountNode],
    }]) === 1,
    "the observer harness must deliver a native remount child-list batch",
  );
  assert(harness.flushAnimationFrames() === 1, "a native remount batch must not be swallowed merely because its nodes currently have an owned ancestor");

  harness.clearMutationRecords();
  const baseline = { ...state.metrics.domainRuns };
  const tool = harness.document.createElement("details");
  main.append(tool);
  assert(harness.flushMutations() === 1);
  assert(harness.flushAnimationFrames() === 1);
  assert(state.metrics.domainRuns.route === baseline.route + 1);
  assert(state.metrics.domainRuns.taskState === baseline.taskState + 1);
  assert(state.metrics.domainRuns.taskDecoration === baseline.taskDecoration + 1);
  assert(state.metrics.domainRuns.sidebar === baseline.sidebar);
  assert(state.metrics.domainRuns.layout === baseline.layout);
  assert(state.metrics.domainRuns.composer === baseline.composer);
  assert(state.metrics.domainRuns.home === baseline.home);

  harness.clearMutationRecords();
  const replacement = harness.document.createElement("form");
  replacement.classList.add("composer-surface-chrome");
  composer.remove();
  main.append(replacement);
  harness.flushMutations();
  harness.flushAnimationFrames();
  assert(replacement.classList.contains("denia-old-days-ds-composer"));

  harness.clearMutationRecords();
  const ordinaryBaseline = { ...state.metrics.domainRuns };
  const ordinaryContent = harness.document.createElement("section");
  const ordinaryForm = harness.document.createElement("form");
  ordinaryForm.append(harness.document.createElement("textarea"));
  const ordinaryAside = harness.document.createElement("aside");
  const ordinaryNav = harness.document.createElement("nav");
  const similarToggle = harness.document.createElement("button");
  similarToggle.setAttribute("aria-label", "切换置顶摘要");
  ordinaryContent.append(ordinaryForm, ordinaryAside, ordinaryNav, similarToggle);
  main.append(ordinaryContent);
  assert(harness.flushMutations() === 1, "one ordinary task subtree must reach the observer");
  assert(harness.flushAnimationFrames() === 1, "ordinary task content must schedule task work");
  assert(state.metrics.domainRuns.taskState === ordinaryBaseline.taskState + 1);
  assert(state.metrics.domainRuns.taskDecoration === ordinaryBaseline.taskDecoration + 1);
  assert(state.metrics.domainRuns.composer === ordinaryBaseline.composer);
  assert(state.metrics.domainRuns.sidebar === ordinaryBaseline.sidebar);
  assert(state.metrics.domainRuns.layout === ordinaryBaseline.layout);
  assert(state.metrics.domainRuns.workSurfaces === ordinaryBaseline.workSurfaces);

  harness.clearMutationRecords();
  const taskStyleBaseline = { ...state.metrics.domainRuns };
  ordinaryAside.style.setProperty("height", "48px");
  assert(harness.flushMutations() === 1, "an internal task style mutation must reach the observer");
  assert(harness.flushAnimationFrames() === 0, "an internal task style mutation must remain trailing");
  assert(harness.pendingTimerCount() === 1, "an internal task style mutation must schedule one trailing timer");
  assert(harness.flushTimers() === 1, "the internal task style timer must fire once");
  assert(harness.flushAnimationFrames() === 1, "the internal task style timer must schedule one frame");
  assert(state.metrics.domainRuns.taskState === taskStyleBaseline.taskState + 1);
  assert(state.metrics.domainRuns.art === taskStyleBaseline.art + 1);
  assert(state.metrics.domainRuns.composer === taskStyleBaseline.composer);
  assert(state.metrics.domainRuns.sidebar === taskStyleBaseline.sidebar);
  assert(state.metrics.domainRuns.layout === taskStyleBaseline.layout);
  assert(state.metrics.domainRuns.workSurfaces === taskStyleBaseline.workSurfaces);

  harness.clearMutationRecords();
  main.dataset.state = "observer-probe";
  main.dataset.state = "observer-probe";
  assert(harness.takeMutationRecords().length === 2, "the VM dataset mock must record every dataset write so idempotence checks catch redundant writes");

  harness.clearMutationRecords();
  main.classList.add("denia-old-days-ds-batch-token");
  main.classList.add("native-application-state");
  assert(harness.flushMutations() === 2, "a mixed theme and native class batch must deliver both records");
  assert(harness.flushAnimationFrames() === 1, "any native application mutation in a mixed batch must schedule exactly one refresh");

  harness.clearMutationRecords();
  main.style.setProperty("height", "100px");
  assert(harness.flushMutations() === 1, "a native style mutation must reach the observer callback");
  assert(harness.flushAnimationFrames() === 0, "a style-only mutation must not schedule a per-frame refresh");
  assert(harness.pendingTimerCount() === 1, "a style-only mutation must schedule one trailing refresh");
  assert(harness.pendingTimerDelays().join(",") === "80", "the trailing style refresh must wait 80 milliseconds");
  assert(harness.flushTimers() === 1, "the trailing style refresh timer must be flushable");
  assert(harness.flushAnimationFrames() === 1, "the trailing style timer must schedule one ordinary refresh frame");

  harness.clearMutationRecords();
  main.style.setProperty("height", "101px");
  assert(harness.flushMutations() === 1, "the first repeated style mutation must reach the observer");
  const [firstRepeatedStyleTimerId] = harness.pendingTimerIds();
  main.style.setProperty("height", "102px");
  assert(harness.flushMutations() === 1, "the second repeated style mutation must reach the observer");
  assert(harness.pendingTimerCount() === 1, "repeated style-only batches must collapse into one trailing timer");
  assert(harness.pendingTimerIds()[0] !== firstRepeatedStyleTimerId, "the latest style mutation must restart the trailing delay");
  assert(harness.flushTimers() === 1, "the collapsed style timer must fire exactly once");
  assert(harness.flushAnimationFrames() === 1, "collapsed style-only batches must produce one refresh frame");

  harness.clearMutationRecords();
  main.style.setProperty("height", "103px");
  assert(harness.flushMutations() === 1, "a pending style refresh must be observable before a semantic mutation");
  assert(harness.pendingTimerCount() === 1, "the style refresh must remain pending until semantic work arrives");
  const [styleTimerId] = harness.pendingTimerIds();
  main.classList.add("native-semantic-after-style");
  assert(harness.flushMutations() === 1, "the semantic mutation must reach the observer callback");
  assert(harness.pendingTimerCount() === 1, "a semantic mutation during style animation must remain in the trailing refresh");
  assert(harness.pendingTimerIds()[0] === styleTimerId, "a semantic mutation must not postpone the trailing refresh beyond the last style change");
  assert(harness.flushAnimationFrames() === 0, "a semantic mutation during style animation must not interrupt the animation with a refresh");
  assert(harness.flushTimers() === 1, "the combined animation refresh must fire once");
  assert(harness.flushAnimationFrames() === 1, "the combined animation refresh must produce one ordinary refresh frame");

  harness.clearMutationRecords();
  main.classList.add("native-semantic-without-animation");
  assert(harness.flushMutations() === 1, "a semantic mutation outside animation must reach the observer callback");
  assert(harness.pendingTimerCount() === 0, "a semantic mutation outside animation must not schedule a trailing timer");
  assert(harness.flushAnimationFrames() === 1, "a semantic mutation outside animation must refresh on the next frame");

  harness.clearMutationRecords();
  const interleavedBaseline = { ...state.metrics.domainRuns };
  main.classList.add("native-semantic-before-style");
  assert(harness.flushMutations() === 1, "the semantic half of an interleaved batch must reach the observer");
  harness.document.body.style.setProperty("height", "860px");
  assert(harness.flushMutations() === 1, "the style half of an interleaved batch must reach the observer");
  assert(harness.pendingTimerCount() === 1, "interleaved style work must retain one trailing timer");
  assert(harness.flushAnimationFrames() === 1, "the already-pending semantic RAF must run once");
  assert(state.metrics.domainRuns.route === interleavedBaseline.route + 1);
  assert(state.metrics.domainRuns.sidebar === interleavedBaseline.sidebar, "the semantic RAF must not consume trailing sidebar work");
  assert(state.metrics.domainRuns.layout === interleavedBaseline.layout, "the semantic RAF must not consume trailing layout work");
  const afterSemanticRefresh = state.metrics.refreshes;
  assert(harness.flushTimers() === 1, "the interleaved style timer must fire once");
  assert(harness.flushAnimationFrames() === 1, "the style timer must schedule its own non-empty frame");
  assert(state.metrics.domainRuns.sidebar === interleavedBaseline.sidebar + 1);
  assert(state.metrics.domainRuns.layout === interleavedBaseline.layout + 1);
  assert(state.metrics.refreshes === afterSemanticRefresh + 1, "the style timer must execute exactly one refresh");
  assert(harness.flushTimers() === 0, "interleaved work must not leave an empty timer");
  assert(harness.flushAnimationFrames() === 0, "interleaved work must not leave an empty RAF");

  const assertStableRefreshBudget = (stableHarness, stableState, view) => {
    stableHarness.clearMutationRecords();
    const refreshStart = stableState.metrics.refreshes;
    stableState.refresh();
    assert(stableHarness.takeMutationRecords().length === 0, `repeated ${view} refresh with unchanged state must not write observable style or class mutations`);
    for (let tick = 0; tick < 120; tick += 1) {
      stableHarness.flushMutations();
      stableHarness.flushAnimationFrames();
    }
    assert(stableState.metrics.refreshes - refreshStart <= 4, `stable ${view} must stay within four refreshes over the equivalent two-second observation window`);
  };

  assertStableRefreshBudget(harness, state, "task view");
  harness.clearMutationRecords();
  main.style.setProperty("height", "104px");
  assert(harness.flushMutations() === 1, "cleanup coverage requires one pending style refresh");
  assert(harness.pendingTimerCount() === 1, "cleanup coverage must begin with one pending style timer");
  state.cleanup();
  assert(harness.pendingTimerCount() === 0, "cleanup must cancel the pending style refresh");
  assert(harness.flushTimers() === 0, "cleanup must prevent delayed style work from running");

  const homeHarness = createRuntimeHarness((index) => `blob:observer-home-${index + 1}`);
  const homeMain = homeHarness.document.createElement("main");
  homeMain.setAttribute("role", "main");
  homeMain.classList.add("dream-skin-home");
  const nativeActions = homeHarness.document.createElement("div");
  for (const label of ["Explore code", "Build feature", "Review changes", "Fix bug"]) {
    const button = homeHarness.document.createElement("button");
    button.textContent = label;
    nativeActions.append(button);
  }
  homeMain.append(nativeActions);
  homeHarness.document.body.append(homeMain);
  vm.runInContext(payload, homeHarness.context, { timeout: 1000 });
  const homeState = homeHarness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assertStableRefreshBudget(homeHarness, homeState, "home view");
  homeState.cleanup();
}

function assertStateArtRailLifecycle(payload) {
  const appendTaskMain = (harness) => {
    const main = harness.document.createElement("main");
    main.setAttribute("role", "main");
    harness.document.body.append(main);
    return main;
  };
  const appendMarker = (harness, main, attributes) => {
    const marker = harness.document.createElement("div");
    for (const [name, value] of Object.entries(attributes)) marker.setAttribute(name, value);
    main.append(marker);
    return marker;
  };
  const activeLayer = (rail) => rail.querySelector(".denia-old-days-ds-state-art-layer.is-active");

  const animated = createRuntimeHarness((index) => `blob:state-art-${index + 1}`);
  const main = appendTaskMain(animated);
  vm.runInContext(payload, animated.context, { timeout: 1000 });
  const state = animated.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const rail = animated.document.getElementById("denia-old-days-ds-state-art");
  let active = activeLayer(rail);
  assert(rail?.getAttribute("aria-hidden") === "true", "state art rail must stay decorative for assistive technology");
  assert(active?.dataset.deniaArtFamily === "taskWarm", "staged tasks must begin on the warm artwork");
  assert(active?.style.getPropertyValue("--denia-state-art-opacity") === ".11", "staged warm artwork must use restrained opacity");
  assert(state.artGeneration === 1, "initial state artwork must create one generation");

  const working = appendMarker(animated, main, { "data-status": "running" });
  state.refresh();
  active = activeLayer(rail);
  assert(active?.dataset.deniaArtFamily === "taskWarm", "working must retain the warm artwork family");
  assert(active?.style.getPropertyValue("--denia-state-art-opacity") === ".20", "working must strengthen the warm artwork");
  assert(state.artGeneration === 1, "same-family working updates must not create another art generation");

  working.remove();
  const approval = appendMarker(animated, main, { "data-state": "approval" });
  state.refresh();
  const approvalLayer = activeLayer(rail);
  const warmLeaving = rail.querySelector('.denia-old-days-ds-state-art-layer[data-denia-art-family="taskWarm"]');
  assert(approvalLayer?.dataset.deniaArtFamily === "taskApproval", "approval must transition to its dedicated artwork");
  assert(approvalLayer?.style.getPropertyValue("--denia-state-art-opacity") === ".43", "approval must use the restrained approval opacity");
  assert(warmLeaving?.classList.contains("is-leaving"), "cross-family transitions must leave the previous layer visible for its fade");
  assert(state.artGeneration === 2, "cross-family approval must create a new art generation");

  approval.remove();
  const error = appendMarker(animated, main, { "data-state": "error" });
  state.refresh();
  const errorLayer = activeLayer(rail);
  const approvalLeaving = rail.querySelector('.denia-old-days-ds-state-art-layer[data-denia-art-family="taskApproval"]');
  assert(errorLayer?.dataset.deniaArtFamily === "taskError", "error must use separate disrupted artwork");
  assert(errorLayer?.style.getPropertyValue("--denia-state-art-opacity") === ".56", "error must use the restrained error opacity");
  assert(approvalLeaving?.classList.contains("is-leaving"), "approval must crossfade out during error");
  assert(state.artGeneration === 3, "error must create its own artwork generation");

  for (const handler of approvalLeaving.listeners.get("transitionend") || []) {
    handler.call(approvalLeaving, { currentTarget: approvalLeaving, propertyName: "opacity", target: approvalLeaving });
  }
  assert(!approvalLeaving.dataset.deniaArtFamily, "error transitionend must clear the retired approval artwork layer");
  assert(!approvalLeaving.classList.contains("is-leaving"), "error transitionend must retire the approval leaving class");

  error.remove();
  const assistant = appendMarker(animated, main, { "data-content-search-unit-key": "turn:assistant" });
  state.refresh();
  active = activeLayer(rail);
  assert(active?.dataset.deniaArtFamily === "taskComplete", "complete must transition to its direct-gaze artwork");
  assert(active?.style.getPropertyValue("--denia-state-art-opacity") === ".28", "complete artwork must remain secondary to the response");
  assert(assistant.classList.contains("denia-old-days-ds-final-card"), "complete artwork must accompany the latest assistant final card");
  assert(state.artGeneration === 4, "complete must create the fourth cross-family art generation");

  const reduced = createRuntimeHarness((index) => `blob:reduced-art-${index + 1}`);
  reduced.sandbox.matchMedia = () => ({ matches: true });
  reduced.sandbox.window.matchMedia = reduced.sandbox.matchMedia;
  const reducedMain = appendTaskMain(reduced);
  vm.runInContext(payload, reduced.context, { timeout: 1000 });
  const reducedState = reduced.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  appendMarker(reduced, reducedMain, { "data-state": "approval" });
  reducedState.refresh();
  const reducedRail = reduced.document.getElementById("denia-old-days-ds-state-art");
  const reducedApproval = activeLayer(reducedRail);
  const reducedWarm = reducedRail.querySelector('.denia-old-days-ds-state-art-layer[data-denia-art-family="taskWarm"]');
  assert(reducedApproval?.dataset.deniaArtFamily === "taskApproval", "reduced motion must still switch to the correct artwork");
  assert(!reducedWarm, "reduced motion must clear the outgoing layer immediately");
  assert(!reducedRail.querySelector(".denia-old-days-ds-state-art-layer.is-leaving"), "reduced motion must not leave a fading layer");
}

function assertIncrementalTaskDecoration(payload) {
  const harness = createRuntimeHarness((index) => `blob:incremental-decoration-${index + 1}`);
  const main = harness.document.createElement("main");
  main.setAttribute("role", "main");
  harness.document.body.append(main);
  const existing = harness.document.createElement("details");
  main.append(existing);
  vm.runInContext(payload, harness.context, { timeout: 1000 });
  const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  state.refresh();
  const existingTouches = harness.classMutationCount(existing, "denia-old-days-ds-observation");

  const added = harness.document.createElement("details");
  main.append(added);
  harness.flushMutations();
  harness.flushAnimationFrames();

  assert(added.classList.contains("denia-old-days-ds-observation"), "incremental decoration must decorate an added observation");
  assert(
    harness.classMutationCount(existing, "denia-old-days-ds-observation") === existingTouches,
    "incremental decoration must not retouch historical observations",
  );

  const removedBeforeRefresh = harness.document.createElement("details");
  main.append(removedBeforeRefresh);
  removedBeforeRefresh.remove();
  harness.flushMutations();
  harness.flushAnimationFrames();
  assert(!removedBeforeRefresh.classList.contains("denia-old-days-ds-observation"), "a root removed before its pending refresh must not receive observation decoration");

  const externalHost = harness.document.createElement("section");
  harness.document.body.append(externalHost);
  harness.clearMutationRecords();
  const movedOutsideMain = harness.document.createElement("details");
  main.append(movedOutsideMain);
  externalHost.append(movedOutsideMain);
  harness.flushMutations();
  harness.flushAnimationFrames();
  assert(
    !movedOutsideMain.classList.contains("denia-old-days-ds-observation"),
    "a pending decoration root moved outside the current task main must not be decorated",
  );

  const firstAssistant = harness.document.createElement("div");
  firstAssistant.setAttribute("data-content-search-unit-key", "turn:assistant");
  const latestAssistant = harness.document.createElement("div");
  latestAssistant.setAttribute("data-content-search-unit-key", "turn:assistant");
  main.append(firstAssistant, latestAssistant);
  harness.flushMutations();
  harness.flushAnimationFrames();
  assert(!firstAssistant.classList.contains("denia-old-days-ds-final-card"), "only the latest assistant may be the final card");
  assert(latestAssistant.classList.contains("denia-old-days-ds-final-card"), "the latest assistant must become the final card");

  latestAssistant.remove();
  harness.flushMutations();
  harness.flushAnimationFrames();
  assert(firstAssistant.classList.contains("denia-old-days-ds-final-card"), "removing the latest assistant must promote the remaining assistant");
  assert(!latestAssistant.classList.contains("denia-old-days-ds-final-card"), "a disconnected assistant must lose final-card decoration");

  firstAssistant.remove();
  harness.flushMutations();
  harness.flushAnimationFrames();
  assert(state.formState !== "complete", "removing the final assistant must leave the complete state");
  assert(!firstAssistant.classList.contains("denia-old-days-ds-final-card"), "non-complete state must remove final-card decoration");

  const oldAssistant = harness.document.createElement("div");
  oldAssistant.setAttribute("data-content-search-unit-key", "turn:assistant");
  main.append(oldAssistant);
  harness.flushMutations();
  harness.flushAnimationFrames();
  assert(oldAssistant.classList.contains("denia-old-days-ds-final-card"), "the old main must have a final card before replacement");

  const replacementMain = harness.document.createElement("main");
  replacementMain.setAttribute("role", "main");
  const replacementAssistant = harness.document.createElement("div");
  replacementAssistant.setAttribute("data-content-search-unit-key", "turn:assistant");
  const replacementObservation = harness.document.createElement("details");
  replacementMain.append(replacementAssistant, replacementObservation);
  main.remove();
  harness.document.body.append(replacementMain);
  harness.flushMutations();
  harness.flushAnimationFrames();
  assert(!oldAssistant.classList.contains("denia-old-days-ds-final-card"), "replacing the task main must clear the disconnected final card");
  assert(replacementAssistant.classList.contains("denia-old-days-ds-final-card"), "replacing the task main must decorate its latest assistant");
  assert(
    replacementObservation.classList.contains("denia-old-days-ds-observation"),
    "replacing one task main with another must schedule decoration for the new main root",
  );
  state.cleanup();
}

function assertFinalReviewRegressions(payload) {
  const appendHomePrompt = (harness, main) => {
    const text = "What should we build in denia-old-days-codex-theme?";
    const prompt = harness.document.createElement("div");
    const heading = harness.document.createElement("div");
    const title = harness.document.createElement("span");
    prompt.textContent = text;
    heading.textContent = text;
    title.textContent = text;
    title.setRect({ x: 404, y: 443, width: 392, height: 42 });
    heading.append(title);
    prompt.append(heading);
    main.append(prompt);
    return prompt;
  };
  const appendComposer = (harness, main) => {
    const boundary = harness.document.createElement("div");
    boundary.computedPosition = "relative";
    boundary.computedZIndex = "20";
    boundary.setRect({ x: 196, y: 755, width: 1120, height: 194 });
    const composer = harness.document.createElement("form");
    composer.classList.add("composer-surface-chrome");
    composer.append(harness.document.createElement("textarea"));
    boundary.append(composer);
    main.append(boundary);
    return boundary;
  };
  const appendHomeSuggestions = (harness, main) => {
    const suggestions = harness.document.createElement("div");
    for (const label of ["Explore code", "Build feature", "Review changes", "Fix bug"]) {
      const button = harness.document.createElement("button");
      button.textContent = label;
      suggestions.append(button);
    }
    main.append(suggestions);
    return suggestions;
  };
  const appendLeftNav = (harness) => {
    const nav = harness.document.createElement("nav");
    nav.setRect({ x: 0, y: 46, width: 280, height: 813 });
    harness.document.body.append(nav);
    return nav;
  };

  const homeHarness = createRuntimeHarness((index) => `blob:final-home-${index + 1}`);
  const homeMain = homeHarness.document.createElement("main");
  homeMain.setAttribute("role", "main");
  homeMain.classList.add("dream-skin-home");
  homeMain.setRect({ x: 280, y: 46, width: 1232, height: 813 });
  const initialPrompt = appendHomePrompt(homeHarness, homeMain);
  const initialSuggestions = appendHomeSuggestions(homeHarness, homeMain);
  const initialComposerBoundary = appendComposer(homeHarness, homeMain);
  homeHarness.document.body.append(homeMain);
  const initialNav = appendLeftNav(homeHarness);
  vm.runInContext(payload, homeHarness.context, { timeout: 1000 });
  const homeState = homeHarness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  homeHarness.document.getElementById("denia-old-days-ds-hero-copy")
    .setRect({ x: 196, y: 121, width: 1120, height: 455 });
  assert(initialPrompt.classList.contains("denia-old-days-ds-native-home-prompt"));
  assert(initialSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"));
  assert(initialNav.contains(homeHarness.document.getElementById("denia-old-days-ds-sidebar-brand")));

  homeHarness.clearMutationRecords();
  const replacementPrompt = appendHomePrompt(homeHarness, homeMain);
  const replacementComposerBoundary = appendComposer(homeHarness, homeMain);
  const replacementNav = appendLeftNav(homeHarness);
  initialPrompt.remove();
  initialComposerBoundary.remove();
  initialNav.remove();
  const homeBaseline = homeState.metrics.domainRuns.home;
  assert(homeHarness.flushMutations() > 0, "home structure remounts must reach the observer");
  assert(homeHarness.flushAnimationFrames() === 1, "home structure remounts must schedule one refresh frame");
  assert(homeState.homeActive === true, "home structure remounts must not require a route-state change");
  assert(homeState.metrics.domainRuns.home === homeBaseline + 1, "home structure remounts must rerun the home domain");
  assert(
    replacementPrompt.classList.contains("denia-old-days-ds-native-home-prompt")
      && replacementPrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift") === "246px",
    "home title and composer remounts must restore prompt decoration and positioning",
  );
  assert(
    replacementNav.contains(homeHarness.document.getElementById("denia-old-days-ds-sidebar-brand")),
    "home left-sidebar remounts must restore the brand",
  );

  homeHarness.clearMutationRecords();
  homeMain.classList.remove("dream-skin-home");
  const assistant = homeHarness.document.createElement("article");
  assistant.setAttribute("data-content-search-unit-key", "turn:assistant");
  homeMain.append(assistant);
  assert(homeHarness.flushMutations() > 0, "home-to-task transition mutations must reach the observer");
  assert(homeHarness.flushAnimationFrames() === 1, "home-to-task transition must schedule one refresh");
  assert(homeState.homeActive === false);
  assert(!replacementPrompt.classList.contains("denia-old-days-ds-native-home-prompt"));
  assert(!replacementPrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift"));
  assert(!initialSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"));

  homeHarness.clearMutationRecords();
  homeMain.classList.add("dream-skin-home");
  assistant.remove();
  homeHarness.flushMutations();
  homeHarness.flushAnimationFrames();
  assert(replacementPrompt.classList.contains("denia-old-days-ds-native-home-prompt"));
  assert(replacementPrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift") === "246px");
  assert(initialSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"));
  homeState.cleanup();
  assert(!replacementPrompt.classList.contains("denia-old-days-ds-native-home-prompt"));
  assert(!replacementPrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift"));
  assert(!initialSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"));
  void replacementComposerBoundary;

  const portalHarness = createRuntimeHarness((index) => `blob:final-portal-${index + 1}`);
  const portalMain = portalHarness.document.createElement("main");
  portalMain.setAttribute("role", "main");
  portalHarness.document.body.append(portalMain);
  vm.runInContext(payload, portalHarness.context, { timeout: 1000 });
  const portalState = portalHarness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const portal = portalHarness.document.createElement("section");
  portal.setAttribute("data-state", "approval");
  portalHarness.clearMutationRecords();
  const approvalBaseline = { ...portalState.metrics.domainRuns };
  portalHarness.document.body.append(portal);
  assert(portalHarness.flushMutations() === 1, "an external approval portal mount must reach the observer");
  assert(portalHarness.flushAnimationFrames() === 1, "an external approval portal mount must schedule task state");
  assert(portalState.formState === "approval");
  assert(portalState.metrics.domainRuns.taskState === approvalBaseline.taskState + 1);
  assert(portalState.metrics.domainRuns.art === approvalBaseline.art + 1);

  portalHarness.clearMutationRecords();
  const errorBaseline = { ...portalState.metrics.domainRuns };
  portal.setAttribute("data-state", "error");
  assert(portalHarness.flushMutations() === 1, "an external error portal attribute must reach the observer");
  assert(portalHarness.flushAnimationFrames() === 1, "an external error portal attribute must schedule task state");
  assert(portalState.formState === "error");
  assert(portalState.metrics.domainRuns.taskState === errorBaseline.taskState + 1);
  assert(portalState.metrics.domainRuns.art === errorBaseline.art + 1);

  portalHarness.clearMutationRecords();
  const workingBaseline = { ...portalState.metrics.domainRuns };
  portal.setAttribute("data-state", "loading");
  assert(portalHarness.flushMutations() === 1, "an external working portal attribute must reach the observer");
  assert(portalHarness.flushAnimationFrames() === 1, "an external working portal attribute must schedule task state");
  assert(portalState.formState === "working");
  assert(portalState.metrics.domainRuns.taskState === workingBaseline.taskState + 1);
  assert(portalState.metrics.domainRuns.art === workingBaseline.art + 1);

  portalState.cleanup();

  const assertExternalAttributeDowngrade = ({
    label,
    tagName = "section",
    attributeName,
    semanticValue,
    downgradeValue = null,
    textContent = "",
    initialState,
  }) => {
    const harness = createRuntimeHarness((index) => `blob:attribute-downgrade-${label}-${index + 1}`);
    const main = harness.document.createElement("main");
    main.setAttribute("role", "main");
    harness.document.body.append(main);
    const marker = harness.document.createElement(tagName);
    marker.textContent = textContent;
    marker.setAttribute(attributeName, semanticValue);
    harness.document.body.append(marker);
    vm.runInContext(payload, harness.context, { timeout: 1000 });
    const runtimeState = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
    assert(runtimeState.formState === initialState, `${label} must establish ${initialState}`);
    harness.clearMutationRecords();
    const baseline = { ...runtimeState.metrics.domainRuns };
    if (downgradeValue == null) marker.removeAttribute(attributeName);
    else marker.setAttribute(attributeName, downgradeValue);
    assert(harness.flushMutations() === 1, `${label} downgrade must produce one real attribute record`);
    assert(harness.flushAnimationFrames() === 1, `${label} downgrade must schedule one refresh`);
    assert(runtimeState.formState === "staged", `${label} downgrade must leave ${initialState}`);
    assert(
      runtimeState.metrics.domainRuns.taskState === baseline.taskState + 1,
      `${label} downgrade must schedule task state`,
    );
    assert(
      runtimeState.metrics.domainRuns.art === baseline.art + 1,
      `${label} downgrade must schedule task art`,
    );
    runtimeState.cleanup();
  };

  assertExternalAttributeDowngrade({
    label: "role-alert",
    attributeName: "role",
    semanticValue: "alert",
    downgradeValue: "status",
    textContent: "Error: failed",
    initialState: "error",
  });
  assertExternalAttributeDowngrade({
    label: "role-dialog",
    attributeName: "role",
    semanticValue: "dialog",
    textContent: "Allow this action",
    initialState: "approval",
  });
  assertExternalAttributeDowngrade({
    label: "role-progressbar",
    attributeName: "role",
    semanticValue: "progressbar",
    initialState: "working",
  });
  assertExternalAttributeDowngrade({
    label: "aria-busy",
    attributeName: "aria-busy",
    semanticValue: "true",
    downgradeValue: "false",
    initialState: "working",
  });
  assertExternalAttributeDowngrade({
    label: "approval-button-label",
    tagName: "button",
    attributeName: "aria-label",
    semanticValue: "Allow once",
    downgradeValue: "Continue",
    initialState: "approval",
  });
  assertExternalAttributeDowngrade({
    label: "working-button-label",
    tagName: "button",
    attributeName: "aria-label",
    semanticValue: "Stop",
    downgradeValue: "Done",
    initialState: "working",
  });

  const contentHarness = createRuntimeHarness((index) => `blob:portal-content-${index + 1}`);
  const contentMain = contentHarness.document.createElement("main");
  contentMain.setAttribute("role", "main");
  contentHarness.document.body.append(contentMain);
  vm.runInContext(payload, contentHarness.context, { timeout: 1000 });
  const contentState = contentHarness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const settleExternalMount = (node) => {
    contentHarness.clearMutationRecords();
    contentHarness.document.body.append(node);
    assert(contentHarness.flushMutations() === 1, "an external fixture mount must reach the observer");
    assert(contentHarness.flushAnimationFrames() === 1, "an external fixture mount must settle its structure refresh");
    contentHarness.clearMutationRecords();
  };
  const assertRealChildListRefresh = (mutate, expectedState, label) => {
    contentHarness.clearMutationRecords();
    const baseline = { ...contentState.metrics.domainRuns };
    mutate();
    assert(contentHarness.flushMutations() > 0, `${label} must produce real child-list records`);
    assert(contentHarness.flushAnimationFrames() === 1, `${label} must schedule one refresh`);
    assert(contentState.formState === expectedState, `${label} must derive ${expectedState}`);
    assert(
      contentState.metrics.domainRuns.taskState === baseline.taskState + 1,
      `${label} must schedule task state`,
    );
    assert(
      contentState.metrics.domainRuns.art === baseline.art + 1,
      `${label} must schedule task art`,
    );
    contentHarness.clearMutationRecords();
  };

  const alertPortal = contentHarness.document.createElement("section");
  alertPortal.setAttribute("role", "alert");
  settleExternalMount(alertPortal);
  const errorCopy = contentHarness.document.createElement("span");
  errorCopy.textContent = "Error: failed";
  assertRealChildListRefresh(() => {
    alertPortal.textContent = errorCopy.textContent;
    alertPortal.append(errorCopy);
  }, "error", "appending error text to an empty role alert");
  assertRealChildListRefresh(() => {
    alertPortal.textContent = "";
    errorCopy.remove();
  }, "staged", "deleting the final error text from a role alert");
  assertRealChildListRefresh(() => {
    alertPortal.textContent = errorCopy.textContent;
    alertPortal.append(errorCopy);
  }, "error", "restoring error text in a role alert");
  const ordinaryAlertCopy = contentHarness.document.createElement("span");
  ordinaryAlertCopy.textContent = "All clear";
  assertRealChildListRefresh(() => {
    alertPortal.textContent = ordinaryAlertCopy.textContent;
    errorCopy.remove();
    alertPortal.append(ordinaryAlertCopy);
  }, "staged", "replacing role alert error text with ordinary text");

  const approvalButton = contentHarness.document.createElement("button");
  const allowCopy = contentHarness.document.createElement("span");
  allowCopy.textContent = "Allow once";
  approvalButton.textContent = allowCopy.textContent;
  approvalButton.append(allowCopy);
  settleExternalMount(approvalButton);
  contentState.refresh();
  assert(contentState.formState === "approval", "an external Allow once action must establish approval");
  const continueCopy = contentHarness.document.createElement("span");
  continueCopy.textContent = "Continue";
  assertRealChildListRefresh(() => {
    approvalButton.textContent = continueCopy.textContent;
    allowCopy.remove();
    approvalButton.append(continueCopy);
  }, "staged", "replacing an approval action with ordinary button text");

  approvalButton.remove();
  contentHarness.flushMutations();
  contentHarness.flushAnimationFrames();
  contentHarness.clearMutationRecords();
  const workingButton = contentHarness.document.createElement("button");
  const stopCopy = contentHarness.document.createElement("span");
  stopCopy.textContent = "Stop";
  workingButton.textContent = stopCopy.textContent;
  workingButton.append(stopCopy);
  settleExternalMount(workingButton);
  contentState.refresh();
  assert(contentState.formState === "working", "an external Stop action must establish working");
  const doneCopy = contentHarness.document.createElement("span");
  doneCopy.textContent = "Done";
  assertRealChildListRefresh(() => {
    workingButton.textContent = doneCopy.textContent;
    stopCopy.remove();
    workingButton.append(doneCopy);
  }, "staged", "replacing a working action with ordinary button text");

  const unrelatedHost = contentHarness.document.createElement("section");
  settleExternalMount(unrelatedHost);
  contentHarness.clearMutationRecords();
  const unrelatedBaseline = { ...contentState.metrics.domainRuns };
  const unrelatedCopy = contentHarness.document.createElement("span");
  unrelatedCopy.textContent = "Ordinary external copy";
  unrelatedHost.textContent = unrelatedCopy.textContent;
  unrelatedHost.append(unrelatedCopy);
  assert(contentHarness.flushMutations() === 1, "ordinary external text insertion must produce a real child-list record");
  assert(contentHarness.flushAnimationFrames() === 1, "ordinary external text insertion may schedule structure work");
  assert(
    contentState.metrics.domainRuns.taskState === unrelatedBaseline.taskState
      && contentState.metrics.domainRuns.art === unrelatedBaseline.art,
    "ordinary external text insertion must not run task state or art",
  );
  contentHarness.clearMutationRecords();
  unrelatedHost.textContent = "";
  unrelatedCopy.remove();
  assert(contentHarness.flushMutations() === 1, "ordinary external text deletion must produce a real child-list record");
  assert(contentHarness.flushAnimationFrames() === 1, "ordinary external text deletion may schedule structure work");
  assert(
    contentState.metrics.domainRuns.taskState === unrelatedBaseline.taskState
      && contentState.metrics.domainRuns.art === unrelatedBaseline.art,
    "ordinary external text deletion must not run task state or art",
  );

  contentHarness.clearMutationRecords();
  const standaloneActionBaseline = { ...contentState.metrics.domainRuns };
  const standaloneActionCopy = contentHarness.document.createElement("span");
  standaloneActionCopy.textContent = "Stop";
  unrelatedHost.append(standaloneActionCopy);
  assert(contentHarness.flushMutations() === 1, "standalone Stop text must produce a real child-list record");
  assert(contentHarness.flushAnimationFrames() === 1, "standalone Stop text may schedule structure work");
  assert(contentState.formState === "staged", "standalone Stop text must not select working");
  assert(
    contentState.metrics.domainRuns.taskState === standaloneActionBaseline.taskState
      && contentState.metrics.domainRuns.art === standaloneActionBaseline.art,
    "standalone Stop text must not run task state or art",
  );

  const standaloneLabel = contentHarness.document.createElement("span");
  settleExternalMount(standaloneLabel);
  contentHarness.clearMutationRecords();
  const standaloneLabelBaseline = { ...contentState.metrics.domainRuns };
  standaloneLabel.setAttribute("aria-label", "Stop");
  assert(contentHarness.flushMutations() === 1, "standalone Stop aria-label must produce a real attribute record");
  assert(contentHarness.flushAnimationFrames() === 1, "standalone Stop aria-label may schedule structure work");
  assert(contentState.formState === "staged", "standalone Stop aria-label must not select working");
  assert(
    contentState.metrics.domainRuns.taskState === standaloneLabelBaseline.taskState
      && contentState.metrics.domainRuns.art === standaloneLabelBaseline.art,
    "standalone Stop aria-label must not run task state or art",
  );
  contentState.cleanup();

  const toggleHarness = createRuntimeHarness((index) => `blob:final-toggle-${index + 1}`);
  const toggleMain = toggleHarness.document.createElement("main");
  toggleMain.setAttribute("role", "main");
  const completed = toggleHarness.document.createElement("article");
  completed.setAttribute("data-content-search-unit-key", "turn:assistant");
  toggleMain.append(completed);
  toggleHarness.document.body.append(toggleMain);
  const appendToggle = (labelAttribute, label, pressed, x) => {
    const button = toggleHarness.document.createElement("button");
    button.setAttribute(labelAttribute, label);
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    button.setRect({ x, y: 8, width: 28, height: 28 });
    toggleHarness.document.body.append(button);
    return button;
  };
  const summary = appendToggle("aria-label", "切换置顶摘要", true, 1400);
  const summaryFallback = appendToggle("aria-label", "切换置顶摘要", false, 1300);
  const summaryThird = appendToggle("aria-label", "切换置顶摘要", true, 1200);
  const bottom = appendToggle("title", "Toggle bottom panel", true, 1390);
  const bottomFallback = appendToggle("title", "Toggle bottom panel", false, 1290);
  const bottomThird = appendToggle("title", "Toggle bottom panel", true, 1190);
  vm.runInContext(payload, toggleHarness.context, { timeout: 1000 });
  const toggleState = toggleHarness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(toggleHarness.root.dataset.deniaSummaryState === "open");
  assert(toggleHarness.root.dataset.deniaBottomPanelState === "open");

  toggleHarness.clearMutationRecords();
  const summaryLabelBaseline = { ...toggleState.metrics.domainRuns };
  summary.setAttribute("aria-label", "Retired summary toggle");
  assert(toggleHarness.flushMutations() === 1, "cached toggle aria-label changes must be observed");
  assert(toggleHarness.flushAnimationFrames() === 1, "cached toggle aria-label changes must schedule its domain");
  assert(toggleHarness.root.dataset.deniaSummaryState === "closed");
  assert(toggleState.metrics.domainRuns.workSurfaces === summaryLabelBaseline.workSurfaces + 1);

  toggleHarness.clearMutationRecords();
  const summaryClassBaseline = { ...toggleState.metrics.domainRuns };
  summaryFallback.computedDisplay = "none";
  summaryFallback.classList.add("native-hidden");
  assert(toggleHarness.flushMutations() === 1, "cached toggle visibility class changes must be observed");
  assert(toggleHarness.flushAnimationFrames() === 1, "cached toggle visibility class changes must schedule its domain");
  assert(toggleHarness.root.dataset.deniaSummaryState === "open");
  assert(toggleState.metrics.domainRuns.workSurfaces === summaryClassBaseline.workSurfaces + 1);
  assert(toggleState.metrics.domainRuns.route === summaryClassBaseline.route);
  assert(toggleState.metrics.domainRuns.composer === summaryClassBaseline.composer);
  assert(toggleState.metrics.domainRuns.sidebar === summaryClassBaseline.sidebar);
  assert(toggleState.metrics.domainRuns.layout === summaryClassBaseline.layout);

  toggleHarness.clearMutationRecords();
  const bottomTitleBaseline = { ...toggleState.metrics.domainRuns };
  bottom.setAttribute("title", "Retired bottom toggle");
  assert(toggleHarness.flushMutations() === 1, "cached toggle title changes must be observed");
  assert(toggleHarness.flushAnimationFrames() === 1, "cached toggle title changes must schedule its domain");
  assert(toggleHarness.root.dataset.deniaBottomPanelState === "closed");
  assert(toggleState.metrics.domainRuns.workSurfaces === bottomTitleBaseline.workSurfaces + 1);

  toggleHarness.clearMutationRecords();
  const bottomStyleBaseline = { ...toggleState.metrics.domainRuns };
  bottomFallback.computedDisplay = "none";
  bottomFallback.style.setProperty("display", "none");
  assert(toggleHarness.flushMutations() === 1, "cached toggle visibility style changes must be observed");
  assert(toggleHarness.flushAnimationFrames() === 0, "cached toggle visibility style work must remain trailing");
  assert(toggleHarness.flushTimers() === 1, "cached toggle visibility style work must use one trailing timer");
  assert(toggleHarness.flushAnimationFrames() === 1, "cached toggle visibility style work must schedule its domain");
  assert(toggleHarness.root.dataset.deniaBottomPanelState === "open");
  assert(toggleState.metrics.domainRuns.workSurfaces === bottomStyleBaseline.workSurfaces + 1);
  assert(toggleState.metrics.domainRuns.route === bottomStyleBaseline.route);
  assert(toggleState.metrics.domainRuns.composer === bottomStyleBaseline.composer);
  assert(toggleState.metrics.domainRuns.sidebar === bottomStyleBaseline.sidebar);
  assert(toggleState.metrics.domainRuns.layout === bottomStyleBaseline.layout);
  toggleState.cleanup();
  void summaryThird;
  void bottomThird;
}

function assertFormStateRecognition(payload) {
  const runCase = (build) => {
    const harness = createRuntimeHarness((index) => `blob:form-state-${index + 1}`);
    const main = harness.document.createElement("main");
    main.setAttribute("role", "main");
    harness.document.body.append(main);
    build({ ...harness, main });
    vm.runInContext(payload, harness.context, { timeout: 1000 });
    return harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.formState;
  };

  const appendMarker = ({ document, main }, attributes, text = "") => {
    const marker = document.createElement("div");
    for (const [name, value] of Object.entries(attributes)) marker.setAttribute(name, value);
    marker.textContent = text;
    main.append(marker);
    return marker;
  };

  const appendContentUnit = ({ document, main }, role, paragraphs) => {
    const unit = document.createElement("section");
    unit.setAttribute("data-content-search-unit-key", `unit:${role}`);
    for (const text of paragraphs) {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      unit.append(paragraph);
    }
    main.append(unit);
    return unit;
  };

  const appendNativeTurn = ({ document, main }, {
    status = "completed",
    error = null,
    items = [],
    paragraphs = ["任务已结束。"],
  } = {}) => {
    const turn = document.createElement("section");
    turn.setAttribute("data-turn-key", "native-turn");
    const unit = document.createElement("section");
    unit.setAttribute("data-content-search-unit-key", "native-turn:assistant");
    for (const text of paragraphs) {
      const paragraph = document.createElement("p");
      paragraph.textContent = text;
      unit.append(paragraph);
    }
    turn.append(unit);
    turn.__reactFiber$test = {
      memoizedProps: { "data-turn-key": "native-turn" },
      return: {
        memoizedProps: {
          entry: {
            isMostRecentTurn: true,
            turn: { status, error, items },
          },
        },
        return: null,
      },
    };
    main.append(turn);
    return turn;
  };

  assert(
    runCase((fixture) => appendMarker(fixture, { "data-state": "error" }, "Something needs attention")) === "error",
    "visible data-state=error must be authoritative without error wording",
  );
  assert(
    runCase((fixture) => appendMarker(fixture, { "data-status": "error" }, "Something needs attention")) === "error",
    "visible data-status=error must be authoritative without error wording",
  );
  assert(
    runCase((fixture) => appendMarker(fixture, { "data-testid": "task-error-state" }, "Something needs attention")) === "error",
    "visible error test IDs must be authoritative without error wording",
  );
  assert(
    runCase((fixture) => appendContentUnit(
      fixture,
      "assistant",
      ["测试错误已触发： command not found，退出码为 127。"],
    )) === "complete",
    "assistant failure wording alone must not select error",
  );
  assert(
    runCase(({ document }) => {
      const outsideAssistant = document.createElement("div");
      outsideAssistant.setAttribute("data-content-search-unit-key", "outside:assistant");
      document.body.append(outsideAssistant);
    }) === "staged",
    "an assistant outside the current main must not change task state",
  );
  assert(
    runCase((fixture) => appendContentUnit(
      fixture,
      "assistant",
      ["已触发测试错误：进程退出码为 1，没有修改任何文件。"],
    )) === "complete",
    "assistant nonzero-exit wording alone must not select error",
  );
  assert(
    runCase((fixture) => appendNativeTurn(fixture, {
      status: "completed",
      items: [{ executionStatus: "failed" }],
      paragraphs: ["任务已结束。"],
    })) === "complete",
    "a completed native turn must select complete even when an intermediate tool item failed",
  );
  assert(
    runCase((fixture) => appendNativeTurn(fixture, {
      status: "inProgress",
      items: [{ executionStatus: "failed" }],
    })) === "working",
    "an in-progress native turn must remain working even after an intermediate tool failure",
  );
  assert(
    runCase((fixture) => appendNativeTurn(fixture, {
      status: "interrupted",
      items: [],
    })) === "error",
    "an interrupted native turn must select error",
  );
  assert(
    runCase((fixture) => {
      appendContentUnit(fixture, "user", ["测试错误已触发： command not found，退出码为 127。"]);
      appendContentUnit(fixture, "assistant", ["命令已完成。"]);
    }) === "complete",
    "a matching user paragraph must not select error",
  );
  assert(
    runCase((fixture) => appendContentUnit(
      fixture,
      "assistant",
      ["We discussed an error, but no command was executed."],
    )) === "complete",
    "generic error discussion must not select error",
  );
  assert(
    runCase((fixture) => appendContentUnit(
      fixture,
      "assistant",
      ["命令执行失败： command not found，退出码为 0。"],
    )) === "complete",
    "an explicit command-failure paragraph with exit code zero must not select error",
  );
  assert(
    runCase(({ document, main }) => {
      const unit = appendContentUnit(
        { document, main },
        "assistant",
        ["command failed: command not found, exit code 127."],
      );
      unit.querySelector("p").append(document.createElement("code"));
    }) === "complete",
    "a paragraph containing a code descendant must not select error",
  );
  assert(
    runCase((fixture) => appendContentUnit(
      fixture,
      "assistant",
      ["command failed: command not found, exit code 127ms."],
    )) === "complete",
    "an exit status with a trailing token must not select error",
  );
  assert(
    runCase((fixture) => appendContentUnit(
      fixture,
      "assistant",
      ["命令执行失败： command not found。"],
    )) === "complete",
    "a command-failure paragraph missing its status signal must not select error",
  );
  assert(
    runCase((fixture) => {
      appendContentUnit(fixture, "assistant", ["command failed: command not found, exit code 127."]);
      appendContentUnit(fixture, "assistant", ["命令已完成。"]);
    }) === "complete",
    "an older matching assistant must not leave error sticky after a normal latest assistant",
  );
  {
    const harness = createRuntimeHarness((index) => `blob:form-state-mutation-${index + 1}`);
    const main = harness.document.createElement("main");
    main.setAttribute("role", "main");
    harness.document.body.append(main);
    vm.runInContext(payload, harness.context, { timeout: 1000 });
    const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
    harness.clearMutationRecords();
    appendNativeTurn({ ...harness, main }, {
      status: "completed",
      items: [{ status: "failed" }],
    });
    assert(harness.flushMutations() === 1, "inserting a completed native turn must produce one child-list mutation");
    assert(harness.flushAnimationFrames() === 1, "inserting a completed native turn must schedule exactly one animation-frame refresh");
    assert(state.formState === "complete", "the child-list refresh must keep completed turns complete after intermediate tool failures");
    state.cleanup();
  }

  {
    const harness = createRuntimeHarness((index) => `blob:form-state-testid-${index + 1}`);
    const main = harness.document.createElement("main");
    main.setAttribute("role", "main");
    harness.document.body.append(main);
    appendContentUnit({ ...harness, main }, "assistant", ["命令已完成。"]);
    vm.runInContext(payload, harness.context, { timeout: 1000 });
    const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
    const structured = harness.document.createElement("div");
    main.append(structured);
    harness.clearMutationRecords();
    structured.setAttribute("data-testid", "new-error-state");
    assert(state.observer.options.attributeFilter.includes("data-testid"), "the observer must watch data-testid changes");
    assert(harness.flushMutations() === 1, "a new structured data-testid marker must be observable");
    assert(harness.flushAnimationFrames() === 1, "the structured data-testid marker must schedule one refresh");
    assert(state.formState === "error", "the observed structured data-testid marker must select error");
    state.cleanup();
  }
  assert(
    runCase(({ document, main }) => {
      const button = document.createElement("button");
      button.textContent = "Review changes";
      main.append(button);
    }) === "staged",
    "an ordinary Review changes button must not imply approval",
  );
  assert(
    runCase((fixture) => appendMarker(fixture, { "data-state": "approval" })) === "approval",
    "visible stable approval state must be authoritative",
  );
  assert(
    runCase((fixture) => appendMarker(fixture, { "data-status": "permission" })) === "approval",
    "visible stable permission status must be authoritative",
  );
  assert(
    runCase((fixture) => appendMarker(fixture, { role: "dialog" }, "Review changes")) === "approval",
    "Review changes inside a visible dialog must imply approval",
  );
  assert(
    runCase((fixture) => appendMarker(fixture, { role: "alertdialog" }, "Review changes")) === "approval",
    "Review changes inside a visible alert dialog must imply approval",
  );
  assert(
    runCase((fixture) => appendMarker(fixture, { "data-status": "running" })) === "working",
    "working state recognition must remain intact",
  );
  assert(
    runCase(({ document, main }) => {
      appendMarker({ document, main }, { "data-content-search-unit-key": "unit:assistant" });
      const permissionCard = document.createElement("div");
      permissionCard.textContent = "权限";
      const allow = document.createElement("button");
      allow.textContent = "允许一次";
      permissionCard.append(allow);
      main.append(permissionCard);
    }) === "approval",
    "a visible native allow-once action must outrank an existing assistant completion marker",
  );
  assert(
    runCase((fixture) => appendMarker(fixture, { "data-content-search-unit-key": "unit:assistant" })) === "complete",
    "completed assistant state recognition must remain intact",
  );
}

function scanCssSyntax(source) {
  const characters = source.split("");
  const delimiters = [];
  const braceStack = [];
  let quote = null;
  let escaped = false;
  let inComment = false;
  let parenthesisDepth = 0;
  let bracketDepth = 0;

  for (let index = 0; index < characters.length; index += 1) {
    const character = characters[index];
    const next = characters[index + 1];
    if (inComment) {
      if (character === "*" && next === "/") {
        characters[index] = " ";
        characters[index + 1] = " ";
        index += 1;
        inComment = false;
      } else if (character !== "\n" && character !== "\r") {
        characters[index] = " ";
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && next === "*") {
      characters[index] = " ";
      characters[index + 1] = " ";
      index += 1;
      inComment = true;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "(") {
      parenthesisDepth += 1;
      continue;
    }
    if (character === ")") {
      parenthesisDepth -= 1;
      assert(parenthesisDepth >= 0, `stylesheet has an unmatched ) at index ${index}`);
      continue;
    }
    if (character === "[") {
      bracketDepth += 1;
      continue;
    }
    if (character === "]") {
      bracketDepth -= 1;
      assert(bracketDepth >= 0, `stylesheet has an unmatched ] at index ${index}`);
      continue;
    }
    if (!"{};,:".includes(character)) continue;
    if (character === "{") {
      const delimiter = {
        character,
        index,
        braceDepth: braceStack.length,
        parenthesisDepth,
        bracketDepth,
        match: -1,
      };
      delimiters.push(delimiter);
      braceStack.push(delimiter);
      continue;
    }
    if (character === "}") {
      const opening = braceStack.pop();
      assert(opening, `stylesheet has an unmatched } at index ${index}`);
      opening.match = index;
      delimiters.push({
        character,
        index,
        braceDepth: braceStack.length,
        parenthesisDepth,
        bracketDepth,
        match: opening.index,
      });
      continue;
    }
    delimiters.push({
      character,
      index,
      braceDepth: braceStack.length,
      parenthesisDepth,
      bracketDepth,
      match: -1,
    });
  }

  assert(!inComment, "stylesheet has an unclosed comment");
  assert(!quote, `stylesheet has an unclosed ${quote || "string"}`);
  assert(!escaped, "stylesheet ends with an incomplete string escape");
  assert(braceStack.length === 0, "stylesheet has an unclosed block");
  assert(parenthesisDepth === 0, "stylesheet has unbalanced parentheses");
  assert(bracketDepth === 0, "stylesheet has unbalanced brackets");
  return { source: characters.join(""), delimiters };
}

function assertCssScannerCoverage() {
  const syntax = scanCssSyntax(String.raw`
/* REMOVE-ME { ; , } */
@media (min-width: 1px) {
  .scanner-alpha[data-label='literal,;:{}/*'], .scanner-beta {
    content: "escaped quote: \" literal /* , ; { }";
    color: red;
  }
  @media (prefers-reduced-motion: reduce) {
    .scanner-gamma { content: 'escaped quote: \' literal */ , ; { }'; }
  }
}
`);
  const rules = parseCssRules(syntax);
  const combined = rules.find((rule) => rule.selectors.includes(".scanner-beta"));
  const nested = rules.find((rule) => rule.selectors.includes(".scanner-gamma"));
  assert(!syntax.source.includes("REMOVE-ME"), "CSS scanner must remove real comments");
  assert(
    combined?.selectors.length === 2
      && combined.selectors[0] === ".scanner-alpha[data-label='literal,;:{}/*']"
      && combined.declarations.get("color") === "red"
      && combined.declarations.get("content")?.includes("literal /* , ; { }")
      && combined.atRules.length === 1,
    "CSS scanner must preserve delimiters inside double/single-quoted and escaped selector or declaration strings",
  );
  assert(
    nested?.atRules.length === 2 && nested.declarations.get("content")?.includes("literal */ , ; { }"),
    "CSS scanner must preserve escaped single-quoted strings inside nested media rules",
  );
}

function parseCssRules(syntax, start = 0, end = syntax.source.length, atRules = [], braceDepth = 0, rules = []) {
  let cursor = start;
  const openings = syntax.delimiters.filter((delimiter) =>
    delimiter.character === "{"
      && delimiter.braceDepth === braceDepth
      && delimiter.index >= start
      && delimiter.index < end);
  for (const opening of openings) {
    if (opening.index < cursor) continue;
    const header = syntax.source.slice(cursor, opening.index).trim().replace(/\s+/gu, " ");
    assert(opening.match >= 0 && opening.match <= end, `stylesheet has an unclosed block after ${header}`);
    if (header.startsWith("@")) {
      parseCssRules(syntax, opening.index + 1, opening.match, [...atRules, header], braceDepth + 1, rules);
    } else if (header) {
      rules.push({
        selectors: splitCssRange(syntax, cursor, opening.index, ",", braceDepth)
          .map((selector) => selector.trim().replace(/\s+/gu, " ")),
        declarations: parseCssDeclarations(syntax, opening.index + 1, opening.match, braceDepth + 1),
        atRules,
        sourceIndex: cursor,
      });
    }
    cursor = opening.match + 1;
  }
  return rules;
}

function parseCssDeclarations(syntax, start, end, braceDepth) {
  const declarations = new Map();
  for (const declaration of splitCssRange(syntax, start, end, ";", braceDepth)) {
    const declarationStart = syntax.source.indexOf(declaration, start);
    const declarationEnd = declarationStart + declaration.length;
    const separator = syntax.delimiters.find((delimiter) =>
      delimiter.character === ":"
        && delimiter.index >= declarationStart
        && delimiter.index < declarationEnd
        && delimiter.braceDepth === braceDepth
        && delimiter.parenthesisDepth === 0
        && delimiter.bracketDepth === 0);
    if (!separator) continue;
    const property = syntax.source.slice(declarationStart, separator.index).trim().toLowerCase();
    const value = syntax.source.slice(separator.index + 1, declarationEnd).trim();
    if (property) declarations.set(property, value);
    start = declarationEnd + 1;
  }
  return declarations;
}

function splitCssRange(syntax, start, end, character, braceDepth) {
  const parts = [];
  let cursor = start;
  const separators = syntax.delimiters.filter((delimiter) =>
    delimiter.character === character
      && delimiter.index >= start
      && delimiter.index < end
      && delimiter.braceDepth === braceDepth
      && delimiter.parenthesisDepth === 0
      && delimiter.bracketDepth === 0);
  for (const separator of separators) {
    parts.push(syntax.source.slice(cursor, separator.index));
    cursor = separator.index + 1;
  }
  parts.push(syntax.source.slice(cursor, end));
  return parts;
}

function findCssRule(rules, selector, atRuleFragments = []) {
  const normalizedSelector = selector.trim().replace(/\s+/gu, " ");
  const matching = rules.filter((rule) =>
    rule.selectors.includes(normalizedSelector)
      && (atRuleFragments.length > 0
        ? atRuleFragments.every((fragment) => rule.atRules.some((atRule) => atRule.includes(fragment)))
        : rule.atRules.length === 0));
  assert(matching.length === 1, `stylesheet must contain exactly one ${normalizedSelector} rule${atRuleFragments.length ? ` under ${atRuleFragments.join(" and ")}` : " at the top level"}`);
  return matching[0];
}

function assertCssDeclarations(rules, selector, expected, atRuleFragments = []) {
  const rule = findCssRule(rules, selector, atRuleFragments);
  for (const [property, value] of Object.entries(expected)) {
    assert(
      canonicalCssValue(rule.declarations.get(property)) === canonicalCssValue(value),
      `${selector} must set ${property}: ${value}`,
    );
  }
}

function assertCssCascadeDeclarations(rules, selector, expected, atRuleFragments = []) {
  const normalizedSelector = selector.trim().replace(/\s+/gu, " ");
  const matching = rules.filter((rule) =>
    rule.selectors.includes(normalizedSelector)
      && atRuleFragments.every((fragment) => rule.atRules.some((atRule) => atRule.includes(fragment))));
  assert(matching.length > 0, `stylesheet must contain ${normalizedSelector} under ${atRuleFragments.join(" and ")}`);
  for (const [property, value] of Object.entries(expected)) {
    const declaration = matching.reduce((result, rule) => rule.declarations.get(property) ?? result, undefined);
    assert(
      canonicalCssValue(declaration) === canonicalCssValue(value),
      `${selector} cascade must resolve ${property}: ${value} under ${atRuleFragments.join(" and ")}`,
    );
  }
}

function assertArtworkVariableWhitelist(rules, whitelist) {
  for (const [variable, approved] of whitelist) {
    let occurrences = 0;
    for (const rule of rules) {
      for (const [property, value] of rule.declarations) {
        if (!value.includes(variable)) continue;
        occurrences += 1;
        const approvedMedia = approved.atRuleFragments.length === 0
          ? rule.atRules.length === 0
          : rule.atRules.length === 1
            && approved.atRuleFragments.every((fragment) => rule.atRules[0].includes(fragment));
        assert(
          property === approved.property
            && approvedMedia
            && rule.selectors.length === 1
            && rule.selectors.every((selector) => selector === approved.selector),
          `artwork variable ${variable} must stay on its approved selector, declaration, and media context`,
        );
      }
    }
    assert(occurrences === 1, `artwork variable ${variable} must occur in exactly one active declaration`);
  }
}

function canonicalCssValue(value = "") {
  return value.toLowerCase().replace(/\s+/gu, "");
}

function rgbaAlpha(value = "") {
  const matches = [...value.matchAll(/rgba?\([^)]*\)/giu)];
  const alphas = matches.map((match) => {
    const channels = match[0].slice(match[0].indexOf("(") + 1, -1).split(",");
    return Number(channels.at(-1)?.trim());
  }).filter(Number.isFinite);
  return alphas.at(-1) ?? 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
