import { useEffect, useState } from "react";
import {
  Search,
  Plus,
  GraduationCap,
  ArrowUpRight,
  Edit3,
  BookOpen,
} from "lucide-react";
import { usePlatform, isAdmin, manages, fmtTime } from "./platform-data";
import {
  Hero,
  Dialog,
  ScopeSelect,
  StatusField,
  LoadState,
  EmptyState,
  LoginPrompt,
  FormError,
  useTask,
  Badge,
  scopeName,
} from "./PlatformUI";
function Editor({ row, user, institutions, api, onClose, notice }) {
  const [scope, setScope] = useState(
    row?.institution_id ??
      (user.role === "platform_admin" ? null : user.institution_id),
  );
  const task = useTask(notice);
  return (
    <Dialog
      title={row ? "编辑名校信息" : "新建名校信息"}
      wide
      onClose={onClose}
      busy={task.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          task.run(async () => {
            const url = String(f.get("official_url")).trim();
            if (url && !/^https:\/\//.test(url))
              throw Error("学校官方链接应为HTTPS地址");
            await api.save("school_information", {
              id: row?.id || crypto.randomUUID(),
              institution_id: scope,
              title: f.get("title").trim(),
              school_name: f.get("school_name").trim(),
              category: f.get("category").trim(),
              summary: f.get("summary").trim(),
              body: f.get("body").trim(),
              official_url: url || null,
              status: f.get("status"),
              updated_at: new Date().toISOString(),
            });
            notice("名校信息已保存");
            onClose();
          });
        }}
      >
        <ScopeSelect
          user={user}
          institutions={institutions}
          value={scope}
          onChange={setScope}
          disabled={!!row}
        />
        <div className="p-form-grid">
          <label>
            学校名称
            <input
              name="school_name"
              defaultValue={row?.school_name}
              maxLength={120}
              required
              placeholder="填写学校正式名称"
            />
          </label>
          <label>
            内容分类
            <input
              name="category"
              defaultValue={row?.category || "学校介绍"}
              maxLength={60}
              required
              placeholder="学校介绍 / 课程动态 / 学习指南"
            />
          </label>
        </div>
        <label>
          信息标题
          <input
            name="title"
            defaultValue={row?.title}
            maxLength={150}
            required
          />
        </label>
        <label>
          摘要
          <textarea
            name="summary"
            defaultValue={row?.summary}
            rows={3}
            maxLength={1000}
          />
        </label>
        <label>
          详细内容
          <textarea
            name="body"
            defaultValue={row?.body}
            rows={12}
            maxLength={30000}
            required
            placeholder="建议写清信息来源、适用人群和官方核实方式。"
          />
        </label>
        <label>
          学校官方来源链接（选填）
          <input
            name="official_url"
            type="url"
            defaultValue={row?.official_url}
            placeholder="https://"
          />
        </label>
        <StatusField value={row?.status} />
        <p className="platform-note">
          请核对官方来源。不要虚构合作关系、学校资质或录取承诺。
        </p>
        <FormError error={task.error} />
        <div className="p-form-actions">
          <button className="p-button" disabled={task.busy}>
            {task.busy ? "正在保存…" : "保存名校信息"}
          </button>
          <button
            type="button"
            className="p-button secondary"
            onClick={onClose}
            disabled={task.busy}
          >
            取消
          </button>
        </div>
      </form>
    </Dialog>
  );
}
export default function Schools({ user, demo, institutions, onLogin, notice }) {
  const api = usePlatform(user, demo, "schools"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("全部"),
    [manage, setManage] = useState(false),
    [editing, setEditing] = useState(null),
    [selected, setSelected] = useState(null);
  const task = useTask(notice);
  useEffect(() => {
    setSelected(null);
    setEditing(null);
    setManage(false);
  }, [user?.id]);
  const admin = isAdmin(user);
  const rows = api.school_information.filter(
    (r) =>
      (!manage || manages(user, r.institution_id)) &&
      (category === "全部" || r.category === category) &&
      (r.title + r.school_name + r.summary)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <main className="platform-main">
      <Hero
        type="schools"
        title="看见更广阔的学习世界。"
        description="走近名校，探索课程与学习路径。将可靠的信息，转化为前行的方向。"
      >
        {admin && (
          <div className="p-hero-actions">
            <button
              className="p-button"
              disabled={!!api.error}
              onClick={() => setEditing({})}
            >
              <Plus size={18} />
              新建名校信息
            </button>
            <button
              className="p-button light-outline"
              onClick={() => setManage(!manage)}
            >
              {manage ? "返回阅读视图" : "进入信息管理"}
            </button>
          </div>
        )}
      </Hero>
      <LoadState api={api} admin={admin} />
      {!user ? (
        <LoginPrompt onLogin={onLogin} />
      ) : (
        <>
          <div className="p-toolbar">
            <div className="p-filters">
              {[
                "全部",
                ...new Set(api.school_information.map((r) => r.category)),
              ].map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <label className="p-search">
              <Search size={19} />
              <input
                aria-label="搜索名校信息"
                placeholder="学校、标题或关键词"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="p-section-heading">
            <h2>{manage ? "信息编辑与发布" : "名校探索"}</h2>
            <span>{rows.length} 篇内容</span>
          </div>
          {rows.length ? (
            <div className="p-school-grid">
              {rows.map((r) => (
                <article className="p-school-card" key={r.id}>
                  <div className="school-monogram">
                    <GraduationCap size={38} />
                    <span>{r.school_name}</span>
                  </div>
                  <div className="resource-card-content">
                    <div className="p-card-meta">
                      <Badge>
                        {r.status === "draft" ? "草稿" : r.category}
                      </Badge>
                      <small>{scopeName(r.institution_id, institutions)}</small>
                    </div>
                    <h2>{r.title}</h2>
                    <p>{r.summary || r.body.slice(0, 100)}</p>
                    <div className="p-card-footer">
                      <button
                        className="p-text-button"
                        onClick={() => setSelected(r)}
                      >
                        阅读详情
                        <ArrowUpRight size={18} />
                      </button>
                      {admin && manages(user, r.institution_id) && (
                        <button
                          className="p-icon"
                          aria-label={"编辑名校信息" + r.title}
                          onClick={() => setEditing(r)}
                        >
                          <Edit3 size={19} />
                        </button>
                      )}
                    </div>
                    {manage && (
                      <button
                        className="p-button secondary"
                        disabled={task.busy}
                        onClick={() =>
                          task.run(async () => {
                            await api.save("school_information", {
                              id: r.id,
                              status:
                                r.status === "published"
                                  ? "draft"
                                  : "published",
                            });
                            notice("发布状态已更新");
                          })
                        }
                      >
                        {r.status === "published" ? "撤为草稿" : "发布信息"}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              title="尚无匹配的名校信息"
              text="管理员可添加学校介绍、课程动态或学习指南，审核后发布。"
            />
          )}
          <FormError error={task.error} />
        </>
      )}
      {user && selected && (
        <Dialog title={selected.title} wide onClose={() => setSelected(null)}>
          <div className="p-detail-meta">
            <Badge>{selected.school_name}</Badge>
            <span>{selected.category}</span>
            {selected.updated_at && (
              <small>更新于 {fmtTime(selected.updated_at)}</small>
            )}
          </div>
          <p className="p-lead">{selected.summary}</p>
          <article className="p-prose">{selected.body}</article>
          {selected.official_url && (
            <a
              className="p-button secondary"
              href={selected.official_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              前往官方来源
              <ArrowUpRight size={18} />
            </a>
          )}
        </Dialog>
      )}
      {admin && editing && (
        <Editor
          key={editing.id || "new-school"}
          row={editing.id ? editing : null}
          user={user}
          institutions={institutions}
          api={api}
          onClose={() => setEditing(null)}
          notice={notice}
        />
      )}
    </main>
  );
}
