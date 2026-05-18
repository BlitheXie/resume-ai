# Resume AI — 简历模板工坊

> 22 款精心设计的简历模板，纯前端在线编辑，所有数据仅存储在你的浏览器中。

🔗 **在线体验：[resume-ai.site](https://resume-ai.site)**

---

## 🎯 核心理念

### 你的数据你做主

大厂简历工具总要你注册账号、上传到云端。Resume AI 反其道而行：

- **零服务器** — 纯静态 HTML/CSS/JS，不需要后端
- **本地存储** — 所有编辑内容保存在浏览器 localStorage
- **隐私无忧** — 你的简历永远不会离开你的电脑
- **离线可用** — 加载一次后无需网络

### 模板不是「皮肤」

市面上大多数简历工具只是在同一布局上换颜色。我们把每个模板当作**独立的排版系统**来设计——不同的字体、不同的网格、不同的信息层级。换模板 = 换一种纸媒设计语言。

---

## 🎨 22 款模板

### 按风格分类

| 风格 | 模板 |
|------|------|
| 🌙 **暗色系** | Cyberpunk 科技 · 高级黑金 · Neon Nights · Synthwave 80s · Synthwave 数字 · Glassmorphism · Brutalist · Vaporwave · Terminal CLI |
| ☀️ **浅色系** | Modern Pro · Apple 极简 · Stripe/Notion · Creator · Nordic Clean · Bold Impact · Editorial · Soft Gradient · Mono Chrome · Precision Finance · Blueprint · Newspaper · Timeline Right |

### 排版多样性

- **双栏布局**：Modern Pro、Bold Impact、Cyberpunk、Creator、Glass、Neon Nights、Soft Gradient、Synthwave 80s
- **单栏居中**：Apple、Brutalist、Editorial、黑金、Mono、Nordic、金融、Stripe/Notion、Synthwave
- **CSS 真双栏**：Newspaper（`column-count:2`）
- **时间轴**：Nordic（左轴）、Timeline Right（右轴）
- **命令行界面**：Terminal CLI
- **蓝图工程图**：Blueprint

---

## ✨ 编辑器功能

- **✏️ 即时编辑** — 点击右下角编辑按钮（或 `Ctrl+E`），蓝色虚线框内直接改
- **🖼️ 头像裁切** — 上传后可拖拽定位 + 缩放滑块
- **➕ 动态增删** — 工作经历、技能、教育经历可自由增加/删除
- **💾 自动保存** — 每次输入自动存入浏览器，刷新不丢失
- **🖨️ 一键打印** — A4 优化，打印自动隐藏工具栏和编辑虚线
- **📖 交互教程** — 主页内置 5 步使用教程弹窗
- **💬 鼓励 Toast** — 操作时弹出暖人鼓励语

---

## 🚀 技术栈

```
index.html          ← 单页应用（22 张模板卡片 + 分类导航）
resume-editor.js    ← 编辑器引擎（共享给所有模板）
templates/          ← 22 个独立 HTML 模板
favicon.svg         ← 网站图标
```

- **零依赖** — 不引入任何 npm 包、CDN、框架
- **纯前端** — HTML + CSS + Vanilla JS
- **部署即用** — 静态文件，丢到任何 Web 服务器即可

---

## 📦 本地运行

```bash
# 方式一：直接打开
open index.html

# 方式二：本地服务器（解决 file:// 跨域）
npx serve .
```

---

## 🌐 部署到 Vercel

1. Fork 本仓库到你的 GitHub
2. 打开 [vercel.com/new](https://vercel.com/new)
3. 导入仓库，直接点 Deploy
4. 3 分钟后上线，Vercel 自动提供 HTTPS 域名

绑定自定义域名：[Settings → Domains → 输入你的域名](https://vercel.com/docs/projects/domains/add-a-domain)

---

## 📁 项目结构

```
resume_ai/
├── index.html              # 主页（模板浏览 + 分类筛选）
├── resume-editor.js        # 编辑器核心（工具栏、编辑模式、存储）
├── favicon.svg             # 网站图标
├── prompt.md               # AI 生成模板的提示词
├── spec.md                 # 模板规范文档
├── .gitignore
└── templates/
    ├── modern-professional.html   # 12 Modern Professional
    ├── apple-minimal.html         # 13 Apple 极简
    ├── cyberpunk-tech.html        # 14 Cyberpunk 科技
    ├── stripe-notion.html         # 15 Stripe/Notion 风
    ├── luxury-black-gold.html     # 16 高级黑金
    ├── creative-creator.html      # 17 创作者风格
    ├── nordic-clean.html          # 18 Nordic Clean
    ├── bold-impact.html           # 19 Bold Impact
    ├── editorial.html             # 20 Editorial 杂志
    ├── soft-gradient.html         # 21 Soft Gradient
    ├── mono-chrome.html           # 22 Mono Chrome
    ├── brutalist.html             # 23 Brutalist
    ├── glassmorphism.html         # 24 Glassmorphism
    ├── neon-nights.html           # 25 Neon Nights
    ├── synthwave-80s.html         # 26 Synthwave 80s
    ├── synthwave.html             # 27 Synthwave
    ├── precision-finance.html     # 28 Precision Finance
    ├── blueprint.html             # 29 Blueprint 蓝图
    ├── vaporwave.html             # 30 Vaporwave 蒸汽波
    ├── terminal-cli.html          # 31 Terminal CLI 终端
    ├── newspaper.html             # 32 Newspaper 报纸
    └── timeline-right.html        # 33 Timeline Right
```

---

## 📝 License

MIT — 自由使用、修改、分发。
