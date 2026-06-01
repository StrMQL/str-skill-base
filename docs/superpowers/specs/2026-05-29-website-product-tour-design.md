# 设计规范：website/ Scroll-linked 产品导览区

## 1. 背景与目标

用户希望 Skill Base 官网（`website/`）具备类似 [Cursor 官网](https://cursor.com) 的高级感：**滚动时文案与产品界面联动**，让访客「看到产品在用」，而不只是读文字。

本规范聚焦 **方案 B**：在 `#why` 与 `#features` 之间新增 **Scroll-linked 产品导览区**，桌面端采用「左侧 sticky 步骤文案 + 右侧 sticky 产品 mockup 切换」的 Cursor 式叙事结构。

### 目标

- 用真实 Web / Desktop 界面截图证明「这是可操作产品，不是概念图」
- 滚动（或点击步骤）时，右侧 mockup 平滑切换对应场景
- 保持现有技术栈：Vanilla HTML / CSS / JS，无框架、无 WebGL、无视频
- 中英文双语、浅/深主题、移动端可用、`prefers-reduced-motion` 可访问

### 非目标

- 不改造 Hero 区（终端动画保留）
- 不替换 `#what-is-skill` 场景 Tab（代码对比区保留）
- 不做 CSS 重建的迷你 UI（第一期只用截图）
- 不新增 npm 依赖

---

## 2. 页面位置与导航

### 2.1 插入点

在 `website/index.html` 中，紧接 `</section>` of `#why`（`class="why-skill-base"`）之后、`#features` 之前插入新区块：

```html
<section class="product-tour band-light" id="product-tour">
  ...
</section>
```

### 2.2 导航栏

在 `#site-navbar` 的 `.nav-links` 中，`#features` 链接之前增加一项：

| 语言 | 文案 | href |
|------|------|------|
| zh | 产品一览 | `#product-tour` |
| en | Product tour | `#product-tour` |

沿用现有 `.i18n-zh` / `.i18n-en` 模式。

---

## 3. 信息架构：4 个导览步骤

每个步骤 = 一组「文案 + mockup 帧」。步骤按用户使用路径排序：先 Web 浏览 → 版本管理 → Desktop 图形化 → CLI 分发。

| step | id | 平台 | 标题 (zh) | 标题 (en) | 截图 | mockup 类型 |
|------|-----|------|-----------|-----------|------|-------------|
| 1 | `tour-web-browse` | Web | 浏览团队 Skill 库 | Browse your team library | `web-home.png` | browser |
| 2 | `tour-web-version` | Web | 版本追溯与详情 | Versions & detail | `web-detail.png` | browser |
| 3 | `tour-desktop` | Desktop | 桌面端一键安装 | Install from desktop | `desktop-market.png` → `desktop-install.png` | desktop（双帧交叉） |
| 4 | `tour-cli` | CLI | 命令行分发到 IDE | Ship to your IDE | 内联终端 DOM | terminal |

### 3.1 步骤文案结构（每步固定字段）

```html
<article class="product-tour-step" data-tour-step="tour-web-browse">
  <span class="product-tour-step-label">01 · Web</span>
  <h3>...</h3>
  <p class="product-tour-step-lead">...</p>
  <ul class="product-tour-step-points">...</ul>
</article>
```

- `step-label`：平台 + 序号，小字 muted
- `h3`：主标题（中英各一，`.i18n-zh` / `.i18n-en`）
- `lead`：一句价值主张
- `points`：最多 3 条 bullet，讲具体能力

### 3.2 各步文案（定稿）

**Step 1 — Web 浏览**

- zh 标题：浏览团队 Skill 库
- en 标题：Browse your team library
- zh lead：在浏览器里搜索、筛选、收藏——非研发也能找到需要的 Skill。
- en lead：Search, filter, and favorite Skills in the browser—PMs and QA included.
- points (zh)：全文搜索 Skill 名称与描述 / 按标签与收藏快速筛选 / 登录后即可安装到本地
- points (en)：Full-text search / Filter by tags and favorites / Install locally after sign-in

**Step 2 — Web 版本**

- zh 标题：版本追溯与详情
- en 标题：Versions & detail
- zh lead：每次发布自动打版本号，谁改了什么、当前 Head 是哪一版，一目了然。
- en lead：Every publish gets a timestamped version—see history and current head at a glance.
- points (zh)：时间戳版本号 `vYYYYMMDD.HHmmss` / 版本列表与变更说明 / 管理者可设 webhook 通知
- points (en)：Timestamp versions / Version list with notes / Optional webhooks for managers

**Step 3 — Desktop**

- zh 标题：桌面端一键安装
- en 标题：Install from desktop
- zh lead：Tauri 原生客户端：逛市场、点安装、看本地 Skill——不用记命令。
- en lead：Native Tauri app—browse the market, one-click install, manage local Skills.
- points (zh)：Skill 市场浏览与搜索 / 一键安装到本地或 IDE 目录 / 本地 Skill 管理与发布
- points (en)：Market browse & search / One-click install / Local manage & publish
- **mockup 特殊**：此步右侧在 step 激活后，两帧截图 `desktop-market.png` 与 `desktop-install.png` 每 4s 自动交叉淡入（仅当该 step 为 active；离开 step 暂停计时）

**Step 4 — CLI**

- zh 标题：命令行分发到 IDE
- en 标题：Ship to your IDE
- zh lead：`skb search / install / publish`——熟悉的 npm 式工作流，装到 Cursor、Claude 或任意目录。
- en lead：`skb search / install / publish`—npm muscle memory, into Cursor, Claude, or any path.
- points (zh)：`npx skill-base` 一行启动服务 / `skb install <skill> --ide cursor` / 团队统一版本，按需更新
- points (en)：One-line server start / IDE-targeted install / Team-wide version sync
- **mockup 特殊**：复用站点已有 `.terminal` 结构，内嵌静态 4 行命令（非 Hero 打字动画），避免两个终端同时跑 JS 动画

---

## 4. 布局与视觉

### 4.1 桌面（≥ 1024px）

```
┌──────────────────────────────────────────────────────────────┐
│  section-title + section-subtitle（居中）                      │
├──────────────────────┬───────────────────────────────────────┤
│  product-tour-rail   │  product-tour-stage (sticky)          │
│  (scroll 自然高度)    │  top: calc(64px + 32px)               │
│                      │                                       │
│  [Step 1 文案]       │   ┌─ browser / desktop / terminal ─┐  │
│       ↕ min-height   │   │  ● ● ●  mockup chrome           │  │
│  [Step 2 文案]       │   │  [ screenshot or terminal ]     │  │
│       ↕              │   └─────────────────────────────────┘  │
│  [Step 3 文案]       │                                       │
│       ↕              │   （mockup 随 active step 交叉淡入）    │
│  [Step 4 文案]       │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

- **Grid**：`grid-template-columns: minmax(0, 420px) minmax(0, 1fr)`，`gap: 64px`
- **左侧 rail**：每步 `min-height: 85vh`，保证滚动时有足够「停留」区间触发切换
- **右侧 stage**：`position: sticky`，mockup 固定视口内，内容帧切换
- **Section 背景**：`band-light`（与 `#why` / `#features` 一致）

### 4.2 平板 / 手机（< 1024px）

- 取消 sticky 双栏，改为 **垂直堆叠**：每步 = 「文案块 + mockup」成对出现
- mockup 宽度 100%，`max-width: 560px`，居中
- 步骤之间 `margin-bottom: 48px`
- 右侧 stage 的「全局 sticky mockup」在移动端 **不渲染**（HTML 里 mockup 跟在各 step 内，或通过 CSS 重排为 step 内嵌）
- **实现策略（简单）**：桌面用一套 sticky stage + 隐藏 rail 内 mockup；移动用 `@media` 隐藏 sticky stage，每 step 下方显示对应 mockup（duplicate markup 可接受——4 步仅 4 张图，DOM 重复比 JS 重排更稳）

**更干净的做法（推荐）**：单一 DOM——mockup 帧全在 sticky stage；移动端 sticky 解除（`position: relative`），rail 每步后插入 spacer，用 JS 在 mobile 把 stage 视觉上「跟」到当前 step（复杂）。

**最终选定（YAGNI）**：**双 DOM 策略**

| 视口 | 结构 |
|------|------|
| ≥1024px | `.product-tour-layout--desktop`：rail + sticky stage |
| <1024px | `.product-tour-layout--mobile`：每 step 内含 `.product-tour-step-media` |

两套布局用 CSS `display: none / block` 切换，mockup 图片路径相同。移动端不做 scroll-linked，仅 fade-in 进入视口。桌面端才启用 IntersectionObserver 驱动 stage 切换。

### 4.3 Mockup 窗口 chrome

复用 `promo.html` 的 `.shot-window` 视觉，在 `website/css/index.css` 内联等价样式（不 cross-import promo.html）：

```css
.product-mockup { /* = shot-window */ }
.product-mockup-bar { /* traffic lights + title */ }
.product-mockup-media img { width: 100%; height: auto; display: block; }
```

**Browser 帧**：bar 标题 `skill-base.local/skills`  
**Desktop 帧**：bar 标题 `Skill Base`  
**Terminal 帧**：沿用 `.terminal` / `.terminal-header` / `.terminal-body` 现有 class

- 圆角：`var(--radius-xl)`（16px，对齐 DESIGN.md）
- 阴影：`var(--shadow-level-2)`
- 边框：`1px solid var(--hairline)`

### 4.4 步骤激活态

当前 active 步骤的文案侧：

```css
.product-tour-step.is-active h3 { color: var(--ink); }
.product-tour-step.is-active .product-tour-step-label { opacity: 1; }
.product-tour-step:not(.is-active) { opacity: 0.45; } /* 桌面 rail */
.product-tour-step.is-active { opacity: 1; }
```

非 active 步骤弱化，active 步骤全对比——Cursor 式视觉引导。

### 4.5 Mockup 帧切换动画

```css
.product-mockup-frame {
  position: absolute;
  inset: 0;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.5s ease, transform 0.5s ease;
  pointer-events: none;
}
.product-mockup-frame.is-active {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
```

- 仅 `opacity` + `transform`（GPU 友好）
- `prefers-reduced-motion: reduce` 时：`transition: none`，instant switch

---

## 5. 数据结构与 JS 行为

### 5.1 步骤注册表

在 `website/index.html` 底部 `<script>` 内（或新建 `website/js/product-tour.js` defer 加载）：

```js
const PRODUCT_TOUR_STEPS = [
  { id: 'tour-web-browse',   frame: 'frame-web-home' },
  { id: 'tour-web-version',  frame: 'frame-web-detail' },
  { id: 'tour-desktop',      frame: 'frame-desktop', subframes: ['frame-desktop-market', 'frame-desktop-install'], subframeInterval: 4000 },
  { id: 'tour-cli',          frame: 'frame-cli' },
];
```

### 5.2 Scroll-linked 逻辑（仅桌面 ≥1024px）

1. `initProductTour()` 在 `DOMContentLoaded` 调用
2. `matchMedia('(min-width: 1024px)')` 为 false 时：只观察 fade-in，不绑定 step observer
3. 为每个 `.product-tour-step` 创建 `IntersectionObserver`：
   - `root: null`
   - `rootMargin: '-40% 0px -40% 0px'`（步骤进入视口中央带时触发）
   - `threshold: 0`
4. 多个 step 同时 intersect 时，取 **intersectionRatio 最大** 者为 active
5. active 变化时：
   - 更新 step 的 `.is-active`
   - 更新 stage 内 `.product-mockup-frame.is-active`
   - 若 step 3：启动 subframe 轮播 timer；否则清除 timer

### 5.3 键盘与可访问性

- 每个 `.product-tour-step` 设 `tabindex="0"`，`aria-current="step"` 在 active 步
- sticky stage 容器：`aria-live="polite"`，`aria-label` 描述当前展示界面
- 截图 `alt` 写清界面内容（中英各一，或通过 `alt` 统一英文 + `aria-describedby` 中文——与站现惯例一致：img 一个 alt，取英文描述）
- 步骤 label 对屏幕阅读器可见，不用 `aria-hidden`

### 5.4 错误处理

- 图片 `onerror`：mockup 容器加 `.is-error`，显示 fallback 文案「截图加载失败」
- Observer 不存在（旧浏览器）：首步默认 active，静态展示 4 步文案 + 首帧截图

---

## 6. 静态资源

### 6.1 截图拷贝

将现有素材 **复制** 到 `website/assets/product-tour/`（避免运行时依赖 repo 根 `docs/images/`）：

| 源文件 | 目标 |
|--------|------|
| `docs/images/skill-base-home.png` | `website/assets/product-tour/web-home.png` |
| `docs/images/skill-detail.png` | `website/assets/product-tour/web-detail.png` |
| `docs/images/desktop-market.png` | `website/assets/product-tour/desktop-market.png` |
| `docs/images/desktop-install.png` | `website/assets/product-tour/desktop-install.png` |

后续 UI 改版时只需替换这 4 张 PNG。

### 6.2 CLI 终端静态内容

```html
<div class="terminal-body product-tour-terminal-body">
  <div class="terminal-line"><span class="prompt">~</span> npx skill-base -p 8000</div>
  <div class="terminal-line output success">Server running at http://localhost:8000</div>
  <div class="terminal-line"><span class="prompt">~</span> skb install team-vue-rules --ide cursor</div>
  <div class="terminal-line output success">✓ Installed to .cursor/skills/team-vue-rules</div>
</div>
```

不使用 Hero 的 `typeChar` 动画。

---

## 7. HTML 骨架（桌面布局）

```html
<section class="product-tour band-light" id="product-tour">
  <div class="container">
    <h2 class="section-title fade-in">
      <span class="i18n-zh">产品一览</span>
      <span class="i18n-en">See it in action</span>
    </h2>
    <p class="section-subtitle fade-in">
      <span class="i18n-zh">Web、Desktop、CLI——同一套 Skill，三种用法</span>
      <span class="i18n-en">Web, desktop, and CLI—one Skill library, three surfaces</span>
    </p>

    <div class="product-tour-layout product-tour-layout--desktop">
      <div class="product-tour-rail">
        <!-- 4 × product-tour-step articles -->
      </div>
      <div class="product-tour-stage" aria-live="polite">
        <div class="product-mockup product-mockup--browser">
          <div class="product-mockup-bar">...</div>
          <div class="product-mockup-viewport">
            <figure class="product-mockup-frame is-active" id="frame-web-home">...</figure>
            <figure class="product-mockup-frame" id="frame-web-detail">...</figure>
            <!-- desktop ×2, cli terminal -->
          </div>
        </div>
      </div>
    </div>

    <div class="product-tour-layout product-tour-layout--mobile">
      <!-- 4 steps, each with embedded product-mockup -->
    </div>
  </div>
</section>
```

---

## 8. CSS 新增范围

在 `website/css/index.css` 追加区块（约 180–220 行）：

- `.product-tour` section spacing（`padding: var(--section-padding)`）
- `.product-tour-layout--desktop` grid + sticky
- `.product-tour-layout--mobile` stack
- `.product-tour-step` / `.is-active` 状态
- `.product-mockup*` chrome
- `.product-mockup-frame` 切换
- `@media (max-width: 1023px)` 布局切换
- `@media (prefers-reduced-motion: reduce)` 禁用 transition
- `html[data-theme="dark"]` 下 mockup bar 背景微调（`var(--surface-strong)`）

不修改无关 section 样式。

---

## 9. 与现有区块的关系

| 区块 | 关系 |
|------|------|
| `#hero` 终端 | 独立；Hero 继续打字动画，导览区 CLI 步为静态终端 |
| `#what-is-skill` | 互补；场景 Tab 讲「Skill 价值」，导览讲「产品界面」 |
| `#why` | 上文承接痛点，导览给出「解法长什么样」 |
| `#features` | 下文特性卡片可保留；导览已视觉演示其中 Web/Desktop/CLI，无需删特性区 |

---

## 10. 验证清单

- [ ] 桌面 Chrome / Safari：滚动 `#product-tour`，mockup 随步骤切换，无抖动
- [ ] Step 3 激活时 market ↔ install 自动轮播；切到其他 step 停止
- [ ] 移动端 iOS Safari：垂直堆叠，每步自带 mockup，无 sticky 遮挡
- [ ] 深浅主题切换：mockup chrome 可读
- [ ] 中英文切换：文案正确，截图不变
- [ ] `prefers-reduced-motion`：无过渡动画，内容仍完整
- [ ] 导航 `#product-tour` 锚点跳转正确（考虑 fixed nav offset：`scroll-margin-top: 80px`）
- [ ] 4 张 PNG 缺失时 fallback 文案显示
- [ ] Lighthouse：无新增 CLS（mockup viewport 预设 `aspect-ratio: 16/10` + `min-height`）

---

## 11. 自审 (Self-Review)

1. **占位符**：无 TBD；步骤文案、文件路径、observer 参数均已固化。
2. **一致性**：mockup 圆角/阴影与 DESIGN.md 的 `{rounded.xl}`、`shadow-level-2` 一致；i18n 与全站相同模式。
3. **范围**：仅新增一个 section + 资源拷贝 + CSS/JS，不扩散到 Hero / features 重构。
4. **歧义消除**：移动端采用双 DOM 布局（desktop/mobile 分支），避免过度复杂的 JS 重排；桌面才 scroll-linked。

---

## 12. 后续可选（本期不做）

- Hero 双窗口轮播（方案 A）
- 特性卡片内嵌小预览
- 截图热点高亮（CSS overlay 圈选 UI 元素）
- 自动播放 GIF / 录屏
