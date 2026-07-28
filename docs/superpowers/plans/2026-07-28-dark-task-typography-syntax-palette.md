# Dark Task Typography and Syntax Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the incomplete dark-task Markdown inheritance with a scoped semantic typography and Highlight.js palette that keeps tables, inline code, code blocks, and plain-text diagrams readable without changing layout or unrelated work surfaces.

**Architecture:** Extend the existing deep-space variables with text and code roles, then consume them only below the dark task `main` and native Markdown root. The existing static validator remains the contract: it permits `code` and `pre` only under that Markdown root, rejects terminal/Diff/editor reach, and limits new declarations to paint-only properties.

**Tech Stack:** CSS custom properties, Codex native Markdown DOM attributes, Highlight.js token classes, Node.js 20 ESM validation, CDP runtime inspection on port `9341`, and existing Sidecar packaging/install scripts.

## Global Constraints

- Work directly on the current `main` branch because the user explicitly requested all theme work be merged into `main`.
- Preserve the current canvas `#12142F`, base surface `#1A1C3A`, raised surface `#202348`, layout, DOM, focus order, selection, copying, wrapping, and scrolling.
- Scope every new content rule to the deep task main and `[class*="_markdownContent_"]`.
- Keep the light theme, dark homepage, terminal, Diff viewer, code editor, logs, sidebars, composer, model selector, permission controls, task art, and state-card geometry unchanged.
- Use static CSS only: no observer, listener, timer, animation, filter, backdrop filter, runtime network request, font, image, or per-node JavaScript styling.
- Use exactly the approved text colors `#F3EFF6`, `#E7E3EC`, `#BBB5C9`, `#9E98AE`, and `#8DC5EA`.
- Use exactly the approved code colors `#D7D9E8`, `#8F97B5`, `#C7A7E8`, `#91C9F2`, `#9DD8C5`, `#F0B2CE`, `#B6BCD2`, `#F0CC8C`, `#191C38`, and `#272A50`.
- Ordinary text must remain at least `4.5:1`; body, table body, and default code text target at least `7:1`.
- Follow strict TDD: add the contract, run it and observe the expected failure, add only the required CSS, then rerun the complete check.

---

### Task 1: Establish the dark Markdown text hierarchy

**Files:**

- Modify: `sidecar/tests/validate.mjs:1010-1145`
- Modify: `sidecar/src/denia-old-days-extension.css:966-1064`

**Interfaces:**

- Consumes: `darkTaskMainReadabilityRoot` and the existing parsed CSS rule helpers in `sidecar/tests/validate.mjs`.
- Produces: the text variables `--denia-dark-text-heading`, `--denia-dark-text-body`, `--denia-dark-text-secondary`, `--denia-dark-text-tertiary`, `--denia-dark-text-link`, and the inline surface `--denia-dark-code-inline-surface`; the stable `darkTaskMarkdownRoot` test constant used by Task 2.

- [ ] **Step 1: Add failing semantic-palette and Markdown-structure assertions**

Replace the current single `darkTaskMarkdownSelector` contract and direct-child inline-code contract with the following constants and assertions:

```js
const darkThemePaletteSelector =
  '.denia-old-days-ds-extension[data-denia-theme="dark"]';
const darkTaskMarkdownRoot =
  `${darkTaskMainReadabilityRoot} [class*="_markdownContent_"]`;
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

assertCssDeclarations(stylesheetRules, darkThemePaletteSelector, {
  "--denia-dark-text-heading": "#F3EFF6",
  "--denia-dark-text-body": "#E7E3EC",
  "--denia-dark-text-secondary": "#BBB5C9",
  "--denia-dark-text-tertiary": "#9E98AE",
  "--denia-dark-text-link": "#8DC5EA",
  "--denia-dark-code-inline-surface": "#272A50",
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
});
assertCssDeclarations(stylesheetRules, darkTaskInlineMarkdownSelector, {
  color: "var(--denia-dark-text-link) !important",
  background: "var(--denia-dark-code-inline-surface) !important",
  "text-shadow": "none !important",
});
```

Add every selector above to the existing deep-task selector audit. Define the allowed Markdown paint properties as:

```js
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
  if (!rule.selectors.some((selector) =>
    selector === darkTaskMarkdownRoot
      || selector.startsWith(`${darkTaskMarkdownRoot} `))) continue;
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
```

Replace the old blanket `code`/`pre` ban with:

```js
for (const selector of darkTaskMarkdownSelectors) {
  const targetsMarkdownCode =
    /(?:^|[\s>+~,(])(?:code|pre)(?:$|[\s>+~,.:[#])/iu.test(selector);
  assert(
    !targetsMarkdownCode
      || selector.startsWith(`${darkTaskMarkdownRoot} `),
    `dark task code paint must stay inside the native Markdown root: ${selector}`,
  );
}
```

- [ ] **Step 2: Run the validator and verify RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL on the first missing new palette declaration, beginning with `--denia-dark-text-heading` or the new Markdown-root color.

- [ ] **Step 3: Add the approved text variables and scoped Markdown paint**

Change the dark palette block to:

```css
.denia-old-days-ds-extension[data-denia-theme="dark"] {
  --denia-dark-canvas: #12142F;
  --denia-dark-surface: #1A1C3A;
  --denia-dark-surface-raised: #202348;
  --denia-dark-text-heading: #F3EFF6;
  --denia-dark-text-body: #E7E3EC;
  --denia-dark-text-secondary: #BBB5C9;
  --denia-dark-text-tertiary: #9E98AE;
  --denia-dark-text-link: #8DC5EA;
  --denia-dark-code-inline-surface: #272A50;
  --denia-dark-text: var(--denia-dark-text-heading);
  --denia-dark-text-muted: var(--denia-dark-text-secondary);
  --denia-dark-focus: var(--denia-dark-text-link);
  --denia-dark-character: #D98FB3;
  --denia-dark-divider: rgba(141, 154, 211, .30);
  --denia-crystal: var(--denia-dark-focus);
  color-scheme: dark;
}
```

Replace the old combined paragraph/heading and inline-code rules with:

```css
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"] {
  color: var(--denia-dark-text-body) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is(h1, h2, h3, h4, h5, h6, th) {
  color: var(--denia-dark-text-heading) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is(p, li, ol, ul, blockquote, td) {
  color: var(--denia-dark-text-body) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  [data-markdown-table="true"]
  table {
  color: var(--denia-dark-text-body) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is(th, td) {
  border-color: var(--denia-dark-divider) !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  a {
  color: var(--denia-dark-text-link) !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  [data-markdown-copy="inline-code"].inline-markdown {
  color: var(--denia-dark-text-link) !important;
  background: var(--denia-dark-code-inline-surface) !important;
  text-shadow: none !important;
}
```

- [ ] **Step 4: Run the complete check and verify GREEN**

Run:

```bash
npm run check
```

Expected: `source structure ok` followed by the successful Sidecar validation summary.

- [ ] **Step 5: Commit Task 1**

```bash
git add sidecar/tests/validate.mjs sidecar/src/denia-old-days-extension.css
git commit -m "fix: establish dark markdown text hierarchy"
```

---

### Task 2: Add the scoped Highlight.js code palette

**Files:**

- Modify: `sidecar/tests/validate.mjs:1010-1145`
- Modify: `sidecar/src/denia-old-days-extension.css:966-1100`

**Interfaces:**

- Consumes: `darkTaskMarkdownRoot`, `darkTaskMarkdownPaintProperties`, and the semantic text variables from Task 1.
- Produces: the complete approved code-variable set and scoped Markdown code-block/token rules.

- [ ] **Step 1: Add failing code-palette and scope assertions**

Extend the palette assertion with:

```js
"--denia-dark-code-text": "#D7D9E8",
"--denia-dark-code-comment": "#8F97B5",
"--denia-dark-code-keyword": "#C7A7E8",
"--denia-dark-code-type": "#91C9F2",
"--denia-dark-code-string": "#9DD8C5",
"--denia-dark-code-constant": "#F0B2CE",
"--denia-dark-code-punctuation": "#B6BCD2",
"--denia-dark-code-warning": "#F0CC8C",
"--denia-dark-code-surface": "#191C38",
```

Add these selector contracts:

```js
const darkTaskCodeBlockSelector =
  `${darkTaskMarkdownRoot} :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])`;
const darkTaskCodeSelector =
  `${darkTaskCodeBlockSelector} code`;
const darkTaskCodeChromeSelector =
  `${darkTaskMarkdownRoot} [data-markdown-copy="code-block"] [data-markdown-copy="exclude"]`;
const darkTaskCodeChromeControlSelector =
  `${darkTaskCodeChromeSelector} :is(button, [role="button"])`;
const darkTaskCodeChromeInteractiveSelector =
  `${darkTaskCodeChromeControlSelector}:is(:hover, :focus-visible)`;
const darkTaskCodeCommentSelector =
  `${darkTaskCodeSelector} :is(.hljs-comment, .hljs-quote)`;
const darkTaskCodeKeywordSelector =
  `${darkTaskCodeSelector} :is(.hljs-keyword, .hljs-selector-tag, .hljs-built_in)`;
const darkTaskCodeTypeSelector =
  `${darkTaskCodeSelector} :is(.hljs-title, .hljs-type, .hljs-attr, .hljs-attribute, .hljs-property)`;
const darkTaskCodeStringSelector =
  `${darkTaskCodeSelector} :is(.hljs-string, .hljs-regexp, .hljs-addition)`;
const darkTaskCodeConstantSelector =
  `${darkTaskCodeSelector} :is(.hljs-number, .hljs-literal, .hljs-symbol, .hljs-variable.constant_, .hljs-deletion)`;
const darkTaskCodePunctuationSelector =
  `${darkTaskCodeSelector} :is(.hljs-punctuation, .hljs-operator)`;
const darkTaskCodeWarningSelector =
  `${darkTaskCodeSelector} :is(.hljs-meta, .hljs-doctag)`;

assertCssDeclarations(stylesheetRules, darkTaskCodeBlockSelector, {
  color: "var(--denia-dark-code-text) !important",
  "background-color": "var(--denia-dark-code-surface) !important",
  "text-shadow": "none !important",
});
assertCssDeclarations(stylesheetRules, darkTaskCodeSelector, {
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
```

Add the code selectors to an explicit scoped audit:

```js
const darkTaskMarkdownCodeSelectors = [
  darkTaskCodeBlockSelector,
  darkTaskCodeSelector,
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
```

- [ ] **Step 2: Run the validator and verify RED**

Run:

```bash
node sidecar/tests/validate.mjs sidecar
```

Expected: FAIL on `--denia-dark-code-text` or the first missing Markdown code-block selector.

- [ ] **Step 3: Add the approved code variables**

Insert into the existing dark palette block:

```css
--denia-dark-code-text: #D7D9E8;
--denia-dark-code-comment: #8F97B5;
--denia-dark-code-keyword: #C7A7E8;
--denia-dark-code-type: #91C9F2;
--denia-dark-code-string: #9DD8C5;
--denia-dark-code-constant: #F0B2CE;
--denia-dark-code-punctuation: #B6BCD2;
--denia-dark-code-warning: #F0CC8C;
--denia-dark-code-surface: #191C38;
```

- [ ] **Step 4: Add the Markdown-only code and Highlight.js rules**

Add:

```css
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"]) {
  color: var(--denia-dark-code-text) !important;
  background-color: var(--denia-dark-code-surface) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])
  code {
  color: var(--denia-dark-code-text) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  [data-markdown-copy="code-block"]
  [data-markdown-copy="exclude"],
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  [data-markdown-copy="code-block"]
  [data-markdown-copy="exclude"]
  :is(button, [role="button"]) {
  color: var(--denia-dark-text-secondary) !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  [data-markdown-copy="code-block"]
  [data-markdown-copy="exclude"]
  :is(button, [role="button"]):is(:hover, :focus-visible) {
  color: var(--denia-dark-text-link) !important;
}
```

Add seven Highlight.js rules using the exact selector groups from Step 1. Each rule sets only:

```css
html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])
  code
  :is(.hljs-comment, .hljs-quote) {
  color: var(--denia-dark-code-comment) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])
  code
  :is(.hljs-keyword, .hljs-selector-tag, .hljs-built_in) {
  color: var(--denia-dark-code-keyword) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])
  code
  :is(.hljs-title, .hljs-type, .hljs-attr, .hljs-attribute, .hljs-property) {
  color: var(--denia-dark-code-type) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])
  code
  :is(.hljs-string, .hljs-regexp, .hljs-addition) {
  color: var(--denia-dark-code-string) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])
  code
  :is(.hljs-number, .hljs-literal, .hljs-symbol, .hljs-variable.constant_, .hljs-deletion) {
  color: var(--denia-dark-code-constant) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])
  code
  :is(.hljs-punctuation, .hljs-operator) {
  color: var(--denia-dark-code-punctuation) !important;
  text-shadow: none !important;
}

html.codex-dream-skin.denia-old-days-ds-extension.denia-old-days-ds-task[data-denia-theme="dark"]
  main.main-surface:not(.dream-skin-home-shell)
  [class*="_markdownContent_"]
  :is([data-markdown-copy="code-block"], pre[class*="_codeBlockPlaceholder_"])
  code
  :is(.hljs-meta, .hljs-doctag) {
  color: var(--denia-dark-code-warning) !important;
  text-shadow: none !important;
}
```

- [ ] **Step 5: Run the complete check and verify GREEN**

Run:

```bash
npm run check
```

Expected: source and Sidecar validation pass with zero failures.

- [ ] **Step 6: Commit Task 2**

```bash
git add sidecar/tests/validate.mjs sidecar/src/denia-old-days-extension.css
git commit -m "fix: add dark markdown syntax palette"
```

---

### Task 3: Build, hot-install, and verify the real renderer

**Files:**

- Verify: `sidecar/src/denia-old-days-extension.css`
- Verify: `sidecar/tests/validate.mjs`
- Generate outside the repository: `/tmp/denia-dark-typography-after.png`

**Interfaces:**

- Consumes: the installed Sidecar, CDP port `9341`, and the fixed Markdown sample containing a table, inline code, TypeScript, and plain text.
- Produces: fresh build/install evidence, computed-style evidence, and a screenshot for user review.

- [ ] **Step 1: Run full source, Sidecar, and package verification**

Run:

```bash
npm run check
npm run build:kaboo
git diff --check
```

Expected: all commands exit `0`; the source structure, Sidecar validator, and Kaboo build report success.

- [ ] **Step 2: Install and restart only the Sidecar runtime**

Run:

```bash
bash sidecar/scripts/install.sh --no-start
bash sidecar/scripts/start.sh
bash sidecar/scripts/verify.sh
```

Expected: installation succeeds, the runtime connects to the existing Codex CDP endpoint, and verification reports the extension active. Do not restart Codex.

- [ ] **Step 3: Inspect the fixed real Markdown sample through CDP**

For the last Markdown block containing `BookGenre.MOTION_COMIC`, collect:

```text
Markdown root: color #E7E3EC; text-shadow none
table: color #E7E3EC; text-shadow none
th: color #F3EFF6; text-shadow none
td: color #E7E3EC; text-shadow none
inline code: color #8DC5EA; background #272A50
code block: background #191C38
plain code: color #D7D9E8
hljs-keyword: #C7A7E8
hljs-title: #91C9F2
hljs-variable.constant_ and hljs-number: #F0B2CE
hljs-string: #9DD8C5
hljs-comment: #8F97B5
```

Also inspect one terminal/Diff/editor surface when present and confirm its computed colors do not resolve to any `--denia-dark-code-*` variable.

- [ ] **Step 4: Capture and inspect the result**

Scroll the fixed sample into view, capture its viewport or bounding clip through `Page.captureScreenshot`, and save it to:

```text
/tmp/denia-dark-typography-after.png
```

Open the image and confirm:

- table body no longer disappears;
- table headers have no glow;
- plain-text code is readable;
- code colors are restrained and distinct;
- no layout or wrapping changed.

- [ ] **Step 5: Run final fresh verification**

Run:

```bash
npm run check
npm run build:kaboo
git diff --check
git status --short --branch
```

Expected: tests/build pass, no whitespace errors exist, and only intentional commits are present.
