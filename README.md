# loseheartの博客

[访问博客](https://loseheart-dev.github.io/) · [部署记录](https://github.com/loseheart-dev/loseheart-dev.github.io/actions/workflows/pages.yml)

[![Deploy blog](https://github.com/loseheart-dev/loseheart-dev.github.io/actions/workflows/pages.yml/badge.svg)](https://github.com/loseheart-dev/loseheart-dev.github.io/actions/workflows/pages.yml)

以 Hexo + Butterfly 搭建的个人博客，首页使用原创 AI 插画「碧潭」。支持文章阅读、目录、归档、标签、分类、本地全文搜索、深浅色、阅读模式和手机导航。

已部署到 GitHub Pages。日常更新流程：新增或编辑 Markdown → 本地预览与检查 → 提交并推送到 `main` → 等待 `Deploy blog` 成功 → 查看公网结果。文章内容维护在 `source/`，无需网页后台。

## 本地运行

在 macOS 项目目录使用 Node.js 24 或更高版本：

```bash
git clone https://github.com/loseheart-dev/loseheart-dev.github.io.git
cd loseheart-dev.github.io
npm ci
npm run dev
```

已有本地项目时，进入原项目目录，从 `npm ci` 开始即可。

打开 http://localhost:4173 。开发服务器仅监听本机。

```bash
npm test         # 生成站点并检查页面、分页、搜索索引和本地资源链接
npm run build   # 生成 public/ 静态文件
npm run clean   # 清理生成缓存
```

## 写文章

以下命令都在项目根目录运行。文章、标签、分类通过 Markdown 文件管理，网页用于阅读。

### 新增文章

```bash
npm run new -- "我的第一篇文章" --slug my-first-post
```

命令会创建 `source/_posts/my-first-post.md`，终端会显示实际文件位置。使用简短的英文 slug，方便保持链接稳定；不同文章使用不同 slug，不要用 `--replace` 覆盖已有文章。

打开新文件，保留自动生成的日期，按下面的结构填写。示例日期须改成实际写作时间：当前配置不会展示未来日期的文章，时区为 `Asia/Shanghai`。

````markdown
---
title: "我的第一篇文章"
date: 2026-10-19 10:00:00
categories: 技术笔记
tags:
  - JavaScript
  - 学习记录
description: "这里写首页列表展示的文章摘要。"
---

这里开始写正文。

## 一个小标题

支持 **加粗**、[链接](https://example.com) 和列表。

```javascript
console.log('Hello, loseheart');
```

![图片说明](/images/my-first-post/example.png)
````

顶部两行 `---` 之间是文章配置，之后才是正文。配置缩进使用空格；标题或摘要包含冒号等特殊字符时，使用引号。`##`、`###` 会生成文章目录，文章主标题由 `title` 提供。

示例图片需要自行放到 `source/images/my-first-post/example.png`；没有图片时删掉该行。图片链接使用 `/images/...`，不要写电脑上的绝对路径。此目录的文件会进入生成站点。

### 新增标签和分类

不需要单独创建标签或分类文件。在文章顶部填写一个新名称，保存后就会自动生成对应页面，并加入导航中的“标签”“分类”列表。

- 多个标签：在 `tags:` 下逐行写 `- 标签名`，顺序不影响分类层级。
- 单个分类：使用 `categories: 技术笔记`，适合日常写作。
- 多级分类：使用下方列表，表示“技术笔记 → 前端”，并非两个独立的同级分类。

```yaml
categories:
  - 技术笔记
  - 前端
```

同一个名称保持相同的大小写和拼写。没有文章使用的标签或分类不会独立保留。`source/tags/index.md`、`source/categories/index.md` 是汇总页配置，不用于填写标签或分类名称。

### 预览和检查

```bash
npm run dev
```

打开 http://localhost:4173 ，保存文章后刷新页面，检查正文、目录、图片，以及标签和分类链接。如果预览已经在运行，直接保存并刷新即可，不必再启动一份。结束预览时在对应终端按 `Ctrl+C`。

```bash
npm test
```

这会生成站点并检查主要页面、本地链接和资源；并不代表文章已公开上线。现有测试还依赖演示文章和首页文章数量；批量删改演示文章时，需要同步调整 `tests/site.test.mjs` 中相关断言。

### 修改与删除

- 修改文章：编辑原 `.md` 文件；只改 `title` 通常不会改变链接，重命名文件或修改 slug 会影响文章地址。
- 修改标签或分类：编辑文章顶部的名称；要统一重命名一个名称，需要修改所有使用它的文章。
- 删除标签或分类：从所有相关文章中移除对应配置；如果文章不再需要任何标签或分类，可以删掉整个 `tags` 或 `categories` 字段。
- 删除文章：删除对应 `.md` 文件；使用中的插图继续保留，只清理确定不再被引用的图片。

删除或重命名后，先停止预览，清理旧页面并重新检查：

```bash
npm run clean
npm test
npm run dev
```

只编辑 `source/` 下的内容，`public/` 会在构建时重新生成。当前四篇开站短文用于展示阅读效果，可以替换或删除。没有复制参考站的文章、人物原照片或作者联系方式。

### 提交并自动发布

检查通过后，用 Git 提交修改过的文章和图片，再推送到远程仓库的 `main` 分支。GitHub Actions 会自动安装依赖、执行测试，并将生成的 `public/` 发布到 GitHub Pages。只有工作流部署成功后，公网内容才会更新。

例如，只新增上面的文章及配图时，在项目根目录执行：

```bash
npm test
git status --short
git add source/_posts/my-first-post.md
# 有配图时，再添加实际使用的图片目录：
# git add source/images/my-first-post/
git commit -m "post: add my first article"
git push origin main
```

示例路径须换成这次实际修改的文件；修改配置时也需要提交对应配置文件。提交前用 `git status --short` 核对范围。

公网地址：[loseheartの博客](https://loseheart-dev.github.io/)。在[部署记录](https://github.com/loseheart-dev/loseheart-dev.github.io/actions/workflows/pages.yml)查看 `Deploy blog` 的运行结果；部署失败时打开失败步骤的日志，修复后重新推送。也可以通过 `Run workflow` 手动触发部署。

部署配置为 `.github/workflows/pages.yml`，使用 Node.js 24 和 GitHub 自带令牌；Pages 的发布来源应选择 GitHub Actions。`public/` 无须提交，私人提示词和参考站研究资料继续只保留在本地。

## 修改个人资料与背景

- `_config.yml`：站名、作者、描述、文章路径与公网地址。站名为 loseheartの博客，作者为 loseheart。
- `_config.butterfly.yml`：菜单、头像、首页与内页背景、标语、侧栏、强调色和功能开关。
- `source/images/avatar-loseheart.jpg`：作者头像，用于侧栏和手机导航。
- `source/favicon-character-v2.ico`：浏览器标签页人物图标，包含 16／32／48／64／128／256px 尺寸；高清透明源图为 `source/images/loseheart-character-v2.png`。设计保留棕色盘发、翡翠绿衣服与侧背影。`source/favicon.ico` 是相同图标的默认路径副本。
- `source/css/custom.css`：背景裁切、卡片、阅读字号和响应式细节。
- `source/js/custom.js`：主题交互的键盘补充与减少动态效果适配。
- `source/images/jade-pond.png`：站点使用的背景。原始生成图保留在 `assets/artwork/`；包含个人偏好的提示词仅保留在本地，不提交远程。此目录不进入生成站点。
- `source/about/index.md`：关于页。
- `scripts/page-title.js`：归档总览页的浏览器标签标题调整。

主题及第三方脚本使用本地资源，不依赖外部 CDN。通过 npm 锁定依赖；个性化配置不修改 `node_modules`，更新主题不会覆盖自定义文件。

`source/vendor/` 保留了 Font Awesome Free 和 Typed.js 的所需发布文件及许可证；原包经 npm SHA-512 完整性校验，文件 SHA-256 清单在 `manifest.json`，测试会检查这些资源。

## 当前边界

这是 Markdown 驱动的静态博客，通过 GitHub Pages 发布。评论与在线写作后台暂未接入。`public/` 是生成文件，不直接编辑，也不提交到源码仓库。

2026-10-19 的 `npm audit` 报告 10 项构建工具依赖告警（8 high、2 moderate），来自 `braces` 和 `sprintf-js` 及其依赖链，当前查询到的最新版仍在受影响范围。未采用审计工具建议的跨大版本降级。只处理自己信任的 Markdown、模板与配置；开发服务器保持本机监听。这些 Node 构建依赖不作为脚本发送给读者浏览器。详见 `docs/verification/2026-10-19/dependency-audit.json`。

`docs/立项.md` 为旧课程立项，已不再约束这次新博客。参考站拆解与截图仅保留在本地 `docs/博客逆向与个性化方案.md` 及 `docs/research/`，不提交远程仓库，也不进入公开站点。
