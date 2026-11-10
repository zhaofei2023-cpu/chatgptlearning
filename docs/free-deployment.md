# 慧动科技 · 机构正式部署（第二版）

当前状态：源码和本地验证已准备，尚未创建或连接你的 Supabase 项目。现有 GitHub Pages 网站仍是演示版，演示数据不是正式教学记录。不要直接给学生分发演示账号。

## 1. 创建免费数据库项目（现在先完成这一步）

1. 打开 https://supabase.com/dashboard ，注册或使用 GitHub 登录。
2. 创建 Organization，选择 **Free**。不要选择 Pro、付费附加项，不要绑定银行卡。
3. 点 **New project**，名称可用 `flowspark-learning`。设置并私下保存数据库强密码；选择便于机构访问的区域。
4. 等待项目建立。在项目 **Connect** 或 **Settings → Data API / API** 找到项目 URL（形如 `https://xxxxx.supabase.co`）。
5. 可以把这个公开 URL 发给协助部署的人。不要发送数据库密码、登录密码、service_role / secret key。

免费套餐有容量、流量、函数和活跃用户限制，也可能暂停不活跃项目，不承诺永久免费或不间断服务。约330个师生账号只是规模估计，能否持续留在免费额度内取决于提交量等实际用量。上线前查看项目 Usage；达到额度时暂停新增或清理归档，不自动购买套餐。视频使用合法的官方外链，不上传数据库。

## 2. 初始化数据库

在 Supabase 的 SQL Editor 新建查询，依次执行：

1. `supabase/schema.sql`
2. `supabase/migrations/002_institutions.sql`

仅对全新项目依次执行一次。已有第一版数据库只执行迁移，先备份；迁移会把旧账号标记为未启用，需要人工核对、分配机构和用户名。旧班级和私有资源需要同时补齐机构关联，不能把旧数据随意归到一家机构。

在 Authentication 设置中关闭 **Allow new users to sign up**。关闭匿名登录。所有普通账号都由管理函数创建。配置密码最少12位。学生使用内部登录标识，不依赖邮箱收信；不要为这些内部标识启用邮件通知。

## 3. 初始化唯一的平台管理员

在 **Authentication → Users → Add user / Create new user** 手动创建自己的真实邮箱账号，设置强临时密码并确认邮箱。然后复制这个用户的 UUID，在 SQL Editor 执行（先替换占位符）：

```sql
update public.profiles
set role = 'platform_admin', is_active = true,
    institution_id = null, must_change_password = true
where id = '替换为你的用户UUID';
```

不要使用学生账号作为平台管理员。首次登录用“平台管理员邮箱登录”，按提示改密。数据库通过 Auth 密码更新触发器解除首次改密限制，不由网页自行授权。此触发器需要在实际项目中验收。

## 4. 部署机构开户函数

安装 Supabase CLI 后，在本项目 `website` 目录操作：

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set ALLOWED_ORIGIN=https://YOUR_ACTUAL_FRONTEND_HOST
supabase functions deploy account-admin
```

可使用 Supabase 控制台 Edge Functions 的编辑/部署功能替代 CLI，函数入口为 `supabase/functions/account-admin/index.ts`。保留 JWT 验证；函数内部还会调用 Auth 校验当前用户，并从数据库再次核查角色、机构、启用状态、首次改密状态。若所选项目新式 JWT 配置不兼容网关验证，应先按官方说明配置，不能把身份校验整体删除。

`SUPABASE_URL`、`SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 使用 Edge Functions 服务端内置变量。**service_role 绝不放进网页、GitHub、截图或聊天。** `ALLOWED_ORIGIN` 只填前端 origin，不含路径和尾斜线；GitHub Pages 对应 `https://zhaofei2023-cpu.github.io`。

首期不部署 mentor 也可正常使用。网页 `VITE_AI_ENABLED=false`，服务端不设置 `AI_ENABLED=true`，不配置付费模型密钥。

## 5. 构建网站

复制 `.env.example` 为本地 `.env.local`，填写公开的项目 URL 和 `VITE_SUPABASE_PUBLISHABLE_KEY`（新项目）；旧项目也兼容 `VITE_SUPABASE_ANON_KEY`。不要填 service_role。该文件被 Git 忽略。

```bash
npm ci
npm test
npm run build
```

部署 `dist/`。源码继续存放在 GitHub 的 `flowspark-website` 分支。现有 GitHub Pages 演示不因源代码更新而自动变成正式平台。

合作机构常态化教学平台建议使用 Cloudflare Pages 免费静态托管（无需购买域名，可用 pages.dev），源码仍保存在 GitHub。创建 Pages 项目并连接本仓库，分支 `flowspark-website`，根目录 `website`，构建命令 `npm run build`，输出目录 `dist`，环境变量同 `.env.example`。使用前确认服务当时的免费额度、地区可达性和使用条款。GitHub Pages 对商业站点、SaaS 有用途限制，不应仅凭演示站能访问就承诺适用于机构正式运营。选择托管后要把最终 origin 写入开户函数配置。

## 6. 开通首家机构及账号

平台管理员进入“机构与账号”，添加：

- 名称：**玛酷机器人（迎新校区）**
- 机构代码建议：`mkyx`（创建后用于登录，不随意改动）

另两家等名称确定后添加，不预置虚构机构。先为每家创建一名 `org_admin`，由其创建本机构 `teacher` 和 `student`。每批最多20人，每行格式：`用户名,显示姓名,角色`。这是简易三列清单，不支持字段里含逗号。

创建后立即下载本批 CSV，逐人私下发放机构代码、用户名和临时密码，绝不上传仓库。密码不存入业务数据表或浏览器本地缓存，关闭结果后不能再次查询。部分失败不会回滚已成功账号，按结果仅重试失败项，不覆盖已有账号。

机构管理员可停用/启用本机构教师和学生，不能创建机构、授予管理员身份或管理其他机构。停用后数据库拒绝新的私有数据访问；已经下载或显示在浏览器里的内容不能远程收回。

## 7. 正式邀请学生前验收

- 用平台管理员创建首家机构及机构管理员，退出登录。
- 机构管理员分别开通一名老师和学生；检查首次改密，刷新和重新登录。
- 教师创建班级并发布作业，私下发送班级邀请码；本机构学生加入并提交。
- 教师人工评分；学生换设备重新登录能看到自己的代码、成绩和评语。
- 创建第二个测试机构，确认它的学生不能用第一家邀请码加入，也不能读取作业、提交或账号。
- 停用测试学生、停用机构的数据库测试，确认没有新增私有访问。
- 检查部署端浏览器没有 service_role / 模型密钥；公开访问只能看到官网、公开资源和登录入口。

本地 SQL 测试不等同于真实 Supabase Auth/Edge Functions/网络验收。在这些步骤完成之前，不宣称正式上线。

## 8. 日常维护与恢复

每周由平台负责人用 Supabase 官方数据库导出方式备份，保存在私有安全位置。备份 Auth 用户需要单独按官方迁移文档处理；仅导出业务表不包含可恢复的登录凭据。免费计划不要假定有可随时使用的托管备份。

遗失密码：平台管理员通过可信渠道确认身份，在 Auth 后台更新目标用户密码（如控制台不支持，使用受控的服务器管理脚本调用 `auth.admin.updateUserById`，不在网页调用服务密钥）。重设完成后，再用 SQL 将该用户 `must_change_password=true`，让其首次登录改密。内部登录标识不接收邮件，不能依赖“发重置邮件”。不要把临时密码写入 SQL 文件或审计日志。控制台权限保留给平台负责人。

首期保存账号、机构、班级、作业、代码提交、成绩和评语；代码不会运行，老师人工批阅。收藏和未提交草稿仍保存在当前浏览器，不属于云端记录。学习助手为本地规则提示，不是大模型。后续若接入真实AI或自动判题，需另行明确服务费用、学生数据处理和运行隔离方案。
