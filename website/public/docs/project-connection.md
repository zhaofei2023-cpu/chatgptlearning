# 当前 Supabase 项目接入

项目 URL：`https://iyqdrtkaqatfvvxryawf.supabase.co`

状态：用户已创建项目并提供新版 Publishable Key；开发环境已配置公开连接参数。用户确认尚未执行建表脚本。尚未验证远端表结构、认证或管理函数，现有演示站不等于已连接该项目。

## 现在先做两步

1. 打开 [本项目 SQL Editor](https://supabase.com/dashboard/project/iyqdrtkaqatfvvxryawf/sql/new)，新建查询。
2. 打开仓库中的 `supabase/bootstrap-new-project.sql`，复制全部内容，粘贴后点击 **Run**。若出现 “Success. No rows returned”，说明执行成功；不要重复执行。

公开密钥已经提供，不需要再找 legacy anon key。前端使用 `VITE_SUPABASE_PUBLISHABLE_KEY`，兼容旧项目的 `VITE_SUPABASE_ANON_KEY`。公开参数配置在本地被 Git 忽略的 `.env.local` 中，尚未发布正式网站。

如果之前已执行 `schema.sql`，不要运行合并脚本；只在确认基础表执行成功后执行 `supabase/migrations/002_institutions.sql`。若两份都已执行，不再重复执行。错误信息请保留原样，不删除现有表来重试。

接下来还要关闭自行注册、创建平台管理员和部署 `account-admin` 函数，完成后才能真实开户。完整顺序见 [免费部署文档](free-deployment.md)。不要求把平台管理员密码或服务端密钥发送给协助者。

## 云环境连通性

本地环境的出站域名清单尚未包含本项目。远端接口测试前，需要在云环境网络设置中增加精确域名 `iyqdrtkaqatfvvxryawf.supabase.co` 并保存；不需要开放所有网站。此项影响开发环境的直接测试，不影响你自己打开 Supabase 控制台。实际连通性以保存后测试结果为准。
