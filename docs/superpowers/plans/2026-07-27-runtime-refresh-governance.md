# Runtime Refresh Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the invisible home suggestion-card feature and replace unconditional runtime refreshes with cached, dirty-domain incremental work.

**Architecture:** Keep the removable sidecar in its existing CSS and JavaScript entrypoints. A bitmask scheduler merges route, composer, sidebar, layout, work-surface, home, task-state, task-decoration, and art work; the public `state.refresh()` remains a full diagnostic refresh. Mutation records invalidate cached semantic anchors and schedule only affected domains, while task decoration consumes added subtree roots.

**Tech Stack:** Browser JavaScript, CSS, MutationObserver, requestAnimationFrame, Node.js VM validation harness, CDP performance probes

## Global Constraints

- Preserve current home, task, sidebar, composer, state-art, approval, error, and complete visuals.
- Do not change native dimensions, panel animations, terminal initialization, or asset encoding.
- Keep style-only animation changes on the existing 80ms trailing debounce.
- Keep sidebar, summary, and bottom-panel dataset markers synchronous in the observer callback.
- Preserve cleanup, object URL revocation, reduced-motion behavior, and `state.refresh()`.
- Use one focused RED/GREEN cycle per task, one full validation at the end, one live verify, one panel probe, and one refresh performance sample.
- Preserve the untracked `.superpowers/` local state directory.

---

### Task 1: Remove the invisible suggestion-card feature

**Files:**
- Modify: `sidecar/extension.json`
- Modify: `sidecar/src/denia-old-days-extension.css`
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/runtime/loader.mjs`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Produces: `findNativeHomeTitle(): HTMLElement | null`
- Produces: `syncNativeHomePrompt(): HTMLElement | null`
- Removes: `nativeSuggestionButtons()`, `ensureSuggestionSlot()`, `ensureSuggestionDeck()`, `retainSuggestionSlotHeight()`, `restoreNativeSuggestionClasses()`
- Preserves: `isHomeView(): boolean`

- [ ] **Step 1: Add failing static and runtime assertions**

Update `sidecar/tests/validate.mjs` so the source suite requires all removed suggestion tokens to be absent:

```js
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
```

Replace the home fixture assertions with:

```js
assert(!harness.document.getElementById("denia-old-days-ds-suggestion-slot"));
assert(!harness.document.getElementById("denia-old-days-ds-card-deck"));
assert(nativeButtons.every((button) =>
  !button.classList.contains("denia-old-days-ds-native-card")));
assert(state.homeActive === true);
assert(nativePrompt.classList.contains("denia-old-days-ds-native-home-prompt"));
```

Keep the existing title-above-composer geometry assertion.

- [ ] **Step 2: Run the validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero because manifest, CSS, runtime, loader, and tests still contain suggestion-card tokens.

- [ ] **Step 3: Remove manifest, CSS, loader, and runtime branches**

Remove `ui.cardLabels`, `home.suggestion-cards`, all suggestion slot/deck/native-hiding CSS including media overrides, and loader cleanup/verification references.

Refactor home title discovery:

```js
function findNativeHomeTitle() {
  const promptPattern = /(?:what should we build in|what would you like to build|想在.+中构建什么|要在.+中构建什么)/iu;
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
```

Change `syncNativeHomePrompt` to call `findNativeHomeTitle()` without a suggestion-button parameter. Use `findNativeHomeTitle()` as the fallback in `isHomeView()` when there are no assistant messages.

On a home refresh call:

```js
ensureHomeHero();
syncNativeHomePrompt();
syncHomeVisualFrame(findMain());
syncHomeViewport(findMain());
```

Delete suggestion state, DOM creation, proxy listeners, native class mutation, cleanup, and related removable classes.

- [ ] **Step 4: Run the validator and confirm GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit zero with no suggestion slot, proxy button, or native suggestion hiding behavior.

- [ ] **Step 5: Commit the removal**

```bash
git add sidecar/extension.json sidecar/src/denia-old-days-extension.css \
  sidecar/src/denia-old-days-extension.js sidecar/runtime/loader.mjs \
  sidecar/tests/validate.mjs
git commit -m "refactor: remove hidden home suggestion cards"
```

---

### Task 2: Add dirty-domain scheduling and semantic anchor caches

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Produces: `DIRTY: Readonly<Record<string, number>>`
- Produces: `scheduleRefresh(mask?: number, decorationRoots?: Iterable<Element>): void`
- Produces: `runRefresh(mask: number, decorationRoots: Set<Element>): void`
- Produces: `invalidateComposerCache(): void`
- Produces: `invalidateToggleCache(kind?: "sidebar" | "summary" | "bottom"): void`
- Preserves: `refresh(): void`

- [ ] **Step 1: Add failing domain-isolation tests**

Expose domain counts under `state.metrics.domainRuns`. In `assertObserverStability(payload)`, capture a baseline and add a task subtree mutation:

```js
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
```

Add cache replacement coverage:

```js
const replacement = harness.document.createElement("form");
replacement.classList.add("composer-surface-chrome");
composer.remove();
main.append(replacement);
harness.flushMutations();
harness.flushAnimationFrames();
assert(replacement.classList.contains("denia-old-days-ds-composer"));
```

- [ ] **Step 2: Run the validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero because every semantic mutation still runs the monolithic refresh and `domainRuns` does not exist.

- [ ] **Step 3: Add domain state, caches, and scheduler**

Add:

```js
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
```

Extend state:

```js
pendingDirty: 0,
pendingDecorationRoots: new Set(),
metrics: {
  refreshes: 0,
  createdNodes: 0,
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
```

Use `cachedComposer` and a `Map` keyed by `sidebar`, `summary`, and `bottom`. Cached values are accepted only while connected and semantically valid. Child-list records containing matching nodes and relevant toggle attributes invalidate the corresponding entry.

`scheduleRefresh` ORs masks and adds decoration roots before requesting a frame. `refresh()` calls `runRefresh(DIRTY.ALL, new Set([document.body]))`.

- [ ] **Step 4: Split `refresh()` into domain work**

Implement `runRefresh(mask, roots)` in this order:

```js
route
composer
sidebar
layout
workSurfaces
home or taskState
taskDecoration
art
```

If the route domain changes `state.homeActive`, add all page-dependent domains to the current mask. Increment the matching `domainRuns` counter immediately before each domain executes.

Keep right-sidebar geometry inside sidebar/layout work. Do not call it from task-state or task-decoration work.

- [ ] **Step 5: Classify observer and event work**

Use these masks:

```js
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
```

Child-list records always add `ROUTE`; records inside the current task main add task-state/art and their added element roots add task-decoration. Composer/sidebar subtree replacements add their structure domains and invalidate caches. Relevant state attributes inside main add task-state/art. Toggle records retain immediate marker synchronization and schedule sidebar/layout/work-surface work.

Resize schedules sidebar/layout/work-surfaces plus the active page domain. popstate and hashchange schedule `DIRTY.ALL`.

- [ ] **Step 6: Run the validator and confirm GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit zero; task mutations do not increment sidebar, layout, composer, or home domain counts.

- [ ] **Step 7: Commit the scheduler**

```bash
git add sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "perf: split theme refresh into dirty domains"
```

---

### Task 3: Make task decoration incremental

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js`
- Modify: `sidecar/tests/validate.mjs`

**Interfaces:**
- Produces: `decorateTaskRoots(roots: Iterable<Element>): void`
- Produces: `syncFinalAssistantCard(): void`
- Consumes: `state.pendingDecorationRoots`

- [ ] **Step 1: Add a failing incremental-decoration test**

Mount one existing observation, run a full refresh, then add a second observation and flush one mutation:

```js
const existing = harness.document.createElement("details");
main.append(existing);
state.refresh();
const existingTouches = harness.classMutationCount(existing, "denia-old-days-ds-observation");

const added = harness.document.createElement("details");
main.append(added);
harness.flushMutations();
harness.flushAnimationFrames();

assert(added.classList.contains("denia-old-days-ds-observation"));
assert(
  harness.classMutationCount(existing, "denia-old-days-ds-observation") === existingTouches,
  "incremental decoration must not retouch historical observations",
);
```

Add two assistant nodes, remove the latest, and assert the remaining latest node becomes the only final card in complete state.

- [ ] **Step 2: Run the validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero because `decorateTask()` rescans all historical observations and assistants.

- [ ] **Step 3: Implement subtree-only decoration**

Define the observation selector once. For every root:

```js
if (root.matches?.(observationSelector)) decorateObservation(root);
root.querySelectorAll?.(observationSelector).forEach(decorateObservation);
```

On a full refresh pass the current main as the only root. On incremental refresh pass only connected added roots. Keep a `finalAssistantCard` reference; remove its class when it disconnects, stops being latest, or form state stops being complete. Query assistants within `findMain()` only when task-state or assistant child-list mutations require final-card synchronization.

- [ ] **Step 4: Run the validator and confirm GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit zero; only added task roots are decorated after ordinary child-list mutations.

- [ ] **Step 5: Commit incremental decoration**

```bash
git add sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "perf: decorate only changed task subtrees"
```

---

### Task 4: Necessary final validation and performance comparison

**Files:**
- Verify: `sidecar/src/denia-old-days-extension.css`
- Verify: `sidecar/src/denia-old-days-extension.js`
- Verify: `sidecar/tests/validate.mjs`
- Verify: `sidecar/runtime/loader.mjs`

**Interfaces:**
- Verifies: removable sidecar behavior, runtime domains, live layout, panel transitions, refresh cost

- [ ] **Step 1: Run the only full source validation**

Run:

```bash
git diff --check
npm run check
```

Expected: both exit zero.

- [ ] **Step 2: Build, install, and verify once**

Run:

```bash
bash sidecar/package.sh
bash sidecar/scripts/install.sh
bash sidecar/scripts/verify.sh
```

Expected: package and install succeed; verify reports `"pass": true`.

- [ ] **Step 3: Run one panel probe**

Run:

```bash
node /Users/bytedance/Documents/Codex/2026-07-27/new-chat/work/panel-animation-performance-probe.mjs
```

Expected:

- all original states are restored;
- terminal composer decorations remain zero;
- every panel direction performs at most 5 refreshes per 900ms.

- [ ] **Step 4: Run one refresh-domain performance sample**

On a stable task page, append one temporary task subtree through CDP, wait for its incremental refresh, remove it, and report:

- elapsed incremental refresh time;
- `domainRuns` delta;
- sidebar, layout, composer, and home deltas remain zero;
- task-state and task-decoration deltas equal one.

Target: incremental task refresh below 1ms on the current approximately 1700-node page.

- [ ] **Step 5: Review final branch state**

Run:

```bash
git status --short --branch
git log --oneline main..HEAD
```

Expected: only `.superpowers/` is untracked and the branch contains the design plus three focused implementation commits.
