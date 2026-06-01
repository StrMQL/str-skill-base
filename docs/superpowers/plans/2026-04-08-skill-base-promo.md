# Skill Base Promo HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable promo page for Skill Base that renders Xiaohongshu-ready cards for three content phases and exports each card or the current phase as PNG images.

**Architecture:** Keep content in one focused data module and keep the page renderer thin. The HTML file owns layout, visual style, and DOM wiring; the data module owns phase/card content plus small helpers for export naming and validation; tests cover the content structure so future edits do not silently break the page.

**Tech Stack:** Static HTML, CSS, browser JavaScript modules, `html2canvas`, Node.js built-in test runner

---

### Task 1: Create promo content module with testable structure

**Files:**
- Create: `promo-content.js`
- Create: `tests/promo-content.test.js`

- [ ] **Step 1: Write the failing test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { PROMO_PHASES, getPhaseById, getCardExportName } = require('../promo-content.js');

test('defines three promo phases with seven cards each', () => {
  assert.equal(PROMO_PHASES.length, 3);

  for (const phase of PROMO_PHASES) {
    assert.equal(phase.cards.length, 7);
    assert.ok(phase.cards.every((card) => card.id && card.title && card.exportName));
  }
});

test('looks up phase ids and builds png export names', () => {
  const phase = getPhaseById('phase-1');
  assert.equal(phase.title, '第一期｜为什么团队需要 Skill Base');
  assert.equal(getCardExportName(phase.cards[0]), 'skill-base-phase-1-cover.png');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/promo-content.test.js`
Expected: FAIL with module not found for `promo-content.js`

- [ ] **Step 3: Write minimal implementation**

```js
const PROMO_PHASES = [
  {
    id: 'phase-1',
    title: '第一期｜为什么团队需要 Skill Base',
    summary: '问题递进 + 证据落地',
    cards: [
      {
        id: 'cover',
        type: 'cover',
        eyebrow: 'Skill Base / 01',
        title: '为什么团队需要 Skill Base',
        desc: '团队明明已经积累了经验，但 AI 并不会自动理解这些经验。',
        points: [
          'AI 很强，但它不认识你们公司的业务黑话',
          'Prompt 可以复制，团队经验却很难稳定分发',
          'Skill Base 的目标就是把经验变成可安装资产'
        ],
        exportName: 'skill-base-phase-1-cover'
      }
    ]
  }
];

function getPhaseById(phaseId) {
  return PROMO_PHASES.find((phase) => phase.id === phaseId) || PROMO_PHASES[0];
}

function getCardExportName(card) {
  return `${card.exportName}.png`;
}

module.exports = {
  PROMO_PHASES,
  getPhaseById,
  getCardExportName
};
```

- [ ] **Step 4: Expand the implementation to full card data**

```js
const phaseIds = ['phase-1', 'phase-2', 'phase-3'];
const cardTypes = ['cover', 'pain', 'solution', 'proof', 'cta', 'benefit', 'flow'];

for (const phase of PROMO_PHASES) {
  if (!phaseIds.includes(phase.id)) {
    throw new Error(`Unknown phase id: ${phase.id}`);
  }

  if (phase.cards.length !== 7) {
    throw new Error(`Phase ${phase.id} must contain 7 cards`);
  }

  for (const card of phase.cards) {
    if (!cardTypes.includes(card.type)) {
      throw new Error(`Unknown card type: ${card.type}`);
    }

    if (!card.id || !card.title || !card.exportName) {
      throw new Error(`Card is missing required fields in phase ${phase.id}`);
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test tests/promo-content.test.js`
Expected: PASS

### Task 2: Rebuild promo page around reusable data and card export

**Files:**
- Modify: `promo.html`

- [ ] **Step 1: Write the failing page-level test expectation in prose**

```txt
The page must:
1. import `promo-content.js`
2. render phase switch buttons from data
3. render 7 cards for the active phase
4. expose per-card export buttons and a current-phase export button
5. show local screenshot assets inside mockup windows
```

- [ ] **Step 2: Replace the current one-shot grid with a data-driven page shell**

```html
<div class="page-shell">
  <header class="topbar">
    <div>
      <p class="eyebrow">Skill Base Promo Cards</p>
      <h1>把团队经验做成 AI 能安装的资产</h1>
    </div>
    <div class="toolbar-actions">
      <button id="export-phase-btn" type="button">导出当前期全部卡片</button>
    </div>
  </header>

  <nav class="phase-switcher" id="phase-switcher"></nav>
  <main class="card-list" id="card-list"></main>
</div>
```

- [ ] **Step 3: Render cards from the shared content module**

```html
<script type="module">
  import { PROMO_PHASES, getPhaseById, getCardExportName } from './promo-content.js';

  let activePhaseId = PROMO_PHASES[0].id;

  function renderPhaseButtons() {
    // create one button per phase
  }

  function renderCards() {
    const phase = getPhaseById(activePhaseId);
    // render 7 cards from phase.cards
  }
</script>
```

- [ ] **Step 4: Implement minimal export helpers with `html2canvas`**

```js
async function exportCard(cardElement, fileName) {
  const canvas = await html2canvas(cardElement, {
    scale: 2,
    backgroundColor: '#F8FAFC',
    useCORS: true
  });

  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = fileName;
  link.click();
}

async function exportCurrentPhase() {
  const phase = getPhaseById(activePhaseId);

  for (const card of phase.cards) {
    const cardElement = document.querySelector(`[data-card-id="${card.id}"]`);
    await exportCard(cardElement, getCardExportName(card));
  }
}
```

- [ ] **Step 5: Keep screenshot rendering simple**

```js
function renderScreenshotBlock(card) {
  if (!card.screenshots || card.screenshots.length === 0) {
    return '';
  }

  return `
    <div class="shot-grid">
      ${card.screenshots.map((shot) => `
        <figure class="shot-window">
          <div class="shot-window-bar">
            <span class="dot dot-red"></span>
            <span class="dot dot-yellow"></span>
            <span class="dot dot-green"></span>
          </div>
          <img src="${shot.src}" alt="${shot.alt}">
        </figure>
      `).join('')}
    </div>
  `;
}
```

### Task 3: Verify behavior and clean up copy

**Files:**
- Modify: `promo-content.js`
- Modify: `promo.html`
- Test: `tests/promo-content.test.js`

- [ ] **Step 1: Run focused automated tests**

Run: `node --test tests/promo-content.test.js`
Expected: PASS

- [ ] **Step 2: Run the project test suite to catch collateral damage**

Run: `pnpm test`
Expected: existing suite stays green

- [ ] **Step 3: Sanity-check final copy and export affordances**

```txt
Check that:
1. each card title is one clear statement
2. no card has more than 3 bullet points
3. phase button labels clearly distinguish 3 periods
4. export buttons say exactly what they do
```

- [ ] **Step 4: Confirm docs and implementation still match**

```txt
Check `docs/superpowers/specs/2026-04-08-skill-base-promo-design.md` against:
1. three fixed phases
2. seven cards per phase
3. per-card PNG export
4. screenshot use on proof-oriented cards
```
