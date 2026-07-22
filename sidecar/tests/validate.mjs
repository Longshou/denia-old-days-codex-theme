import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(process.argv[2] || path.join(import.meta.dirname, ".."));
const realRoot = await fs.realpath(root);

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
  stateArtwork: "assets/denia-old-days-dark.webp",
  portraitFallback: "assets/denia-old-days-portrait.webp",
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

const [loader, styles, runtime, ...scripts] = await Promise.all([
  readRequired("runtime/loader.mjs"),
  readRequired(manifest.entrypoints.style),
  readRequired(manifest.entrypoints.runtime),
  ...["common.sh", "install.sh", "start.sh", "status.sh", "stop.sh", "uninstall.sh", "verify.sh"]
    .map((name) => readRequired(`scripts/${name}`)),
]);

const runtimeTokens = [
  "__DENIA_OLD_DAYS_EXTENSION_MANIFEST_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_CSS_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_BRIGHT_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_DARK_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_PORTRAIT_ART_JSON__",
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

assert(loader.includes("127.0.0.1"), "loader must bind to loopback");
assert(!loader.includes("0.0.0.0"), "loader must not use a wildcard host");
assert(loader.includes("Target.setDiscoverTargets"), "loader must subscribe to target discovery");
assert(loader.includes("__DENIA_OLD_DAYS_EXTENSION_CSS_JSON__"), "loader must inject CSS token");
assert(loader.includes("__DENIA_OLD_DAYS_EXTENSION_MANIFEST_JSON__"), "loader must inject manifest token");
for (const token of [
  "__DENIA_OLD_DAYS_EXTENSION_BRIGHT_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_DARK_ART_JSON__",
  "__DENIA_OLD_DAYS_EXTENSION_PORTRAIT_ART_JSON__",
]) assert(loader.includes(token), `loader missing ${token}`);
for (const assetKey of Object.keys(expectedAssets)) {
  assert(loader.includes(`manifest.assets.${assetKey}`), `loader must resolve ${assetKey}`);
}
assert(loader.includes("--denia-old-days-art-bright"), "live verification must read bright artwork variable");

for (const token of [
  "ensureSidebarBrand",
  "ensureHomeHero",
  "ensureSuggestionDeck",
  "decorateComposer",
  "decorateTask",
  "deriveFormState",
  "scheduleRefresh",
  "requestAnimationFrame",
  "MutationObserver",
  "prefers-reduced-motion",
  "cleanup",
]) assert(runtime.includes(token), `runtime missing ${token}`);

assert((runtime.match(/new MutationObserver\s*\(/gu) || []).length === 1, "runtime must create exactly one MutationObserver");
assert(!runtime.includes("setInterval("), "runtime must not use setInterval");
assert(runtime.includes("URL.revokeObjectURL"), "runtime cleanup must revoke object URL");
assert(runtime.includes("Object.freeze({"), "runtime must freeze artwork URL map");
assert(runtime.includes("Object.values(artUrls).every(Boolean)"), "runtime must require every artwork URL");
assert(runtime.includes("Object.values(artUrls)"), "runtime must clean every artwork URL");
for (const name of ["bright", "dark", "portrait"]) {
  assert(runtime.includes(`--denia-old-days-art-${name}`), `runtime missing ${name} artwork variable`);
}
assert(!runtime.includes("denia-old-days-ds-photo-back"), "home hero must not include generic photo-back markup");
assert(!runtime.includes("denia-old-days-ds-bubble"), "fixed chrome must not retain empty decorative bubble markup");
assert(runtime.includes("data-content-search-unit-key"), "runtime must mark completed assistant units");
assert(!runtime.includes("fetch("), "injected runtime must not make network requests");

for (const color of ["#EAF7F7", "#8FD2DD", "#F4AFC5", "#6FB8E7", "#F7D88A", "#263548", "#11162F", "#7556D9", "#E45AA8", "#C5415D"]) {
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
  "--denia-old-days-art-portrait",
  ".denia-old-days-ds-photo-front",
  ".denia-old-days-ds-task .denia-old-days-ds-chrome::after",
  "prefers-reduced-transparency: reduce",
]) assert(activeStyles.includes(token), `stylesheet missing ${token}`);

const stylesheetRules = parseCssRules(cssSyntax);
assertCssScannerCoverage();
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-hero", {
  "grid-template-columns": "minmax(340px, .9fr) minmax(430px, 1.1fr)",
  "column-gap": "clamp(32px, 4vw, 58px)",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", {
  position: "relative",
  isolation: "isolate",
  "align-self": "center",
  width: "min(100%, 610px)",
  "aspect-ratio": "16 / 10",
  "min-height": "0",
  margin: "0",
  padding: "18px 18px 52px",
  "border-radius": "8px",
  background: "#fffef8",
  "box-shadow": "0 22px 44px rgba(38, 53, 72, .14)",
  transform: "rotate(-1.2deg)",
  "pointer-events": "none",
});
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo-front", {
  position: "absolute",
  inset: "18px 18px 52px",
  "border-radius": "4px",
  background: "var(--denia-old-days-art-bright) center / cover no-repeat",
});
assertArtworkVariableWhitelist(stylesheetRules, new Map([
  ["--denia-old-days-art-bright", {
    selector: ".denia-old-days-ds-photo-front",
    property: "background",
    atRuleFragments: [],
  }],
  ["--denia-old-days-art-portrait", {
    selector: ".denia-old-days-ds-photo-front",
    property: "background",
    atRuleFragments: ["max-width: 1199px", "max-height: 759px"],
  }],
  ["--denia-old-days-art-dark", {
    selector: ".denia-old-days-ds-task .denia-old-days-ds-chrome::after",
    property: "background",
    atRuleFragments: [],
  }],
]));
assert(
  !stylesheetRules.some((rule) => rule.selectors.some((selector) => selector.includes(":hover") && selector.includes("denia-old-days-ds-photo"))),
  "home photo must not use hover flip selectors",
);
assert(
  !stylesheetRules.some((rule) => rule.selectors.some((selector) => selector.includes("denia-old-days-ds-bubble"))),
  "large decorative bubbles must be removed",
);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-tape", {
  top: "auto",
  bottom: "12px",
  "z-index": "2",
});

const taskRailSelector = ".denia-old-days-ds-task .denia-old-days-ds-chrome::after";
assertCssDeclarations(stylesheetRules, taskRailSelector, {
  content: '""',
  position: "absolute",
  inset: "0 0 0 auto",
  width: "min(12vw, 180px)",
  "pointer-events": "none",
  opacity: "0",
  transform: "translateX(24%)",
  transition: "opacity 320ms ease, transform 320ms ease",
});
const taskRail = findCssRule(stylesheetRules, taskRailSelector);
assert(
  canonicalCssValue(taskRail.declarations.get("background")).includes(canonicalCssValue("var(--denia-old-days-art-dark) 18% center / auto 100% no-repeat")),
  "task rail must render the dark artwork outside the reading column",
);
for (const selector of [".denia-old-days-ds-task [role=\"main\"]", ".denia-old-days-ds-task main"]) {
  assertCssDeclarations(stylesheetRules, selector, { position: "relative", "z-index": "3" });
}
for (const [state, opacity] of [["working", ".12"], ["approval", ".18"], ["error", ".28"]]) {
  assertCssDeclarations(
    stylesheetRules,
    `.denia-old-days-ds-extension[data-denia-form-state="${state}"] .denia-old-days-ds-chrome::after`,
    { opacity, transform: "none" },
  );
}
for (const state of ["staged", "complete"]) {
  assertCssDeclarations(
    stylesheetRules,
    `.denia-old-days-ds-extension[data-denia-form-state="${state}"] .denia-old-days-ds-chrome::after`,
    { opacity: "0" },
  );
}

const compactMedia = ["max-width: 1199px", "max-height: 759px"];
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", {
  display: "block",
  "aspect-ratio": "3 / 4",
}, compactMedia);
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo-front", {
  background: "var(--denia-old-days-art-portrait) center bottom / contain no-repeat",
}, compactMedia);
const narrowMedia = ["max-width: 919px"];
assertCssDeclarations(stylesheetRules, ".denia-old-days-ds-photo", { display: "none" }, narrowMedia);
assertCssDeclarations(stylesheetRules, taskRailSelector, { display: "none" }, narrowMedia);
assertCssCascadeDeclarations(stylesheetRules, ".denia-old-days-ds-hero", {
  "grid-template-columns": "1fr",
  "column-gap": "0",
}, narrowMedia);
const compactPhotoRule = findCssRule(stylesheetRules, ".denia-old-days-ds-photo", compactMedia);
const narrowPhotoRule = findCssRule(stylesheetRules, ".denia-old-days-ds-photo", narrowMedia);
const compactHeroRule = findCssRule(stylesheetRules, ".denia-old-days-ds-hero", compactMedia);
const narrowHeroGridRule = stylesheetRules.find((rule) =>
  rule.selectors.includes(".denia-old-days-ds-hero")
    && rule.declarations.has("grid-template-columns")
    && narrowMedia.every((fragment) => rule.atRules.some((atRule) => atRule.includes(fragment))));
assert(
  narrowHeroGridRule
    && narrowHeroGridRule.sourceIndex > compactHeroRule.sourceIndex
    && narrowPhotoRule.sourceIndex > compactPhotoRule.sourceIndex,
  "narrow breakpoint must follow compact breakpoint so hidden artwork and the single-column hero win the cascade",
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
      prefix: "denia-validator-css-portrait-host-",
      target: "  .denia-old-days-ds-photo-front {\n    inset: 12px 12px 32px;",
      replacement: "  .denia-old-days-ds-photo-front,\n  article {\n    inset: 12px 12px 32px;",
      name: "compact portrait selector",
      expected: "artwork variable --denia-old-days-art-portrait must stay on its approved selector",
      failure: "validator must reject compact portrait artwork added to an article through a combined selector",
    },
    {
      prefix: "denia-validator-css-dark-host-",
      target: ".denia-old-days-ds-task .denia-old-days-ds-chrome::after {\n  content: \"\";",
      replacement: ".denia-old-days-ds-task .denia-old-days-ds-chrome::after,\nmain {\n  content: \"\";",
      name: "dark artwork selector",
      expected: "artwork variable --denia-old-days-art-dark must stay on its approved selector",
      failure: "validator must reject dark artwork added to main through a combined selector",
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
  const propertyNames = ["bright", "dark", "portrait"].map((name) => `--denia-old-days-art-${name}`);
  const successful = createRuntimeHarness((index) => `blob:denia-${index + 1}`);

  vm.runInContext(payload, successful.context, { timeout: 1000 });
  const firstState = successful.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(successful.created.length === 3, "runtime install must create three artwork URLs");
  assert(successful.freezeCalls.length === 1 && Object.isFrozen(successful.freezeCalls[0]), "runtime must freeze the artwork URL map");
  assert(Object.keys(successful.freezeCalls[0]).join(",") === "bright,dark,portrait", "runtime artwork URL map must contain all states");
  assert(firstState?.artReady === true, "runtime artReady must be true when every artwork URL succeeds");
  assert(!publicStateContainsUrl(firstState), "runtime public state must not expose artwork URLs");
  assert(successful.events.filter((event) => event.startsWith("set:")).length === 3, "runtime install must set exactly three CSS artwork variables");
  for (const [index, property] of propertyNames.entries()) {
    assert(successful.root.style.getPropertyValue(property) === `url("blob:denia-${index + 1}")`, `runtime install must set ${property}`);
  }

  const firstInstallEventCount = successful.events.length;
  vm.runInContext(payload, successful.context, { timeout: 1000 });
  const secondState = successful.sandbox.window.__DENIA_OLD_DAYS_DREAM_SKIN_EXTENSION__;
  assert(successful.created.length === 6, "runtime reinstall must create three replacement artwork URLs");
  assert(successful.freezeCalls.length === 2 && Object.isFrozen(successful.freezeCalls[1]), "runtime reinstall must freeze its replacement artwork URL map");
  assert(successful.revoked.join(",") === "blob:denia-1,blob:denia-2,blob:denia-3", "runtime reinstall must revoke previous artwork URLs");
  const firstReplacementCreate = successful.events.indexOf("create:blob:denia-4");
  const reinstallCleanupEvents = successful.events.slice(firstInstallEventCount, firstReplacementCreate);
  assert(propertyNames.every((property) => reinstallCleanupEvents.filter((event) => event === `remove:${property}`).length === 1), "runtime reinstall must remove each previous CSS artwork variable before creating replacements");
  assert(reinstallCleanupEvents.filter((event) => event.startsWith("revoke:")).join(",") === "revoke:blob:denia-1,revoke:blob:denia-2,revoke:blob:denia-3", "runtime reinstall must clean previous artwork URLs before creating replacements");
  assert(successful.events.filter((event) => event.startsWith("set:")).length === 6, "runtime reinstall must set exactly three replacement CSS artwork variables");
  assert(secondState?.artReady === true && !publicStateContainsUrl(secondState), "runtime reinstall must retain ready state without exposing URLs");
  for (const [index, property] of propertyNames.entries()) {
    assert(successful.root.style.getPropertyValue(property) === `url("blob:denia-${index + 4}")`, `runtime reinstall must reset ${property}`);
  }

  const finalCleanupEventCount = successful.events.length;
  secondState.cleanup();
  const finalCleanupEvents = successful.events.slice(finalCleanupEventCount);
  assert(successful.revoked.join(",") === [1, 2, 3, 4, 5, 6].map((number) => `blob:denia-${number}`).join(","), "runtime cleanup must revoke current artwork URLs");
  assert(propertyNames.every((property) => finalCleanupEvents.filter((event) => event === `remove:${property}`).length === 1), "runtime cleanup must remove each current CSS artwork variable exactly once");
  assert(finalCleanupEvents.filter((event) => event.startsWith("revoke:")).join(",") === "revoke:blob:denia-4,revoke:blob:denia-5,revoke:blob:denia-6", "runtime cleanup must revoke each current artwork URL exactly once");
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
    constructor() {
      this.values = new Set();
    }

    add(...names) {
      names.forEach((name) => this.values.add(name));
    }

    remove(...names) {
      names.forEach((name) => this.values.delete(name));
    }

    toggle(name, force) {
      if (force) this.values.add(name);
      else this.values.delete(name);
      return Boolean(force);
    }

    contains(name) {
      return this.values.has(name);
    }
  }

  class FakeElement {
    constructor(tagName = "div") {
      this.tagName = tagName.toUpperCase();
      this.id = "";
      this.className = "";
      this.classList = new FakeClassList();
      this.dataset = {};
      this.style = new FakeStyle();
      this.children = [];
      this.parentElement = null;
      this.isConnected = false;
      this.textContent = "";
      this.innerHTML = "";
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
      this.parentElement?.insertBefore(node, null);
    }

    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
      this.parentElement = null;
      this.isConnected = false;
    }

    setAttribute(name, value) {
      this[name] = String(value);
    }

    getAttribute(name) {
      return this[name] || null;
    }

    addEventListener() {}
    removeEventListener() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
    closest() { return null; }
    matches() { return false; }
    getBoundingClientRect() { return { width: 0, height: 0 }; }

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
    querySelector: () => null,
    querySelectorAll: () => [],
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
    getComputedStyle: () => ({ display: "none", visibility: "hidden" }),
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
  return { context, sandbox, root: documentElement, created, revoked, events, freezeCalls };
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

function scanCssSyntax(source) {
  const characters = [...source];
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
