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
assert(manifest.layoutContract === "layout-contract.json", "layout contract pointer is required");
const layoutContract = JSON.parse(await readRequired(manifest.layoutContract));
assert(layoutContract.schemaVersion === 1, "layout contract schemaVersion must be 1");
assert(layoutContract.packageId === manifest.id, "layout contract packageId must match the extension");
assert(layoutContract.packageVersion === manifest.version, "layout contract packageVersion must match the extension");
assert(layoutContract.coordinateSpace === "css-pixel", "layout contract coordinateSpace must be css-pixel");
assert(
  JSON.stringify(layoutContract.requiredTargets) === JSON.stringify([
    { id: "home-desktop", route: "/", viewport: { width: 1440, height: 900 } },
    { id: "home-narrow", route: "/", viewport: { width: 390, height: 844 } },
    { id: "task-desktop", route: "/task/current", viewport: { width: 1440, height: 900 } },
    { id: "task-narrow", route: "/task/current", viewport: { width: 390, height: 844 } },
  ]),
  "layout contract must declare the four supported verification targets",
);
assert(
  Array.isArray(layoutContract.assertions)
    && layoutContract.assertions.length >= 1
    && layoutContract.assertions.every(({ path }) => path?.startsWith("targets.*.result.")),
  "layout contract assertions must apply to every declared target result",
);
const expectedAssets = {
  runtimeWallpaper: "assets/denia-old-days-bright.webp",
  darkHomeArtwork: "assets/denia-home-dark.webp",
  rightSidebarArtwork: "assets/denia-right-sidebar.webp",
  rightSidebarWideArtwork: "assets/denia-right-sidebar-wide.webp",
  taskWarmArtwork: "assets/denia-task-warm.webp",
  taskApprovalArtwork: "assets/denia-task-approval.webp",
  taskErrorArtwork: "assets/denia-task-error.webp",
  taskCompleteArtwork: "assets/denia-task-complete.webp",
};
for (const [key, value] of Object.entries(expectedAssets)) {
  assert(manifest.assets?.[key] === value, `unexpected ${key}`);
}
assert(manifest.ui?.eyebrow === "DENIA · OLD DAYS IN COLOR", "light eyebrow must remain byte-for-byte stable");
assert(manifest.ui?.headline === "今天要把什么写进手账？", "light headline must remain byte-for-byte stable");
assert(manifest.ui?.statusText === "布景之形 · 记录中", "light status must remain byte-for-byte stable");
assert(manifest.ui?.darkEyebrow === "DENIA · OLD DAYS AFTERGLOW", "unexpected dark eyebrow");
assert(manifest.ui?.darkHeadline === "今晚，要让哪段思绪显影？", "unexpected dark headline");
assert(manifest.ui?.darkStatusText === "幻灭之形 · 观察中", "unexpected dark status");
assert(manifest.cleanup?.stateKey === "__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__", "unexpected cleanup stateKey");
assert(manifest.cleanup?.styleId === "denia-old-days-dream-skin-extension-style", "unexpected cleanup styleId");
assert(manifest.cleanup?.rootClass === "denia-old-days-ds-extension", "unexpected cleanup rootClass");
assert(Array.isArray(manifest.capabilities) && manifest.capabilities.includes("runtime.cleanup"), "runtime cleanup capability is required");
assert(manifest.capabilities.includes("runtime.multi-art-preload"), "multi-art preload capability is required");
assert(manifest.capabilities.includes("task.state-art-rail"), "state art rail capability is required");

if (canonSources) {
  const officialRows = new Map(
    canonSources.split("\n")
      .filter((line) => /^\| `art\/source\/official\/[^`]+` \|/u.test(line))
      .map((line) => [line.split("|")[1].trim().slice(1, -1), line]),
  );
  const expectedOfficialSources = {
    "art/source/official/old-days-bright-102s.jpg": [
      "d0989c926a8dcb8033c21e781fc6c99a5d6e550d3233dac2789ca688e9c7f1dd",
      "https://www.kurobbs.com/mc/post/1507356224033308672",
    ],
    "art/source/official/denia-home-dark-hjz.jpg": [
      "b4d5f5b17b83c0f855e8d09effadc01fdead43d01fb6c03b42c3f34860fe17ce",
      "https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust",
    ],
    "art/source/official/denia-garden-bubbles-warm.jpg": [
      "481bf5ff8fa4f54d5b696f6144fb3f6a7d3b2d8b580cf2a5baee39409110489b",
      "https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust",
    ],
    "art/source/official/denia-approval-dual-form.jpg": [
      "3339a65536eb6b8cff762f4ac441df6358e857c8b25f0ddaecbade8e457f84c0",
      "https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust",
    ],
    "art/source/official/denia-error-reaching.jpg": [
      "42c2a49b83de911a01627501875e6df992ac26da556c90b2c64433883eb353f4",
      "https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust",
    ],
    "art/source/official/denia-anniversary-direct-gaze.jpg": [
      "dea27e716f9561131e2b5255ea60a84de2512e8e81886073f09c64e02739fc6e",
      "https://x.com/WW_JP_Official/status/2049081192532557960",
    ],
    "art/source/official/denia-dark-form-smile-closeup.png": [
      "1dcbfa127968c2386ad77da325f850ad4985bccc95959d915652df36dcba2296",
      "https://x.com/Wuthering_Waves/status/2037002852649099578",
    ],
    "art/source/official/denia-right-sidebar-wide.jpg": [
      "d312c86f21610d7d6b50b8d8fa9b9685ef4baa11d34c0ca72fd71a712bfa42ed",
      "https://wikiwiki.jp/w-w/%E3%83%80%E3%83%BC%E3%83%8B%E3%83%A3#official_illust",
    ],
  };
  assert(
    officialRows.size === Object.keys(expectedOfficialSources).length,
    "canon/sources.md must list exactly the official files used by the renderer",
  );
  for (const [relative, [hash, url]] of Object.entries(expectedOfficialSources)) {
    const row = officialRows.get(relative) || "";
    assert(row.includes(`\`${hash}\``), `${relative} source row must include exact SHA-256 ${hash}`);
    assert(row.includes(url), `${relative} source row must include ${url}`);
  }
}

const required = [
  manifest.entrypoints.style,
  manifest.entrypoints.runtime,
  ...new Set(Object.values(manifest.assets || {})),
  "runtime/loader.mjs",
  "scripts/common.sh",
  "scripts/health.sh",
  "scripts/install.sh",
  "scripts/start.sh",
  "scripts/status.sh",
  "scripts/stop.sh",
  "scripts/uninstall.sh",
  "scripts/verify.sh",
  "tests/validate.mjs",
  "package.sh",
  manifest.layoutContract,
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
  ...["common.sh", "health.sh", "install.sh", "start.sh", "status.sh", "stop.sh", "uninstall.sh", "verify.sh"]
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
const healthScript = scripts[1];
const startScript = scripts[3];
const statusScript = scripts[4];
assert(healthScript.includes("--health"), "health script must use the current-page health mode");
assert(statusScript.includes("--health"), "status script must use the non-disruptive health mode");
assert(!statusScript.includes("--verify"), "status must not trigger the route-changing layout verifier");
assert(loader.includes('"--health"'), "loader must register the current-page health mode");
assert(loader.includes('operation === "health"'), "loader must evaluate health without layout navigation");
const launchBootstrapIndex = startScript.lastIndexOf('/bin/launchctl bootstrap "$LAUNCH_DOMAIN" "$LAUNCH_PLIST"');
const launchKickstartIndex = startScript.indexOf('/bin/launchctl kickstart -k "$LAUNCH_DOMAIN/$LAUNCH_LABEL"');
assert(
  launchBootstrapIndex >= 0 && launchKickstartIndex > launchBootstrapIndex,
  "start script must kickstart the LaunchAgent after bootstrap",
);
const packageDocumentation = `${packageReadme}\n${packageNotice}`;
assert(!/同一暗色图|approval\s*\/\s*error|approval\s+and\s+error[^.\n]*(?:same|shared)/iu.test(packageDocumentation), "README/NOTICE must not claim approval and error share one image");
for (const marker of [
  "denia-old-days@0.1.0",
  "sidecar/layout-contract.json",
  "sidecar/scripts/health.sh",
  "sidecar/scripts/verify.sh",
  "SHA256SUMS",
  "app://-/index.html",
]) {
  assert(packageNotice.includes(marker), `NOTICE must include package boundary marker: ${marker}`);
}

const runtimeTokens = [
  "__DENIA_OLD_DAYS_EXTENSION_MANIFEST_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_CSS_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_BRIGHT_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_DARK_HOME_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_RIGHT_SIDEBAR_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_RIGHT_SIDEBAR_WIDE_ART_JSON__",
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
assertHostThemeLifecycle(runtimePayload);
assertSettingsSurfaceLifecycle(runtimePayload);
assertThemeHeroCopy(runtimePayload);
assertFormStateRecognition(runtimePayload);
assertStateArtRailLifecycle(runtimePayload);
assertTaskChromeHostLifecycle(runtimePayload);
assertIncrementalTaskDecoration(runtimePayload);
assertObserverStability(runtimePayload);
assertFinalReviewRegressions(runtimePayload);

assert(loader.includes("127.0.0.1"), "loader must bind to loopback");
assert(!loader.includes("0.0.0.0"), "loader must not use a wildcard host");
assert(loader.includes("validatedDebuggerUrl"), "loader must validate each loopback page WebSocket");
assert(loader.includes("probeCodexRenderer"), "loader must verify the Codex DOM before injection");
assert(loader.includes('target.url.startsWith("app://")'), "loader must accept validated app:// renderer URL variants");
assert(!loader.includes("target.url === manifest.protocol.target"), "loader must not require one exact renderer URL");
assert(loader.includes("Target.setDiscoverTargets"), "loader must subscribe to target discovery");
assert(loader.includes("__DENIA_OLD_DAYS_EXTENSION_CSS_JSON__"), "loader must inject CSS token");
assert(loader.includes("__DENIA_OLD_DAYS_EXTENSION_MANIFEST_JSON__"), "loader must inject manifest token");
for (const token of runtimeTokens.slice(2)) assert(loader.includes(token), `loader missing ${token}`);
for (const assetKey of Object.keys(expectedAssets)) {
  assert(loader.includes(`manifest.assets.${assetKey}`), `loader must resolve ${assetKey}`);
}
assert(loader.includes("--denia-old-days-art-bright"), "live verification must read bright artwork variable");
assert(loader.includes("--denia-old-days-art-dark"), "live verification must read dark home artwork variable");
assert(
  loader.includes("--denia-old-days-art-right-sidebar"),
  "live verification must read right sidebar artwork variable",
);
assert(
  loader.includes("--denia-old-days-art-right-sidebar-wide"),
  "live verification must read wide right sidebar artwork variable",
);
assert(loader.includes("denia-old-days-ds-home-visuals"), "loader cleanup and verification must recognize the out-of-flow home visual layer");
assert(loader.includes("homeLayoutPreserved"), "live verification must enforce native home layout preservation");
assert(loader.includes("composerViewportPass"), "live verification must keep the home composer inside the viewport");
assert(!runtime.includes("ensureSidebarBrand"), "the theme must not inject a Denia brand marker into the native sidebar");
assert(!runtime.includes("removeSidebarBrand"), "the runtime must not retain obsolete sidebar brand lifecycle code");
assert(!styles.includes(".denia-old-days-ds-sidebar-brand"), "the stylesheet must not retain the removed sidebar brand");
assert(!manifest.capabilities.includes("sidebar.brand-overlay"), "the manifest must not advertise the removed sidebar brand");

for (const token of [
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
for (const name of ["bright", "dark", "task-warm", "task-approval", "task-error", "task-complete"]) {
  assert(runtime.includes(`--denia-old-days-art-${name}`), `runtime missing ${name} artwork variable`);
}
assert(runtime.includes("syncNativeTheme"), "runtime must synchronize host electron theme classes");
assert(runtime.includes("electron-dark"), "runtime must recognize electron-dark");
assert(runtime.includes("electron-light"), "runtime must recognize electron-light");
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
  "--denia-old-days-art-dark",
  "--denia-old-days-art-right-sidebar",
  "--denia-old-days-art-right-sidebar-wide",
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
const homeBackgroundPaintRootSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home:not([data-denia-theme="dark"])[data-dream-art-wide="true"]:has(main.main-surface.dream-skin-home-shell)';
const homeBackgroundBodySelector = `${homeBackgroundPaintRootSelector} body`;
const homeBackgroundMainSelector =
  `${homeBackgroundPaintRootSelector} main.main-surface.dream-skin-home-shell`;
const unscopedHomeBackgroundPaintRootSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-dream-art-wide="true"]:has(main.main-surface.dream-skin-home-shell)';
for (const selector of [
  `${unscopedHomeBackgroundPaintRootSelector} body`,
  `${unscopedHomeBackgroundPaintRootSelector} main.main-surface.dream-skin-home-shell`,
]) {
  assert(
    !stylesheetRules.some((rule) => rule.selectors.includes(selector)),
    `wide home paint must exclude the dark theme marker: ${selector}`,
  );
}

assertCssDeclarations(stylesheetRules, homeBackgroundBodySelector, {
  "background-color": "#F7EEE9 !important",
  "background-image": "none !important",
});
assertCssDeclarations(stylesheetRules, homeBackgroundMainSelector, {
  "background-color": "#F7EEE9 !important",
  "background-image": "linear-gradient(90deg, var(--ds-immersive-edge), var(--ds-immersive-mid) 64%, var(--ds-immersive-far)), var(--dream-skin-art) !important",
  "background-attachment": "scroll !important",
  "background-position": "center, var(--ds-art-position) !important",
  "background-repeat": "no-repeat !important",
  "background-size": "cover !important",
});
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
  width: "min(1160px, calc(100% - 32px))",
  margin: "clamp(16px, 3vh, 32px) auto 16px",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero h1", {
  "max-width": "6.2em",
  margin: "20px 0 14px",
  "font-size": "clamp(34px, 4vw, 54px)",
  "font-weight": "750",
  "line-height": "1.12",
  "letter-spacing": "-0.035em",
  "text-wrap": "wrap",
  "line-break": "strict",
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
const pendingHomePromptSelector =
  "html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task .denia-old-days-ds-native-home-prompt";
assertCssDeclarations(stylesheetRules, pendingHomePromptSelector, {
  visibility: "hidden",
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
  "outline",
  "outline-offset",
]);
const composerEditorFocusSelector =
  '.denia-old-days-ds-extension .denia-old-days-ds-composer :is(textarea, [contenteditable="true"]):focus-visible';
const nativeComposerEditorFocusSelector =
  '.denia-old-days-ds-extension .composer-surface-chrome :is(textarea, [contenteditable="true"]):focus-visible';
const composerShellFocusSelector =
  '.denia-old-days-ds-extension .denia-old-days-ds-composer:has(:is(textarea, [contenteditable="true"]):focus-visible)';
const lightWorkspaceComposerSelector =
  'html:root.codex-dream-skin.denia-old-days-ds-extension[data-denia-theme="light"][data-denia-sidebar-layout="workspace"] .composer-surface-chrome.denia-old-days-ds-composer';
const darkWorkspaceComposerSelector =
  'html:root.codex-dream-skin.denia-old-days-ds-extension[data-denia-theme="dark"][data-denia-sidebar-layout="workspace"] .composer-surface-chrome.denia-old-days-ds-composer';
const darkComposerShellFocusSelector =
  '.denia-old-days-ds-extension[data-denia-theme="dark"] .denia-old-days-ds-composer:has(:is(textarea, [contenteditable="true"]):focus-visible)';
assertCssDeclarations(stylesheetRules, composerEditorFocusSelector, {
  outline: "none !important",
  "outline-offset": "0 !important",
});
assertCssDeclarations(stylesheetRules, nativeComposerEditorFocusSelector, {
  outline: "none !important",
  "outline-offset": "0 !important",
});
assertCssDeclarations(stylesheetRules, composerShellFocusSelector, {
  "box-shadow": "inset 0 0 0 2px rgba(111, 184, 231, .86), 0 16px 40px rgba(38, 53, 72, .14) !important",
});
assertCssDeclarations(stylesheetRules, lightWorkspaceComposerSelector, {
  "border-color": "rgba(111, 184, 231, .72) !important",
  background: "rgba(249, 255, 255, .95) !important",
});
assertCssDeclarations(stylesheetRules, darkWorkspaceComposerSelector, {
  "border-color": "rgba(141, 197, 234, .72) !important",
  background: "rgba(18, 20, 47, .94) !important",
});
assertCssDeclarations(stylesheetRules, darkComposerShellFocusSelector, {
  "box-shadow": "inset 0 0 0 2px rgba(141, 197, 234, .9), 0 18px 44px rgba(8, 10, 32, .36) !important",
});
const darkComposerPlaceholderSelector =
  '.denia-old-days-ds-extension[data-denia-theme="dark"] .denia-old-days-ds-composer textarea::placeholder';
const darkNativeComposerEditorSelector =
  '.denia-old-days-ds-extension[data-denia-theme="dark"] .composer-surface-chrome :is(textarea, [contenteditable="true"])';
const darkHomeComposerSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-denia-theme="dark"] .denia-old-days-ds-composer';
const darkTaskComposerSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]:has(main.main-surface:not(.dream-skin-home-shell)) .denia-old-days-ds-composer';
const darkNativeComposerSelector =
  'html:root.codex-dream-skin.denia-old-days-ds-extension[data-denia-theme="dark"][data-dream-shell="dark"][data-dream-art-wide="true"] .composer-surface-chrome';
for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) => selector.includes(".denia-old-days-ds-composer"))) continue;
  assert(
    rule.selectors.every((selector) =>
      !selector.includes("::") || selector === darkComposerPlaceholderSelector),
    "composer skin must not replace Codex native pseudo-elements",
  );
  for (const property of rule.declarations.keys()) {
    assert(
      composerPaintProperties.has(property),
      `composer skin must be paint-only and cannot set ${property}`,
    );
  }
}
assertCssDeclarations(stylesheetRules, darkComposerPlaceholderSelector, {
  color: "var(--denia-dark-text-muted) !important",
  opacity: "1",
});
assertCssDeclarations(stylesheetRules, darkNativeComposerEditorSelector, {
  color: "var(--denia-dark-text) !important",
  "background-color": "transparent !important",
});
assert(
  !stylesheetRules.some((rule) =>
    rule.selectors.includes('.denia-old-days-ds-extension[data-denia-theme="dark"] textarea::placeholder')),
  "dark placeholder paint must stay scoped to the composer",
);
for (const selector of [darkHomeComposerSelector, darkTaskComposerSelector, darkNativeComposerSelector]) {
  assertCssDeclarations(stylesheetRules, selector, {
    color: "var(--denia-dark-text) !important",
    "border-color": "rgba(141, 197, 234, .66) !important",
    background: "rgba(26, 28, 58, .96) !important",
  });
  assertCssDeclarations(stylesheetRules, selector, {
    background: "var(--denia-dark-surface) !important",
    "backdrop-filter": "none",
  }, ["prefers-reduced-transparency: reduce"]);
}
const darkComposerMutedControlSelector =
  '.denia-old-days-ds-extension[data-denia-theme="dark"] .denia-old-days-ds-composer :is(button, [role="button"]).text-token-text-tertiary';
assertCssDeclarations(stylesheetRules, darkComposerMutedControlSelector, {
  color: "var(--denia-dark-text-muted) !important",
});
assertArtworkVariableWhitelist(stylesheetRules, new Map([
  ["--denia-old-days-art-bright", {
    selector: ".denia-old-days-ds-photo-front",
    property: "background",
    atRuleFragments: [],
  }],
  ["--denia-old-days-art-dark", {
    selector: 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-denia-theme="dark"] main.main-surface.dream-skin-home-shell',
    property: "background-image",
    atRuleFragments: [],
  }],
  ["--denia-old-days-art-right-sidebar", {
    selector: ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art",
    property: "--denia-sidebar-portrait-image",
    atRuleFragments: [],
  }],
  ["--denia-old-days-art-right-sidebar-wide", {
    selector: ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art",
    property: "--denia-sidebar-wide-image",
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
const deepHomeSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-home[data-denia-theme="dark"]';
const deepHomeTransitionMainSelector = `${deepHomeSelector} main.main-surface`;
const deepHomeMainSelector = `${deepHomeSelector} main.main-surface.dream-skin-home-shell`;
const deepHomePromptCopySelector =
  `${deepHomeSelector} .denia-old-days-ds-native-home-prompt :is([class*="heading"], h1, h2, h3, p)`;
assertCssDeclarations(stylesheetRules, deepHomePromptCopySelector, {
  color: "var(--denia-dark-text) !important",
});
const deepHomeUtilitySelector = `${deepHomeSelector} .dream-skin-home-utility`;
const deepHomeUtilityButtonSelector =
  `${deepHomeUtilitySelector} :is(button, [role="button"])`;
const deepHomeUtilityNeutralTextSelector =
  `${deepHomeUtilitySelector} :is(.text-token-foreground, .text-token-text-primary, .text-token-text-tertiary, .text-token-muted-foreground)`;
const deepHomeUtilityActiveButtonSelector =
  `${deepHomeUtilitySelector} :is(button, [role="button"]):is(:hover, :focus-visible, [aria-expanded="true"], [data-state="open"])`;
assertCssDeclarations(stylesheetRules, deepHomeUtilitySelector, {
  color: "var(--denia-dark-text-muted) !important",
  background: "rgba(26, 28, 58, .98) !important",
  "border-color": "var(--denia-dark-divider) !important",
});
assertCssDeclarations(stylesheetRules, deepHomeUtilityButtonSelector, {
  color: "var(--denia-dark-text-muted) !important",
  "background-color": "transparent !important",
  "border-color": "transparent !important",
});
assertCssDeclarations(stylesheetRules, deepHomeUtilityNeutralTextSelector, {
  color: "inherit !important",
});
assertCssDeclarations(stylesheetRules, deepHomeUtilityActiveButtonSelector, {
  color: "var(--denia-dark-focus) !important",
  "background-color": "rgba(141, 197, 234, .12) !important",
});
const deepHomeUtilityPaintProperties = new Set([
  "background",
  "background-color",
  "border-color",
  "box-shadow",
  "color",
]);
for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) => selector.includes(".dream-skin-home-utility"))) continue;
  assert(
    rule.selectors.every((selector) => selector.includes(deepHomeSelector)),
    "home utility paint must stay scoped to the deep-home dark selector",
  );
  for (const property of rule.declarations.keys()) {
    assert(
      deepHomeUtilityPaintProperties.has(property),
      `deep-home utility paint must not change native layout property ${property}`,
    );
  }
}
const deepHomeLayoutProperties = /^(?:width|height|min-width|min-height|max-width|max-height|margin(?:-.+)?|padding(?:-.+)?|position|inset|top|right|bottom|left|display|grid(?:-.+)?|flex(?:-.+)?|transform|translate|overflow(?:-.+)?)$/u;
const deepHomeNativeLayoutTargets = /(?:\bmain\b|denia-old-days-ds-composer|denia-old-days-ds-native-home-prompt|denia-old-days-ds-native-(?:left|right)-sidebar|denia-old-days-ds-native-sidebar-(?:group|row))/u;
const deepHomeDecorationSelectors = new Set([
  `${deepHomeSelector} .denia-old-days-ds-photo`,
  `${deepHomeSelector} .denia-old-days-ds-memory-bubbles`,
]);
const deepHomeHeroLayoutSelector = /\.denia-old-days-ds-hero(?:\b|[-\s.:#[])/u;
for (const rule of stylesheetRules) {
  const scopedSelectors = rule.selectors.filter((selector) => selector.includes(deepHomeSelector));
  if (!scopedSelectors.length) continue;
  for (const property of rule.declarations.keys()) {
    if (!deepHomeLayoutProperties.test(property)) continue;
    for (const selector of scopedSelectors) {
      const allowedDecoration = property === "display"
        && rule.declarations.get(property) === "none !important"
        && deepHomeDecorationSelectors.has(selector);
      const allowedHeroAnchor = deepHomeHeroLayoutSelector.test(selector) && !deepHomeNativeLayoutTargets.test(selector);
      assert(
        allowedDecoration || allowedHeroAnchor,
        `deep home must not alter native layout property ${property} on ${selector}`,
      );
    }
  }
}
assertCssDeclarations(stylesheetRules, deepHomeTransitionMainSelector, {
  "background-color": "var(--denia-dark-canvas) !important",
  "background-image": "none !important",
});
const deepHomeMainRule = stylesheetRules.find((rule) => rule.selectors.includes(deepHomeMainSelector));
assert(
  deepHomeMainRule?.declarations.get("background-image")?.includes("var(--denia-old-days-art-dark)")
    && deepHomeMainRule.declarations.get("background-repeat") === "no-repeat !important"
    && deepHomeMainRule.declarations.get("background-size") === "cover !important",
  "deep home main surface must paint the approved dark artwork once at cover size",
);
assertCssDeclarations(stylesheetRules, `${deepHomeSelector} .denia-old-days-ds-hero`, {
  background: "transparent !important",
});
for (const selector of deepHomeDecorationSelectors) {
  assertCssDeclarations(stylesheetRules, selector, { display: "none !important" });
}
assert(
  stylesheetRules.some((rule) => rule.atRules.some((atRule) => atRule.includes("prefers-reduced-transparency: reduce"))
    && rule.selectors.includes(deepHomeMainSelector)
    && rule.declarations.get("background-image") === "none !important"
    && rule.declarations.get("background-color") === "#12142F !important"),
  "deep home reduced-transparency fallback must use a solid dark canvas",
);
for (const forbidden of ["canvas", "WebGL", "PointerEvent", "dragstart", "fetch(", "new MutationObserver"]) {
  const count = runtime.split(forbidden).length - 1;
  if (forbidden === "new MutationObserver") assert(count === 1, "theme sync must reuse the one existing observer");
  else assert(count === 0, `deep home must not add ${forbidden}`);
}
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
  "border-inline-start": "1px solid rgba(var(--denia-task-rail-indigo-rgb), .14)",
  background: "rgba(var(--denia-task-rail-surface-rgb), .3)",
  "mask-image": "linear-gradient(90deg, transparent 0, #000 42px)",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-chrome", {
  "z-index": "-1",
});
const taskChromeCascadeSelector =
  "html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task main.main-surface:not(.dream-skin-home-shell) > .denia-old-days-ds-chrome";
assertCssDeclarations(stylesheetRules, taskChromeCascadeSelector, {
  position: "fixed",
  inset: "0",
  "z-index": "-1",
});
assert(!activeStyles.includes(".denia-old-days-ds-task .denia-old-days-ds-chrome::after"), "retired pseudo-element task rail must be removed");
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-state-art-layer", {
  position: "absolute",
  inset: "0",
  "background-image": "var(--denia-state-art-image)",
  "background-position": "center",
  "background-size": "cover",
  "background-repeat": "no-repeat",
  opacity: "0",
  filter: "saturate(.92) contrast(.98)",
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
assertCssDeclarations(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="working"] .denia-old-days-ds-state-art-layer[data-denia-art-family="taskWarm"].is-active',
  {
    filter: "saturate(1) contrast(1.1)",
    transform: "translateX(-3px) scale(1.015)",
  },
);
for (const token of [
  'staged: Object.freeze({ family: "taskWarm", opacity: ".11" })',
  'working: Object.freeze({ family: "taskWarm", opacity: ".20" })',
  'approval: Object.freeze({ family: "taskApproval", opacity: ".43" })',
  'error: Object.freeze({ family: "taskError", opacity: ".56" })',
  'complete: Object.freeze({ family: "taskComplete", opacity: ".28" })',
]) {
  assert(runtime.includes(token), `state artwork contract changed: ${token}`);
}

const tintBackgrounds = new Map([
  [
    ".denia-old-days-ds-state-art-tint",
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .96) 0, rgba(var(--denia-task-rail-mid-rgb), .26) 26%, transparent 58%), linear-gradient(180deg, rgba(var(--denia-task-rail-indigo-rgb), .12), rgba(var(--denia-task-rail-rose-rgb), .08))",
  ],
  [
    '.denia-old-days-ds-extension[data-denia-form-state="staged"] .denia-old-days-ds-state-art-tint',
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .98) 0, rgba(var(--denia-task-rail-mid-rgb), .34) 30%, transparent 62%), linear-gradient(180deg, rgba(var(--denia-task-rail-rose-rgb), .12), rgba(var(--denia-task-rail-indigo-rgb), .1))",
  ],
  [
    '.denia-old-days-ds-extension[data-denia-form-state="working"] .denia-old-days-ds-state-art-tint',
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .96) 0, rgba(var(--denia-task-rail-mid-rgb), .28) 30%, transparent 64%), linear-gradient(180deg, rgba(var(--denia-task-rail-indigo-rgb), .16), rgba(var(--denia-task-rail-rose-rgb), .08))",
  ],
  [
    '.denia-old-days-ds-extension[data-denia-form-state="approval"] .denia-old-days-ds-state-art-tint',
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .96) 0, rgba(var(--denia-task-rail-deep-rgb), .28) 35%, rgba(var(--denia-task-rail-deep-rgb), .08) 72%), linear-gradient(180deg, rgba(var(--denia-task-rail-plum-rgb), .16), rgba(var(--denia-task-rail-deep-rgb), .22))",
  ],
  [
    '.denia-old-days-ds-extension[data-denia-form-state="error"] .denia-old-days-ds-state-art-tint',
    "linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .95) 0, rgba(var(--denia-task-rail-deep-rgb), .34) 34%, rgba(var(--denia-task-rail-deep-rgb), .14) 74%), linear-gradient(180deg, rgba(228, 90, 168, .18), rgba(var(--denia-task-rail-deep-rgb), .28))",
  ],
  [
    '.denia-old-days-ds-extension[data-denia-form-state="complete"] .denia-old-days-ds-state-art-tint',
    "radial-gradient(circle at 92% 92%, rgba(var(--denia-task-background-rgb), .3), transparent 32%), linear-gradient(90deg, rgba(var(--denia-task-background-rgb), .97) 0, rgba(var(--denia-task-rail-mid-rgb), .26) 30%, transparent 62%), linear-gradient(180deg, rgba(var(--denia-task-rail-rose-rgb), .14), rgba(var(--denia-task-rail-indigo-rgb), .08))",
  ],
]);
for (const [selector, background] of tintBackgrounds) {
  assertCssDeclarations(stylesheetRules, selector, { background });
}
for (const selector of ['.denia-old-days-ds-task [role="main"]', ".denia-old-days-ds-task main"]) {
  const rule = stylesheetRules.find((candidate) => candidate.selectors.includes(selector));
  assert(!rule?.declarations.has("z-index"), `task main must not create a theme stacking context: ${selector}`);
}
const taskBackgroundRootSelector = ".denia-old-days-ds-extension";
const taskBackgroundPaintRootSelector =
  "html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task:has(main.main-surface:not(.dream-skin-home-shell))";
const taskBackgroundBodySelector =
  `${taskBackgroundPaintRootSelector} body`;
const taskBackgroundMainSelector =
  `${taskBackgroundPaintRootSelector} main.main-surface:not(.dream-skin-home-shell)`;
const taskBackgroundBeforeSelector =
  "html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task body::before";
const taskBackgroundLightSelector =
  "html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task";
const taskBackgroundDarkSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]';
const taskBackgroundNarrowMedia = ["max-width: 919px"];

assertCssDeclarations(stylesheetRules, taskBackgroundRootSelector, {
  "--denia-task-background-color-light": "#F2EFF4",
  "--denia-task-background-color-dark": "#12142F",
});
assertCssDeclarations(stylesheetRules, taskBackgroundLightSelector, {
  "--denia-task-background-color": "var(--denia-task-background-color-light)",
  "--denia-task-background-image": "var(--denia-task-background-image-light)",
});
assertCssDeclarations(stylesheetRules, taskBackgroundDarkSelector, {
  "--denia-task-background-color": "var(--denia-task-background-color-dark)",
  "--denia-task-background-image": "var(--denia-task-background-image-dark)",
});
const taskBackgroundRootRule = findCssRule(stylesheetRules, taskBackgroundRootSelector);
const taskBackgroundFullImages = [
  taskBackgroundRootRule.declarations.get("--denia-task-background-image-light"),
  taskBackgroundRootRule.declarations.get("--denia-task-background-image-dark"),
];
for (const [label, value] of [
  ["light", taskBackgroundFullImages[0]],
  ["dark", taskBackgroundFullImages[1]],
]) {
  const horizontalAnchors = [...value.matchAll(/\bat\s+(\d+)%\s+\d+%/gu)]
    .map((match) => Number(match[1]));
  assert(horizontalAnchors.length >= 4, `${label} task background must expose its radial anchors`);
  assert(
    horizontalAnchors.every((anchor) => anchor <= 66),
    `${label} task background anchors must stay left of the character rail`,
  );
}
for (const requiredAnchor of ["at 62% 10%", "at 14% 90%", "at 64% 80%", "at 12% 12%"]) {
  assert(
    taskBackgroundFullImages.every((value) => value.includes(requiredAnchor)),
    `both task backgrounds must include content-column anchor ${requiredAnchor}`,
  );
}
assertCssDeclarations(stylesheetRules, taskBackgroundBodySelector, {
  "background-color": "var(--denia-task-background-color) !important",
  "background-image": "none !important",
});
assertCssDeclarations(stylesheetRules, taskBackgroundMainSelector, {
  "background-color": "var(--denia-task-background-color) !important",
  "background-image": "var(--denia-task-background-image) !important",
  "background-attachment": "scroll !important",
  "background-position": "center !important",
  "background-repeat": "no-repeat !important",
  "background-size": "cover !important",
});
assertCssDeclarations(stylesheetRules, taskBackgroundBeforeSelector, {
  background: "none",
});
assertCssDeclarations(stylesheetRules, taskBackgroundLightSelector, {
  "--denia-task-background-image": "var(--denia-task-background-image-light-compact)",
}, taskBackgroundNarrowMedia);
assertCssDeclarations(stylesheetRules, taskBackgroundDarkSelector, {
  "--denia-task-background-image": "var(--denia-task-background-image-dark-compact)",
}, taskBackgroundNarrowMedia);
for (const selector of [taskBackgroundBodySelector, taskBackgroundMainSelector]) {
  assertCssDeclarations(stylesheetRules, selector, {
    "background-color": "var(--denia-task-background-color) !important",
    "background-image": "none !important",
  }, ["prefers-reduced-transparency: reduce"]);
}

for (const rule of stylesheetRules) {
  if (![...rule.declarations.keys()].some((name) => name.startsWith("--denia-task-background"))) continue;
  if (rule.selectors.includes(taskBackgroundRootSelector)) continue;
  assert(
    rule.selectors.every((selector) => selector.includes(".denia-old-days-ds-task")),
    "task background activation must stay scoped to task routes",
  );
}

const taskBackgroundValues = stylesheetRules
  .flatMap((rule) => [...rule.declarations.entries()])
  .filter(([name]) => name.startsWith("--denia-task-background"))
  .map(([, value]) => value)
  .join(" ");
for (const requiredColor of [
  "#F2EFF4",
  "205, 158, 182",
  "83, 83, 139",
  "121, 126, 173",
  "96, 77, 112",
  "#12142F",
  "30, 35, 90",
  "48, 53, 111",
  "87, 95, 154",
  "118, 79, 126",
  "161, 107, 145",
  "190, 144, 172",
]) {
  assert(
    taskBackgroundValues.includes(requiredColor),
    `task background must retain the Denia palette color ${requiredColor}`,
  );
}
for (const forbidden of ["url(", "repeating-", "filter(", "animation"]) {
  assert(!taskBackgroundValues.includes(forbidden), `task background must not use ${forbidden}`);
}
const sidebarPaintProperties = new Set([
  "background",
  "background-color",
  "background-image",
  "background-position",
  "background-repeat",
  "background-size",
  "border-color",
  "border-radius",
  "box-shadow",
  "color",
  "outline-color",
  "isolation",
  "position",
  "transition",
  "transition-duration",
]);
const darkSidebarRoot =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-theme="dark"]';
const darkSettingsRoot =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-settings[data-denia-theme="dark"]';
const darkSettingsBodySelector = `${darkSettingsRoot} body`;
const darkSettingsShellSelector =
  `${darkSettingsRoot} .denia-old-days-ds-settings-shell`;
const darkSettingsNavSelector =
  `${darkSettingsRoot} .denia-old-days-ds-settings-shell > nav.denia-old-days-ds-native-left-sidebar`;
const darkSettingsControlSelector =
  `${darkSettingsRoot} :is(button.text-token-button-tertiary-foreground, select, [role="combobox"])`;
const darkLeftSidebarInteractiveSelector =
  `${darkSidebarRoot} .denia-old-days-ds-native-left-sidebar :is(a, button, [role="button"], [data-app-action-sidebar-project-row], [data-app-action-sidebar-thread-row])`;
const darkLeftSidebarActiveSelector =
  `${darkSidebarRoot} .denia-old-days-ds-native-left-sidebar :is([data-app-action-sidebar-thread-active="true"], [aria-current="page"])`;
const darkRightSidebarInteractiveSelector =
  `${darkSidebarRoot} .denia-old-days-ds-native-right-sidebar :is(a, button, [role="button"])`;
const darkSidebarNeutralTextTarget =
  ':is(.text-token-foreground, .text-token-description-foreground, .text-token-text-tertiary, .text-token-muted-foreground, [class*="text-[var(--vscode-foreground)]"])';
const darkLeftSidebarNeutralTextSelector =
  `${darkSidebarRoot} .denia-old-days-ds-native-left-sidebar ${darkSidebarNeutralTextTarget}`;
const darkRightSidebarNeutralTextSelector =
  `${darkSidebarRoot} .denia-old-days-ds-native-right-sidebar ${darkSidebarNeutralTextTarget}`;
const darkRightSidebarRowNeutralTextSelector =
  `${darkSidebarRoot} :is(.denia-old-days-ds-native-sidebar-group, .denia-old-days-ds-native-sidebar-row) ${darkSidebarNeutralTextTarget}`;
const darkRightSidebarTokenTextSelector =
  `${darkSidebarRoot} .denia-old-days-ds-native-right-sidebar :is(.text-token-text-primary, .text-token-text-secondary)`;
const rightSidebarNativeSurfaceSelector =
  ".denia-old-days-ds-extension .denia-old-days-ds-native-right-sidebar .bg-token-main-surface-primary";
assertCssDeclarations(stylesheetRules, darkSettingsBodySelector, {
  color: "var(--denia-dark-text-body) !important",
  "background-color": "var(--denia-dark-canvas) !important",
  "background-image": "none !important",
});
assertCssDeclarations(stylesheetRules, darkSettingsShellSelector, {
  color: "var(--denia-dark-text-body) !important",
  background: "var(--denia-dark-surface) !important",
  "border-color": "transparent !important",
  "box-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkSettingsNavSelector, {
  background: "transparent !important",
  "border-color": "transparent !important",
  "box-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkSettingsControlSelector, {
  color: "var(--denia-dark-text-body) !important",
});
assertCssDeclarations(stylesheetRules, rightSidebarNativeSurfaceSelector, {
  "background-color": "transparent !important",
});
assertCssDeclarations(stylesheetRules, darkLeftSidebarInteractiveSelector, {
  color: "var(--denia-dark-text-muted) !important",
});
for (const selector of [
  darkLeftSidebarNeutralTextSelector,
  darkRightSidebarNeutralTextSelector,
  darkRightSidebarRowNeutralTextSelector,
  darkRightSidebarTokenTextSelector,
]) {
  assertCssDeclarations(stylesheetRules, selector, { color: "inherit !important" });
}
assertCssDeclarations(stylesheetRules, darkLeftSidebarActiveSelector, {
  color: "var(--denia-dark-text) !important",
});
assertCssDeclarations(stylesheetRules, darkRightSidebarInteractiveSelector, {
  color: "var(--denia-dark-text-muted) !important",
});
for (const rule of stylesheetRules) {
  if (!rule.declarations.has("color")) continue;
  for (const selector of rule.selectors) {
    if (!/denia-old-days-ds-native-(?:left|right)-sidebar|denia-old-days-ds-native-sidebar-(?:group|row)/u.test(selector)) continue;
    assert(
      !/(?:^|[\s>+~])\*$/u.test(selector),
      `sidebar text paint must not use a blanket descendant wildcard: ${selector}`,
    );
    assert(
      !/(?:svg|error|approval|success|badge|git-decoration)/iu.test(selector),
      `sidebar neutral text paint must not target semantic icons or badges: ${selector}`,
    );
  }
}
const nativeSidebarClasses = [
  ".denia-old-days-ds-native-left-sidebar",
  ".denia-old-days-ds-native-right-sidebar",
  ".denia-old-days-ds-native-sidebar-group",
  ".denia-old-days-ds-native-sidebar-row",
];
const forbiddenRightSidebarArtworkProperties = [
  "--denia-old-days-art-bright",
  "--denia-old-days-art-dark",
  "--denia-old-days-art-task-warm",
  "--denia-old-days-art-task-approval",
  "--denia-old-days-art-task-error",
  "--denia-old-days-art-task-complete",
];
for (const rule of stylesheetRules) {
  const selectors = rule.selectors.filter((selector) =>
    nativeSidebarClasses.some((className) => selector.includes(className)));
  if (!selectors.length) continue;
  for (const property of rule.declarations.keys()) {
    assert(sidebarPaintProperties.has(property), `native sidebar selector must stay paint-only: ${property}`);
  }
  for (const [property, value] of rule.declarations) {
    if (!value.includes("--denia-old-days-art-")) continue;
    for (const forbidden of forbiddenRightSidebarArtworkProperties) {
      assert(!value.includes(forbidden), `native right sidebar must not use ${forbidden}`);
    }
  }
}
const lightRightSidebarRule = findCssRule(
  stylesheetRules,
  ".denia-old-days-ds-extension .denia-old-days-ds-native-right-sidebar",
);
const darkRightSidebarRule = findCssRule(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-theme="dark"] .denia-old-days-ds-native-right-sidebar',
);
for (const rule of [lightRightSidebarRule, darkRightSidebarRule]) {
  assert(
    canonicalCssValue(rule.declarations.get("background-image")) === "none",
    "responsive sidebar artwork must live in the owned visual surface",
  );
  assert(
    canonicalCssValue(rule.declarations.get("position")) === "relative",
    "the native sidebar must anchor its out-of-flow visual surface",
  );
  assert(
    canonicalCssValue(rule.declarations.get("isolation")) === "isolate",
    "the native sidebar must contain the negative visual layer",
  );
}
for (const forbiddenSelector of [
  '.denia-old-days-ds-extension:not([data-denia-sidebar-state="closed"]) .denia-old-days-ds-state-art',
  '.denia-old-days-ds-extension[data-denia-work-surface-state="open"] .denia-old-days-ds-state-art',
]) {
  const rule = stylesheetRules.find((candidate) => candidate.selectors.includes(forbiddenSelector));
  assert(
    !rule?.declarations.has("opacity") && !rule?.declarations.has("visibility"),
    `panel state must not hide the persistent task artwork: ${forbiddenSelector}`,
  );
}
const nativeSidebarPanelSelector = ".denia-old-days-ds-extension .denia-old-days-ds-native-right-sidebar";
const nativeSidebarGroupSelector = ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-group";
const nativeSidebarRowSelector = ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-row";
const darkNativeSidebarGroupSelector = '.denia-old-days-ds-extension[data-denia-theme="dark"] .denia-old-days-ds-native-sidebar-group';
const nativeLeftSidebarHostSelector = "html.codex-dream-skin.denia-old-days-ds-extension[data-denia-form-state][data-denia-sidebar-state][data-denia-sidebar-confidence] aside.app-shell-left-panel.denia-old-days-ds-native-left-sidebar";
const nativeSidebarPanelRule = findCssRule(stylesheetRules, nativeSidebarPanelSelector);
const nativeSidebarGroupRule = findCssRule(stylesheetRules, nativeSidebarGroupSelector);
const nativeSidebarRowRule = findCssRule(stylesheetRules, nativeSidebarRowSelector);
assert(
  !canonicalCssValue(nativeSidebarPanelRule.declarations.get("background")).includes("!important"),
  "native sidebar base shorthand must not lock background-image with !important",
);
assertCssDeclarations(stylesheetRules, nativeSidebarPanelSelector, {
  "background-color": "rgba(255, 252, 249, .992) !important",
  "background-image": "none",
  isolation: "isolate",
  position: "relative",
});
assertCssDeclarations(stylesheetRules, nativeSidebarGroupSelector, {
  background: "transparent !important",
  "border-color": "transparent !important",
  "border-radius": "0",
  "box-shadow": "none",
});
assertCssDeclarations(stylesheetRules, darkNativeSidebarGroupSelector, {
  background: "transparent !important",
  "border-color": "transparent !important",
  "box-shadow": "none",
});
assertCssDeclarations(stylesheetRules, nativeSidebarRowSelector, {
  background: "transparent !important",
  "border-color": "transparent !important",
  "box-shadow": "none",
});
assertCssDeclarations(stylesheetRules, nativeLeftSidebarHostSelector, {
  color: "var(--denia-ink) !important",
  background: "radial-gradient(circle at 14% 8%, rgba(143, 210, 221, .15), transparent 24%), radial-gradient(circle at 92% 18%, rgba(242, 154, 171, .1), transparent 28%), repeating-linear-gradient(0deg, transparent 0 31px, rgba(111, 184, 231, .04) 31px 32px), rgb(255, 252, 249) !important",
  "box-shadow": "inset -2px 0 rgba(111, 184, 231, .3), inset -1px 0 rgba(255, 255, 255, .9), inset -10px 0 26px rgba(111, 184, 231, .045), 10px 0 30px rgba(38, 53, 72, .075) !important",
});
assert(
  !stylesheetRules.some((rule) =>
    rule.selectors.some((selector) =>
      selector.includes("denia-old-days-ds-home")
        && selector.includes("denia-old-days-ds-native-right-sidebar"))
      && rule.declarations.has("background-image")),
  "home routes must reuse the responsive visual surface instead of repainting the panel",
);
assert(
  rgbaAlpha(nativeSidebarPanelRule.declarations.get("background-color")) >= .97,
  "native sidebar panel surface must be at least .97 opaque",
);
assert(
  canonicalCssValue(nativeSidebarGroupRule.declarations.get("background")) === "transparent!important",
  "native sidebar group must not draw an outer container",
);
assert(
  canonicalCssValue(nativeSidebarRowRule.declarations.get("background")) === "transparent!important",
  "native sidebar rows must not draw persistent option containers",
);
const nativeSidebarArtSelector =
  ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art";
const nativeSidebarArtLayerSelector =
  ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art > span";
const nativeSidebarPortraitSelector =
  ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art-portrait";
const nativeSidebarWideAmbientSelector =
  ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art-wide-ambient";
const nativeSidebarWideSceneSelector =
  ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art-wide-scene";
const nativeSidebarScrimSelector =
  ".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-art-scrim";
const nativeSidebarPortraitChoiceSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-artwork="portrait"]:not([data-denia-sidebar-resizing="true"]) .denia-old-days-ds-native-sidebar-art-portrait';
const nativeSidebarWideAmbientChoiceSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-artwork="wide"]:not([data-denia-sidebar-resizing="true"]) .denia-old-days-ds-native-sidebar-art-wide-ambient';
const nativeSidebarWideSceneChoiceSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-artwork="wide"]:not([data-denia-sidebar-resizing="true"]) .denia-old-days-ds-native-sidebar-art-wide-scene';
const nativeSidebarResizePortraitSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"][data-denia-sidebar-artwork="portrait"] .denia-old-days-ds-native-sidebar-art-portrait';
const nativeSidebarResizeWideSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"][data-denia-sidebar-artwork="wide"] .denia-old-days-ds-native-sidebar-art-wide-scene';
const nativeSidebarResizeScrimSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"] .denia-old-days-ds-native-sidebar-art-scrim';
const nativeSidebarResizeGlowSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"] .denia-old-days-ds-native-sidebar-art-scrim::before';
const nativeSidebarResizeSweepSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-sidebar-resizing="true"] .denia-old-days-ds-native-sidebar-art-scrim::after';
const darkNativeSidebarResizeScrimSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-theme="dark"][data-denia-sidebar-resizing="true"] .denia-old-days-ds-native-sidebar-art-scrim';
const darkNativeSidebarResizeGlowSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-theme="dark"][data-denia-sidebar-resizing="true"] .denia-old-days-ds-native-sidebar-art-scrim::before';
const darkNativeSidebarResizeSweepSelector =
  'html.codex-dream-skin.denia-old-days-ds-extension[data-denia-theme="dark"][data-denia-sidebar-resizing="true"] .denia-old-days-ds-native-sidebar-art-scrim::after';
assertCssDeclarations(stylesheetRules, nativeSidebarArtSelector, {
  "--denia-sidebar-portrait-image": "var(--denia-old-days-art-right-sidebar)",
  "--denia-sidebar-wide-image": "var(--denia-old-days-art-right-sidebar-wide)",
  position: "absolute",
  inset: "0",
  "z-index": "-1",
  overflow: "hidden",
  contain: "paint",
  "pointer-events": "none",
});
assertCssDeclarations(stylesheetRules, nativeSidebarArtLayerSelector, {
  position: "absolute",
  inset: "0",
  "background-repeat": "no-repeat",
  "pointer-events": "none",
});
assertCssDeclarations(stylesheetRules, nativeSidebarPortraitSelector, {
  "background-image": "var(--denia-sidebar-portrait-image)",
  "background-position": "center bottom",
  "background-size": "cover",
  opacity: "0",
  transform: "scale(1.02)",
  transition: "opacity 160ms cubic-bezier(.22, 1, .36, 1), transform 200ms cubic-bezier(.22, 1, .36, 1)",
});
assertCssDeclarations(stylesheetRules, nativeSidebarWideAmbientSelector, {
  "background-image": "var(--denia-sidebar-wide-image)",
  "background-position": "center",
  "background-size": "cover",
  opacity: "0",
});
assertCssDeclarations(stylesheetRules, nativeSidebarWideSceneSelector, {
  "background-image": "var(--denia-sidebar-wide-image)",
  "background-position": "51% center",
  "background-size": "cover",
  opacity: "0",
  transform: "scale(1.018)",
  transition: "opacity 160ms cubic-bezier(.22, 1, .36, 1), transform 200ms cubic-bezier(.22, 1, .36, 1)",
});
assertCssDeclarations(stylesheetRules, nativeSidebarScrimSelector, {
  opacity: "1",
  overflow: "hidden",
  background: "linear-gradient(90deg, rgba(245, 248, 252, .28) 0%, rgba(247, 250, 253, .5) 42%, rgba(238, 245, 250, .38) 70%, rgba(224, 235, 244, .2) 100%), linear-gradient(180deg, rgba(248, 250, 253, .28) 0%, rgba(236, 244, 249, .06) 48%, rgba(209, 224, 236, .22) 100%)",
});
assertCssDeclarations(stylesheetRules, nativeSidebarPortraitChoiceSelector, {
  opacity: "1",
  transform: "scale(1)",
});
assert(
  !stylesheetRules.some((rule) =>
    rule.selectors.includes(nativeSidebarWideAmbientChoiceSelector)
      && Number.parseFloat(rule.declarations.get("opacity")) > 0),
  "settled wide artwork must not expose the blurred ambient layer",
);
assertCssDeclarations(stylesheetRules, nativeSidebarWideSceneChoiceSelector, {
  opacity: "1",
  transform: "scale(1.035)",
});
assertCssDeclarations(stylesheetRules, nativeSidebarResizePortraitSelector, {
  opacity: ".12",
  filter: "blur(18px) saturate(.76) brightness(.78)",
  transform: "scale(1.08)",
});
assertCssDeclarations(stylesheetRules, nativeSidebarResizeWideSelector, {
  opacity: ".12",
  filter: "blur(18px) saturate(.76) brightness(.78)",
  transform: "scale(1.08)",
});
assertCssDeclarations(stylesheetRules, nativeSidebarResizeScrimSelector, {
  "backdrop-filter": "blur(22px) saturate(140%)",
  background: "radial-gradient(circle at 18% 14%, rgba(132, 224, 235, .52), transparent 34%), radial-gradient(circle at 82% 74%, rgba(236, 143, 187, .38), transparent 38%), rgba(222, 232, 242, .74)",
});
assertCssDeclarations(stylesheetRules, nativeSidebarResizeGlowSelector, {
  animation: "denia-sidebar-glow-drift 2.4s ease-in-out infinite alternate",
  opacity: ".82",
});
assertCssDeclarations(stylesheetRules, nativeSidebarResizeSweepSelector, {
  animation: "denia-sidebar-glass-sweep 1.8s ease-in-out infinite",
  opacity: ".64",
});
assertCssDeclarations(stylesheetRules, darkNativeSidebarResizeScrimSelector, {
  background: "radial-gradient(circle at 18% 14%, rgba(92, 185, 210, .3), transparent 34%), radial-gradient(circle at 82% 74%, rgba(173, 93, 158, .24), transparent 38%), rgba(12, 15, 37, .78)",
});
assertCssDeclarations(stylesheetRules, darkNativeSidebarResizeGlowSelector, {
  background: "radial-gradient(circle at 24% 24%, rgba(87, 190, 213, .4), transparent 34%), radial-gradient(circle at 76% 72%, rgba(181, 98, 164, .32), transparent 36%)",
});
assertCssDeclarations(stylesheetRules, darkNativeSidebarResizeSweepSelector, {
  background: "linear-gradient(90deg, transparent, rgba(206, 231, 245, .42), transparent)",
});
for (const animationName of [
  "denia-sidebar-glow-drift",
  "denia-sidebar-glass-sweep",
]) {
  const keyframeRules = stylesheetRules.filter((rule) =>
    rule.atRules.some((atRule) => atRule === `@keyframes ${animationName}`));
  assert(keyframeRules.length > 0, `${animationName} must define keyframes`);
  for (const rule of keyframeRules) {
    assert(
      [...rule.declarations.keys()].every((property) =>
        property === "transform" || property === "opacity"),
      `${animationName} may animate only transform and opacity`,
    );
  }
}
assertCssDeclarations(stylesheetRules, nativeSidebarArtSelector, {
  display: "none",
}, ["prefers-reduced-transparency: reduce"]);
const taskLayoutProperties = /^(?:width|min-width|max-width|margin(?:-.+)?|padding(?:-.+)?|grid(?:-.+)?|flex(?:-.+)?)$/u;
const darkTaskMainReadabilityRoot =
  'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"] main.main-surface:not(.dream-skin-home-shell)';
const darkThemePaletteSelector =
  '.denia-old-days-ds-extension[data-denia-theme="dark"]';
const darkTaskMarkdownRoot =
  `${darkTaskMainReadabilityRoot} .thread-scroll-container :is([data-content-search-unit-key$=":assistant"], [data-content-search-unit-key$=":user"]) [class*="_markdownContent_"]`;
const darkTaskMarkdownHeadingSelector =
  `${darkTaskMarkdownRoot} :is(h1, h2, h3, h4, h5, h6, th)`;
const darkTaskMarkdownBodySelector =
  `${darkTaskMarkdownRoot} :is(p, li, ol, ul, blockquote, td)`;
const darkTaskMarkdownTableSelector =
  `${darkTaskMarkdownRoot} [data-markdown-table="true"] table`;
const darkTaskMarkdownCellSelector =
  `${darkTaskMarkdownRoot} :is(th, td)`;
const darkTaskMarkdownLinkSelector =
  `${darkTaskMarkdownRoot} a`;
const darkTaskInlineMarkdownSelector =
  `${darkTaskMarkdownRoot} [data-markdown-copy="inline-code"].inline-markdown`;
const darkTaskCodeBlockSelector =
  `${darkTaskMarkdownRoot} :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])`;
const darkTaskCodeSelector =
  `${darkTaskCodeBlockSelector} code`;
const darkTaskCodeDefaultTokenSelector =
  `${darkTaskCodeSelector} :is([class^="hljs-"], [class*=" hljs-"])`;
const darkTaskCodeChromeSelector =
  `${darkTaskMarkdownRoot} [data-markdown-copy="code-block"] [data-markdown-copy="exclude"]`;
const darkTaskCodeChromeControlSelector =
  `${darkTaskCodeChromeSelector} :is(button, [role="button"])`;
const darkTaskCodeChromeInteractiveSelector =
  `${darkTaskCodeChromeControlSelector}:is(:hover, :focus-visible)`;
const darkTaskCodeCommentSelector =
  `${darkTaskCodeSelector} :is(.hljs-comment, .hljs-quote)`;
const darkTaskCodeKeywordSelector =
  `${darkTaskCodeSelector} :is(.hljs-keyword, .hljs-selector-tag)`;
const darkTaskCodeTypeSelector =
  `${darkTaskCodeSelector} :is(.hljs-title, .hljs-type, .hljs-attr, .hljs-attribute, .hljs-property, .hljs-built_in, .hljs-name, .hljs-section, .hljs-selector-class, .hljs-selector-id, .hljs-selector-attr, .hljs-selector-pseudo)`;
const darkTaskCodeStringSelector =
  `${darkTaskCodeSelector} :is(.hljs-string, .hljs-template-variable, .hljs-regexp, .hljs-addition, .hljs-bullet, .hljs-link)`;
const darkTaskCodeConstantSelector =
  `${darkTaskCodeSelector} :is(.hljs-number, .hljs-literal, .hljs-symbol, .hljs-variable.constant_, .hljs-deletion)`;
const darkTaskCodePunctuationSelector =
  `${darkTaskCodeSelector} :is(.hljs-punctuation, .hljs-operator)`;
const darkTaskCodeWarningSelector =
  `${darkTaskCodeSelector} :is(.hljs-meta, .hljs-doctag, .hljs-formula, .hljs-template-tag)`;
const darkTaskMarkdownSemanticShadowSelector =
  `${darkTaskMarkdownRoot} :is(a, strong, em, del, mark, kbd, samp)`;
const darkTaskProgressCopySelector =
  `${darkTaskMainReadabilityRoot} .thread-scroll-container .text-token-conversation-body`;
const darkTaskInlineUserEditorSelector =
  `${darkTaskMainReadabilityRoot} .thread-scroll-container [data-content-search-unit-key$=":user"] form [contenteditable="true"]`;
const darkTaskMetadataSelector =
  `${darkTaskMainReadabilityRoot} .thread-scroll-container :is([data-content-search-unit-key$=":assistant"], [data-content-search-unit-key$=":user"]) .text-xs.text-token-text-tertiary`;
const darkTaskTitleSelector =
  `${darkTaskMainReadabilityRoot} [data-testid="app-shell-header-context-menu-surface"] .text-token-foreground > .min-w-0.truncate`;
const darkTaskActivityCopySelector =
  `${darkTaskMainReadabilityRoot} .thread-scroll-container .text-token-conversation-body :is(span[class~="truncate"], .loading-shimmer-pure-text, [class*="_cadencedShimmer"])`;
const darkTaskConversationSurfaceSelector =
  `${darkTaskMainReadabilityRoot} .thread-scroll-container [role="main"]`;
const darkTaskHeaderSelector =
  `${darkTaskMainReadabilityRoot} > header.app-header-tint`;
const darkTaskHeaderNeutralControlSelector =
  `${darkTaskHeaderSelector} :is(button, [role="button"]).text-token-button-tertiary-foreground`;
const darkTaskNeutralActionSelector =
  `${darkTaskMainReadabilityRoot} .denia-old-days-ds-final-card button.text-token-text-tertiary:not(.end-resource-open-button)`;
const darkTaskNeutralActionInteractiveSelector =
  `${darkTaskNeutralActionSelector}:is(:hover, :focus-visible)`;
assertCssDeclarations(stylesheetRules, darkThemePaletteSelector, {
  "--denia-dark-text-heading": "#F3EFF6",
  "--denia-dark-text-body": "#E7E3EC",
  "--denia-dark-text-secondary": "#BBB5C9",
  "--denia-dark-text-tertiary": "#9E98AE",
  "--denia-dark-text-link": "#8DC5EA",
  "--denia-dark-code-inline-surface": "#272A50",
  "--denia-dark-code-text": "#D7D9E8",
  "--denia-dark-code-comment": "#8F97B5",
  "--denia-dark-code-keyword": "#C7A7E8",
  "--denia-dark-code-type": "#91C9F2",
  "--denia-dark-code-string": "#9DD8C5",
  "--denia-dark-code-constant": "#F0B2CE",
  "--denia-dark-code-punctuation": "#B6BCD2",
  "--denia-dark-code-warning": "#F0CC8C",
  "--denia-dark-code-surface": "#191C38",
  "--denia-dark-text": "var(--denia-dark-text-heading)",
  "--denia-dark-text-muted": "var(--denia-dark-text-secondary)",
  "--denia-dark-focus": "var(--denia-dark-text-link)",
});
assertCssDeclarations(stylesheetRules, darkTaskMarkdownRoot, {
  color: "var(--denia-dark-text-body) !important",
  "text-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkTaskMarkdownHeadingSelector, {
  color: "var(--denia-dark-text-heading) !important",
  "text-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkTaskMarkdownBodySelector, {
  color: "var(--denia-dark-text-body) !important",
  "text-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkTaskMarkdownTableSelector, {
  color: "var(--denia-dark-text-body) !important",
  "text-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkTaskMarkdownCellSelector, {
  "border-color": "var(--denia-dark-divider) !important",
});
assertCssDeclarations(stylesheetRules, darkTaskMarkdownLinkSelector, {
  color: "var(--denia-dark-text-link) !important",
  "text-shadow": "none !important",
});
const darkTaskMarkdownSemanticShadowRule =
  findCssRule(stylesheetRules, darkTaskMarkdownSemanticShadowSelector);
assert(
  darkTaskMarkdownSemanticShadowRule.declarations.size === 1
    && canonicalCssValue(darkTaskMarkdownSemanticShadowRule.declarations.get("text-shadow"))
      === canonicalCssValue("none !important"),
  `${darkTaskMarkdownSemanticShadowSelector} must set only text-shadow: none !important`,
);
assertCssDeclarations(stylesheetRules, darkTaskInlineMarkdownSelector, {
  color: "var(--denia-dark-text-link) !important",
  background: "var(--denia-dark-code-inline-surface) !important",
  "text-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkTaskCodeBlockSelector, {
  color: "var(--denia-dark-code-text) !important",
  "background-color": "var(--denia-dark-code-surface) !important",
  "text-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkTaskCodeSelector, {
  color: "var(--denia-dark-code-text) !important",
  "text-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkTaskCodeDefaultTokenSelector, {
  color: "var(--denia-dark-code-text) !important",
  "text-shadow": "none !important",
});
for (const selector of [darkTaskCodeChromeSelector, darkTaskCodeChromeControlSelector]) {
  assertCssDeclarations(stylesheetRules, selector, {
    color: "var(--denia-dark-text-secondary) !important",
  });
}
assertCssDeclarations(stylesheetRules, darkTaskCodeChromeInteractiveSelector, {
  color: "var(--denia-dark-text-link) !important",
});
for (const [selector, variable] of [
  [darkTaskCodeCommentSelector, "--denia-dark-code-comment"],
  [darkTaskCodeKeywordSelector, "--denia-dark-code-keyword"],
  [darkTaskCodeTypeSelector, "--denia-dark-code-type"],
  [darkTaskCodeStringSelector, "--denia-dark-code-string"],
  [darkTaskCodeConstantSelector, "--denia-dark-code-constant"],
  [darkTaskCodePunctuationSelector, "--denia-dark-code-punctuation"],
  [darkTaskCodeWarningSelector, "--denia-dark-code-warning"],
]) {
  assertCssDeclarations(stylesheetRules, selector, {
    color: `var(${variable}) !important`,
    "text-shadow": "none !important",
  });
}
assertCssDeclarations(stylesheetRules, darkTaskProgressCopySelector, {
  color: "var(--denia-dark-text-muted) !important",
});
assertCssDeclarations(stylesheetRules, darkTaskInlineUserEditorSelector, {
  color: "var(--denia-dark-text) !important",
});
assertCssDeclarations(stylesheetRules, darkTaskMetadataSelector, {
  color: "var(--denia-dark-text-tertiary) !important",
});
for (const rule of stylesheetRules) {
  if (![...rule.declarations.values()].some((value) =>
    canonicalCssValue(value).includes("var(--denia-dark-text-tertiary)"))) continue;
  assert(
    rule.selectors.length === 1 && rule.selectors[0] === darkTaskMetadataSelector,
    "dark text tertiary color must stay on the approved assistant/user metadata selector",
  );
}
assertCssDeclarations(stylesheetRules, darkTaskTitleSelector, {
  color: "var(--denia-dark-text) !important",
});
assertCssDeclarations(stylesheetRules, darkTaskActivityCopySelector, {
  color: "inherit !important",
});
for (const selector of [darkTaskConversationSurfaceSelector, darkTaskHeaderSelector]) {
  assertCssDeclarations(stylesheetRules, selector, {
    "text-shadow": "none !important",
  });
}
assertCssDeclarations(stylesheetRules, darkTaskHeaderNeutralControlSelector, {
  color: "var(--denia-dark-text-muted) !important",
});
assertCssDeclarations(stylesheetRules, darkTaskNeutralActionSelector, {
  color: "var(--denia-dark-text-muted) !important",
});
assertCssDeclarations(stylesheetRules, darkTaskNeutralActionInteractiveSelector, {
  color: "var(--denia-dark-focus) !important",
  "background-color": "rgba(141, 197, 234, .12) !important",
});
const darkTaskMarkdownPaintProperties = new Set([
  "background",
  "background-color",
  "border-color",
  "color",
  "text-shadow",
]);

const darkTaskMarkdownSelectors = [
  darkTaskMarkdownRoot,
  darkTaskMarkdownHeadingSelector,
  darkTaskMarkdownBodySelector,
  darkTaskMarkdownTableSelector,
  darkTaskMarkdownCellSelector,
  darkTaskMarkdownLinkSelector,
  darkTaskMarkdownSemanticShadowSelector,
  darkTaskInlineMarkdownSelector,
];

for (const selector of darkTaskMarkdownSelectors) {
  assert(
    selector === darkTaskMarkdownRoot
      || selector.startsWith(`${darkTaskMarkdownRoot} `),
    `dark task Markdown paint must stay inside the native Markdown root: ${selector}`,
  );
  assert(
    !/(?:diff|monaco|xterm|terminal)/iu.test(selector),
    `dark task Markdown paint must not reach diff, editor, or terminal surfaces: ${selector}`,
  );
}

for (const rule of stylesheetRules) {
  const actualDarkTaskMarkdownSelectors = rule.selectors.filter((selector) =>
    selector.includes(darkTaskMainReadabilityRoot)
      && selector.includes('[class*="_markdownContent_"]'));
  if (!actualDarkTaskMarkdownSelectors.length) continue;
  for (const selector of rule.selectors) {
    assert(
      !/(?:diff|monaco|xterm|terminal|editor|ProseMirror|composer)/iu.test(selector),
      `dark task Markdown paint must not reach forbidden surfaces: ${selector}`,
    );
  }
  assert(
    rule.selectors.every((selector) =>
      selector === darkTaskMarkdownRoot
        || selector.startsWith(`${darkTaskMarkdownRoot} `)),
    "dark task Markdown paint must not share a rule with an out-of-scope selector",
  );
  for (const property of rule.declarations.keys()) {
    assert(
      darkTaskMarkdownPaintProperties.has(property),
      `dark task Markdown paint must not change native geometry or behavior: ${property}`,
    );
  }
}

for (const rule of stylesheetRules) {
  for (const selector of rule.selectors) {
    if (!selector.includes(darkTaskMainReadabilityRoot)) continue;
    const targetsMarkdownCode =
      /(?:^|[\s>+~,(])(?:code|pre)(?:$|[\s>+~,.:[#])/iu.test(selector);
    if (!targetsMarkdownCode) continue;
    assert(
      selector.startsWith(`${darkTaskMarkdownRoot} `),
      `dark task code paint must stay inside the native Markdown root: ${selector}`,
    );
  }
}

const darkTaskMarkdownCodeSelectors = [
  darkTaskCodeBlockSelector,
  darkTaskCodeSelector,
  darkTaskCodeDefaultTokenSelector,
  darkTaskCodeChromeSelector,
  darkTaskCodeChromeControlSelector,
  darkTaskCodeChromeInteractiveSelector,
  darkTaskCodeCommentSelector,
  darkTaskCodeKeywordSelector,
  darkTaskCodeTypeSelector,
  darkTaskCodeStringSelector,
  darkTaskCodeConstantSelector,
  darkTaskCodePunctuationSelector,
  darkTaskCodeWarningSelector,
];
const darkTaskMarkdownCodeSelectorSet =
  new Set(darkTaskMarkdownCodeSelectors);

for (const selector of darkTaskMarkdownCodeSelectors) {
  assert(
    selector.startsWith(`${darkTaskMarkdownRoot} `),
    `dark task code paint must stay inside the native Markdown root: ${selector}`,
  );
  assert(
    !/(?:diff|monaco|xterm|terminal)/iu.test(selector),
    `dark task code paint must not reach diff, editor, or terminal surfaces: ${selector}`,
  );
}

for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) =>
    darkTaskMarkdownCodeSelectorSet.has(selector))) continue;
  assert(
    rule.selectors.every((selector) =>
      darkTaskMarkdownCodeSelectorSet.has(selector)),
    "dark task code paint must not share a rule with an out-of-scope selector",
  );
  for (const property of rule.declarations.keys()) {
    assert(
      darkTaskMarkdownPaintProperties.has(property),
      `dark task code paint must not change native geometry or behavior: ${property}`,
    );
  }
}

for (const selector of [
  ...darkTaskMarkdownSelectors,
  darkTaskProgressCopySelector,
  darkTaskMetadataSelector,
  darkTaskTitleSelector,
  darkTaskActivityCopySelector,
  darkTaskConversationSurfaceSelector,
  darkTaskHeaderSelector,
  darkTaskHeaderNeutralControlSelector,
  darkTaskNeutralActionSelector,
  darkTaskNeutralActionInteractiveSelector,
]) {
  assert(
    !/(?:diff|monaco|xterm|terminal)/iu.test(selector),
    `dark task readability paint must not target diff, editor, or terminal surfaces: ${selector}`,
  );
}
for (const selector of darkTaskMarkdownSelectors) {
  const targetsMarkdownCode =
    /(?:^|[\s>+~,(])(?:code|pre)(?:$|[\s>+~,.:[#])/iu.test(selector);
  assert(
    !targetsMarkdownCode
      || selector.startsWith(`${darkTaskMarkdownRoot} `),
    `dark task code paint must stay inside the native Markdown root: ${selector}`,
  );
}
assert(
  darkTaskActivityCopySelector.includes(".thread-scroll-container .text-token-conversation-body")
    && darkTaskActivityCopySelector.includes('span[class~="truncate"]')
    && darkTaskActivityCopySelector.includes(".loading-shimmer-pure-text")
    && darkTaskActivityCopySelector.includes('[class*="_cadencedShimmer"]')
    && !/(?:^|[\s>+~])\*(?:$|[\s>+~,.:[#])/u.test(darkTaskActivityCopySelector),
  "dark task activity summaries must target only confirmed text spans and shimmer classes",
);
assert(
  darkTaskNeutralActionSelector.includes(".denia-old-days-ds-final-card button.text-token-text-tertiary")
    && darkTaskNeutralActionSelector.includes(":not(.end-resource-open-button)")
    && !/(?:aria-label|title|复制|喜欢|剪切|展开)/u.test(darkTaskNeutralActionSelector),
  "dark task action paint must use the native neutral-control token and exclude resource business actions without localized text matching",
);
const darkTaskActionPaintProperties = new Set([
  "background",
  "background-color",
  "border-color",
  "box-shadow",
  "color",
  "outline-color",
]);
for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) =>
    selector.includes(".denia-old-days-ds-final-card button.text-token-text-tertiary"))) continue;
  assert(
    rule.selectors.every((selector) =>
      selector.startsWith(`${darkTaskMainReadabilityRoot} .denia-old-days-ds-final-card`)),
    "dark task action paint must remain inside the deep task main final card",
  );
  for (const property of rule.declarations.keys()) {
    assert(
      darkTaskActionPaintProperties.has(property),
      `dark task action paint must not change native action geometry or behavior: ${property}`,
    );
  }
}
assert(
  !stylesheetRules.some((rule) => rule.selectors.some((selector) =>
    selector.includes(darkTaskMainReadabilityRoot)
      && (/thread-resource-card/u.test(selector)
        || (/end-resource/u.test(selector)
          && !selector.includes(":not(.end-resource-open-button)"))))),
  "dark task readability paint must not wash out light resource cards",
);
assert(
  !stylesheetRules.some((rule) => rule.selectors.some((selector) =>
    selector.includes(darkTaskMainReadabilityRoot)
      && selector.includes("text-token-foreground")
      && selector !== darkTaskTitleSelector)),
  "dark task foreground-token paint must stay pinned to the native thread title",
);
const taskContentAlignmentSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task main .thread-scroll-container [class*="mx-auto"][class*="thread-content-max-width"]:not([data-thread-scroll-footer="true"] *)';
const taskFooterAlignmentSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task main .thread-scroll-container [data-thread-scroll-footer="true"] [class*="mx-auto"][class*="thread-content-max-width"]:not([data-app-shell-focus-area="right-panel"] *)';
const taskContentMotionSelector = 'html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task main .thread-scroll-container > [class*="min-h-full"][class*="shrink-0"]';
const taskContentAlignmentRule = findCssRule(stylesheetRules, taskContentAlignmentSelector);
assert(
  taskContentAlignmentRule?.selectors.length === 2
    && taskContentAlignmentRule.selectors.includes(taskFooterAlignmentSelector)
    && taskContentAlignmentRule.selectors.every((selector) =>
      !selector.includes("[data-denia-sidebar-state=")),
  "the main task composer must stay aligned across native sidebar transitions without pinning the side-task composer",
);
for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) => selector.includes(".denia-old-days-ds-task"))) continue;
  for (const property of rule.declarations.keys()) {
    if (rule === taskContentAlignmentRule
      && ["margin-inline-start", "margin-inline-end"].includes(property)) continue;
    assert(!taskLayoutProperties.test(property), `task stylesheet must not override native layout property ${property}`);
  }
}
assertCssDeclarations(stylesheetRules, taskContentAlignmentSelector, {
  "margin-inline-start": "max(16px, calc((var(--denia-thread-content-width, 100cqw) - var(--thread-content-max-width) - var(--denia-state-rail-width)) / 2)) !important",
  "margin-inline-end": "auto !important",
});
assertCssDeclarations(stylesheetRules, taskContentMotionSelector, {
  transform: "none !important",
  transition: "none !important",
});
assert(
  !styles.includes("denia-old-days-sidebar-close-align"),
  "task layout must not retain sidebar close compensation animation",
);
assert(
  runtime.includes("if (home) {\n      state.formState = \"staged\";")
    && runtime.includes("syncHomeViewport(findMain());")
    && runtime.includes("clearHomeViewportBinding();\n      removeHomeNodes();"),
  "home and task route synchronization must not depend on a sidebar brand",
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
  "grid-template-columns": "minmax(350px, .88fr) minmax(460px, 1.12fr)",
  "column-gap": "36px",
  width: "min(1160px, calc(100% - 32px))",
  "min-height": "0",
  margin: "12px auto",
  padding: "26px 36px",
}, shortDesktopMedia);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero h1", {
  margin: "12px 0 10px",
  "font-size": "clamp(34px, 3.6vw, 48px)",
}, shortDesktopMedia);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", {
  display: "block",
  width: "min(100%, 500px)",
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
  [".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-group", "transparent !important"],
  [".denia-old-days-ds-extension .denia-old-days-ds-native-sidebar-row", "#fffdf9 !important"],
]) assertCssDeclarations(stylesheetRules, selector, { background }, transparencyMedia);
assertCssDeclarations(stylesheetRules, darkNativeSidebarGroupSelector, {
  background: "transparent !important",
}, transparencyMedia);
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
    for (const artwork of [
      { key: "bright", token: "__DENIA_OLD_DAYS_EXTENSION_BRIGHT_ART_JSON__" },
      { key: "dark", token: "__DENIA_OLD_DAYS_EXTENSION_DARK_HOME_ART_JSON__" },
    ]) {
      const stagingReplacement = `  .replace(templatePlaceholders.${artwork.key}, templateSentinels.${artwork.key})`;
      assert(loaderSource.includes(stagingReplacement), `loader mutation fixture missing ${artwork.key} artwork staging replacement`);
      await fs.writeFile(loaderPath, loaderSource.replace(stagingReplacement, `  // ${stagingReplacement.trim()}`));
      const mutatedResult = spawnSync(process.execPath, loaderArgs, { encoding: "utf8", timeout: 7000 });
      const mutatedOutput = `${mutatedResult.stdout || ""}\n${mutatedResult.stderr || ""}`;
      assert(
        mutatedResult.status !== 0
          && mutatedOutput.includes("Unresolved Denia runtime template token")
          && mutatedOutput.includes(artwork.token)
          && !mutatedOutput.includes("ECONNREFUSED"),
        `loader must reject an unresolved ${artwork.key} artwork token before entering CDP`,
      );
    }
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
    {
      prefix: "denia-validator-css-dark-markdown-xterm-",
      mutate: (source) => `${source}
${darkTaskMarkdownRoot} .xterm pre {
  color: var(--denia-dark-code-text) !important;
}
`,
      expected: "dark task Markdown paint must not reach forbidden surfaces",
      failure: "validator must reject xterm paint nested under the dark task Markdown root",
    },
    {
      prefix: "denia-validator-css-dark-pre-outside-markdown-",
      mutate: (source) => `${source}
${darkTaskMainReadabilityRoot} pre {
  color: var(--denia-dark-code-text) !important;
}
`,
      expected: "dark task code paint must stay inside the native Markdown root",
      failure: "validator must reject dark task pre paint outside the approved Markdown root",
    },
    {
      prefix: "denia-validator-css-dark-markdown-monaco-group-",
      mutate: (source) => `${source}
${darkTaskMarkdownRoot} .denia-validator-group-probe,
${darkTaskMainReadabilityRoot} .monaco-editor {
  color: var(--denia-dark-code-text) !important;
}
`,
      expected: "dark task Markdown paint must not reach forbidden surfaces",
      failure: "validator must reject a grouped Markdown and Monaco paint rule",
    },
    {
      prefix: "denia-validator-css-dark-markdown-padding-",
      mutate: (source) => `${source}
${darkTaskMarkdownRoot} .denia-validator-padding-probe {
  padding: 1px;
}
`,
      expected: "dark task Markdown paint must not change native geometry or behavior: padding",
      failure: "validator must reject layout declarations under the approved Markdown root",
    },
    {
      prefix: "denia-validator-css-dark-tool-reasoning-tertiary-",
      mutate: (source) => `${source}
${darkTaskMainReadabilityRoot}
  .thread-scroll-container
  :is([data-content-search-unit-key$=":tool"], [data-content-search-unit-key$=":reasoning"])
  .text-xs.text-token-text-tertiary {
  color: var(--denia-dark-text-tertiary) !important;
}
`,
      expected: "dark text tertiary color must stay on the approved assistant/user metadata selector",
      failure: "validator must reject tertiary metadata color on tool or reasoning content units",
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
  const resizeHandle = open.document.createElement("div");
  resizeHandle.classList.add("cursor-col-resize");
  aside.append(resizeHandle);
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
    open.root.dataset.deniaSidebarLayout === "compact"
      && open.root.dataset.deniaSidebarArtwork === "portrait"
      && !("deniaSidebarResizing" in open.root.dataset),
    "a 334px native sidebar must settle on the portrait without a resize mask",
  );
  assert(
    open.root.style.getPropertyValue("--denia-thread-content-width") === "1482px",
    "task layout must expose a stable full-width thread content measurement",
  );
  assert(group.classList.contains("denia-old-days-ds-native-sidebar-group"), "the smallest common row ancestor must receive the group class");
  assert(firstRow.classList.contains("denia-old-days-ds-native-sidebar-row"), "wide visible sidebar buttons must receive the row class");
  assert(secondRow.classList.contains("denia-old-days-ds-native-sidebar-row"), "wide visible sidebar links must receive the row class");
  const sidebarArt = aside.querySelector(".denia-old-days-ds-native-sidebar-art");
  assert(
    sidebarArt
      && sidebarArt.getAttribute("aria-hidden") === "true"
      && sidebarArt.children.length === 4
      && state.ownedNodes.has(sidebarArt),
    "an open sidebar must receive one owned four-layer visual surface",
  );
  assert(
    ["portrait", "wide-ambient", "wide-scene", "scrim"].every((name) =>
      Boolean(sidebarArt.querySelector(`.denia-old-days-ds-native-sidebar-art-${name}`))),
    "the sidebar visual surface must contain portrait, ambient, scene, and scrim layers",
  );
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

  open.dispatchWindowEvent("pointerdown", { target: resizeHandle });
  assert(
    open.root.dataset.deniaSidebarResizing === "true",
    "pressing the native resize handle must show the sidebar mask before geometry changes",
  );
  aside.setRect({ x: 952, width: 560 });
  assert(open.flushResizeObservers(aside) === 1, "dragging the sidebar must notify one ResizeObserver");
  assert(open.flushAnimationFrames() === 1, "a sidebar resize must coalesce into one refresh frame");
  assert(
    open.root.dataset.deniaSidebarLayout === "transition"
      && open.root.dataset.deniaSidebarResizing === "true"
      && open.root.dataset.deniaSidebarArtwork === "portrait",
    "a 560px drag must keep the last portrait choice hidden behind the resize mask",
  );
  assert(
    open.flushTimers() === 0
      && open.root.dataset.deniaSidebarResizing === "true",
    "a held native resize pointer must keep the mask instead of settling on idle time",
  );
  open.dispatchWindowEvent("pointerup", { target: resizeHandle });
  assert(
    !("deniaSidebarResizing" in open.root.dataset)
      && open.root.dataset.deniaSidebarArtwork === "portrait",
    "releasing a portrait-like 560px panel must reveal the portrait artwork",
  );
  assert(open.flushAnimationFrames() === 1, "released portrait selection must refresh diagnostics once");

  open.dispatchWindowEvent("pointerdown", { target: resizeHandle });
  aside.setRect({ x: 672, width: 840 });
  main.setRect({ width: 672 });
  assert(open.flushResizeObservers(aside) === 1, "reaching workspace width must keep the observer attached");
  assert(open.flushAnimationFrames() === 1, "workspace width must refresh in one frame");
  assert(
    open.root.dataset.deniaSidebarLayout === "workspace"
      && open.root.dataset.deniaSidebarResizing === "true"
      && open.root.dataset.deniaSidebarArtwork === "portrait",
    "workspace drag must keep the previous artwork hidden until the width settles",
  );
  assert(
    open.flushTimers() === 0
      && open.root.dataset.deniaSidebarResizing === "true",
    "a held workspace resize pointer must keep the mask instead of settling on idle time",
  );
  open.dispatchWindowEvent("pointerup", { target: resizeHandle });
  assert(
    !("deniaSidebarResizing" in open.root.dataset)
      && open.root.dataset.deniaSidebarArtwork === "wide",
    "releasing a landscape-like 840px panel must reveal the complete wide scene",
  );
  assert(open.flushAnimationFrames() === 1, "released wide selection must refresh diagnostics once");

  aside.setRect({ x: 1178, width: 334 });
  main.setRect({ width: 1178 });
  assert(open.flushResizeObservers(aside) === 1, "returning to compact width must keep drag observation active");
  assert(open.flushAnimationFrames() === 1, "returning to compact width must refresh in one frame");
  assert(
    !("deniaSidebarResizing" in open.root.dataset)
      && open.root.dataset.deniaSidebarArtwork === "wide",
    "a passive compact-width change must keep the previous scene without showing the drag mask",
  );
  assert(open.flushTimers() === 1, "the returned compact width must commit one artwork decision");
  assert(
    !("deniaSidebarResizing" in open.root.dataset)
      && open.root.dataset.deniaSidebarArtwork === "portrait",
    "the settled compact width must restore the portrait",
  );
  assert(open.flushAnimationFrames() === 1, "restored portrait selection must refresh diagnostics once");

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
  const rightOnlyNativeChildren = rightOnlyPanel.children.filter((child) =>
    !child.classList.contains("denia-old-days-ds-native-sidebar-art"));
  assert(
    rightOnlyNativeChildren.length === rightOnlyChildren.length
      && rightOnlyNativeChildren.every((child, index) => child === rightOnlyChildren[index]),
    "the visual surface must preserve every native right sidebar child and its order",
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
  assert(!leftHomeBrand, "a high-confidence left sidebar must remain free of the removed home brand");
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
  assert(!("deniaSidebarArtwork" in open.root.dataset), "cleanup must remove the settled sidebar artwork marker");
  assert(!("deniaSidebarResizing" in open.root.dataset), "cleanup must remove the sidebar resize mask marker");
  assert(!open.root.style.getPropertyValue("--denia-native-sidebar-width"), "cleanup must remove the native sidebar width snapshot");
  assert(!open.root.style.getPropertyValue("--denia-thread-content-width"), "cleanup must remove the thread content width snapshot");
  assert(!("deniaSidebarLayout" in open.root.dataset), "cleanup must remove the responsive sidebar layout marker");
  assert(!sidebarArt.isConnected, "cleanup must remove the owned sidebar visual surface");
  assert(open.resizeDisconnectCount() >= 1, "cleanup must disconnect the sidebar ResizeObserver");

  const closed = createRuntimeHarness((index) => `blob:sidebar-closed-${index + 1}`);
  appendTaskMain(closed);
  appendToggle(closed, { "aria-expanded": "false" });
  vm.runInContext(payload, closed.context, { timeout: 1000 });
  const closedState = closed.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar?.state;
  assert(closedState === "closed", "a visible sidebar toggle with no right-docked panel must resolve closed");

  const openingFocusArea = createRuntimeHarness((index) => `blob:sidebar-focus-area-${index + 1}`);
  appendTaskMain(openingFocusArea);
  const openingFocusToggle = appendToggle(openingFocusArea, { "aria-pressed": "false" });
  vm.runInContext(payload, openingFocusArea.context, { timeout: 1000 });
  openingFocusArea.clearMutationRecords();
  openingFocusToggle.setAttribute("aria-pressed", "true");
  const openingFocusPanel = openingFocusArea.document.createElement("aside");
  openingFocusPanel.setAttribute("data-app-shell-focus-area", "right-panel");
  openingFocusPanel.setRect({ x: 1512, y: 46, width: 0, height: 813 });
  let openingArtworkAtArtMount = "";
  const openingFocusPrepend = openingFocusPanel.prepend.bind(openingFocusPanel);
  openingFocusPanel.prepend = (...nodes) => {
    openingArtworkAtArtMount = openingFocusArea.root.dataset.deniaSidebarArtwork || "";
    openingFocusPrepend(...nodes);
  };
  const openingFocusList = openingFocusArea.document.createElement("ul");
  const openingFocusItem = openingFocusArea.document.createElement("li");
  const openingFocusRow = openingFocusArea.document.createElement("button");
  openingFocusRow.textContent = "浏览器";
  openingFocusRow.setRect({ x: 1512, y: 120, width: 0, height: 40 });
  openingFocusItem.append(openingFocusRow);
  openingFocusList.append(openingFocusItem);
  openingFocusPanel.append(openingFocusList);
  openingFocusArea.document.body.append(openingFocusPanel);
  assert(
    openingFocusArea.flushMutations() >= 2,
    "opening a focus-area sidebar must deliver its toggle and mount mutations together",
  );
  const openingFocusState =
    openingFocusArea.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.sidebar;
  assert(
    openingFocusState?.state === "open"
      && openingFocusState.confidence === "high"
      && openingFocusState.anchorKind === "focus-area",
    "the native right-panel focus area must identify an opening sidebar before geometry settles",
  );
  assert(
    openingFocusPanel.classList.contains("denia-old-days-ds-native-right-sidebar"),
    "the opening focus-area sidebar must receive its skin before the next animation frame",
  );
  assert(
    openingArtworkAtArtMount === "portrait",
    "the opening sidebar must choose its artwork before mounting transition-enabled layers",
  );
  assert(
    openingFocusRow.classList.contains("denia-old-days-ds-native-sidebar-row"),
    "a zero-width list shortcut must become transparent before the next animation frame",
  );
  assert(
    openingFocusArea.flushAnimationFrames() === 0,
    "zero-width shortcut decoration must not wait for a deferred frame",
  );
  openingFocusPanel.setRect({ x: 1192, y: 46, width: 320, height: 813 });
  openingFocusRow.setRect({ x: 1216, y: 120, width: 248, height: 40 });
  assert(
    openingFocusArea.flushResizeObservers(openingFocusPanel) === 1,
    "the native opening animation must notify the sidebar ResizeObserver",
  );
  assert(
    !("deniaSidebarResizing" in openingFocusArea.root.dataset)
      && openingFocusArea.root.dataset.deniaSidebarArtwork === "portrait",
    "the native opening animation must not be mistaken for a pointer resize",
  );
  assert(
    openingFocusArea.pendingTimerDelays().includes(120),
    "the opening animation must still settle its final artwork after geometry stabilizes",
  );

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
  const propertyNames = [
    "bright",
    "dark",
    "right-sidebar",
    "right-sidebar-wide",
    "task-warm",
    "task-approval",
    "task-error",
    "task-complete",
  ]
    .map((name) => `--denia-old-days-art-${name}`);
  const artworkKeys = "bright,dark,rightSidebar,rightSidebarWide,taskWarm,taskApproval,taskError,taskComplete";
  const successful = createRuntimeHarness((index) => `blob:denia-${index + 1}`);

  vm.runInContext(payload, successful.context, { timeout: 1000 });
  const firstState = successful.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const firstArtworkMaps = successful.freezeCalls.filter((value) =>
    Object.keys(value).join(",") === artworkKeys);
  assert(successful.created.length === 8, "runtime install must create eight artwork URLs");
  assert(firstArtworkMaps.length === 1 && Object.isFrozen(firstArtworkMaps[0]), "runtime must freeze the artwork URL map");
  assert(firstState?.artReady === true, "runtime artReady must be true when every artwork URL succeeds");
  assert(
    Number.isFinite(firstState?.metrics?.lastRefreshDurationMs)
      && firstState.metrics.lastRefreshDurationMs >= 0,
    "runtime metrics must expose the finite nonnegative duration of the latest runRefresh body",
  );
  assert(!publicStateContainsUrl(firstState), "runtime public state must not expose artwork URLs");
  assert(
    successful.events.filter((event) => propertyNames.some((property) => event.startsWith(`set:${property}:`))).length === 8,
    "runtime install must set exactly eight CSS artwork variables",
  );
  for (const [index, property] of propertyNames.entries()) {
    assert(successful.root.style.getPropertyValue(property) === `url("blob:denia-${index + 1}")`, `runtime install must set ${property}`);
  }

  const firstInstallEventCount = successful.events.length;
  vm.runInContext(payload, successful.context, { timeout: 1000 });
  const secondState = successful.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const secondArtworkMaps = successful.freezeCalls.filter((value) =>
    Object.keys(value).join(",") === artworkKeys);
  assert(successful.created.length === 16, "runtime reinstall must create eight replacement artwork URLs");
  assert(secondArtworkMaps.length === 2 && secondArtworkMaps.every(Object.isFrozen), "runtime reinstall must freeze its replacement artwork URL map");
  assert(successful.revoked.join(",") === "blob:denia-1,blob:denia-2,blob:denia-3,blob:denia-4,blob:denia-5,blob:denia-6,blob:denia-7,blob:denia-8", "runtime reinstall must revoke previous artwork URLs");
  const firstReplacementCreate = successful.events.indexOf("create:blob:denia-9");
  const reinstallCleanupEvents = successful.events.slice(firstInstallEventCount, firstReplacementCreate);
  assert(propertyNames.every((property) => reinstallCleanupEvents.filter((event) => event === `remove:${property}`).length === 1), "runtime reinstall must remove each previous CSS artwork variable before creating replacements");
  assert(
    reinstallCleanupEvents.filter((event) => event.startsWith("revoke:")).join(",")
      === "revoke:blob:denia-1,revoke:blob:denia-2,revoke:blob:denia-3,revoke:blob:denia-4,revoke:blob:denia-5,revoke:blob:denia-6,revoke:blob:denia-7,revoke:blob:denia-8",
    "runtime reinstall must clean previous artwork URLs before creating replacements",
  );
  assert(
    successful.events.filter((event) => propertyNames.some((property) => event.startsWith(`set:${property}:`))).length === 16,
    "runtime reinstall must set exactly eight replacement CSS artwork variables",
  );
  assert(secondState?.artReady === true && !publicStateContainsUrl(secondState), "runtime reinstall must retain ready state without exposing URLs");
  for (const [index, property] of propertyNames.entries()) {
    assert(successful.root.style.getPropertyValue(property) === `url("blob:denia-${index + 9}")`, `runtime reinstall must reset ${property}`);
  }

  const finalCleanupEventCount = successful.events.length;
  secondState.cleanup();
  const finalCleanupEvents = successful.events.slice(finalCleanupEventCount);
  assert(successful.revoked.join(",") === Array.from({ length: 16 }, (_value, index) => `blob:denia-${index + 1}`).join(","), "runtime cleanup must revoke current artwork URLs");
  assert(propertyNames.every((property) => finalCleanupEvents.filter((event) => event === `remove:${property}`).length === 1), "runtime cleanup must remove each current CSS artwork variable exactly once");
  assert(
    finalCleanupEvents.filter((event) => event.startsWith("revoke:")).join(",")
      === "revoke:blob:denia-9,revoke:blob:denia-10,revoke:blob:denia-11,revoke:blob:denia-12,revoke:blob:denia-13,revoke:blob:denia-14,revoke:blob:denia-15,revoke:blob:denia-16",
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
  const sidebarToggle = appendToggle("显示/隐藏侧边栏", false);

  vm.runInContext(payload, harness.context, { timeout: 1000 });
  const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const chrome = harness.document.getElementById("denia-old-days-ds-chrome");
  const rail = harness.document.getElementById("denia-old-days-ds-state-art");
  const initialArtGeneration = state.artGeneration;
  const initialCreatedNodes = state.metrics.createdNodes;

  assert(harness.root.dataset.deniaSummaryState === "open", "pressed summary toggle must expose an open summary state");
  assert(harness.root.dataset.deniaBottomPanelState === "closed", "unpressed bottom toggle must expose a closed bottom panel state");
  assert(harness.root.dataset.deniaWorkSurfaceState === "open", "open summary must expose horizontal work-surface occupancy");

  harness.clearMutationRecords();
  summaryToggle.setAttribute("aria-pressed", "false");
  assert(harness.flushMutations() === 1, "summary aria-pressed mutation must reach the observer");
  assert(harness.root.dataset.deniaSummaryState === "closed", "summary toggle state must synchronize before the next animation frame");
  assert(harness.root.dataset.deniaWorkSurfaceState === "closed", "closing the final right-side surface must restore task alignment");
  assert(harness.flushAnimationFrames() === 0, "summary toggle state must not schedule a full refresh");

  harness.clearMutationRecords();
  bottomToggle.setAttribute("aria-pressed", "true");
  assert(harness.flushMutations() === 1, "bottom panel aria-pressed mutation must reach the observer");
  assert(harness.root.dataset.deniaBottomPanelState === "open", "pressed bottom toggle must expose an open bottom panel state");
  assert(harness.root.dataset.deniaWorkSurfaceState === "closed", "bottom panel must not claim horizontal task space");
  assert(harness.flushAnimationFrames() === 0, "bottom panel toggle state must not schedule a full refresh");

  harness.clearMutationRecords();
  summaryToggle.setAttribute("aria-pressed", "true");
  assert(harness.flushMutations() === 1, "summary may open while the bottom panel remains open");
  assert(harness.root.dataset.deniaWorkSurfaceState === "open", "summary must claim horizontal task space while bottom panel stays open");

  harness.clearMutationRecords();
  summaryToggle.setAttribute("aria-pressed", "false");
  assert(harness.flushMutations() === 1, "summary may close while the bottom panel remains open");
  assert(harness.root.dataset.deniaBottomPanelState === "open", "summary close must preserve the bottom marker");
  assert(harness.root.dataset.deniaWorkSurfaceState === "closed", "bottom-only state must restore task alignment");

  harness.clearMutationRecords();
  sidebarToggle.setAttribute("aria-pressed", "true");
  assert(harness.flushMutations() === 1, "sidebar may open while the bottom panel remains open");
  assert(harness.root.dataset.deniaBottomPanelState === "open", "sidebar open must preserve the bottom marker");
  assert(harness.root.dataset.deniaWorkSurfaceState === "open", "obscuring sidebar must claim horizontal task space");

  harness.clearMutationRecords();
  sidebarToggle.setAttribute("aria-pressed", "false");
  assert(harness.flushMutations() === 1, "sidebar may close while the bottom panel remains open");
  assert(harness.root.dataset.deniaWorkSurfaceState === "closed", "bottom-only state must return after sidebar close");
  assert(state.artGeneration === initialArtGeneration, "panel toggles must not advance artwork generation");
  assert(state.metrics.createdNodes === initialCreatedNodes, "panel toggles must not create artwork nodes");
  assert(harness.document.getElementById("denia-old-days-ds-chrome") === chrome, "panel toggles must retain the same chrome node");
  assert(harness.document.getElementById("denia-old-days-ds-state-art") === rail, "panel toggles must retain the same artwork rail");

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
  const windowListeners = new Map();
  const mutationObservers = new Set();
  const resizeObservers = new Set();
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
      for (const observation of observer.observations) {
        if (!observation.options?.attributes) continue;
        if (target !== observation.target && !(observation.options.subtree && observation.target.contains(target))) continue;
        if (observation.options.attributeFilter && !observation.options.attributeFilter.includes(attributeName)) continue;
        observer.records.push({
          type: "attributes",
          target,
          attributeName,
          oldValue: observation.options.attributeOldValue ? oldValue ?? null : null,
        });
        break;
      }
    }
  }

  function recordChildListMutation(target, addedNodes = [], removedNodes = []) {
    for (const observer of mutationObservers) {
      for (const observation of observer.observations) {
        if (!observation.options?.childList) continue;
        if (target !== observation.target && !(observation.options.subtree && observation.target.contains(target))) continue;
        observer.records.push({ type: "childList", target, addedNodes, removedNodes });
        break;
      }
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
        this.observations = [];
        this.target = null;
        this.options = null;
        this.records = [];
        mutationObservers.add(this);
      }

      observe(target, options) {
        const existing = this.observations.find((observation) => observation.target === target);
        if (existing) existing.options = options;
        else this.observations.push({ target, options });
        this.target = target;
        this.options = options;
      }

      disconnect() {
        this.observations = [];
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
    ResizeObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.targets = new Set();
        this.disconnects = 0;
        resizeObservers.add(this);
      }

      observe(target) {
        this.targets.add(target);
      }

      unobserve(target) {
        this.targets.delete(target);
      }

      disconnect() {
        this.targets.clear();
        this.disconnects += 1;
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
    addEventListener(name, handler) {
      const handlers = windowListeners.get(name) || [];
      handlers.push(handler);
      windowListeners.set(name, handlers);
    },
    removeEventListener(name, handler) {
      windowListeners.set(
        name,
        (windowListeners.get(name) || []).filter((candidate) => candidate !== handler),
      );
    },
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
    observerCount() { return mutationObservers.size; },
    resizeObserverCount() { return resizeObservers.size; },
    resizeDisconnectCount() {
      return [...resizeObservers].reduce((total, observer) => total + observer.disconnects, 0);
    },
    flushResizeObservers(target) {
      let delivered = 0;
      for (const observer of resizeObservers) {
        if (!observer.targets.has(target)) continue;
        observer.callback([{ target, contentRect: target.getBoundingClientRect() }], observer);
        delivered += 1;
      }
      return delivered;
    },
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
        if (!records.length || !observer.observations.length) continue;
        delivered += records.length;
        observer.callback(records, observer);
      }
      return delivered;
    },
    flushMutations() {
      let delivered = 0;
      for (const observer of mutationObservers) {
        const records = observer.takeRecords();
        if (!records.length || !observer.observations.length) continue;
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
    dispatchWindowEvent(name, event = {}) {
      for (const handler of windowListeners.get(name) || []) {
        handler({ type: name, ...event });
      }
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
    chromeHostedByMain = true,
    decorateObservation = true,
    includeFinalCard = false,
    includeSidebarBrand = false,
    composerRect = { x: 100, y: 100, width: 320, height: 80 },
    hideNativeSuggestions = home,
    nativeHomeSuggestionCount = home ? 1 : 0,
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
    const homeVisuals = home ? makeNode(["denia-old-days-ds-home-visuals"], {}, { x: 0, y: 0, width: 1200, height: 800 }) : null;
    const hero = home ? makeNode(["denia-old-days-ds-hero"]) : null;
    const heroCopy = hero;
    const photoFront = home ? makeNode(["denia-old-days-ds-photo-front"]) : null;
    const nativeHomePrompt = home
      ? makeNode(["denia-old-days-ds-native-home-prompt"], {}, { x: 220, y: 420, width: 760, height: 112 })
      : null;
    const nativeHomeSuggestions = Array.from(
      { length: nativeHomeSuggestionCount },
      () => makeNode(["denia-old-days-ds-native-home-suggestions"]),
    );
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
      panel.contains = (node) => skinsContained
        && (nativeSidebarGroups.includes(node) || nativeSidebarRows.includes(node));
    }
    const body = makeNode();
    const main = makeNode(home ? ["dream-skin-home"] : [], {}, mainRect);
    main.scrollHeight = mainRect.height;
    main.clientHeight = mainRect.height;
    main.scrollTop = 0;
    chrome.parentElement = chromeHostedByMain ? main : body;
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
          return nativeSidebarPanels;
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
              "--denia-old-days-art-right-sidebar": 'url("blob:right-sidebar")',
              "--denia-old-days-art-right-sidebar-wide": 'url("blob:right-sidebar-wide")',
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
    runCase({ formState: "working", sidebarState: "open" }).taskPass === true,
    "live task verification must accept persistent artwork behind a valid open sidebar",
  );
  assert(
    runCase({ formState: "working", sidebarState: "open", railDisplay: "none" }).taskPass === false,
    "live task verification must reject hidden task artwork while the sidebar is open",
  );
  assert(
    runCase({ formState: "working", sidebarState: "unknown" }).taskPass === true,
    "live task verification must retain task artwork during uncertain sidebar transitions",
  );
  assert(
    runCase({ formState: "working", sidebarState: "unknown", railDisplay: "none" }).taskPass === false,
    "live task verification must reject hidden artwork during uncertain sidebar transitions",
  );
  assert(
    runCase({ formState: "working", chromeHostedByMain: false }).taskPass === false,
    "live task verification must reject task chrome outside the native main",
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
  const overlaySidebarResult = runCase({
    formState: "working",
    sidebarState: "open",
    mainRect: { x: 0, y: 46, width: 1200, height: 754 },
    nativeSidebarRect: { x: 880, y: 46, width: 320, height: 754 },
  });
  assert(
    overlaySidebarResult.sidebar.nativeGeometryPass === true && overlaySidebarResult.taskPass === true,
    "live task verification must accept a right-edge sidebar overlaying full-width native main",
  );
  const overwideOverlaySidebarResult = runCase({
    formState: "working",
    sidebarState: "open",
    mainRect: { x: 0, y: 46, width: 1200, height: 754 },
    nativeSidebarRect: { x: 400, y: 46, width: 800, height: 754 },
  });
  assert(
    overwideOverlaySidebarResult.sidebar.nativeGeometryPass === false
      && overwideOverlaySidebarResult.taskPass === false,
    "live task verification must reject an overwide right-edge overlay covering most of native main",
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
      nativeHomeSuggestionCount: 0,
    }).pass === true,
    "live verification must accept a home whose host renders no native suggestion cards",
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
      includeSidebarBrand: false,
    }).pass === true,
    "live verification must accept a home without the removed sidebar brand",
  );
  assert(
    runCase({
      formState: "staged",
      home: true,
      sidebarState: "open",
      railDisplay: "none",
      includeSidebarBrand: true,
    }).pass === false,
    "live verification must reject a stale sidebar brand marker",
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
    "denia-old-days-ds-settings-shell",
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

  harness.root.classList.add(
    "denia-old-days-ds-extension",
    "denia-old-days-ds-home",
    "denia-old-days-ds-task",
    "denia-old-days-ds-settings",
  );
  harness.root.dataset.deniaOldDaysExtensionVersion = "0.1.0";
  harness.root.dataset.deniaTheme = "dark";
  harness.root.dataset.deniaFormState = "working";
  harness.root.dataset.deniaSidebarState = "open";
  harness.root.dataset.deniaSidebarConfidence = "high";
  harness.root.dataset.deniaSidebarToggleState = "open";
  harness.root.dataset.deniaSidebarLayout = "workspace";
  harness.root.dataset.deniaSidebarArtwork = "wide";
  harness.root.dataset.deniaSidebarResizing = "true";
  harness.root.dataset.deniaSummaryState = "open";
  harness.root.dataset.deniaBottomPanelState = "open";
  harness.root.dataset.deniaWorkSurfaceState = "open";
  harness.root.style.setProperty("--denia-native-sidebar-width", "320px");
  harness.root.style.setProperty("--denia-thread-content-width", "1242px");
  const fallbackSidebarArt = harness.document.createElement("div");
  fallbackSidebarArt.classList.add("denia-old-days-ds-native-sidebar-art");
  harness.document.body.append(fallbackSidebarArt);
  const fallbackArtworkValues = new Map([
    ["bright", 'url("blob:fallback-bright")'],
    ["dark", "url(blob:fallback-dark)"],
    ["right-sidebar", "url(blob:fallback-sidebar)"],
    ["right-sidebar-wide", "url(blob:fallback-sidebar-wide)"],
    ["task-warm", "url(blob:fallback-bright)"],
    ["task-approval", "url(data:image/webp;base64,AA==)"],
    ["task-error", "url(https://example.invalid/error.webp)"],
    ["task-dark", "none"],
    ["task-complete", ""],
  ]);
  for (const [name, value] of fallbackArtworkValues) {
    if (value) harness.root.style.setProperty(`--denia-old-days-art-${name}`, value);
  }

  assert(vm.runInContext(expression, harness.context) === true, "fallback cleanup must report success");
  for (const className of [
    "denia-old-days-ds-extension",
    "denia-old-days-ds-home",
    "denia-old-days-ds-task",
    "denia-old-days-ds-settings",
  ]) {
    assert(!harness.root.classList.contains(className), `fallback cleanup must remove root class ${className}`);
  }
  assert(!("deniaOldDaysExtensionVersion" in harness.root.dataset), "fallback cleanup must remove the extension version marker");
  assert(!("deniaTheme" in harness.root.dataset), "fallback cleanup must remove the host theme marker");
  assert(!("deniaFormState" in harness.root.dataset), "fallback cleanup must remove the form state marker");
  assert(!("deniaSidebarState" in harness.root.dataset), "fallback cleanup must remove the sidebar state marker");
  assert(!("deniaSidebarConfidence" in harness.root.dataset), "fallback cleanup must remove the sidebar confidence marker");
  assert(!("deniaSidebarToggleState" in harness.root.dataset), "fallback cleanup must remove the sidebar toggle state marker");
  assert(!("deniaSidebarLayout" in harness.root.dataset), "fallback cleanup must remove the responsive sidebar layout marker");
  assert(!("deniaSidebarArtwork" in harness.root.dataset), "fallback cleanup must remove the settled sidebar artwork marker");
  assert(!("deniaSidebarResizing" in harness.root.dataset), "fallback cleanup must remove the sidebar resize mask marker");
  assert(!("deniaSummaryState" in harness.root.dataset), "fallback cleanup must remove the summary state marker");
  assert(!("deniaBottomPanelState" in harness.root.dataset), "fallback cleanup must remove the bottom panel state marker");
  assert(!("deniaWorkSurfaceState" in harness.root.dataset), "fallback cleanup must remove the work-surface state marker");
  assert(!harness.root.style.getPropertyValue("--denia-native-sidebar-width"), "fallback cleanup must remove the native sidebar width snapshot");
  assert(!harness.root.style.getPropertyValue("--denia-thread-content-width"), "fallback cleanup must remove the thread content width snapshot");
  for (const name of fallbackArtworkValues.keys()) {
    assert(!harness.root.style.getPropertyValue(`--denia-old-days-art-${name}`), `fallback cleanup must remove ${name} artwork CSS variable`);
  }
  assert(
    harness.revoked.join(",")
      === "blob:fallback-bright,blob:fallback-dark,blob:fallback-sidebar,blob:fallback-sidebar-wide",
    "fallback cleanup must revoke every unique blob artwork URL exactly once without revoking data or HTTP URLs",
  );
  assert(!fallbackSidebarArt.isConnected, "fallback cleanup must remove the owned responsive sidebar visual surface");
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

  for (const node of [nativePrompt, nativePromptBody, nativeHeading, nativeTitle]) {
    node.textContent = "我们该构建什么？";
  }
  harness.clearMutationRecords();
  inlineProjectButton.remove();
  assert(harness.flushMutations() > 0, "clearing the selected project must reach the observer");
  assert(harness.flushAnimationFrames() === 1, "clearing the selected project must schedule one home refresh");
  assert(
    nativePrompt.classList.contains("denia-old-days-ds-native-home-prompt")
      && nativePrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift") === "246px",
    "clearing the selected project must keep the generic Chinese home prompt aligned above the composer",
  );

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

function assertSettingsSurfaceLifecycle(payload) {
  const harness = createRuntimeHarness((index) => `blob:settings-${index + 1}`);
  harness.root.classList.add("electron-dark");

  const shell = harness.document.createElement("div");
  shell.classList.add("app-shell-left-panel");
  shell.setRect({ x: 0, y: 0, width: 245, height: 900 });
  const nav = harness.document.createElement("nav");
  nav.setAttribute("aria-label", "设置");
  nav.setRect({ x: 0, y: 46, width: 245, height: 854 });
  shell.append(nav);
  harness.document.body.append(shell);

  vm.runInContext(payload, harness.context, { timeout: 1000 });
  const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(state.surface === "settings", "settings navigation must select the settings surface");
  assert(harness.root.classList.contains("denia-old-days-ds-settings"));
  assert(!harness.root.classList.contains("denia-old-days-ds-home"));
  assert(!harness.root.classList.contains("denia-old-days-ds-task"));
  assert(shell.classList.contains("denia-old-days-ds-settings-shell"));
  assert(state.metrics.domainRuns.taskState === 0, "settings must not enter the task-state domain");
  assert(
    !harness.document.getElementById("denia-old-days-ds-chrome"),
    "settings must not mount task artwork chrome",
  );

  harness.clearMutationRecords();
  shell.remove();
  assert(harness.flushMutations() > 0);
  assert(
    harness.root.classList.contains("denia-old-days-ds-settings"),
    "an empty route handoff must retain the dark settings paint",
  );

  const main = harness.document.createElement("main");
  main.classList.add("main-surface");
  main.setRect({ x: 245, y: 0, width: 1195, height: 900 });
  const taskSidebar = harness.document.createElement("nav");
  taskSidebar.setRect({ x: 0, y: 0, width: 245, height: 900 });
  const assistant = harness.document.createElement("article");
  assistant.setAttribute("data-content-search-unit-key", "task:assistant");
  main.append(assistant);
  harness.document.body.append(taskSidebar);
  harness.document.body.append(main);
  assert(harness.flushMutations() > 0);
  assert(
    harness.root.classList.contains("denia-old-days-ds-task")
      && !harness.root.classList.contains("denia-old-days-ds-settings"),
    "a ready task surface must replace settings paint before the queued frame",
  );
  assert(
    taskSidebar.classList.contains("denia-old-days-ds-native-left-sidebar"),
    "the returning task sidebar must receive its dark paint marker before the queued frame",
  );

  state.cleanup();
  assert(!harness.root.classList.contains("denia-old-days-ds-settings"));
  assert(!shell.classList.contains("denia-old-days-ds-settings-shell"));
}

function assertHostThemeLifecycle(payload) {
  const install = (classes = []) => {
    const harness = createRuntimeHarness((index) => `blob:theme-${index + 1}`);
    harness.root.classList.add(...classes);
    vm.runInContext(payload, harness.context, { timeout: 1000 });
    return harness;
  };

  const light = install(["electron-light"]);
  assert(light.root.dataset.deniaTheme === "light", "electron-light must map to data-denia-theme=light on install");
  light.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.cleanup();
  assert(!light.root.dataset.deniaTheme, "cleanup must remove data-denia-theme");

  const dark = install(["electron-dark"]);
  const state = dark.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(dark.root.dataset.deniaTheme === "dark", "electron-dark must map to data-denia-theme=dark on install");
  const observerCount = dark.observerCount();
  const artUrlCount = dark.created.length;
  const createdNodes = state.metrics.createdNodes;
  const domains = { ...state.metrics.domainRuns };
  dark.clearMutationRecords();
  dark.root.classList.remove("electron-dark");
  dark.root.classList.add("electron-light");
  assert(dark.flushMutations() > 0, "root electron class changes must reach the existing observer");
  assert(dark.root.dataset.deniaTheme === "light", "valid root class changes must synchronize before a refresh frame");
  assert(dark.observerCount() === observerCount, "theme changes must not construct another observer");
  assert(dark.created.length === artUrlCount, "theme-only mutations must not recreate artwork URLs");
  assert(state.metrics.createdNodes === createdNodes, "theme-only mutations must not create owned nodes");
  assert(Object.keys(domains).every((key) => state.metrics.domainRuns[key] === domains[key]), "theme-only mutations must not enter route or task refresh domains");

  dark.clearMutationRecords();
  const nonThemeDomains = { ...state.metrics.domainRuns };
  dark.root.classList.add("native-root-shell-state");
  assert(dark.flushMutations() > 0, "root non-theme class changes must reach the existing observer");
  assert(dark.root.dataset.deniaTheme === "light", "root non-theme class changes must not alter the remembered theme");
  assert(dark.flushAnimationFrames() === 1, "root non-theme class changes must retain native semantic refresh scheduling");
  assert(
    state.metrics.domainRuns.route > nonThemeDomains.route,
    "root non-theme class changes must retain the existing route refresh domain",
  );

  dark.clearMutationRecords();
  const mixedDomains = { ...state.metrics.domainRuns };
  const mixedOldValue = dark.root.getAttribute("class");
  const mixedClasses = new Set(mixedOldValue.split(/\s+/u).filter(Boolean));
  mixedClasses.delete("electron-light");
  mixedClasses.add("electron-dark");
  mixedClasses.add("native-root-mixed-state");
  dark.root.className = [...mixedClasses].join(" ");
  assert(
    dark.deliverMutationRecords([{
      type: "attributes",
      target: dark.root,
      attributeName: "class",
      oldValue: mixedOldValue,
    }]) === 1,
    "the observer harness must deliver a single mixed root class record",
  );
  assert(dark.root.dataset.deniaTheme === "dark", "mixed root class changes must synchronize the host theme immediately");
  assert(dark.flushAnimationFrames() === 1, "mixed root class changes must retain native semantic refresh scheduling");
  assert(
    state.metrics.domainRuns.route > mixedDomains.route,
    "mixed root class changes must retain the existing route refresh domain",
  );

  dark.clearMutationRecords();
  dark.root.classList.remove("electron-dark");
  dark.root.classList.add("electron-light");
  assert(dark.flushMutations() > 0 && dark.root.dataset.deniaTheme === "light", "a pure theme change must restore light after mixed root class work");
  dark.clearMutationRecords();
  dark.root.classList.remove("electron-light");
  assert(dark.flushMutations() > 0 && dark.root.dataset.deniaTheme === "light", "missing root classes must preserve the latest valid theme");
  dark.root.classList.add("electron-dark", "electron-light");
  assert(dark.flushMutations() > 0 && dark.root.dataset.deniaTheme === "light", "conflicting root classes must preserve the latest valid theme");
  state.cleanup();

  const unknown = install();
  assert(unknown.root.dataset.deniaTheme === "light", "an unknown initial host theme must fall back to light");
  unknown.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.cleanup();
}

function assertThemeHeroCopy(payload) {
  const harness = createRuntimeHarness((index) => `blob:theme-copy-${index + 1}`);
  harness.root.classList.add("electron-light");
  const main = harness.document.createElement("main");
  main.setAttribute("role", "main");
  main.classList.add("dream-skin-home");
  const nativeHeading = harness.document.createElement("span");
  nativeHeading.textContent = "What should we build in denia-old-days-codex-theme?";
  const inlineProjectButton = harness.document.createElement("button");
  inlineProjectButton.textContent = "denia-old-days-codex-theme";
  nativeHeading.append(inlineProjectButton);
  const prompt = harness.document.createElement("div");
  prompt.append(nativeHeading);
  const composer = harness.document.createElement("form");
  composer.classList.add("composer-surface-chrome");
  const textarea = harness.document.createElement("textarea");
  textarea.placeholder = "Ask anything";
  textarea.value = "preserved draft";
  composer.append(textarea);
  const suggestion = harness.document.createElement("button");
  suggestion.textContent = "Explore code";
  main.append(prompt, composer, suggestion);
  harness.document.body.append(main);
  vm.runInContext(payload, harness.context, { timeout: 1000 });
  assert(harness.document.querySelector(".denia-old-days-ds-eyebrow")?.textContent === "DENIA · OLD DAYS IN COLOR", "light Hero must retain the approved eyebrow");
  assert(harness.document.getElementById("denia-old-days-ds-headline")?.textContent === "今天要把什么写进手账？", "light Hero must retain the approved headline");
  assert(harness.document.querySelector(".denia-old-days-ds-status")?.textContent === "布景之形 · 记录中", "light Hero must retain the approved status");
  const hero = harness.document.getElementById("denia-old-days-ds-hero-copy");
  harness.clearMutationRecords();
  harness.root.classList.remove("electron-light");
  harness.root.classList.add("electron-dark");
  harness.flushMutations();
  assert(harness.document.getElementById("denia-old-days-ds-hero-copy") === hero, "theme switching must update Hero copy without recreating the Hero");
  assert(harness.document.querySelector(".denia-old-days-ds-eyebrow")?.textContent === "DENIA · OLD DAYS AFTERGLOW", "dark Hero must use the approved eyebrow");
  assert(harness.document.getElementById("denia-old-days-ds-headline")?.textContent === "今晚，要让哪段思绪显影？", "dark Hero must use the approved headline");
  assert(harness.document.querySelector(".denia-old-days-ds-status")?.textContent === "幻灭之形 · 观察中", "dark Hero must use the approved status");
  assert(nativeHeading.textContent === "What should we build in denia-old-days-codex-theme?" && nativeHeading.contains(inlineProjectButton), "theme copy must preserve the native heading and inline project button");
  assert(textarea.placeholder === "Ask anything" && textarea.value === "preserved draft", "theme copy must preserve textarea state");
  assert(suggestion.textContent === "Explore code", "theme copy must preserve suggestion text");
  harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__.cleanup();
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

function assertTaskChromeHostLifecycle(payload) {
  const artPropertyForFamily = (family) => ({
    taskWarm: "--denia-old-days-art-task-warm",
    taskApproval: "--denia-old-days-art-task-approval",
    taskError: "--denia-old-days-art-task-error",
    taskComplete: "--denia-old-days-art-task-complete",
  })[family];
  const harness = createRuntimeHarness((index) => `blob:chrome-host-${index + 1}`);
  const firstMain = harness.document.createElement("main");
  firstMain.setAttribute("role", "main");
  harness.document.body.append(firstMain);
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
  const sidebarToggle = appendToggle("显示/隐藏侧边栏", false);
  vm.runInContext(payload, harness.context, { timeout: 1000 });

  const state = harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const chrome = harness.document.getElementById("denia-old-days-ds-chrome");
  const rail = harness.document.getElementById("denia-old-days-ds-state-art");
  const activeLayer = rail.querySelector(".denia-old-days-ds-state-art-layer.is-active");
  const activeFamily = activeLayer?.dataset.deniaArtFamily;
  const activeFamilyProperty = artPropertyForFamily(activeFamily);
  const activeObjectUrl = harness.root.style.getPropertyValue(activeFamilyProperty);
  const artGeneration = state.artGeneration;
  const createdNodes = state.metrics.createdNodes;

  assert(chrome?.parentElement === firstMain, "task chrome must mount inside the current main");
  state.refresh();
  assert(harness.document.getElementById("denia-old-days-ds-chrome") === chrome, "repeat refresh must reuse task chrome");
  assert(state.metrics.createdNodes === createdNodes, "repeat refresh must not create task chrome nodes");

  firstMain.remove();
  state.refresh();

  assert(!harness.document.body.contains(chrome), "task chrome must stay detached while no semantic main exists");
  assert(!harness.document.getElementById("denia-old-days-ds-chrome"), "detached task chrome must not remain discoverable in the document");
  assert(!harness.document.getElementById("denia-old-days-ds-state-art"), "detached artwork rail must not remain discoverable in the document");
  assert(state.metrics.createdNodes === createdNodes, "main replacement gap must not create another chrome");
  assert(state.artGeneration === artGeneration, "main replacement gap must preserve artwork generation");
  assert(chrome.querySelector("#denia-old-days-ds-state-art") === rail, "main replacement gap must retain rail identity inside detached chrome");
  assert(
    rail.querySelector(".denia-old-days-ds-state-art-layer.is-active") === activeLayer,
    "main replacement gap must retain the active artwork layer",
  );
  assert(activeLayer.dataset.deniaArtFamily === activeFamily, "main replacement gap must preserve the active artwork family");
  assert(
    harness.root.style.getPropertyValue(activeFamilyProperty) === activeObjectUrl,
    "main replacement gap must preserve the active family root CSS custom property/object URL",
  );

  const replacementMain = harness.document.createElement("main");
  replacementMain.setAttribute("role", "main");
  harness.document.body.append(replacementMain);
  state.refresh();

  assert(chrome.parentElement === replacementMain, "replacement main must adopt the existing task chrome");
  assert(harness.document.getElementById("denia-old-days-ds-chrome") === chrome, "main replacement must retain chrome identity");
  assert(harness.document.getElementById("denia-old-days-ds-state-art") === rail, "main replacement must retain rail identity");
  assert(state.metrics.createdNodes === createdNodes, "main replacement must not create another chrome");
  assert(state.artGeneration === artGeneration, "main replacement must preserve artwork generation");
  assert(
    rail.querySelector(".denia-old-days-ds-state-art-layer.is-active") === activeLayer,
    "main replacement must preserve the active artwork layer",
  );
  assert(activeLayer.dataset.deniaArtFamily === activeFamily, "main replacement must preserve the active artwork family");
  assert(
    harness.root.style.getPropertyValue(activeFamilyProperty) === activeObjectUrl,
    "main replacement must preserve the active family root CSS custom property/object URL",
  );

  const approval = harness.document.createElement("div");
  approval.setAttribute("data-state", "approval");
  replacementMain.append(approval);
  state.refresh();
  const approvalLayer = rail.querySelector(".denia-old-days-ds-state-art-layer.is-active");
  assert(
    approvalLayer?.dataset.deniaArtFamily === "taskApproval",
    "task state must update artwork while summary covers the rail",
  );

  approval.remove();
  const error = harness.document.createElement("div");
  error.setAttribute("data-state", "error");
  replacementMain.append(error);
  state.refresh();
  assert(
    rail.querySelector(".denia-old-days-ds-state-art-layer.is-active")?.dataset.deniaArtFamily === "taskError",
    "covered artwork must continue updating into the error family",
  );

  error.remove();
  const assistant = harness.document.createElement("article");
  assistant.setAttribute("data-content-search-unit-key", "task:assistant");
  replacementMain.append(assistant);
  state.refresh();
  const coveredLayer = rail.querySelector(".denia-old-days-ds-state-art-layer.is-active");
  assert(
    coveredLayer?.dataset.deniaArtFamily === "taskComplete",
    "covered artwork must continue updating into the complete family",
  );
  const coveredFamilyProperty = artPropertyForFamily(coveredLayer.dataset.deniaArtFamily);
  const coveredArtwork = {
    generation: state.artGeneration,
    createdNodes: state.metrics.createdNodes,
    objectUrl: harness.root.style.getPropertyValue(coveredFamilyProperty),
    chrome,
    rail,
    layer: coveredLayer,
  };
  assert(coveredArtwork.objectUrl, "active complete artwork must retain its root CSS custom property/object URL");

  const assertPersistentArtwork = (panel) => {
    assert(state.artGeneration === coveredArtwork.generation, `${panel} toggle must not recreate the current artwork generation`);
    assert(state.metrics.createdNodes === coveredArtwork.createdNodes, `${panel} toggle must not create artwork nodes`);
    assert(harness.root.style.getPropertyValue(coveredFamilyProperty) === coveredArtwork.objectUrl, `${panel} toggle must retain the active family root CSS custom property/object URL`);
    assert(harness.document.getElementById("denia-old-days-ds-chrome") === coveredArtwork.chrome, `${panel} toggle must retain chrome identity`);
    assert(harness.document.getElementById("denia-old-days-ds-state-art") === coveredArtwork.rail, `${panel} toggle must retain rail identity`);
    assert(
      rail.querySelector(".denia-old-days-ds-state-art-layer.is-active") === coveredArtwork.layer,
      `${panel} toggle must retain the active complete artwork layer`,
    );
  };
  const togglePanel = (toggle, pressed, panel) => {
    harness.clearMutationRecords();
    toggle.setAttribute("aria-pressed", pressed ? "true" : "false");
    assert(harness.flushMutations() === 1, `${panel} ${pressed ? "open" : "close"} must synchronize after covered artwork changes`);
    assertPersistentArtwork(`${panel} ${pressed ? "open" : "close"}`);
  };

  togglePanel(summaryToggle, false, "summary");
  togglePanel(summaryToggle, true, "summary");
  togglePanel(bottomToggle, true, "bottom panel");
  togglePanel(bottomToggle, false, "bottom panel");
  togglePanel(sidebarToggle, true, "right sidebar");
  togglePanel(sidebarToggle, false, "right sidebar");

  state.cleanup();
  assert(!chrome.isConnected, "cleanup must remove chrome nested in task main");

  const pending = createRuntimeHarness((index) => `blob:pending-main-${index + 1}`);
  vm.runInContext(payload, pending.context, { timeout: 1000 });
  const pendingState = pending.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  const pendingChrome = [...pendingState.ownedNodes]
    .find((node) => node.id === "denia-old-days-ds-chrome");
  const pendingRail = pendingChrome?.querySelector("#denia-old-days-ds-state-art");
  const pendingLayer = pendingRail?.querySelector(".denia-old-days-ds-state-art-layer.is-active");
  const pendingFamilyProperty = artPropertyForFamily(pendingLayer?.dataset.deniaArtFamily);
  const pendingArtwork = {
    generation: pendingState.artGeneration,
    createdNodes: pendingState.metrics.createdNodes,
    objectUrl: pending.root.style.getPropertyValue(pendingFamilyProperty),
  };

  assert(pendingChrome && pendingRail && pendingLayer, "task initialization without main must prepare one detached artwork chrome");
  assert(!pending.document.body.contains(pendingChrome), "task initialization without main must not mount artwork on body");
  assert(!pending.document.getElementById("denia-old-days-ds-chrome"), "task initialization without main must keep artwork out of the document");

  const pendingMain = pending.document.createElement("main");
  pendingMain.setAttribute("role", "main");
  pending.document.body.append(pendingMain);
  pendingState.refresh();

  assert(pendingChrome.parentElement === pendingMain, "first semantic main must adopt the detached task chrome");
  assert(pending.document.getElementById("denia-old-days-ds-chrome") === pendingChrome, "first semantic main must retain pending chrome identity");
  assert(pending.document.getElementById("denia-old-days-ds-state-art") === pendingRail, "first semantic main must retain pending rail identity");
  assert(pendingRail.querySelector(".denia-old-days-ds-state-art-layer.is-active") === pendingLayer, "first semantic main must retain pending layer identity");
  assert(pendingState.metrics.createdNodes === pendingArtwork.createdNodes, "first semantic main must not create another chrome");
  assert(pendingState.artGeneration === pendingArtwork.generation, "first semantic main must preserve pending artwork generation");
  assert(
    pending.root.style.getPropertyValue(pendingFamilyProperty) === pendingArtwork.objectUrl,
    "first semantic main must preserve the pending family root CSS custom property/object URL",
  );
  pendingState.cleanup();
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
  firstAssistant.setAttribute("data-content-search-unit-key", "first-turn:assistant");
  const latestAssistant = harness.document.createElement("div");
  latestAssistant.setAttribute("data-content-search-unit-key", "latest-turn:assistant");
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

  const virtualized = createRuntimeHarness((index) => `blob:virtualized-final-card-${index + 1}`);
  const virtualMain = virtualized.document.createElement("main");
  virtualMain.setAttribute("role", "main");
  const virtualScroll = virtualized.document.createElement("div");
  virtualScroll.classList.add("thread-scroll-container");
  virtualScroll.scrollTop = 0;
  const historicalAssistant = virtualized.document.createElement("div");
  historicalAssistant.setAttribute("data-content-search-unit-key", "historical-turn:assistant");
  const actualLatestAssistant = virtualized.document.createElement("div");
  actualLatestAssistant.setAttribute("data-content-search-unit-key", "actual-latest-turn:assistant");
  virtualScroll.append(historicalAssistant, actualLatestAssistant);
  virtualMain.append(virtualScroll);
  virtualized.document.body.append(virtualMain);
  vm.runInContext(payload, virtualized.context, { timeout: 1000 });
  const virtualizedState = virtualized.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(
    actualLatestAssistant.classList.contains("denia-old-days-ds-final-card"),
    "the latest assistant at the thread edge must start as the final card",
  );

  virtualized.clearMutationRecords();
  virtualScroll.scrollTop = -1000;
  actualLatestAssistant.remove();
  assert(virtualized.flushMutations() === 1, "virtualizing the latest assistant must produce one child-list mutation");
  assert(virtualized.flushAnimationFrames() === 1, "virtualizing the latest assistant must schedule one refresh");
  assert(
    !historicalAssistant.classList.contains("denia-old-days-ds-final-card"),
    "a historical assistant must not become the final card when the virtual window leaves the latest thread edge",
  );
  virtualizedState.cleanup();
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
  homeHarness.root.classList.add("electron-dark");
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
  assert(!homeHarness.document.getElementById("denia-old-days-ds-sidebar-brand"));

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
  assert(!homeHarness.document.getElementById("denia-old-days-ds-sidebar-brand"), "home left-sidebar remounts must not restore the removed brand");

  homeHarness.clearMutationRecords();
  homeMain.classList.remove("dream-skin-home");
  homeMain.style.setProperty("min-height", "100%");
  const assistant = homeHarness.document.createElement("article");
  assistant.setAttribute("data-content-search-unit-key", "turn:assistant");
  homeMain.append(assistant);
  assert(homeHarness.flushMutations() > 0, "home-to-task transition mutations must reach the observer");
  assert(
    !homeHarness.document.getElementById("denia-old-days-ds-home-visuals")
      && !homeHarness.document.getElementById("denia-old-days-ds-hero-copy"),
    "home-to-task transitions must remove the fixed hero before trailing native style work",
  );
  assert(
    !homeHarness.root.classList.contains("denia-old-days-ds-home")
      && homeHarness.root.classList.contains("denia-old-days-ds-task"),
    "home-to-task transitions must activate the task skin when the fixed hero is removed",
  );
  assert(homeHarness.flushAnimationFrames() === 0, "mixed route and native style work must keep the full refresh trailing");
  assert(homeHarness.pendingTimerCount() === 1, "mixed home-to-task work must retain one trailing timer");
  assert(homeHarness.flushTimers() === 1, "the mixed home-to-task timer must fire once");
  assert(homeHarness.flushAnimationFrames() === 1, "the trailing home-to-task refresh must schedule one frame");
  assert(homeState.homeActive === false);
  assert(!replacementPrompt.classList.contains("denia-old-days-ds-native-home-prompt"));
  assert(!replacementPrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift"));
  assert(!initialSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"));

  homeHarness.clearMutationRecords();
  assistant.remove();
  assert(homeHarness.flushMutations() > 0, "task-to-home prompt mutations must reach the observer");
  assert(
    !homeHarness.root.classList.contains("denia-old-days-ds-home")
      && homeHarness.root.classList.contains("denia-old-days-ds-task"),
    "a home prompt must not activate home paint before the native home shell is ready",
  );
  assert(
    replacementPrompt.classList.contains("denia-old-days-ds-native-home-prompt"),
    "a prompt-first task-to-home transition must hide the native title until the home shell is ready",
  );
  assert(homeState.homeActive === false, "a prompt-only transition must retain task route state until refresh");

  homeHarness.clearMutationRecords();
  homeMain.classList.add("dream-skin-home");
  assert(homeHarness.flushMutations() > 0, "task-to-home shell mutations must reach the observer");
  assert(
    homeHarness.root.classList.contains("denia-old-days-ds-home")
      && !homeHarness.root.classList.contains("denia-old-days-ds-task"),
    "task-to-home transitions must activate the home paint before the scheduled route refresh",
  );
  assert(
    initialSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"),
    "dark task-to-home transitions must hide native suggestion cards before the scheduled route refresh",
  );
  assert(
    replacementPrompt.classList.contains("denia-old-days-ds-native-home-prompt")
      && replacementPrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift") === "246px",
    "dark task-to-home transitions must align the native title before the scheduled route refresh",
  );
  assert(homeState.homeActive === false, "early task-to-home paint must not bypass the scheduled route-state refresh");
  assert(homeHarness.flushAnimationFrames() === 1, "task-to-home transitions must retain one route refresh frame");
  assert(homeState.homeActive === true);
  assert(replacementPrompt.classList.contains("denia-old-days-ds-native-home-prompt"));
  assert(replacementPrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift") === "246px");
  assert(initialSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"));
  homeState.cleanup();
  assert(!replacementPrompt.classList.contains("denia-old-days-ds-native-home-prompt"));
  assert(!replacementPrompt.style.getPropertyValue("--denia-old-days-native-prompt-shift"));
  assert(!initialSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"));
  void replacementComposerBoundary;

  const shellFirstHarness = createRuntimeHarness((index) => `blob:final-shell-first-${index + 1}`);
  shellFirstHarness.root.classList.add("electron-dark");
  const shellFirstMain = shellFirstHarness.document.createElement("main");
  shellFirstMain.setAttribute("role", "main");
  const shellFirstAssistant = shellFirstHarness.document.createElement("article");
  shellFirstAssistant.setAttribute("data-content-search-unit-key", "turn:assistant");
  shellFirstMain.append(shellFirstAssistant);
  shellFirstHarness.document.body.append(shellFirstMain);
  vm.runInContext(payload, shellFirstHarness.context, { timeout: 1000 });
  const shellFirstState = shellFirstHarness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(shellFirstState.homeActive === false);
  shellFirstHarness.clearMutationRecords();
  shellFirstMain.classList.add("dream-skin-home-shell");
  shellFirstAssistant.remove();
  assert(shellFirstHarness.flushMutations() > 0, "shell-first task-to-home mutations must reach the observer");
  assert(
    shellFirstHarness.root.classList.contains("denia-old-days-ds-home")
      && !shellFirstHarness.root.classList.contains("denia-old-days-ds-task"),
    "a dark native home shell must activate home paint before its prompt mounts",
  );
  assert(shellFirstState.homeActive === false, "shell-first paint must preserve the scheduled route refresh");
  assert(shellFirstHarness.flushAnimationFrames() === 1, "shell-first transitions must retain one route refresh frame");
  assert(shellFirstState.homeActive === true);
  shellFirstHarness.clearMutationRecords();
  const lateDarkSuggestions = appendHomeSuggestions(shellFirstHarness, shellFirstMain);
  assert(shellFirstHarness.flushMutations() > 0, "late dark suggestion cards must reach the observer");
  assert(
    lateDarkSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"),
    "late dark suggestion cards must be hidden in their mount callback instead of the next frame",
  );
  shellFirstState.cleanup();

  const lightTransitionHarness = createRuntimeHarness((index) => `blob:final-light-transition-${index + 1}`);
  lightTransitionHarness.root.classList.add("electron-light");
  const lightTransitionMain = lightTransitionHarness.document.createElement("main");
  lightTransitionMain.setAttribute("role", "main");
  const lightTransitionAssistant = lightTransitionHarness.document.createElement("article");
  lightTransitionAssistant.setAttribute("data-content-search-unit-key", "turn:assistant");
  const lightTransitionSuggestions = appendHomeSuggestions(lightTransitionHarness, lightTransitionMain);
  lightTransitionMain.append(lightTransitionAssistant);
  lightTransitionHarness.document.body.append(lightTransitionMain);
  vm.runInContext(payload, lightTransitionHarness.context, { timeout: 1000 });
  const lightTransitionState =
    lightTransitionHarness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  lightTransitionHarness.clearMutationRecords();
  lightTransitionMain.classList.add("dream-skin-home-shell");
  lightTransitionAssistant.remove();
  assert(lightTransitionHarness.flushMutations() > 0, "light task-to-home mutations must reach the observer");
  assert(
    !lightTransitionHarness.root.classList.contains("denia-old-days-ds-home")
      && lightTransitionHarness.root.classList.contains("denia-old-days-ds-task"),
    "light transitions must wait for the scheduled route refresh instead of using the dark paint bridge",
  );
  assert(
    !lightTransitionSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"),
    "light transitions must not receive the dark suggestion-card paint bridge",
  );
  assert(lightTransitionState.homeActive === false);
  assert(lightTransitionHarness.flushAnimationFrames() === 1, "light transitions must retain one route refresh frame");
  assert(lightTransitionState.homeActive === true);
  assert(lightTransitionSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"));
  lightTransitionHarness.clearMutationRecords();
  lightTransitionSuggestions.remove();
  const lateLightSuggestions = appendHomeSuggestions(lightTransitionHarness, lightTransitionMain);
  assert(lightTransitionHarness.flushMutations() > 0, "late light suggestion cards must reach the observer");
  assert(
    !lateLightSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"),
    "late light suggestion cards must retain the existing scheduled home refresh",
  );
  assert(lightTransitionHarness.flushAnimationFrames() === 1);
  assert(lateLightSuggestions.classList.contains("denia-old-days-ds-native-home-suggestions"));
  lightTransitionState.cleanup();

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
    const variablePattern = new RegExp(
      `${variable.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?![a-z0-9_-])`,
      "iu",
    );
    let occurrences = 0;
    for (const rule of rules) {
      for (const [property, value] of rule.declarations) {
        if (!variablePattern.test(value)) continue;
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
