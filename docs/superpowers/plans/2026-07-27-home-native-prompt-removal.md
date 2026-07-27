# Home Native Prompt Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the duplicate Codex native home prompt whenever the Denia four-card suggestion deck is active, while preserving native actions, the composer, project selection, and cleanup behavior.

**Architecture:** Reuse the existing `syncNativeHomePrompt(nativeButtons)` and `.denia-old-days-ds-native-home-prompt` contract. The runtime adds the hiding class only after all four semantic actions and the themed slot are available; existing incomplete-action and cleanup paths remove it. Runtime tests model the real nested prompt structure and verify reversible behavior.

**Tech Stack:** Browser runtime JavaScript, CSS class contract, Node.js ESM validation harness, CDP live verification

## Global Constraints

- Do not delete, move, or replace Codex native prompt nodes.
- Hide the native prompt only while all four themed proxy cards are active.
- Preserve all four native action buttons as the themed cards' click targets.
- Preserve the themed Hero, composer, bottom project selector, permissions, model selector, and task pages.
- Restore the native prompt when actions are incomplete, the route leaves home, or the extension cleans up.
- Do not add artwork, layout decoration, animation, or dependencies.
- Do not restart Codex.

---

### Task 1: Specify reversible native-prompt hiding

**Files:**
- Modify: `sidecar/tests/validate.mjs:360-367`
- Modify: `sidecar/tests/validate.mjs:1718-1805`
- Modify: `sidecar/tests/validate.mjs:1940-1995`
- Modify: `sidecar/tests/validate.mjs:2749-2805`
- Modify: `sidecar/tests/validate.mjs:2844-3010`

**Interfaces:**
- Consumes: `syncNativeHomePrompt(nativeButtons: HTMLElement[])`
- Consumes: `.denia-old-days-ds-native-home-prompt { display: none !important; }`
- Produces: regression coverage for prompt hiding and restoration

- [ ] **Step 1: Let the DOM harness expose direct text nodes**

Add this getter to `FakeElement` after `getBoundingClientRect()`:

```js
get childNodes() {
  const directText = this.textContent
    ? [{ nodeType: 3, textContent: this.textContent }]
    : [];
  return [...directText, ...this.children];
}
```

Add `Node: { TEXT_NODE: 3 }` to the runtime sandbox so the production direct-text check executes unchanged.

- [ ] **Step 2: Require the four-card branch to synchronize the prompt**

Replace the existing negative static assertion with:

```js
assert(
  /function ensureSuggestionDeck\(\) \{[\s\S]*?if \(!slot\) return null;[\s\S]*?syncNativeHomePrompt\(nativeButtons\);[\s\S]*?function decorateComposer/u.test(runtime),
  "themed suggestions must hide the duplicate native home prompt after the themed slot is available",
);
```

- [ ] **Step 3: Model the real prompt wrapper in the home visual-layer test**

Replace the flat `nativePrompt` fixture with a nested wrapper:

```js
const nativePrompt = harness.document.createElement("div");
const nativePromptBody = harness.document.createElement("div");
const nativeHeading = harness.document.createElement("div");
const nativeTitle = harness.document.createElement("span");
const inlineProjectButton = harness.document.createElement("button");
const promptText = "What should we build in denia-old-days-codex-theme?";
nativePrompt.textContent = promptText;
nativePromptBody.textContent = promptText;
nativeHeading.textContent = promptText;
nativeTitle.textContent = promptText;
inlineProjectButton.textContent = "denia-old-days-codex-theme";
nativeTitle.append(inlineProjectButton);
nativeHeading.append(nativeTitle);
nativePromptBody.append(nativeHeading);
nativePrompt.append(nativePromptBody);
```

Require the exact wrapper to be hidden without removing the inline button:

```js
assert(
  nativePrompt.classList.contains("denia-old-days-ds-native-home-prompt"),
  "home theme must hide the duplicate Codex native prompt while themed cards are active",
);
assert(
  nativePrompt.contains(inlineProjectButton) && inlineProjectButton.isConnected,
  "hiding the native prompt must preserve its inline project button in the DOM",
);
```

- [ ] **Step 4: Cover restoration in the suggestion lifecycle**

Add the same nested prompt structure inside `makeHarness`, return `nativePrompt`, and assert:

```js
assert(
  !short.nativePrompt.classList.contains("denia-old-days-ds-native-home-prompt"),
  "an incomplete native action set must keep the native prompt visible",
);
assert(
  complete.nativePrompt.classList.contains("denia-old-days-ds-native-home-prompt"),
  "four themed actions must hide the duplicate native prompt",
);
```

After dropping to three actions:

```js
assert(
  !complete.nativePrompt.classList.contains("denia-old-days-ds-native-home-prompt"),
  "dropping below four actions must restore the native prompt",
);
```

After four semantic actions return, require the class again. After leaving home and after `cleanup()`, require the class to be absent.

- [ ] **Step 5: Run the validator and confirm RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit nonzero with `themed suggestions must hide the duplicate native home prompt after the themed slot is available`.

---

### Task 2: Enable the existing prompt synchronization

**Files:**
- Modify: `sidecar/src/denia-old-days-extension.js:937-954`
- Test: `sidecar/tests/validate.mjs`

**Interfaces:**
- Calls: `syncNativeHomePrompt(nativeButtons)`
- Restores through: `restoreNativeSuggestionClasses()` and `clearNativeHomePrompt()`

- [ ] **Step 1: Add the minimal runtime call**

In `ensureSuggestionDeck`, immediately after the themed slot guard, add:

```js
if (!slot) return null;
syncNativeHomePrompt(nativeButtons);
```

Keep the existing `nativeButtons.length !== 4` branch unchanged so it restores the prompt through `restoreNativeSuggestionClasses()`.

- [ ] **Step 2: Run the focused validator and confirm GREEN**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: exit zero with `Validated 达妮娅 · 旧日斑斓 extension 0.1.0`.

- [ ] **Step 3: Review the focused diff**

Confirm the production diff contains only the one synchronization call and the test diff covers exact-wrapper hiding, inline project-button preservation, incomplete-action restoration, route restoration, and cleanup restoration.

- [ ] **Step 4: Commit the runtime fix**

Run:

```bash
git add sidecar/src/denia-old-days-extension.js sidecar/tests/validate.mjs
git commit -m "fix: remove duplicate native home prompt"
```

---

### Task 3: Build, hot-update, and verify the live home

**Files:**
- Verify: `sidecar/src/denia-old-days-extension.js`
- Verify: `sidecar/tests/validate.mjs`
- Verify: installed Sidecar package

**Interfaces:**
- Consumes: current local Sidecar source
- Produces: a live home view with four themed cards and no native prompt

- [ ] **Step 1: Run full validation and build**

Run:

```bash
npm run check
git diff --check
npm run build:kaboo
```

Expected: all commands exit zero.

- [ ] **Step 2: Hot-install the Sidecar**

Run:

```bash
bash sidecar/scripts/install.sh
```

Expected: the extension LaunchAgent is active on port `9341`. This updates the Sidecar only; the unchanged Base Theme is not rewritten and Codex is not restarted.

- [ ] **Step 3: Capture and inspect the live home**

Create a bounded temporary directory with `mktemp -d`, then run:

```bash
bash sidecar/scripts/verify.sh --home --screenshot "$HOME_PROMPT_VERIFY_DIR/home.png"
```

Confirm:

- The English native prompt and its inline project button are not visible.
- Four themed suggestion cards are visible and clickable.
- The themed Hero remains intact.
- The bottom project selector and composer remain visible.
- There is no horizontal overflow.

- [ ] **Step 4: Verify the live DOM contract**

Use the active CDP endpoint to assert:

```js
document.querySelectorAll("#denia-old-days-ds-card-deck button[data-denia-old-days-card]").length === 4
document.querySelector(".denia-old-days-ds-native-home-prompt") !== null
getComputedStyle(document.querySelector(".denia-old-days-ds-native-home-prompt")).display === "none"
document.querySelector(".composer-surface-chrome") !== null
```

Expected: every expression is true.

- [ ] **Step 5: Run final repository checks**

Run:

```bash
npm run check
git diff --check
git status --short --branch
```

Expected: checks pass, tracked changes are committed, and only the pre-existing untracked `.superpowers/` directory may remain.
