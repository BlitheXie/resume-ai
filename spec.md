# resume_ai 模板规范 v1.0

## 概述

resume_ai 是一个纯前端简历编辑平台。所有简历模板均为自包含的 HTML 文件，
通过约定的 `data-*` 属性标记可编辑字段，编辑器自动识别并生成编辑界面。

---

## 模板要求

### 基本要求

| 要求 | 说明 |
|------|------|
| 自包含 | 所有 CSS/JS 内联在一个 HTML 文件中 |
| 无外部依赖 | 不引用外部 CDN、字体、图标库 |
| 打印友好 | 必须包含 `@media print` 样式，适配 A4 纸 |
| 宽度控制 | 主体宽度 ≤ 800px，便于屏幕阅读和打印 |

### 文件命名

```
{风格}-{序号}.html

示例：
  modern-professional-01.html
  minimal-dark-01.html
  creative-designer-01.html
```

---

## data-editable 属性规范

### 1. 基础字段 `data-editable`

标记单个可编辑文本字段。

```html
<span data-editable="字段名">默认占位文字</span>
```

**支持的标签：** `span`, `div`, `p`, `h1`~`h6`, `li`, `td`, `a`

**编辑器行为：**
- 点击字段 → 激活编辑模式（contenteditable）
- 修改后自动保存到 localStorage

---

### 2. 图片字段 `data-editable-type="image"`

标记可替换的图片字段（如头像）。

```html
<img
  data-editable="avatar"
  data-editable-type="image"
  src="data:image/svg+xml,..."
  alt="头像"
/>
```

**编辑器行为：**
- 点击图片 → 弹出文件选择器
- 选择图片 → 转为 Base64 替换 src
- 前端压缩至 200×200px 以内再存储

---

### 3. 可编辑组 `data-editable-group`

标记一组可重复/可删除的项目（如多条工作经历）。

```html
<div data-editable-group="work-experience">
  <div data-editable-item>
    <span data-editable="company">公司名称</span>
    <span data-editable="position">职位</span>
    <span data-editable="duration">2020.01 - 2023.01</span>
    <p data-editable="description">工作描述...</p>
  </div>
</div>
```

**属性说明：**

| 属性 | 作用 |
|------|------|
| `data-editable-group="组名"` | 标记一个可编辑组容器 |
| `data-editable-item` | 标记组内的一个项目单元（模板中至少保留1个） |

**编辑器行为：**
- 每个 `[data-editable-item]` 渲染为一个可编辑卡片
- 提供"添加一项"/"删除此项"按钮
- 组内字段独立编辑，独立保存

**注意：** 模板中 `[data-editable-group]` 内至少要包含 **1个** `[data-editable-item]` 作为默认项。

---

### 4. 链接字段 `data-editable-type="link"`

标记可编辑的链接（href + 显示文字）。

```html
<a data-editable="website" data-editable-type="link" href="https://example.com">
  个人网站
</a>
```

**编辑器行为：**
- 提供 URL 和显示文字两个输入框
- 同时更新 href 和文本内容

---

## 保留字段名列表

以下为推荐的字段名（中文），编辑器会据此提供友好的标签和提示：

### 基本信息
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `name` | text | 姓名 |
| `title` | text | 职位头衔 |
| `email` | text | 邮箱地址 |
| `phone` | text | 电话号码 |
| `location` | text | 所在城市 |
| `website` | link | 个人网站/LinkedIn |
| `avatar` | image | 头像照片 |

### 内容区块
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `summary` | text | 个人简介 |
| `skills` | text | 技能列表 |
| `work-experience` | group | 工作经历组 |
| `education` | group | 教育经历组 |
| `projects` | group | 项目经历组（可选） |

### 工作经历组内字段
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `company` | text | 公司名称 |
| `position` | text | 职位 |
| `duration` | text | 时间段 |
| `description` | text | 工作描述 |

### 教育经历组内字段
| 字段名 | 类型 | 说明 |
|--------|------|------|
| `school` | text | 学校名称 |
| `degree` | text | 学位/专业 |
| `duration` | text | 时间段 |

---

## 样式约定

### 颜色
- 建议使用 2-3 种协调颜色
- 主色用于姓名、区块标题
- 辅色用于链接、分割线
- 中性色用于正文

### 打印
```css
@media print {
  @page {
    size: A4;
    margin: 15mm;
  }
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

### 响应式
- 桌面端：居中显示，宽度 ≤ 800px
- 打印：适配 A4 幅面
- 移动端：不做硬性要求，但建议基本可读

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-05 | 初始版本，定义基础规范 |
