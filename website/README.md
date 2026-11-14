# 慧动科技 FlowSpark 学习探索平台

React + Vite 静态网站，面向信息学竞赛教学。品牌主体：山西慧动科技。

## 当前交付状态

- 第三版增加资源主题、本地私有上传、竞赛赛程与题目/报名/人工评分、名校信息编辑发布。需要在现有第二版数据库上执行 `supabase/migrations/003_content_and_competitions.sql`。
- 页面新增更大字号和高对比按钮；新模块按路由分包、按业务加载数据，竞赛列表不批量下载提交代码。

- 已实现动画首页、教师/学生演示空间、班级与作业发布、代码草稿与提交、人工批阅反馈、资源检索、离线学习提示。
- 未配置后端时为**演示模式**：数据与文件仅保存在当前浏览器。已部署站点使用用户提供的公开连接配置，不能将演示数据与正式数据混为一谈。
- 第二版已增加平台管理员、机构管理员、教师、学生四级角色；机构统一批量开户、首次改密、启停账号、机构隔离和云端作业保存接口。
- Supabase 项目已由用户创建，且用户已确认成功登录平台管理员。第三版的新表和私有文件桶仍需执行003迁移，并在真实服务验收上传、跨机构访问和竞赛流程。
- 免费首期关闭付费AI和自动判题。
- 未内置AI密钥或自动评测服务。数据库由已配置的Supabase项目提供，离线提示不是AI对话。
- GitHub Pages只托管前端；数据库与AI服务需要独立提供。

## 本地启动

Node.js 22.12+（本次验证为24）。

```sh
cd website
npm ci
npm run dev
```

生产构建：`npm run build`。将 `dist/` 的**内容**部署到站点根目录，支持 GitHub Pages 项目路径；页面路由使用哈希，刷新不会出现服务器404。

## 说明文档

- **[第三版：资源、竞赛与名校信息操作和升级](docs/content-management.md)**

- [当前已创建的 Supabase 项目接入步骤](docs/project-connection.md)

- **[从这里开始：免费项目创建与机构部署](docs/free-deployment.md)**

- [学生与教师操作手册](docs/user-guide.md)
- [部署、正式账号与AI接入](docs/deployment.md)
- [角色、数据权限与上线验收](docs/permissions.md)
- [第三版验证结果与限制](docs/verification-v3.md)
- [早期演示版验证记录](docs/verification.md)

## 关键目录

- `src/main.jsx`：页面与师生操作流程
- `src/data.js`：演示数据、云端数据接口、离线提示
- `src/styles.css`：响应式视觉、动画与减少动态效果支持
- `supabase/schema.sql`：表结构、权限、截止时间、AI配额规则
- `supabase/functions/mentor/index.ts`：服务端AI代理（密钥不在浏览器）
- `tests/permissions.mjs`：通过PGlite验证真实PostgreSQL权限规则
- `tests/browser.mjs`：浏览器端到端教学流程测试

## 验证命令

```sh
npm run build
npm test
# 另开终端运行 npm run dev -- --port 4173
npm run test:browser
# 如果本机有系统Chromium，可指定：
BROWSER_EXECUTABLE=/usr/bin/chromium npm run test:browser
```

浏览器测试截图保存在 `test-artifacts/`（可用 `SCREENSHOT_DIR` 改写）。使用Playwright自带浏览器时先运行 `npx playwright install chromium`。

## 品牌素材

已采用用户提供的公司介绍和愿景。`public/brand-logo.svg` 是依据聊天中LOGO样式制作的矢量适配标识，**不是原图文件的无损嵌入**；替换为正式品牌原始矢量文件后可保证商标细节完全一致。图形、文本无虚构资质或合作背书。公开课仅链接到官方来源，未抓取、转载第三方课程内容。

## 更新上线

执行 `scripts/publish-pages.sh` 可构建并将静态产物推到 `gh-pages` 分支。脚本会核对目标仓库及远程分支，常规快进更新，不强推。不更改现有视频资源。首次仍需在 GitHub 仓库 Settings → Pages 选择 `gh-pages / (root)`。

## 第三版浏览器验证

`npm test` 包含数据库与纯函数检查。端到端测试需要系统 Chromium（或设置 `BROWSER_EXECUTABLE`），演示上传视频测试另需 ffmpeg。

- `TEST_URL=http://127.0.0.1:4186 npm run test:content:browser`：在未配置Supabase的独立演示前端验证完整流程。可用进程环境将三个 `VITE_SUPABASE_*` 连接变量置空启动独立测试服务器，不修改真实 `.env.local`。
- `TEST_URL=http://127.0.0.1:4187 npm run test:content:cloud`：在已配置公开连接的前端通过模拟HTTP验证SDK请求，不连接真实学生数据。

这两类测试不能替代实际 Supabase Storage、真实账号和跨设备验收。
