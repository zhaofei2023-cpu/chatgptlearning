# FlowSpark 部署与真实服务接入

## 一、GitHub Pages：对外访问前端

源代码放在 `flowspark-website` 分支的 `website/`。发布产物放在独立 `gh-pages` 分支；与此前视频文件分开管理。

首次启用需要仓库管理员：

1. 打开 `https://github.com/zhaofei2023-cpu/chatgptlearning/settings/pages`。
2. 在 Build and deployment 的 Source 选择 **Deploy from a branch**。
3. Branch 选择 **gh-pages**，目录选择 **/(root)**，点击 Save。
4. 等待GitHub Pages部署完成。预期地址为 `https://zhaofei2023-cpu.github.io/chatgptlearning/`，以Pages设置页实际显示的地址为准。
5. 用手机、电脑分别打开，测试首页、角色体验、作业提交和文档下载。Pages部署可能需要数分钟。

如仓库尚未启用Pages、Pages部署失败，推送分支本身不代表网站已经可公开访问。当前云环境对 `api.github.com` 的访问受限，自动启用Pages可能不可用，需要在上述设置页操作。

维护者在 `website/` 下使用：

```sh
npm ci
npm run build
./scripts/publish-pages.sh
```

脚本将推送静态文件，不强制覆盖远程历史。访问者不需要安装Node。GitHub Pages受GitHub服务政策与限额约束，不保证商业级SLA；在中国大陆的访问体验应单独测试。

## 二、推荐架构

```text
浏览器 → GitHub Pages（React静态网站）
       → Supabase Auth（邮箱登录）
       → Supabase Postgres + RLS（班级、作业、提交与反馈）
       → Supabase Edge Function mentor → AI模型API
```

如后续需要国内低延迟或正式机构部署，可将同一前端构建托管到国内静态托管/CDN，把数据库与函数部署至符合实际数据要求的服务。具体合规与备案事项由部署主体按地区和服务类型确认。

## 三、创建正式账号数据库

1. 创建Supabase项目，选择合适区域，设置数据库强密码。
2. 打开SQL Editor，在**新数据库**中运行 `supabase/schema.sql`。脚本创建表、RLS、角色规则、班级邀请码、提交截止时间校验与AI每日配额。不要对已有生产数据库盲目重复执行；先备份并制作迁移。
3. 在Auth配置中开启邮箱确认；配置Site URL为实际网站地址，允许正确的登录回跳URL。正式用户量增加前配置自己的SMTP和邮件限流。
4. 将 `.env.example` 复制为 `.env`，只填：

```dotenv
VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_ANON_KEY=项目公开anon或publishable连接key
```

`VITE_` 变量会打包到浏览器中，只能放公开连接信息，**绝不能放 service_role、数据库密码或AI密钥**。真正访问控制依靠RLS，不能只依靠隐藏前端按钮。

5. `npm run build` 并重新发布。未配置以上两个参数时，网站使用演示模式；配置后进入正式邮箱登录模式，空账号不会继承演示数据。
6. 先在网站注册自己的账号，再在SQL Editor中核验身份后授予教师权限，例如：

```sql
-- 用已核实的UUID替换，绝不要让学生自行调用这条SQL。
update public.profiles set role='teacher' where id='已核实教师的UUID';
```

后续学生注册始终是 `student`。教师创建班级，学生输入邀请码加入；邀请码仅交给对应学生，不贴在公开网页上。

## 四、AI答疑接入

AI服务必须由函数代理，不从GitHub Pages直接携带模型密钥请求。

1. 安装并登录Supabase CLI，在 `website/` 下运行 `supabase init`（如尚未初始化）和 `supabase link --project-ref 你的项目引用`。
2. 在Supabase控制台Edge Functions secrets中安全设置：
   - `OPENAI_API_KEY`：模型服务密钥。
   - `OPENAI_MODEL`：可选，默认 `gpt-4o-mini`，按你的账户实际可用模型设置。
   - `ALLOWED_ORIGIN`：仅网站Origin，**不含路径**。GitHub Pages示例：`https://zhaofei2023-cpu.github.io`。
3. 部署 `supabase functions deploy mentor`。函数会验证登录JWT、限制来源、校验题目访问权限，并通过数据库原子扣减每日20次配额。
4. 学生提问时仅发送最近最多6条消息及题目ID。函数读取数据库中用户可访问的题目，不信任前端传入的题目权限。单条消息最多4000字符，输入数据在服务端再次校验。
5. 用正式学生账号验证：已加入班级的题目可提问，未加入班级的题目不可访问，未登录返回401，超额返回429，源站不匹配返回403。
6. 生产环境可另加供应商预算上限、请求监控、异常告警与滥用限制。当前配额按UTC日统计，失败调用也可能扣减配额。函数未持久化对话，但模型提供商可能按其政策处理请求，应向用户解释。

仓库中只包含函数代码，**没有预置密钥，未替你创建AI账户，也未产生AI服务订阅**。更换供应商时应修改服务端调用与响应解析，浏览器不接触密钥。

## 五、代码评测：当前人工批阅，后续隔离接入

已实现学生提交代码、教师查看和评分；当前没有自动编译、样例运行或隐藏测试判题功能。

后续建议使用自托管或可信的Judge0等隔离判题服务：

1. 在数据库保存题目测试数据，隐藏测试不得对学生可读。
2. 服务端创建评测任务；验证学生身份、班级、截止时间及提交所有权。
3. 任务进入独立队列，由容器/微虚拟机执行；设置CPU、内存、运行时间、输出大小和网络限制。
4. 评测工作节点使用专用最小权限身份写回结果，普通教师与学生不可伪造。
5. 禁止把学生代码直接交给Web服务器shell执行，禁止在Edge Function中直接执行任意代码。

正式自动评测应作为独立部署项目实施，不能通过GitHub Pages静态托管实现。

## 六、资源与品牌维护

`src/data.js` 是演示资源，正式资源由数据库管理。当前资源使用官方公开链接，不复制课程视频。如果使用自有课件/视频，需要选择有带宽配额的对象存储，配置授权访问、版权与费用控制；不建议把大型课程视频直接提交到Git历史。

`public/brand-logo.svg` 为依据提供图样进行的矢量适配。收到正式PNG/SVG后可替换该文件，并检查桌面和移动端。公司介绍、愿景位于 `src/main.jsx`。

## 七、费用和日常运维

GitHub Pages可按账户套餐托管静态页面；Supabase、邮件和AI均以各服务当前定价为准，免费套餐有配额与限制，不承诺永久免费或持续不休眠。设置供应商预算、数据库备份、管理员接收告警。上线前确认学生数据的收集范围、保留期限、删除渠道以及AI服务的数据处理政策。

每次更新先执行构建、浏览器流程与权限测试。备份数据库后才变更表结构。不要把 `.env`、service_role或模型密钥提交到Git。发现泄露时立即在供应商后台轮换密钥。
