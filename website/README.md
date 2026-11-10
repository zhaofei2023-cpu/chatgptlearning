# 慧动科技 FlowSpark 学习探索平台

React + Vite 静态网站，面向信息学竞赛教学。品牌主体：山西慧动科技。

## 当前交付状态

- 已实现动画首页、教师/学生演示空间、班级与作业发布、代码草稿与提交、人工批阅反馈、资源检索、离线学习提示。
- 默认是**演示模式**：数据保存在当前浏览器 localStorage，不能跨设备同步，不是正式账号系统。
- 第二版已增加平台管理员、机构管理员、教师、学生四级角色；机构统一批量开户、首次改密、启停账号、机构隔离和云端作业保存接口。
- 当前尚未配置实际 Supabase 项目；数据库、开户函数和真实账号仍需部署联调，不能把演示站视为正式上线。
- 免费首期关闭付费AI和自动判题。
- AI密钥、真实后端与自动评测服务未预置。演示中的离线提示不是AI对话。
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

- **[从这里开始：免费项目创建与机构部署](docs/free-deployment.md)**

- [学生与教师操作手册](docs/user-guide.md)
- [部署、正式账号与AI接入](docs/deployment.md)
- [角色、数据权限与上线验收](docs/permissions.md)
- [当前验证结果与限制](docs/verification.md)

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
