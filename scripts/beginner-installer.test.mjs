import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const installScript = path.join(root, "installer/install-macos.sh");
const uninstallScript = path.join(root, "installer/uninstall-macos.sh");
const upstreamReleaseUrl = "https://github.com/Fei-Away/Codex-Dream-Skin/releases/latest";

const writeExecutable = async (filePath, source) => {
  await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
  await fsPromises.writeFile(filePath, source, { mode: 0o700 });
};

const writeTheme = async (directory, id) => {
  await fsPromises.mkdir(directory, { recursive: true });
  await fsPromises.writeFile(
    path.join(directory, "theme.json"),
    `${JSON.stringify({ schemaVersion: 1, id, version: "1.0.0", name: id, image: "background.jpg" }, null, 2)}\n`,
  );
  await fsPromises.writeFile(path.join(directory, "background.jpg"), "fake-image");
};

const makeFakeEngine = async (temporary, dreamState) => {
  const engine = path.join(temporary, "engine");
  await writeExecutable(path.join(engine, "scripts/switch-theme-macos.sh"), `#!/bin/bash
set -euo pipefail
theme_id=""
while [ "$#" -gt 0 ]; do
  case "$1" in --id) theme_id="$2"; shift 2 ;; *) shift ;; esac
done
state="\${DENIA_DREAM_SKIN_STATE_ROOT:?}"
/bin/mkdir -p "$state/theme"
/usr/bin/ditto "$state/themes/$theme_id" "$state/theme"
/usr/bin/printf '%s\\n' "$theme_id" >> "$state/switch.log"
`);
  await writeExecutable(path.join(engine, "scripts/pause-dream-skin-macos.sh"), `#!/bin/bash
set -euo pipefail
/usr/bin/printf 'paused\\n' >> "\${DENIA_DREAM_SKIN_STATE_ROOT:?}/switch.log"
`);
  await fsPromises.mkdir(dreamState, { recursive: true });
  return engine;
};

const makeFakeSidecarSource = async (temporary) => {
  const source = path.join(temporary, "fake-sidecar");
  const template = path.join(source, "package-template");
  const scripts = path.join(template, "scripts");
  await fsPromises.mkdir(scripts, { recursive: true });
  await fsPromises.writeFile(path.join(template, "extension.json"), '{"id":"denia-old-days"}\n');
  await writeExecutable(path.join(scripts, "start.sh"), `#!/bin/bash
set -euo pipefail
[ "\${FAKE_SIDECAR_START_FAIL:-0}" != "1" ] || exit 9
/usr/bin/touch "\${DENIA_OLD_DAYS_DS_STATE_ROOT:?}/running"
`);
  await writeExecutable(path.join(scripts, "status.sh"), `#!/bin/bash
if [ -f "\${DENIA_OLD_DAYS_DS_STATE_ROOT:?}/running" ]; then
  /usr/bin/printf 'running=true\\n'
else
  /usr/bin/printf 'running=false\\n'
fi
`);
  await writeExecutable(path.join(scripts, "stop.sh"), `#!/bin/bash
/bin/rm -f "\${DENIA_OLD_DAYS_DS_STATE_ROOT:?}/running"
`);
  await writeExecutable(path.join(scripts, "health.sh"), `#!/bin/bash
[ "\${FAKE_SIDECAR_HEALTH_FAIL:-0}" != "1" ]
`);
  await writeExecutable(path.join(scripts, "uninstall.sh"), `#!/bin/bash
set -euo pipefail
state="\${DENIA_OLD_DAYS_DS_STATE_ROOT:?}"
/usr/bin/find "$state" -mindepth 1 -delete
/bin/rmdir "$state" 2>/dev/null || true
`);
  await writeExecutable(path.join(source, "scripts/install.sh"), `#!/bin/bash
set -euo pipefail
[ "\${FAKE_SIDECAR_INSTALL_FAIL:-0}" != "1" ] || exit 8
state="\${DENIA_OLD_DAYS_DS_STATE_ROOT:?}"
/bin/mkdir -p "$state"
/usr/bin/ditto "$(cd "$(dirname "$0")/.." && pwd -P)/package-template" "$state/package"
`);
  return source;
};

const runInstaller = (script, args, environment) => spawnSync("/bin/bash", [script, ...args], {
  cwd: root,
  encoding: "utf8",
  env: {
    ...process.env,
    DENIA_ALLOW_NON_MACOS: "1",
    DENIA_NO_OPEN: "1",
    ...environment,
  },
});

test("missing Dream Skin engine produces one actionable prerequisite", async (context) => {
  assert.ok(fs.existsSync(installScript), "installer/install-macos.sh must exist");
  const temporary = await fsPromises.mkdtemp(path.join(os.tmpdir(), "denia-installer-missing-"));
  context.after(() => fsPromises.rm(temporary, { recursive: true, force: true }));

  const result = runInstaller(installScript, ["--check"], {
    DENIA_DREAM_SKIN_ENGINE_ROOT: path.join(temporary, "missing-engine"),
    DENIA_DREAM_SKIN_STATE_ROOT: path.join(temporary, "state"),
    DENIA_OLD_DAYS_INSTALL_STATE_ROOT: path.join(temporary, "installer-state"),
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /Codex Dream Skin/u);
  assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(upstreamReleaseUrl.replaceAll("/", "\\/"), "u"));
});

test("check mode validates a ready fake engine without changing it", async (context) => {
  assert.ok(fs.existsSync(installScript), "installer/install-macos.sh must exist");
  assert.ok(fs.existsSync(uninstallScript), "installer/uninstall-macos.sh must exist");
  const temporary = await fsPromises.mkdtemp(path.join(os.tmpdir(), "denia-installer-ready-"));
  context.after(() => fsPromises.rm(temporary, { recursive: true, force: true }));

  const engine = path.join(temporary, "engine");
  const state = path.join(temporary, "state");
  const installerState = path.join(temporary, "installer-state");
  await fsPromises.mkdir(path.join(engine, "scripts"), { recursive: true });
  await fsPromises.mkdir(state, { recursive: true });
  const switchScript = path.join(engine, "scripts/switch-theme-macos.sh");
  await fsPromises.writeFile(switchScript, "#!/bin/bash\nexit 0\n", { mode: 0o700 });
  await fsPromises.writeFile(
    path.join(engine, "scripts/pause-dream-skin-macos.sh"),
    "#!/bin/bash\nexit 0\n",
    { mode: 0o700 },
  );

  const environment = {
    DENIA_DREAM_SKIN_ENGINE_ROOT: engine,
    DENIA_DREAM_SKIN_STATE_ROOT: state,
    DENIA_OLD_DAYS_INSTALL_STATE_ROOT: installerState,
  };
  const installResult = runInstaller(installScript, ["--check"], environment);
  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);
  assert.match(installResult.stdout, /检查通过/u);
  assert.equal(fs.existsSync(path.join(state, "themes/denia-old-days")), false);

  const uninstallResult = runInstaller(uninstallScript, ["--check"], environment);
  assert.equal(uninstallResult.status, 0, uninstallResult.stderr || uninstallResult.stdout);
  assert.match(uninstallResult.stdout, /检查通过/u);
});

test("double-click launchers are location-independent", () => {
  for (const relative of ["Install Denia Old Days.command", "Uninstall Denia Old Days.command"]) {
    const source = fs.readFileSync(path.join(root, relative), "utf8");
    assert.match(source, /SCRIPT_DIR=.*dirname/u);
    assert.match(source, /installer\/(?:install|uninstall)-macos\.sh/u);
    assert.match(source, /read -r/u);
  }
});

test("bootstrap command downloads the stable latest-release asset", () => {
  const source = fs.readFileSync(path.join(root, "installer/bootstrap-macos.sh"), "utf8");
  assert.match(source, /releases\/latest\/download\/denia-old-days-macos\.zip/u);
  assert.match(source, /Install Denia Old Days\.command/u);
  assert.match(source, /mktemp -d/u);
});

test("full fake install persists an independent uninstaller and restores the previous theme", async (context) => {
  const temporary = await fsPromises.mkdtemp(path.join(os.tmpdir(), "denia-installer-full-"));
  context.after(() => fsPromises.rm(temporary, { recursive: true, force: true }));
  const dreamState = path.join(temporary, "dream-state");
  const sidecarState = path.join(temporary, "sidecar-state");
  const engine = await makeFakeEngine(temporary, dreamState);
  const fakeSidecar = await makeFakeSidecarSource(temporary);
  await writeTheme(path.join(dreamState, "themes/original-theme"), "original-theme");
  await writeTheme(path.join(dreamState, "themes/unrelated-theme"), "unrelated-theme");
  await writeTheme(path.join(dreamState, "theme"), "original-theme");

  const environment = {
    HOME: path.join(temporary, "home"),
    DENIA_DREAM_SKIN_ENGINE_ROOT: engine,
    DENIA_DREAM_SKIN_STATE_ROOT: dreamState,
    DENIA_OLD_DAYS_DS_STATE_ROOT: sidecarState,
    DENIA_OLD_DAYS_INSTALL_STATE_ROOT: sidecarState,
    DENIA_SIDECAR_PACKAGE_SOURCE: fakeSidecar,
  };
  const installResult = runInstaller(installScript, [], environment);
  assert.equal(installResult.status, 0, installResult.stderr || installResult.stdout);
  assert.equal(
    JSON.parse(await fsPromises.readFile(path.join(dreamState, "theme/theme.json"), "utf8")).id,
    "denia-old-days",
  );
  assert.equal(
    JSON.parse(await fsPromises.readFile(path.join(sidecarState, "installer-receipt.json"), "utf8")).previousThemeId,
    "original-theme",
  );
  const durableUninstaller = path.join(sidecarState, "uninstall/Uninstall Denia Old Days.command");
  assert.equal((await fsPromises.stat(durableUninstaller)).isFile(), true);

  const uninstallResult = runInstaller(durableUninstaller, ["--no-pause"], environment);
  assert.equal(uninstallResult.status, 0, uninstallResult.stderr || uninstallResult.stdout);
  assert.equal(
    JSON.parse(await fsPromises.readFile(path.join(dreamState, "theme/theme.json"), "utf8")).id,
    "original-theme",
  );
  assert.equal(fs.existsSync(path.join(dreamState, "themes/denia-old-days")), false);
  assert.equal(fs.existsSync(path.join(dreamState, "themes/unrelated-theme/theme.json")), true);
  assert.equal(fs.existsSync(path.join(engine, "scripts/switch-theme-macos.sh")), true);
  assert.equal(fs.existsSync(sidecarState), false);
});

test("post-start failure rolls back the base theme and the complete previous Sidecar state", async (context) => {
  const temporary = await fsPromises.mkdtemp(path.join(os.tmpdir(), "denia-installer-rollback-"));
  context.after(() => fsPromises.rm(temporary, { recursive: true, force: true }));
  const dreamState = path.join(temporary, "dream-state");
  const sidecarState = path.join(temporary, "sidecar-state");
  const engine = await makeFakeEngine(temporary, dreamState);
  const fakeSidecar = await makeFakeSidecarSource(temporary);
  await writeTheme(path.join(dreamState, "themes/original-theme"), "original-theme");
  await writeTheme(path.join(dreamState, "theme"), "original-theme");
  await fsPromises.mkdir(path.join(sidecarState, "package/scripts"), { recursive: true });
  await fsPromises.writeFile(path.join(sidecarState, "package/old-marker"), "old-package");
  await writeExecutable(path.join(sidecarState, "package/scripts/status.sh"), "#!/bin/bash\nprintf 'running=true\\n'\n");
  await writeExecutable(path.join(sidecarState, "package/scripts/stop.sh"), "#!/bin/bash\nexit 0\n");
  await writeExecutable(
    path.join(sidecarState, "package/scripts/start.sh"),
    "#!/bin/bash\ntouch \"${DENIA_OLD_DAYS_DS_STATE_ROOT:?}/old-restarted\"\n",
  );
  await fsPromises.writeFile(path.join(sidecarState, "installer-receipt.json"), '{"previousThemeId":"original-theme"}\n');

  const result = runInstaller(installScript, [], {
    HOME: path.join(temporary, "home"),
    DENIA_DREAM_SKIN_ENGINE_ROOT: engine,
    DENIA_DREAM_SKIN_STATE_ROOT: dreamState,
    DENIA_OLD_DAYS_DS_STATE_ROOT: sidecarState,
    DENIA_OLD_DAYS_INSTALL_STATE_ROOT: sidecarState,
    DENIA_SIDECAR_PACKAGE_SOURCE: fakeSidecar,
    DENIA_INSTALLER_TEST_FAIL_AFTER_SIDECAR: "1",
  });
  assert.notEqual(result.status, 0);
  assert.equal(
    JSON.parse(await fsPromises.readFile(path.join(dreamState, "theme/theme.json"), "utf8")).id,
    "original-theme",
  );
  assert.equal(await fsPromises.readFile(path.join(sidecarState, "package/old-marker"), "utf8"), "old-package");
  assert.equal(fs.existsSync(path.join(sidecarState, "old-restarted")), true);
  assert.equal(fs.existsSync(path.join(dreamState, "themes/denia-old-days")), false);
});

test("uninstall remains available after the upstream engine is removed", async (context) => {
  const temporary = await fsPromises.mkdtemp(path.join(os.tmpdir(), "denia-uninstall-without-engine-"));
  context.after(() => fsPromises.rm(temporary, { recursive: true, force: true }));
  const dreamState = path.join(temporary, "dream-state");
  const sidecarState = path.join(temporary, "sidecar-state");
  await writeTheme(path.join(dreamState, "themes/denia-old-days"), "denia-old-days");
  await writeTheme(path.join(dreamState, "theme"), "denia-old-days");
  await fsPromises.mkdir(path.join(sidecarState, "package/scripts"), { recursive: true });
  await writeExecutable(path.join(sidecarState, "package/scripts/uninstall.sh"), `#!/bin/bash
state="\${DENIA_OLD_DAYS_DS_STATE_ROOT:?}"
/usr/bin/find "$state" -mindepth 1 -delete
/bin/rmdir "$state" 2>/dev/null || true
`);
  const result = runInstaller(uninstallScript, [], {
    DENIA_DREAM_SKIN_ENGINE_ROOT: path.join(temporary, "missing-engine"),
    DENIA_DREAM_SKIN_STATE_ROOT: dreamState,
    DENIA_OLD_DAYS_DS_STATE_ROOT: sidecarState,
    DENIA_OLD_DAYS_INSTALL_STATE_ROOT: sidecarState,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(dreamState, "themes/denia-old-days")), false);
  assert.equal(fs.existsSync(path.join(dreamState, "theme")), false);
  assert.equal(fs.existsSync(sidecarState), false);
});

test("standalone Sidecar upgrade removes its transaction backup", async (context) => {
  const temporary = await fsPromises.mkdtemp(path.join(os.tmpdir(), "denia-sidecar-upgrade-"));
  context.after(() => fsPromises.rm(temporary, { recursive: true, force: true }));
  const state = path.join(temporary, "state");
  const dreamState = path.join(temporary, "dream-state");
  await fsPromises.mkdir(path.join(state, "package/scripts"), { recursive: true });
  await fsPromises.mkdir(dreamState, { recursive: true });
  await fsPromises.writeFile(
    path.join(dreamState, "state.json"),
    `${JSON.stringify({ nodePath: process.execPath, port: 9341 }, null, 2)}\n`,
  );
  await fsPromises.writeFile(path.join(state, "package/old-marker"), "old");
  await writeExecutable(path.join(state, "package/scripts/status.sh"), "#!/bin/bash\nprintf 'running=false\\n'\n");
  await writeExecutable(path.join(state, "package/scripts/stop.sh"), "#!/bin/bash\nexit 0\n");
  await fsPromises.writeFile(path.join(state, "receipt.json"), '{"version":"old"}\n');
  const result = runInstaller(path.join(root, "sidecar/scripts/install.sh"), ["--no-start"], {
    DENIA_DREAM_SKIN_STATE_ROOT: dreamState,
    DENIA_OLD_DAYS_DS_STATE_ROOT: state,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(fs.existsSync(path.join(state, "package/extension.json")), true);
  assert.equal(fs.existsSync(path.join(state, "package/old-marker")), false);
  assert.deepEqual(
    (await fsPromises.readdir(state)).filter((name) => name.includes("previous")),
    [],
  );
});
