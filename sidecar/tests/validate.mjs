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
assert(manifest.protocol?.minimumDreamSkinVersion === "1.1.2", "minimum Dream Skin version must be 1.1.2");
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
assertRuntimeArtworkLifecycle(runtimePayload);
assertPublicStateUrlCollectionCoverage();
assertLiveVerificationArtworkTarget(loader);
assertLiveTaskVerification(loader);
assertFallbackCleanupBehavior(loader);
assertSuggestionDeckLifecycle(runtimePayload);
assertFormStateRecognition(runtimePayload);
assertStateArtRailLifecycle(runtimePayload);

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

for (const token of [
  "ensureSidebarBrand",
  "ensureHomeHero",
  "ensureSuggestionDeck",
  "ensureStateArt",
  "syncStateArt",
  "decorateComposer",
  "decorateTask",
  "deriveFormState",
  "scheduleRefresh",
  "requestAnimationFrame",
  "MutationObserver",
  "prefers-reduced-motion",
  "transitionend",
  "cleanup",
]) assert(runtime.includes(token), `runtime missing ${token}`);

assert((runtime.match(/new MutationObserver\s*\(/gu) || []).length === 1, "runtime must create exactly one MutationObserver");
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
assert(runtime.includes("denia-old-days-ds-state-bubble"), "chrome must use a bubble state mark");
assert(!runtime.includes("denia-old-days-ds-star"), "runtime must retire the star state mark");
assert(!runtime.includes("denia-old-days-ds-tape"), "P2 polaroid must not use generic tape");
assert(runtime.includes("data-content-search-unit-key"), "runtime must mark completed assistant units");
assert(!runtime.includes("fetch("), "injected runtime must not make network requests");

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
  "prefers-reduced-transparency: reduce",
]) assert(activeStyles.includes(token), `stylesheet missing ${token}`);

const stylesheetRules = parseCssRules(cssSyntax);
assertCssScannerCoverage();
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero", {
  "grid-template-columns": "minmax(340px, .85fr) minmax(460px, 1.15fr)",
  "column-gap": "clamp(34px, 4.5vw, 64px)",
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
  inset: "0 0 0 auto",
  width: "var(--denia-state-rail-width)",
  overflow: "hidden",
  isolation: "isolate",
  "pointer-events": "none",
  "border-inline-start": "1px solid rgba(89, 132, 145, .14)",
  "mask-image": "linear-gradient(90deg, transparent 0, #000 42px)",
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
for (const selector of [".denia-old-days-ds-task [role=\"main\"]", ".denia-old-days-ds-task main"]) {
  assertCssDeclarations(stylesheetRules, selector, { position: "relative", "z-index": "3" });
}
const taskLayoutProperties = /^(?:width|min-width|max-width|margin(?:-.+)?|padding(?:-.+)?|grid(?:-.+)?|flex(?:-.+)?)$/u;
for (const rule of stylesheetRules) {
  if (!rule.selectors.some((selector) => selector.includes(".denia-old-days-ds-task"))) continue;
  for (const property of rule.declarations.keys()) {
    assert(!taskLayoutProperties.test(property), `task stylesheet must not override native layout property ${property}`);
  }
}
assert(
  /const home = isHomeView\(\);[\s\S]*?if \(home\) \{\s*ensureSidebarBrand\(\);[\s\S]*?\} else \{\s*removeSidebarBrand\(\);/u.test(runtime),
  "sidebar brand must be created only on home and removed on task routes",
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
assertCssDeclarations(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="working"] .denia-old-days-ds-state-bubble',
  { "border-color": "var(--denia-crystal)", background: "rgba(17, 22, 47, .18)" },
);
assertCssDeclarations(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="approval"] .denia-old-days-ds-state-bubble',
  { "border-color": "var(--denia-violet)", background: "rgba(117, 86, 217, .26)" },
);
assertCssDeclarations(
  stylesheetRules,
  '.denia-old-days-ds-extension[data-denia-form-state="error"] .denia-old-days-ds-state-bubble',
  { "border-color": "var(--denia-fracture)", background: "rgba(228, 90, 168, .32)" },
);
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

const transparencyMedia = ["prefers-reduced-transparency: reduce"];
for (const [selector, background] of [
  [".denia-old-days-ds-hero", "#f9ffff"],
  [".denia-old-days-ds-card-deck button", "#f9ffff"],
  [".denia-old-days-ds-composer", "#f9ffff !important"],
  [".denia-old-days-ds-final-card", "#fffdf1 !important"],
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

function createRuntimeHarness(createObjectUrl) {
  const created = [];
  const revoked = [];
  const events = [];
  const freezeCalls = [];

  class FakeStyle {
    constructor() {
      this.values = new Map();
    }

    setProperty(name, value) {
      this.values.set(name, value);
      events.push(`set:${name}:${value}`);
    }

    removeProperty(name) {
      this.values.delete(name);
      events.push(`remove:${name}`);
    }

    getPropertyValue(name) {
      return this.values.get(name) || "";
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
      this.owner.className = [...values].join(" ");
    }
  }

  class FakeElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.id = "";
      this.className = "";
      this.classList = new FakeClassList(this);
      this.attributes = new Map();
      this.dataset = {};
      this.style = new FakeStyle();
      this.children = [];
      this.parentElement = null;
      this.isConnected = false;
      this.textContent = "";
      this.innerHTML = "";
      this.listeners = new Map();
      this.disabled = false;
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
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
      this.parentElement = null;
      this.isConnected = false;
    }

    setAttribute(name, value) {
      const stringValue = String(value);
      this.attributes.set(name, stringValue);
      if (name === "id") this.id = stringValue;
      if (name === "class") this.className = stringValue;
      if (name.startsWith("data-")) this.dataset[dataAttributeKey(name)] = stringValue;
    }

    getAttribute(name) {
      if (name === "id") return this.id || null;
      if (name === "class") return this.className || null;
      if (name.startsWith("data-")) return this.dataset[dataAttributeKey(name)] || null;
      return this.attributes.get(name) || null;
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
    getBoundingClientRect() { return { x: 0, y: 0, width: 120, height: 36 }; }

    #attach(node, index) {
      node.remove();
      node.parentElement = this;
      node.isConnected = true;
      this.children.splice(index, 0, node);
    }
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
    elementFromPoint: () => null,
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
      for (const attribute of source.matchAll(/\[([^\]=*^$~|]+)(?:([*$]?=)["']?([^\]"']*)["']?)?\]/gu)) {
        const actual = attributeValue(node, attribute[1]);
        if (!attribute[2] && actual == null) return false;
        if (attribute[2] === "=" && actual !== attribute[3]) return false;
        if (attribute[2] === "*=" && !String(actual || "").includes(attribute[3])) return false;
        if (attribute[2] === "$=" && !String(actual || "").endsWith(attribute[3])) return false;
      }
      return true;
    });
  }
  const sandbox = {
    Blob,
    HTMLElement: FakeElement,
    MutationObserver: class {
      observe() {}
      disconnect() {}
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
    cancelAnimationFrame: () => {},
    console,
    decodeURIComponent,
    document,
    getComputedStyle: (node) => ({
      backgroundImage: node?.computedBackgroundImage || "none",
      display: node?.computedDisplay || "block",
      opacity: node?.computedOpacity || "1",
      visibility: node?.computedVisibility || "visible",
      getPropertyValue: (name) => node?.style?.getPropertyValue(name) || "",
    }),
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame: () => 1,
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.window.matchMedia = sandbox.matchMedia;
  const context = vm.createContext(sandbox);
  sandbox.captureFreeze = (value) => freezeCalls.push(value);
  vm.runInContext("globalThis.originalFreeze = Object.freeze; Object.freeze = (value) => { captureFreeze(value); return originalFreeze(value); };", context);
  return { context, sandbox, root: documentElement, document, FakeElement, created, revoked, events, freezeCalls };
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

  const makeNode = (classes = [], dataset = {}) => ({
    classList: { contains: (name) => classes.includes(name) },
    contains: () => false,
    dataset,
    querySelector: () => null,
    getBoundingClientRect: () => ({ x: 100, y: 100, width: 320, height: 80 }),
  });

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
    decorateObservation = true,
    includeFinalCard = false,
    includeSidebarBrand = false,
  }) => {
    const rootClasses = ["denia-old-days-ds-extension", "denia-old-days-ds-task"];
    const root = {
      classList: { contains: (name) => rootClasses.includes(name) },
      clientWidth: 1200,
      dataset: { deniaFormState: formState },
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
    const composer = makeNode();
    const nativeObservation = makeNode();
    const observation = decorateObservation ? makeNode(["denia-old-days-ds-observation"]) : null;
    const assistant = makeNode(includeFinalCard ? ["denia-old-days-ds-final-card"] : []);
    const finalCard = includeFinalCard ? assistant : null;
    const document = {
      documentElement: root,
      elementFromPoint: () => null,
      getElementById(id) {
        if (id === "denia-old-days-dream-skin-extension-style") return style;
        if (id === "denia-old-days-ds-chrome") return chrome;
        if (id === "denia-old-days-ds-state-art") return stateArtRail;
        if (id === "denia-old-days-ds-sidebar-brand") return includeSidebarBrand ? sidebar : null;
        return null;
      },
      querySelector(selector) {
        if (selector === ".composer-surface-chrome") return composer;
        if (selector === ".denia-old-days-ds-observation") return observation;
        if (selector === ".denia-old-days-ds-final-card") return finalCard;
        return null;
      },
      querySelectorAll(selector) {
        if (selector.includes('[data-content-search-unit-key*="tool"]')) return [nativeObservation];
        if (selector === ".denia-old-days-ds-observation") return observation ? [observation] : [];
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
    "live task verification must accept a visible warm working rail",
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
    "denia-old-days-ds-hero-copy",
    "denia-old-days-ds-hero-badge",
    "denia-old-days-ds-stage-pass",
    "denia-old-days-ds-custom-card",
    "denia-old-days-ds-card-deck",
    "denia-old-days-ds-state-art",
  ];
  for (const id of ownedIds) {
    const node = harness.document.createElement("div");
    node.id = id;
    harness.document.body.append(node);
  }

  const removableClasses = [
    "denia-old-days-ds-native-card",
    "denia-old-days-ds-native-suggestions",
    "denia-old-days-ds-composer",
    "denia-old-days-ds-send",
    "denia-old-days-ds-attachment",
    "denia-old-days-ds-observation",
    "denia-old-days-ds-final-card",
  ];
  const touched = removableClasses.map((className) => {
    const node = harness.document.createElement("div");
    node.classList.add(className);
    node.dataset.deniaObservationLabel = "观察记录";
    node.dataset.deniaOldDaysCard = "0";
    harness.document.body.append(node);
    return node;
  });

  const hero = harness.document.createElement("div");
  hero.classList.add("denia-old-days-ds-hero");
  for (const property of ["background-image", "background-position", "background-size", "background-repeat", "background-color"]) {
    hero.style.setProperty(property, "legacy");
  }
  harness.document.body.append(hero);

  harness.root.classList.add("denia-old-days-ds-extension", "denia-old-days-ds-home", "denia-old-days-ds-task");
  harness.root.dataset.deniaOldDaysExtensionVersion = "0.1.0";
  harness.root.dataset.deniaFormState = "working";
  for (const name of ["bright", "task-warm", "task-approval", "task-error", "task-complete"]) {
    harness.root.style.setProperty(`--denia-old-days-art-${name}`, `url(blob:${name})`);
  }

  assert(vm.runInContext(expression, harness.context) === true, "fallback cleanup must report success");
  for (const className of ["denia-old-days-ds-extension", "denia-old-days-ds-home", "denia-old-days-ds-task"]) {
    assert(!harness.root.classList.contains(className), `fallback cleanup must remove root class ${className}`);
  }
  assert(!("deniaOldDaysExtensionVersion" in harness.root.dataset), "fallback cleanup must remove the extension version marker");
  assert(!("deniaFormState" in harness.root.dataset), "fallback cleanup must remove the form state marker");
  for (const name of ["bright", "task-warm", "task-approval", "task-error", "task-complete"]) {
    assert(!harness.root.style.getPropertyValue(`--denia-old-days-art-${name}`), `fallback cleanup must remove ${name} artwork CSS variable`);
  }
  for (const id of ownedIds) assert(!harness.document.getElementById(id), `fallback cleanup must remove owned node ${id}`);
  removableClasses.forEach((className, index) => {
    assert(!touched[index].classList.contains(className), `fallback cleanup must remove touched class ${className}`);
    assert(!("deniaObservationLabel" in touched[index].dataset), `fallback cleanup must remove observation data from ${className}`);
    assert(!("deniaOldDaysCard" in touched[index].dataset), `fallback cleanup must remove card data from ${className}`);
  });
  for (const property of ["background-image", "background-position", "background-size", "background-repeat", "background-color"]) {
    assert(!hero.style.getPropertyValue(property), `fallback cleanup must remove legacy hero ${property}`);
  }
}

function assertSuggestionDeckLifecycle(payload) {
  const labels = ["Explore code", "Build feature", "Review changes", "Fix bug"];

  const makeHarness = (initialLabels) => {
    const harness = createRuntimeHarness((index) => `blob:suggestion-${index + 1}`);
    const main = harness.document.createElement("main");
    main.setAttribute("role", "main");
    main.classList.add("dream-skin-home");
    harness.document.body.append(main);
    let nativeContainer = null;
    const remount = (nextLabels) => {
      nativeContainer?.remove();
      nativeContainer = harness.document.createElement("div");
      nativeContainer.className = "native-actions";
      main.append(nativeContainer);
      const buttons = nextLabels.map((label) => {
        const button = harness.document.createElement("button");
        button.textContent = label;
        button.clickCount = 0;
        button.addEventListener("click", () => { button.clickCount += 1; });
        nativeContainer.append(button);
        return button;
      });
      return buttons;
    };
    const buttons = remount(initialLabels);
    return { harness, main, remount, buttons, nativeContainer: () => nativeContainer };
  };

  const short = makeHarness(labels.slice(0, 3));
  vm.runInContext(payload, short.harness.context, { timeout: 1000 });
  assert(!short.harness.document.getElementById("denia-old-days-ds-card-deck"), "suggestion deck must not be created for only three native actions");
  assert(!short.nativeContainer().classList.contains("denia-old-days-ds-native-suggestions"), "three native actions must remain visible and undecorated");

  const complete = makeHarness(labels);
  vm.runInContext(payload, complete.harness.context, { timeout: 1000 });
  const state = complete.harness.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  let deck = complete.harness.document.getElementById("denia-old-days-ds-card-deck");
  assert(deck?.querySelectorAll("button[data-denia-old-days-card]").length === 4, "suggestion deck must proxy all four native actions");

  const reordered = complete.remount([labels[3], labels[0], labels[2], labels[1]]);
  state.refresh();
  deck = complete.harness.document.getElementById("denia-old-days-ds-card-deck");
  const proxyButtons = deck.querySelectorAll("button[data-denia-old-days-card]");
  const semanticTargets = [reordered[1], reordered[3], reordered[2], reordered[0]];
  ["Explore", "Build", "Review", "Fix"].forEach((action, index) => {
    proxyButtons[index].click();
    assert(semanticTargets[index].clickCount === 1, `${action} proxy must bind to its semantic native action after reorder`);
  });

  reordered[3].disabled = true;
  state.refresh();
  const refreshedProxies = deck.querySelectorAll("button[data-denia-old-days-card]");
  assert(refreshedProxies[1].disabled, "Build proxy disabled state must follow the semantic Build action after reorder");
  assert([refreshedProxies[0], refreshedProxies[2], refreshedProxies[3]].every((button) => !button.disabled), "other proxies must remain enabled when only Build is disabled");

  const incompleteCategories = makeHarness([labels[0], "Understand project", labels[2], labels[3]]);
  vm.runInContext(payload, incompleteCategories.harness.context, { timeout: 1000 });
  assert(!incompleteCategories.harness.document.getElementById("denia-old-days-ds-card-deck"), "suggestion deck requires one native action from each semantic category");

  const dropped = complete.remount(labels.slice(0, 3));
  state.refresh();
  assert(!complete.harness.document.getElementById("denia-old-days-ds-card-deck"), "suggestion deck must be removed when native action count drops below four");
  assert(!complete.nativeContainer().classList.contains("denia-old-days-ds-native-suggestions"), "native action container must be restored after count drop");
  assert(dropped.every((button) => !button.classList.contains("denia-old-days-ds-native-card")), "native action buttons must be restored after count drop");
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
