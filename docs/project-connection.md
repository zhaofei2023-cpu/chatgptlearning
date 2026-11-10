# 当前 Supabase 项目接入

项目 URL：`https://iyqdrtkaqatfvvxryawf.supabase.co`

状态（2026-11-10）：用户已确认完成数据库初始化、平台管理员创建及 `account-admin` 函数部署；新版 Publishable Key 已配置。以上远端操作由用户报告完成，开发环境尚未验证实际 Auth、数据库及函数响应。网站发布后仍需用户在自己的浏览器完成首次改密、创建机构、师生开户和跨设备保存验收。

## 发布后先验证管理员登录

1. 打开 https://zhaofei2023-cpu.github.io/chatgptlearning/ ，如果仍显示“演示版”，等待 GitHub Pages 部署并强制刷新。
2. 点“进入学习空间”，选择“平台管理员邮箱登录”，填写自己创建的管理员邮箱和密码。不要把密码发送给协助者。
3. 首次登录按提示更改密码，进入“机构与账号”。先创建“玛酷机器人（迎新校区）”，机构代码可用 `mkyx`。
4. 给该机构创建一个 `org_admin` 账号，再退出平台管理员，用机构代码、用户名及临时密码登录机构管理员，首次改密后创建教师和学生。
5. 验证教师发题、学生提交、教师评分；换设备后应能读到同一条提交和反馈。全部通过后再批量分发账号。

发布不代表真实业务验收已完成。不要重复运行初始化SQL或重复创建平台管理员。操作失败时，提供页面报错文字及 Supabase 对应函数日志中的错误摘要，遮住令牌和密码。

在 Authentication 设置中关闭 Allow new users to sign up。部分控制台位于 Authentication → Sign In / Providers → User Signups。关闭的是公开自行注册，服务端管理员创建账号仍然可用。未关闭前不批量邀请学生。

`ALLOWED_ORIGIN` 应为 `https://zhaofei2023-cpu.github.io`（无末尾斜线和仓库路径）。`SUPABASE_SERVICE_ROLE_KEY` 只由函数内置环境读取，不放入前端。

前端支持 `VITE_SUPABASE_PUBLISHABLE_KEY`，并兼容旧版 `VITE_SUPABASE_ANON_KEY`。公开参数在本地被 Git 忽略的 `.env.local` 中，生产构建只包含公开连接参数。

若开户时报 401 Invalid JWT，应核查该项目 Auth 签名算法与 Edge Function 网关 JWT 验证是否兼容；不能只根据使用 Publishable Key 判断原因，也不要删除函数内 `auth.getUser()` 和机构权限核验。先保留错误信息再排查。

## 云环境连通性

本地环境的出站域名清单尚未包含本项目。远端接口测试前，需要在云环境网络设置中增加精确域名 `iyqdrtkaqatfvvxryawf.supabase.co` 并保存；不需要开放所有网站。此项影响开发环境的直接测试，不影响你自己打开 Supabase 控制台。实际连通性以保存后测试结果为准。
