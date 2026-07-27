import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { RENDERER_SOURCE_INPUTS } from "./release-inputs.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = (name) => {
  const relative = path.join("art/source", name);
  if (!RENDERER_SOURCE_INPUTS.includes(relative)) {
    throw new Error(`renderer source is not declared: ${relative}`);
  }
  return path.join(root, relative);
};
const output = (name) => path.join(root, name);

await Promise.all([
  fs.mkdir(output("theme"), { recursive: true }),
  fs.mkdir(output("sidecar/assets"), { recursive: true }),
  fs.mkdir(output("evidence"), { recursive: true }),
]);

await sharp(source("background.svg"))
  .resize(1920, 1080, { fit: "cover" })
  .flatten({ background: "#f7eee9" })
  .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
  .toFile(output("theme/background.jpg"));

const SINGLE_SOURCE_HOME = "official/old-days-bright-102s.jpg";
const runtimeArt = [
  {
    source: SINGLE_SOURCE_HOME,
    target: "sidecar/assets/denia-old-days-bright.webp",
    resize: { width: 1440, height: 810, fit: "cover", position: "centre" },
    flatten: null,
    webp: { quality: 88, smartSubsample: true },
  },
];

for (const item of runtimeArt) {
  let image = sharp(source(item.source));
  if (item.flatten) image = image.flatten({ background: item.flatten });
  await image.resize(item.resize).webp(item.webp).toFile(output(item.target));
}

const TASK_RAIL_SOURCES = Object.freeze({
  warm: {
    source: "official/denia-garden-bubbles-warm.jpg",
    extract: { left: 245, top: 0, width: 346, height: 1080 },
    target: "sidecar/assets/denia-task-warm.webp",
  },
  approval: {
    source: "official/denia-approval-dual-form.jpg",
    extract: { left: 470, top: 220, width: 896, height: 2800 },
    target: "sidecar/assets/denia-task-approval.webp",
  },
  error: {
    source: "official/denia-error-reaching.jpg",
    extract: { left: 1140, top: 100, width: 282, height: 880 },
    target: "sidecar/assets/denia-task-error.webp",
  },
  complete: {
    source: "official/denia-anniversary-direct-gaze.jpg",
    extract: { left: 330, top: 100, width: 464, height: 1450 },
    target: "sidecar/assets/denia-task-complete.webp",
  },
});

async function renderTaskRail(spec) {
  return sharp(source(spec.source))
    .extract(spec.extract)
    .resize(640, 2000, { fit: "cover", position: "centre" })
    .webp({ quality: 86, smartSubsample: true })
    .toFile(output(spec.target));
}

await Promise.all(Object.values(TASK_RAIL_SOURCES).map(renderTaskRail));

await Promise.all([
  fs.rm(output("sidecar/assets/denia-task-dark.webp"), { force: true }),
  fs.rm(output("sidecar/assets/denia-old-days-dark.webp"), { force: true }),
  fs.rm(output("sidecar/assets/denia-old-days-hero.webp"), { force: true }),
  fs.rm(output("sidecar/assets/denia-old-days-portrait.webp"), { force: true }),
]);

const P2_POLAROID = Object.freeze({
  paper: "#fffaf1",
  paperBack: "#eee5dc",
  paperShadow: "#364c58",
  innerEdge: "#403a53",
  coral: "#e990a6",
  cyan: "#73ced9",
  blue: "#77aee8",
  gold: "#e5c56f",
});

const IRIDESCENT_MEMBRANE = Object.freeze({
  pink: "#f0a4bb",
  cyan: "#7bd6df",
  blue: "#8cb5ef",
  gold: "#f1d67e",
  violet: "#9a80df",
});

function homeLayoutOverlay({ width, height, compact }) {
  const suggestions = compact
    ? [
      ["翻阅并理解代码", 248],
      ["写下新的实现", 309],
      ["校对这页改动", 370],
      ["修补未完成的记录", 431],
    ]
    : [
      ["翻阅并理解代码", 348],
      ["写下新的实现", 434],
      ["校对这页改动", 520],
      ["修补未完成的记录", 606],
    ];
  const buttonMarkup = suggestions.map(([label, y]) => {
    const x = compact ? 92 : 146;
    const w = compact ? 486 : 516;
    const h = compact ? 48 : 66;
    const baseline = compact ? y + 30 : y + 41;
    return `
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${compact ? 14 : 18}"
        fill="#fffdf9" stroke="#9fcfd4" stroke-opacity=".7"/>
      <path d="M${x + 17} ${y + h - 10}h${w - 34}" stroke="#e6b4be" stroke-opacity=".22"/>
      <text x="${x + 27}" y="${baseline}" fill="#334151" font-family="Arial, sans-serif"
        font-size="${compact ? 14 : 17}">${label}</text>`;
  }).join("");

  if (compact) {
    return Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <defs>
          <linearGradient id="compact-paper" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#fffaf6"/>
            <stop offset=".53" stop-color="#fffdf9"/>
            <stop offset=".54" stop-color="#eef9f8"/>
            <stop offset="1" stop-color="#e9f7f8"/>
          </linearGradient>
          <filter id="book-shadow" x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#35505b" flood-opacity=".15"/>
          </filter>
        </defs>
        <g filter="url(#book-shadow)">
          <rect x="44" y="42" width="1112" height="714" rx="34" fill="url(#compact-paper)" stroke="#79c8d2" stroke-opacity=".52"/>
        </g>
        <path d="M596 65C573 121 583 672 596 733" fill="none" stroke="#8ebec5" stroke-opacity=".22"/>
        <path d="M62 83C207 68 382 78 596 102C792 73 960 70 1138 91" fill="none" stroke="#fffdf9" stroke-width="20" stroke-opacity=".62"/>
        <path d="M72 126C220 104 390 112 558 130" fill="none" stroke="#efb4c2" stroke-opacity=".18" stroke-width="3"/>
        <text x="92" y="120" fill="#6a7f86" font-family="Arial, sans-serif" font-size="10" letter-spacing="3.6">DENIA / OLD DAYS IN COLOR</text>
        <text x="92" y="167" fill="#2d3b4d" font-family="Arial, sans-serif" font-size="34" font-weight="700">今天要把什么写进手账？</text>
        <text x="92" y="205" fill="#657987" font-family="Arial, sans-serif" font-size="15">让思绪显影，也让每一步留下记录。</text>
        ${buttonMarkup}
        <rect x="92" y="636" width="518" height="68" rx="22" fill="#fffdf9" fill-opacity=".96" stroke="#73ced9" stroke-width="2"/>
        <text x="124" y="677" fill="#829398" font-family="Arial, sans-serif" font-size="14">让达妮娅记录下一项任务…</text>
        <circle cx="570" cy="670" r="23" fill="#293448"/>
        <path d="M559 670h22M570 659v22" stroke="#efd276" stroke-width="3.5" stroke-linecap="round"/>
      </svg>`);
  }

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="wide-paper" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff8f4"/>
          <stop offset=".5" stop-color="#fffdf9"/>
          <stop offset=".51" stop-color="#eff9f8"/>
          <stop offset="1" stop-color="#e9f7f8"/>
        </linearGradient>
        <filter id="book-shadow" x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="22" stdDeviation="24" flood-color="#35505b" flood-opacity=".16"/>
        </filter>
      </defs>
      <g filter="url(#book-shadow)">
        <rect x="74" y="64" width="1452" height="870" rx="42" fill="url(#wide-paper)" stroke="#79c8d2" stroke-opacity=".54"/>
      </g>
      <path d="M772 87C746 172 756 798 772 910" fill="none" stroke="#8ebec5" stroke-opacity=".2"/>
      <path d="M92 110C286 82 508 96 772 128C1012 92 1250 91 1508 120" fill="none" stroke="#fffdf9" stroke-width="24" stroke-opacity=".68"/>
      <path d="M104 146C304 116 518 126 722 151" fill="none" stroke="#efb4c2" stroke-opacity=".18" stroke-width="4"/>
      <text x="146" y="178" fill="#647f86" font-family="Arial, sans-serif" font-size="13" letter-spacing="4.7">DENIA / OLD DAYS IN COLOR</text>
      <text x="146" y="246" fill="#2d3b4d" font-family="Arial, sans-serif" font-size="48" font-weight="700">今天要把什么写进手账？</text>
      <text x="146" y="296" fill="#657987" font-family="Arial, sans-serif" font-size="19">让思绪显影，也让每一步留下记录。</text>
      ${buttonMarkup}
      <rect x="146" y="766" width="574" height="92" rx="30" fill="#fffdf9" fill-opacity=".96" stroke="#73ced9" stroke-width="2"/>
      <text x="186" y="821" fill="#829398" font-family="Arial, sans-serif" font-size="17">让达妮娅记录下一项任务…</text>
      <circle cx="667" cy="812" r="30" fill="#293448"/>
      <path d="M654 812h26M667 799v26" stroke="#efd276" stroke-width="4" stroke-linecap="round"/>
    </svg>`);
}

function iridescentBubbleOverlay({ width, height, compact }) {
  const bubbles = compact
    ? [
      { cx: 1088, cy: 118, r: 50, rotate: -18 },
      { cx: 1018, cy: 154, r: 18, rotate: 12 },
      { cx: 1102, cy: 620, r: 29, rotate: 24 },
      { cx: 654, cy: 548, r: 13, rotate: -8 },
    ]
    : [
      { cx: 1452, cy: 164, r: 64, rotate: -18 },
      { cx: 1378, cy: 218, r: 22, rotate: 12 },
      { cx: 1432, cy: 718, r: 36, rotate: 24 },
      { cx: 792, cy: 662, r: 17, rotate: -8 },
      { cx: 122, cy: 832, r: 27, rotate: 16 },
    ];

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <radialGradient id="bubble-fill" cx="31%" cy="24%" r="78%">
          <stop offset="0" stop-color="#fffdf9" stop-opacity=".92"/>
          <stop offset=".16" stop-color="#fffdf9" stop-opacity=".12"/>
          <stop offset=".46" stop-color="${IRIDESCENT_MEMBRANE.cyan}" stop-opacity=".1"/>
          <stop offset=".7" stop-color="${IRIDESCENT_MEMBRANE.pink}" stop-opacity=".18"/>
          <stop offset=".88" stop-color="${IRIDESCENT_MEMBRANE.violet}" stop-opacity=".09"/>
          <stop offset="1" stop-color="${IRIDESCENT_MEMBRANE.blue}" stop-opacity=".03"/>
        </radialGradient>
        <linearGradient id="bubble-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${IRIDESCENT_MEMBRANE.gold}" stop-opacity=".36"/>
          <stop offset=".24" stop-color="${IRIDESCENT_MEMBRANE.cyan}" stop-opacity=".82"/>
          <stop offset=".54" stop-color="${IRIDESCENT_MEMBRANE.violet}" stop-opacity=".5"/>
          <stop offset=".78" stop-color="${IRIDESCENT_MEMBRANE.pink}" stop-opacity=".72"/>
          <stop offset="1" stop-color="${IRIDESCENT_MEMBRANE.cyan}" stop-opacity=".4"/>
        </linearGradient>
        <filter id="bubble-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#35505b" flood-opacity=".11"/>
        </filter>
      </defs>
      ${bubbles.map(({ cx, cy, r, rotate }) => `
        <g transform="rotate(${rotate} ${cx} ${cy})" filter="url(#bubble-shadow)">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#bubble-fill)" stroke="url(#bubble-edge)" stroke-width="${Math.max(1.2, r * .035)}"/>
          <path d="M${cx - r * .62} ${cy - r * .28}A${r * .7} ${r * .7} 0 0 1 ${cx - r * .08} ${cy - r * .78}"
            fill="none" stroke="#fffdf9" stroke-opacity=".82" stroke-width="${Math.max(1.2, r * .08)}" stroke-linecap="round"/>
          <path d="M${cx + r * .12} ${cy + r * .78}A${r * .7} ${r * .7} 0 0 0 ${cx + r * .72} ${cy + r * .24}"
            fill="none" stroke="url(#bubble-edge)" stroke-opacity=".72" stroke-width="${Math.max(1, r * .05)}" stroke-linecap="round"/>
          <ellipse cx="${cx - r * .31}" cy="${cy - r * .42}" rx="${r * .17}" ry="${r * .08}" fill="#fffdf9" fill-opacity=".62"/>
        </g>`).join("")}
    </svg>`);
}

async function makePolaroid({ photoWidth, photoHeight, side, bottom, rotation }) {
  const frameWidth = photoWidth + side * 2;
  const frameHeight = photoHeight + side + bottom;
  const inset = 48;
  const photo = await sharp(source(SINGLE_SOURCE_HOME))
    .resize(photoWidth, photoHeight, { fit: "cover", position: "centre" })
    .modulate({ saturation: 1.04, brightness: 1.01 })
    .png()
    .toBuffer();
  const paper = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${frameWidth + inset * 2}" height="${frameHeight + inset * 2}">
      <defs>
        <pattern id="paper-grain" width="19" height="19" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="5" r=".65" fill="${P2_POLAROID.coral}" opacity=".08"/>
          <circle cx="14" cy="12" r=".55" fill="${P2_POLAROID.innerEdge}" opacity=".055"/>
          <path d="M0 17L19 15" stroke="${P2_POLAROID.gold}" stroke-opacity=".035"/>
        </pattern>
        <linearGradient id="paper-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fffdf8"/>
          <stop offset=".62" stop-color="${P2_POLAROID.paper}"/>
          <stop offset="1" stop-color="#f6efe3"/>
        </linearGradient>
        <linearGradient id="curl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#e4dbcf"/>
          <stop offset=".55" stop-color="#fffdf8"/>
          <stop offset="1" stop-color="#cfc4b8"/>
        </linearGradient>
        <filter id="paper-shadow" x="-30%" y="-30%" width="170%" height="190%">
          <feDropShadow dx="0" dy="20" stdDeviation="14" flood-color="${P2_POLAROID.paperShadow}" flood-opacity=".23"/>
        </filter>
      </defs>
      <g transform="translate(${inset + 9} ${inset + 12}) rotate(1.2 ${frameWidth / 2} ${frameHeight / 2})">
        <rect width="${frameWidth}" height="${frameHeight}" rx="7" fill="${P2_POLAROID.paperBack}" stroke="#cfc5b9"/>
      </g>
      <g filter="url(#paper-shadow)" transform="translate(${inset} ${inset})">
        <rect x=".5" y=".5" width="${frameWidth - 1}" height="${frameHeight - 1}" rx="6" fill="url(#paper-face)" stroke="#d4c9bb"/>
        <rect x="1" y="1" width="${frameWidth - 2}" height="${frameHeight - 2}" rx="5" fill="url(#paper-grain)"/>
        <path d="M${frameWidth - 34} 1H${frameWidth - 1}V34Z" fill="url(#curl)" opacity=".86"/>
        <path d="M${frameWidth - 34} 1L${frameWidth - 1} 34" stroke="#c8bdb1" stroke-opacity=".8"/>
        <rect x="${side - 1}" y="${side - 1}" width="${photoWidth + 2}" height="${photoHeight + 2}"
          fill="none" stroke="${P2_POLAROID.innerEdge}" stroke-opacity=".18"/>
        <path d="M${side + 22} ${side + photoHeight + Math.round(bottom * .48)}
          C${frameWidth * .34} ${side + photoHeight + Math.round(bottom * .39)},
          ${frameWidth * .62} ${side + photoHeight + Math.round(bottom * .62)},
          ${frameWidth - side - 30} ${side + photoHeight + Math.round(bottom * .46)}"
          fill="none" stroke="${P2_POLAROID.coral}" stroke-opacity=".2" stroke-width="2" stroke-linecap="round"/>
      </g>
    </svg>`);

  return sharp(paper)
    .composite([{ input: photo, left: inset + side, top: inset + side }])
    .rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function renderHomePreview({ compact }) {
  const size = compact ? { width: 1200, height: 800 } : { width: 1600, height: 1000 };
  const photoSpec = compact
    ? { photoWidth: 390, photoHeight: 219, side: 11, bottom: 52, rotation: -1.1 }
    : { photoWidth: 610, photoHeight: 343, side: 14, bottom: 66, rotation: -1.5 };
  const [background, polaroid] = await Promise.all([
    sharp(source("background.svg")).resize(size.width, size.height, { fit: "cover" }).png().toBuffer(),
    makePolaroid(photoSpec),
  ]);
  const position = compact ? { left: 642, top: 198 } : { left: 792, top: 168 };
  return sharp(background)
    .composite([
      { input: homeLayoutOverlay({ ...size, compact }), left: 0, top: 0 },
      { input: polaroid, ...position },
      { input: iridescentBubbleOverlay({ ...size, compact }), left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const [homePreview, compactHomePreview] = await Promise.all([
  renderHomePreview({ compact: false }),
  renderHomePreview({ compact: true }),
]);
await Promise.all([
  sharp(homePreview).toFile(output("evidence/home.png")),
  sharp(compactHomePreview).toFile(output("evidence/home-compact.png")),
]);

const TASK_STATE_ART = Object.freeze({
  staged: {
    family: "warm",
    opacity: 0.11,
    tint: "rgba(255,250,246,.12)",
    observation: "待命记录 / STAGED",
    page: "当前页 / 尚未开始",
    pill: "布景之形 / 待命中",
    accent: "#e990a6",
  },
  working: {
    family: "warm",
    opacity: 0.20,
    tint: "rgba(115,206,217,.08)",
    scale: 1.015,
    shiftX: -3,
    modulate: { saturation: 1 },
    linear: { gain: 1.1, offset: -12 },
    observation: "观察记录 / WORKING",
    page: "当前页 / 处理中",
    pill: "布景之形 / 记录中",
    accent: "#73ced9",
  },
  approval: {
    family: "approval",
    opacity: 0.43,
    tint: "rgba(117,86,217,.12)",
    observation: "等待确认 / APPROVAL",
    page: "当前页 / 等待确认",
    pill: "双形之页 / 等待决定",
    accent: "#866cdb",
  },
  error: {
    family: "error",
    opacity: 0.56,
    tint: "rgba(228,90,168,.18)",
    modulate: { brightness: 0.92, saturation: 1.04 },
    linear: { gain: 1.08, offset: -8 },
    observation: "异常记录 / ERROR",
    page: "当前页 / 检查失败项",
    pill: "幻灭之形 / 检查中",
    accent: "#d45a95",
  },
  complete: {
    family: "complete",
    opacity: 0.28,
    tint: "rgba(229,197,111,.10)",
    observation: "记录完成 / COMPLETE",
    page: "当前页 / 已归档",
    pill: "布景之形 / 已完成",
    accent: "#d3b457",
  },
});

function taskStateOverlay(spec, state) {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000">
      <rect x="424" y="301" width="430" height="38" rx="8" fill="#eaf7f7"/>
      <text x="434" y="325" fill="#5f7c89" font-family="Arial, sans-serif" font-size="12" letter-spacing="1.6">${spec.observation}</text>
      <rect x="428" y="564" width="380" height="42" fill="#fbffff"/>
      <text x="436" y="592" fill="#263548" font-family="Arial, sans-serif" font-size="15" font-weight="700">${spec.page}</text>
      <rect x="430" y="735" width="230" height="48" fill="#fbffff"/>
      <rect x="435" y="742" width="214" height="34" rx="17" fill="${spec.accent}" fill-opacity=".16"/>
      <text x="458" y="764" fill="#5f7c89" font-family="Arial, sans-serif" font-size="12">${spec.pill}</text>
      ${state === "complete" ? `
        <path d="M405 515H1220V548C1087 528 980 561 856 543C689 520 551 566 405 541Z"
          fill="#f1d67e" fill-opacity=".26"/>
      ` : ""}
    </svg>`);
}

async function renderTaskRailPanel(state) {
  const spec = TASK_STATE_ART[state];
  const panelWidth = 320;
  const scale = spec.scale || 1;
  const stageWidth = Math.round(panelWidth * scale);
  const stageHeight = Math.round(1000 * scale);
  const stageLeft = Math.round((panelWidth - stageWidth) / 2 + (spec.shiftX || 0));
  const stageTop = Math.round((1000 - stageHeight) / 2);
  let stagePipeline = sharp(output(TASK_RAIL_SOURCES[spec.family].target))
    .resize(stageWidth, stageHeight, { fit: "cover", position: "centre" });
  if (spec.modulate) stagePipeline = stagePipeline.modulate(spec.modulate);
  if (spec.linear) stagePipeline = stagePipeline.linear(spec.linear.gain, spec.linear.offset);
  const scaledStage = await stagePipeline.ensureAlpha(spec.opacity).png().toBuffer();
  const stage = scale === 1
    ? scaledStage
    : await sharp(scaledStage)
      .extract({ left: -stageLeft, top: -stageTop, width: panelWidth, height: 1000 })
      .png()
      .toBuffer();
  const panelBacking = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}" height="1000">
      <rect width="${panelWidth}" height="1000" fill="#f5eeee"/>
    </svg>`);
  const panelOverlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${panelWidth}" height="1000">
      <defs>
        <linearGradient id="panel-fade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#eef9f8"/>
          <stop offset=".12" stop-color="#eef9f8" stop-opacity=".82"/>
          <stop offset=".28" stop-color="#eef9f8" stop-opacity=".24"/>
          <stop offset=".46" stop-color="#eef9f8" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="${panelWidth}" height="1000" fill="${spec.tint}"/>
      ${state === "complete" ? '<radialGradient id="paper-fog" cx="92%" cy="92%" r="36%"><stop offset="0" stop-color="#f7eee9" stop-opacity=".34"/><stop offset="1" stop-color="#f7eee9" stop-opacity="0"/></radialGradient><rect width="320" height="1000" fill="url(#paper-fog)"/>' : ""}
      <rect width="${panelWidth}" height="1000" fill="url(#panel-fade)"/>
      <path d="M1 0V1000" stroke="${state === "error" ? "#e45aa8" : "#73ced9"}" stroke-opacity="${state === "error" ? ".32" : ".28"}"/>
    </svg>`);
  return sharp(panelBacking)
    .composite([
      { input: stage, left: 0, top: 0 },
      { input: panelOverlay, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

async function renderTaskPreview(state) {
  const spec = TASK_STATE_ART[state];
  const taskBase = await sharp(source("task-preview.svg"))
    .resize(1600, 1000, { fit: "cover" })
    .png()
    .toBuffer();
  if (!spec) return taskBase;
  const [taskBackground, rail] = await Promise.all([
    sharp(taskBase)
      .composite([{ input: taskStateOverlay(spec, state), left: 0, top: 0 }])
      .png()
      .toBuffer(),
    renderTaskRailPanel(state),
  ]);
  return sharp(taskBackground)
    .composite([{ input: rail, left: 1280, top: 0, blend: "over" }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function renderTaskTransition(fromState, toState, progress) {
  const fromPreview = await renderTaskPreview(fromState);
  const toRail = await renderTaskRailPanel(toState);
  const fadedRail = await sharp(toRail)
    .removeAlpha()
    .ensureAlpha(progress)
    .png()
    .toBuffer();
  return sharp(fromPreview)
    .composite([{ input: fadedRail, left: 1280, top: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

const [taskStaged, taskWorking, taskApproval, taskError, taskComplete] = await Promise.all([
  renderTaskPreview("staged"),
  renderTaskPreview("working"),
  renderTaskPreview("approval"),
  renderTaskPreview("error"),
  renderTaskPreview("complete"),
]);
await Promise.all([
  sharp(taskStaged).toFile(output("evidence/task-staged.png")),
  sharp(taskWorking).toFile(output("evidence/task.png")),
  sharp(taskApproval).toFile(output("evidence/task-approval.png")),
  sharp(taskError).toFile(output("evidence/task-error.png")),
  sharp(taskComplete).toFile(output("evidence/task-complete.png")),
]);

const [taskWorkingToApproval, taskErrorToComplete] = await Promise.all([
  renderTaskTransition("working", "approval", 0.82),
  renderTaskTransition("error", "complete", 0.92),
]);
await Promise.all([
  sharp(taskWorkingToApproval).toFile(output("evidence/task-working-to-approval-350ms.png")),
  sharp(taskErrorToComplete).toFile(output("evidence/task-error-to-complete-500ms.png")),
]);

for (const target of [
  ...runtimeArt.map((item) => item.target),
  ...Object.values(TASK_RAIL_SOURCES).map((item) => item.target),
]) {
  const stat = await fs.stat(output(target));
  if (stat.size > 1024 * 1024) throw new Error(`runtime artwork exceeds 1 MiB: ${target}`);
}

console.log("rendered 15 Denia assets");
