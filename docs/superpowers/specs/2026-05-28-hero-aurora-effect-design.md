# 设计规范：website/ Hero 区域极光流动效果

## 1. 背景与目标
在 `website/` 的 Hero 区域（`.hero`）引入现代、低阻尼、流畅的“极光（Aurora）”流动效果，提升 Skill Base 门户网站的视觉质感与专业品牌形象，同时保持极简主义和极致性能。

具体要求：
- **纯 CSS 方案**：不引入额外的 JavaScript / WebGL 重型库，完全基于 CSS 变量、高斯模糊、3D 变换（Composite 图层）和 `@keyframes` 动画实现。
- **极致性能**：动画仅使用 `transform`，并在关键节点设置 `will-change: transform`，强制 GPU 硬件加速，避免触发浏览器的 Repaint 与 Reflow。
- **浅色与深色主题（Light/Dark）完美适配**：根据页面 `data-theme` 状态切换极光的色调与透明度，实现和谐自然的视觉咬合。

---

## 2. 数据结构与设计决策 (Design Decisions)

### 2.1 色调与透明度配置
由于 Hero 区域在 Light 和 Dark 模式下均使用黑色背景，因此通过调整极光 blob 的颜色与不透明度来配合外部网页环境：

* **Light（浅色）主题时** (网页明亮白底，Hero 区域暗底)：
  * 目标：高净度、冷冽、通透的冰川极光，使暗底 Hero 在白底网页中过渡自然。
  * `var(--aurora-1)`: `rgba(0, 242, 254, 0.14)` (冰蓝)
  * `var(--aurora-2)`: `rgba(0, 255, 136, 0.10)` (薄荷绿)
  * `var(--aurora-3)`: `rgba(168, 85, 247, 0.10)` (优雅紫)

* **Dark（深色）主题时** (整站深夜黑)：
  * 目标：低对比度、幽深、克制的科技霓虹，完美融入沉浸式暗色底。
  * `var(--aurora-1)`: `rgba(30, 64, 175, 0.18)` (深海蓝)
  * `var(--aurora-2)`: `rgba(16, 185, 129, 0.12)` (极光翠绿)
  * `var(--aurora-3)`: `rgba(109, 40, 217, 0.15)` (神秘黛紫)

### 2.2 动画与层级设计
- **模糊半径**：`filter: blur(140px)`，确保色彩彻底交融、无生硬色块边缘。
- **混合模式**：`mix-blend-mode: screen`，在黑底上展现出色的发光融合效果。
- **层级管理**：
  * 极光容器 `.hero-aurora`：`position: absolute; z-index: 0; pointer-events: none; overflow: hidden;`，完全不拦截鼠标，不干扰前台文字与 Terminal 终端的选择、拷贝或点击操作。
  * 前台内容：确保 `.container` 及内部元素具有 `position: relative; z-index: 1;`。

---

## 3. 技术实现方案

### 3.1 HTML 结构变更
在 `website/index.html` 的 `<section id="hero">` 容器最顶部插入极光背景结构：

```html
<section class="hero hero-band-dark" id="hero">
  <div class="hero-aurora" aria-hidden="true">
    <div class="aurora-blob aurora-blob-1"></div>
    <div class="aurora-blob aurora-blob-2"></div>
    <div class="aurora-blob aurora-blob-3"></div>
  </div>
  <div class="container">
    <!-- 原有内容不变 -->
  </div>
</section>
```

### 3.2 CSS 变量与动画定义
在 `website/css/index.css` 的 `:root` 与 `html[data-theme="dark"]` 中配置对应的颜色：

```css
:root {
  /* 极光冰川冷色调 (Light 模式) */
  --aurora-1: rgba(0, 242, 254, 0.14);
  --aurora-2: rgba(0, 255, 136, 0.10);
  --aurora-3: rgba(168, 85, 247, 0.10);
}

html[data-theme="dark"] {
  /* 极光暗夜霓虹色调 (Dark 模式) */
  --aurora-1: rgba(30, 64, 175, 0.18);
  --aurora-2: rgba(16, 185, 129, 0.12);
  --aurora-3: rgba(109, 40, 217, 0.15);
}
```

在 `.hero-band-dark` 相关的 CSS 段落中追加以下样式：

```css
/* 极光背景容器 */
.hero-aurora {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

/* 极光彩色球体 */
.aurora-blob {
  position: absolute;
  border-radius: var(--radius-full);
  filter: blur(140px);
  mix-blend-mode: screen;
  will-change: transform;
}

.aurora-blob-1 {
  top: -10%;
  left: -10%;
  width: 50vw;
  height: 50vw;
  min-width: 350px;
  min-height: 350px;
  background: var(--aurora-1);
  animation: aurora-shift-1 25s infinite alternate ease-in-out;
}

.aurora-blob-2 {
  bottom: -10%;
  right: -5%;
  width: 45vw;
  height: 45vw;
  min-width: 300px;
  min-height: 300px;
  background: var(--aurora-2);
  animation: aurora-shift-2 20s infinite alternate ease-in-out;
}

.aurora-blob-3 {
  top: 20%;
  left: 35%;
  width: 40vw;
  height: 40vw;
  min-width: 280px;
  min-height: 280px;
  background: var(--aurora-3);
  animation: aurora-shift-3 22s infinite alternate ease-in-out;
  opacity: 0.8;
}

/* 硬件加速流动动画 */
@keyframes aurora-shift-1 {
  0% {
    transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
  }
  33% {
    transform: translate3d(8%, 12%, 0) scale(1.08) rotate(120deg);
  }
  66% {
    transform: translate3d(-6%, 6%, 0) scale(0.92) rotate(240deg);
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1) rotate(360deg);
  }
}

@keyframes aurora-shift-2 {
  0% {
    transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
  }
  50% {
    transform: translate3d(-10%, -8%, 0) scale(0.95) rotate(-180deg);
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1) rotate(-360deg);
  }
}

@keyframes aurora-shift-3 {
  0% {
    transform: translate3d(0, 0, 0) scale(1);
  }
  50% {
    transform: translate3d(10%, -12%, 0) scale(1.12);
  }
  100% {
    transform: translate3d(0, 0, 0) scale(1);
  }
}
```

---

## 4. 自微审查 (Self-Review)
1. **占位符检查**：本规范中没有任何 TBD/TODO，参数、CSS 类名和设计逻辑均已明确固化。
2. **一致性检查**：混合模式选用 `mix-blend-mode: screen` 与黑底完美融合；层级明确定义 `z-index: 0` 与 `pointer-events: none` 以确保完全不干扰终端和文本的前台操作，这与 `index.html` 的结构一致。
3. **适配细节**：极光 blob 仅在 Hero 区域内部定位流动，利用绝对定位和 `overflow: hidden` 防止溢出到网页外部其他亮色模块中，保证了设计的高度内聚性。
