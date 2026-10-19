# loseheart的博客

以 Hexo + Butterfly 搭建的个人博客，首页使用原创 AI 插画「碧潭」。支持文章阅读、目录、归档、标签、分类、本地全文搜索、深浅色、阅读模式和手机导航。

## 本地运行

在 macOS 项目目录使用 Node.js 24 或更高版本：

```bash
npm ci
npm run dev
```

打开 http://localhost:4173 。开发服务器仅监听本机。

```bash
npm test         # 生成站点并检查页面、分页、搜索索引和本地资源链接
npm run build   # 生成 public/ 静态文件
npm run clean   # 清理生成缓存
```

## 写文章

```bash
npm run new -- "文章标题"
```

编辑 `source/_posts/` 下的 Markdown 文件。`description` 用作首页摘要，`categories` 用作分类，`tags` 用作标签。当前四篇开站短文用于展示阅读效果，可以替换或删除。没有复制参考站的文章、人物原照片或作者联系方式。

## 修改个人资料与背景

- `_config.yml`：站名、作者、描述、文章路径。站名为 loseheart的博客，作者暂用 Shihao，正式上线前将 `url` 改为真实域名。
- `_config.butterfly.yml`：菜单、头像、首页与内页背景、标语、侧栏、强调色和功能开关。
- `source/css/custom.css`：背景裁切、卡片、阅读字号和响应式细节。
- `source/js/custom.js`：主题交互的键盘补充与减少动态效果适配。
- `source/images/jade-pond.png`：站点使用的背景。原始生成图保留在 `assets/artwork/`；包含个人偏好的提示词仅保留在本地，不提交远程。此目录不进入生成站点。
- `source/about/index.md`：关于页。

主题及第三方脚本使用本地资源，不依赖外部 CDN。通过 npm 锁定依赖；个性化配置不修改 `node_modules`，更新主题不会覆盖自定义文件。

`source/vendor/` 保留了 Font Awesome Free 和 Typed.js 的所需发布文件及许可证；原包经 npm SHA-512 完整性校验，文件 SHA-256 清单在 `manifest.json`，测试会检查这些资源。

## 当前边界

这是 Markdown 驱动的静态博客。评论、在线写作后台和正式部署暂未接入；需要公开上线时，再配置域名及部署位置。`public/` 是生成文件，不直接编辑，也不提交到源码仓库。

2026-10-19 的 `npm audit` 报告 10 项构建工具依赖告警（8 high、2 moderate），来自 `braces` 和 `sprintf-js` 及其依赖链，当前查询到的最新版仍在受影响范围。未采用审计工具建议的跨大版本降级。只处理自己信任的 Markdown、模板与配置；开发服务器保持本机监听。这些 Node 构建依赖不作为脚本发送给读者浏览器。详见 `docs/verification/2026-10-19/dependency-audit.json`。

`docs/立项.md` 为旧课程立项，已不再约束这次新博客。参考站拆解与截图仅保留在本地 `docs/博客逆向与个性化方案.md` 及 `docs/research/`，不提交远程仓库，也不进入公开站点。
