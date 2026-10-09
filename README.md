# Resume AI — 简历模板工坊

> 22 款精心设计的简历模板，纯前端在线编辑，所有数据仅存储在你的浏览器中。

🔗 **在线体验：[www.resume-works.site](https://www.resume-works.site/)**

***

## 🎯 核心理念

### 你的数据你做主

大厂简历工具总要你注册账号、上传到云端。Resume AI 反其道而行：

- **零服务器** — 纯静态 HTML/CSS/JS，不需要后端
- **本地存储** — 所有编辑内容保存在浏览器 localStorage
- **隐私无忧** — 你的简历永远不会离开你的电脑
- **离线可用** — 加载一次后无需网络

### 模板不是「皮肤」

市面上大多数简历工具只是在同一布局上换颜色。我们把每个模板当作**独立的排版系统**来设计——不同的字体、不同的网格、不同的信息层级。换模板 = 换一种纸媒设计语言。

***

## 🎨 22 款模板

### 按风格分类

| 风格         | 模板                                                                                                                                                                                  |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🌙 **暗色系** | Cyberpunk 科技 · 高级黑金 · Neon Nights · Synthwave 80s · Synthwave 数字 · Glassmorphism · Brutalist · Vaporwave · Terminal CLI                                                             |
| ☀️ **浅色系** | Modern Pro · Apple 极简 · Stripe/Notion · Creator · Nordic Clean · Bold Impact · Editorial · Soft Gradient · Mono Chrome · Precision Finance · Blueprint · Newspaper · Timeline Right |

### 排版多样性

- **双栏布局**：Modern Pro、Bold Impact、Cyberpunk、Creator、Glass、Neon Nights、Soft Gradient、Synthwave 80s
- **单栏居中**：Apple、Brutalist、Editorial、黑金、Mono、Nordic、金融、Stripe/Notion、Synthwave
- **CSS 真双栏**：Newspaper（`column-count:2`）
- **时间轴**：Nordic（左轴）、Timeline Right（右轴）
- **命令行界面**：Terminal CLI
- **蓝图工程图**：Blueprint

***

## ✨ 编辑器功能

- **✏️ 即时编辑** — 点击右下角编辑按钮（或 `Ctrl+E`），蓝色虚线框内直接改
- **🖼️ 头像裁切** — 上传后可拖拽定位 + 缩放滑块
- **➕ 动态增删** — 工作经历、技能、教育经历可自由增加/删除
- **💾 自动保存** — 每次输入自动存入浏览器，刷新不丢失
- **🖨️ 一键打印** — A4 优化，打印自动隐藏工具栏和编辑虚线
- **📇 联系信息开关** — 右下角 📇 面板可逐项显示 / 隐藏邮箱、电话、地区、网站（模板用哪个就列出哪个）
- **📖 交互教程** — 主页内置 5 步使用教程弹窗
- **💬 鼓励 Toast** — 操作时弹出暖人鼓励语
- **🌐 中英双语** — 模板默认英文，右下角语言按钮可随时切换中文；两种语言各自保存编辑内容

***

## 🌐 双语支持

站点与 22 款模板均默认英文，并可通过语言按钮切换中文。

- **主页** — 右上角语言按钮切换界面文案、卡片标题/描述/标签/角标与教程；模板预览会同步刷新
- **模板页** — 右下角 `🌐` 按钮切换正文、区块标题、联系方式与工具栏文案；`<title>` 同步更新
- **实现方式** — 每个可本地化的节点都带有 `data-en` / `data-zh` 属性（文档标题存于 `<html data-title-en data-title-zh>`）
- **编辑数据** — 中英文各用一份 localStorage key（英文为 `resume_ai_<模板>`，中文为 `resume_ai_<模板>_zh`），切换语言不会串数据
- **语言记忆** — 选择写入 `resume_ai_lang`，主页与模板页共享

***

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

***

## 📦 本地运行

```bash
# 方式一：直接打开
open index.html

# 方式二：本地服务器（解决 file:// 跨域）
npx serve .
```

***

## 🌐 部署到 Vercel

1. Fork 本仓库到你的 GitHub
2. 打开 [vercel.com/new](https://vercel.com/new)
3. 导入仓库，直接点 Deploy
4. 3 分钟后上线，Vercel 自动提供 HTTPS 域名

绑定自定义域名：[Settings → Domains → 输入你的域名](https://vercel.com/docs/projects/domains/add-a-domain)

***

## 📊 访问统计（Vercel Web Analytics）

想知道有多少人用了这个站，用 Vercel 自带的 Web Analytics 即可，本站已接入。

**开启步骤**

1. 在 Vercel 控制台进入项目的 **Analytics** 页，点 **Enable**
2. 部署后访问一次站点，在浏览器 Network 里应能看到 `/_vercel/insights/script.js` 请求
3. 回到 Analytics 面板查看访客数、页面浏览量、来源、设备、地区等

**为什么不用 `@vercel/analytics` npm 包 / Vercel Agent**

本仓库是**纯静态、零依赖、无构建步骤**的站点，Vercel 官方文档也写明：
> When using the HTML implementation, there is no need to install the `@vercel/analytics` package.

Vercel Agent 的自动化流程是「安装 npm 包 + 在 root layout 中引入组件」，那是给框架项目用的；
强行为一个静态站加 npm 包会引入构建步骤，反而破坏现在的零配置静态部署。

**实现要点**

- 每页 `<head>` 里内联 2 行官方 HTML 片段（见 `index.html` 末尾 `</head>` 前）
- **只在顶层窗口上报**：主页用 iframe 渲染 22 个模板预览，若不加 `window.self === window.top` 判断，
  光访问一次主页就会产生 23 次页面浏览，模板缩略图会污染「Top Pages」报表
- `sw.js` 对 `/_vercel/` 路径直接放行，不经过缓存

**隐私说明**

Vercel Web Analytics 不使用 Cookie，也不采集可识别个人的信息（访客由请求哈希标识，24 小时后失效），
统计的是聚合数据（URL、来源、地区、设备/浏览器）。
简历内容始终只存在浏览器 localStorage 中，不会上传，与「数据只在你电脑里」的承诺不冲突。

> 若控制台给出的脚本路径不是 `/_vercel/insights/script.js`（Vercel 会为项目生成唯一路径以规避广告拦截器），
> 把控制台显示的片段路径替换到全部 HTML 即可：
> `grep -rl '/_vercel/insights/script.js' --include='*.html' . | xargs sed -i '' 's#/_vercel/insights/script.js#你的路径#g'`

***

## 🔍 SEO / 让 Google 收录

已包含的文件：

| 文件 | 作用 |
| --- | --- |
| `sitemap.xml` | 列出全部 23 个页面（主页 + 22 个模板），供 Google 抓取 |
| `robots.txt` | 允许抓取全部内容，并声明 sitemap 地址 |
| `<link rel="canonical">` | 每页声明规范地址，避免 iframe 预览造成重复内容 |
| `<meta name="description">` | 搜索结果摘要，模板简介复用主页卡片文案 |

**提交给 Google（一次性操作）**

1. 打开 [Google Search Console](https://search.google.com/search-console)，用你的 Google 账号登录
2. 添加资源 → 选择 **网址前缀** → 填 `https://www.resume-works.site/`
   （本项目部署在 Vercel，DNS 由 Vercel 托管，通常会自动验证通过；否则按提示在 Vercel 的
   [Domains](https://vercel.com/docs/projects/domains/add-a-domain) 里加一条 DNS TXT 记录）
3. 左侧 **站点地图** → 输入 `sitemap.xml` → 提交
4. 用 **网址检查** 输入首页 URL，点「请求编入索引」可加速首次收录
5. 之后在 **效果** 报表查看曝光量、点击量、查询词

> 收录通常需要几天到几周，属正常现象。

**新增模板后重新生成 sitemap**

```bash
python3 - <<'PY'
from pathlib import Path
BASE, LASTMOD = 'https://www.resume-works.site', __import__('datetime').date.today().isoformat()
tpl = sorted(p.stem for p in Path('templates').glob('*.html'))
urls = [('/', '1.0', 'weekly')] + [(f'/templates/{n}.html', '0.8', 'monthly') for n in tpl]
L = ['<?xml version="1.0" encoding="UTF-8"?>',
     '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for path, pri, freq in urls:
    L += ['  <url>', f'    <loc>{BASE}{path}</loc>', f'    <lastmod>{LASTMOD}</lastmod>',
          f'    <changefreq>{freq}</changefreq>', f'    <priority>{pri}</priority>', '  </url>']
L.append('</urlset>')
Path('sitemap.xml').write_text('\n'.join(L) + '\n')
print('urls:', len(urls))
PY
```

### ⚠️ 中英双语目前共用同一个 URL

语言切换是纯前端的（切换 `data-en` / `data-zh`，URL 不变），因此**中英文无法被分别收录**，
搜索引擎只会看到一个地址。若要两种语言都能带来搜索流量，需要改成独立路径，例如：

- `https://www.resume-works.site/` → 英文
- `https://www.resume-works.site/zh/` → 中文

并在每页加上互相对应的 `hreflang` 标注。这需要调整目录结构（模板也要各存一份或做重写规则），
改动量不小，建议等真有中文搜索流量需求时再做。

***

## 📁 项目结构

```
resume_ai/
├── index.html              # 主页（模板浏览 + 分类筛选 + 中英切换）
├── resume-editor.js        # 编辑器核心（工具栏、编辑模式、存储、语言切换）
├── sw.js                   # Service Worker（离线缓存，网络优先 + 离线回退）
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

***

## 📝 License

MIT — 自由使用、修改、分发。
