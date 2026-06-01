# Website Hero Product Hunt 布局调整设计

## 目标

优化 `website/index.html` 的 Hero 区信息层级，让 Product Hunt 徽章承担次级入口角色，同时把 `Learn more` 从按钮降级为纯滚动提示，避免主 CTA 区出现三个不同层级的操作。

## 数据结构与层级

Hero 区只保留 3 类交互元素：

1. 主 CTA：`npx skill-base`
2. 次级外链：`Product Hunt badge`
3. 页面内滚动提示：跳转到 `#what-is-skill` 的下箭头

不变量：

- Hero 主操作只能有一个，仍然是 `npx skill-base`
- Product Hunt 徽章属于次级入口，可以与主 CTA 同层，但不能悬挂在 CTA 区外形成第三层
- `Learn more` 只负责提示继续向下浏览，不再作为按钮参与竞争注意力
- 移动端仍然自然堆叠，不引入新脚本逻辑

## 方案

采用用户确认的方案 1：

- 删除 Hero CTA 区中的 `Learn more` 按钮
- 将 Product Hunt 徽章移动到原 `Learn more` 按钮位置，与主 CTA 同一行
- 在 Hero 区底部中央新增一个轻量下箭头锚点，链接到 `#what-is-skill`

## 组件与样式调整

需要调整的结构：

- `hero-cta`
- `hero-product-hunt`
- 新增 `hero-scroll-indicator`

样式原则：

- CTA 区保持一主一次两项结构
- Product Hunt 徽章保持原始素材，不额外包装成伪按钮
- 下箭头弱化视觉权重，放在 Hero 底部中央，仅作为浏览引导
- 移动端下，CTA 与徽章纵向排列，下箭头仍位于 Hero 底部

## 错误处理与风险

- Product Hunt 徽章为外部图片，如果加载失败，只影响背书展示，不影响主 CTA
- 下箭头仅是普通锚点，不依赖 JS；即使样式缺失也仍然可点击
- 需要避免 Hero 高度不足导致下箭头压住正文或终端卡片

## 验证

- 桌面端：Hero 首屏只看到一个主按钮和一个 Product Hunt 次级入口，层级清晰
- 移动端：CTA 区不拥挤，徽章不溢出容器
- 点击下箭头能跳转到 `#what-is-skill`
- 不修改与本次请求无关的内容
