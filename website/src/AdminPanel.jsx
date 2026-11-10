import { useState } from "react";
import { supabase } from "./data";
export const roleNames = {
  platform_admin: "平台管理员",
  org_admin: "机构管理员",
  teacher: "教师",
  student: "学生",
};
export function PasswordChange({ onDone, notice }) {
  const [busy, setBusy] = useState(false);
  return (
    <main className="app-main">
      <div className="admin-box">
        <h1>设置你的专属密码</h1>
        <p>首次登录须修改临时密码。新密码至少12位，请勿共享。</p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (f.get("password") !== f.get("confirm"))
              return notice("两次密码不一致");
            setBusy(true);
            try {
              const { error } = await supabase.auth.updateUser({
                password: f.get("password"),
              });
              if (error) throw error;
              await onDone();
            } catch (err) {
              notice(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            新密码
            <input
              name="password"
              type="password"
              minLength={12}
              maxLength={128}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            再次输入
            <input
              name="confirm"
              type="password"
              minLength={12}
              required
              autoComplete="new-password"
            />
          </label>
          <button className="button" disabled={busy}>
            修改密码并进入
          </button>
        </form>
      </div>
    </main>
  );
}
export default function AdminPanel({ user, data, demo, refresh, notice }) {
  const [org, setOrg] = useState(
      user.institution_id || data.institutions?.[0]?.id || "",
    ),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false);
  const platform = user.role === "platform_admin";
  async function run(body) {
    if (demo) throw Error("管理演示不创建真实账号，请先完成云端接入");
    const { data: r, error } = await supabase.functions.invoke(
      "account-admin",
      { body },
    );
    if (error || r?.error) throw Error(r?.error || error.message);
    return r;
  }
  async function action(fn) {
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const cols = [
      "institution_code",
      "username",
      "display_name",
      "role",
      "password",
    ];
    const cell = (x) =>
      '"' +
      String(x ?? "")
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob(
        [
          "\ufeff" +
            [
              cols,
              ...results
                .filter((r) => !r.error)
                .map((r) => cols.map((k) => r[k])),
            ]
              .map((row) => row.map(cell).join(","))
              .join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    a.href = url;
    a.download = "账号临时密码-请私下分发.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <main className="app-main">
      <div className="page-heading">
        <span className="eyebrow">ORGANIZATION SPACE</span>
        <h1>{roleNames[user.role]}工作台</h1>
        <p>统一开户 · 机构隔离 · 教学记录保存</p>
      </div>
      {demo && (
        <p className="notice-box">
          这是管理界面演示。真实开户需要接入 Supabase。
        </p>
      )}
      {platform && (
        <section className="admin-box">
          <h2>添加合作机构</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action(async () => {
                const r = await run({
                  action: "create_institution",
                  name: f.get("name"),
                  code: f.get("code"),
                });
                setOrg(r.institution.id);
                notice("机构已创建");
              });
            }}
          >
            <label>
              机构名称
              <input
                name="name"
                placeholder="玛酷机器人（迎新校区）"
                maxLength={80}
                required
              />
            </label>
            <label>
              机构代码（3–20位小写英文、数字）
              <input
                name="code"
                placeholder="例如 mkyx"
                pattern="[a-z0-9][a-z0-9_-]{2,19}"
                required
              />
            </label>
            <button className="button" disabled={busy}>
              创建机构
            </button>
          </form>
        </section>
      )}
      <section className="admin-box">
        <h2>机构账号</h2>
        <label>
          当前机构
          <select
            value={org}
            onChange={(e) => {
              setOrg(e.target.value);
              setResults([]);
            }}
          >
            <option value="">请选择机构</option>
            {(data.institutions || []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} · {i.code}
              </option>
            ))}
          </select>
        </label>
        <p>
          每批最多20人，每行：用户名,姓名,角色。角色为 student 或 teacher
          {platform ? "，机构管理员为 org_admin" : ""}
          。用户名为3–32位小写英文、数字、下划线或短横线。不要填写身份证号。
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const raw = new FormData(e.currentTarget).get("accounts");
            action(async () => {
              const accounts = String(raw)
                .trim()
                .split(/\r?\n/)
                .filter(Boolean)
                .map((line) => {
                  const a = line.split(/[,，]/).map((x) => x.trim());
                  if (a.length !== 3) throw Error("每行必须恰好三列");
                  return { username: a[0], display_name: a[1], role: a[2] };
                });
              setResults([]);
              const r = await run({
                action: "create_accounts",
                institution_id: org,
                accounts,
              });
              setResults(r.results);
              notice("处理完成，请核查各账号结果");
            });
          }}
        >
          <label>
            账号列表
            <textarea
              name="accounts"
              rows={6}
              required
              placeholder={
                "student001,学生姓名,student\nteacher001,教师姓名,teacher"
              }
            />
          </label>
          <button disabled={busy || !org} className="button">
            {busy ? "处理中…" : "创建账号并生成临时密码"}
          </button>
        </form>
        {!!results.length && (
          <div className="notice-box">
            <p>
              临时密码只提供一次，请立即下载并私下分发，勿上传
              GitHub。清除后不能查询原密码。
            </p>
            <button onClick={download}>下载本批账号 CSV</button>{" "}
            <button onClick={() => setResults([])}>清除结果</button>
            <ul>
              {results.map((r) => (
                <li key={r.username}>
                  {r.username}：{r.error || "已创建，首次登录需改密"}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="admin-table">
          {(data.profiles || [])
            .filter((p) => p.institution_id === org)
            .map((p) => (
              <article key={p.id}>
                <div>
                  <b>{p.display_name}</b>
                  <p>
                    {p.username} · {roleNames[p.role]} ·{" "}
                    {p.is_active ? "启用" : "停用"}
                  </p>
                </div>
                {p.id !== user.id &&
                  (platform || ["teacher", "student"].includes(p.role)) && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        action(async () => {
                          await run({
                            action: "set_active",
                            institution_id: org,
                            target_id: p.id,
                            is_active: !p.is_active,
                          });
                          notice("状态已更新");
                        })
                      }
                    >
                      {p.is_active ? "停用账号" : "启用账号"}
                    </button>
                  )}
              </article>
            ))}
        </div>
      </section>
      <p>密码遗失请联系平台管理员。自动判题与付费 AI 当前关闭。</p>
    </main>
  );
}
