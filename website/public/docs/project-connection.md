# 当前 Supabase 项目接入

项目 URL：`https://iyqdrtkaqatfvvxryawf.supabase.co`

状态：用户已创建项目；尚未获取公开连接密钥，未验证远端表结构、认证或管理函数。现有演示站不等于已连接该项目。

## 现在先做两步

1. 在项目 **Settings → API Keys → Legacy API Keys** 中复制 `anon / public` 连接密钥。可以提供这个公开密钥，不能提供 `service_role`、`sb_secret_...`、数据库密码或账号密码。若页面只有 Publishable key，请说明页面栏目；先不要为了寻找旧密钥更改项目认证配置。
2. 如果还没有执行过任何建表脚本，打开项目 **SQL Editor → New query**，复制 `supabase/bootstrap-new-project.sql` 的全部内容，粘贴并点击 **Run**。该文件在一个事务中完成基础表和机构权限初始化，并在检测到已有 profiles 表时停止，避免重复初始化。

如果之前已执行 `schema.sql`，不要运行合并脚本；只在确认基础表执行成功后执行 `supabase/migrations/002_institutions.sql`。若两份都已执行，不再重复执行。错误信息请保留原样，不删除现有表来重试。

接下来还要关闭自行注册、创建平台管理员和部署 `account-admin` 函数，完成后才能真实开户。完整顺序见 [免费部署文档](free-deployment.md)。不要求把平台管理员密码或服务端密钥发送给协助者。

## 云环境连通性

本地环境的出站域名清单尚未包含本项目。远端接口测试前，需要在云环境网络设置中增加精确域名 `iyqdrtkaqatfvvxryawf.supabase.co` 并保存；不需要开放所有网站。此项影响开发环境的直接测试，不影响你自己打开 Supabase 控制台。实际连通性以保存后测试结果为准。
