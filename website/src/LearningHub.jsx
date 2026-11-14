import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Upload,
  Play,
  FileText,
  Network,
  ArrowUpRight,
  FolderOpen,
  Download,
  Edit3,
  Link2,
  Bookmark,
} from "lucide-react";
import {
  usePlatform,
  isAdmin,
  manages,
  KINDS,
  MIME,
  validateFile,
} from "./platform-data";
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
import { safeUrl } from "./data";
function TopicEditor({ row, user, institutions, api, onClose, notice }) {
  const [scope, setScope] = useState(
    row?.institution_id ??
      (user.role === "platform_admin" ? null : user.institution_id),
  );
  const task = useTask(notice);
  return (
    <Dialog
      title={row ? "编辑主题" : "新建学习主题"}
      onClose={onClose}
      busy={task.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          task.run(async () => {
            await api.save("learning_topics", {
              id: row?.id || crypto.randomUUID(),
              institution_id: scope,
              title: f.get("title").trim(),
              description: f.get("description").trim(),
            });
            notice("主题已保存");
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
        <label>
          主题名称
          <input
            name="title"
            defaultValue={row?.title}
            maxLength={80}
            placeholder="例如：C++入门、人工智能、图论专项"
            required
          />
        </label>
        <label>
          主题简介
          <textarea
            name="description"
            defaultValue={row?.description}
            maxLength={1000}
            rows={3}
          />
        </label>
        <FormError error={task.error} />
        <div className="p-form-actions">
          <button className="p-button" disabled={task.busy}>
            保存主题
          </button>
          <button
            className="p-button secondary"
            type="button"
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
function ItemEditor({ row, user, institutions, api, onClose, notice }) {
  const [scope, setScope] = useState(
      row?.institution_id ??
        (user.role === "platform_admin" ? null : user.institution_id),
    ),
    [source, setSource] = useState(row?.source_type || "upload"),
    [kind, setKind] = useState(row?.kind || "video"),
    [file, setFile] = useState(null),
    [id] = useState(row?.id || crypto.randomUUID());
  const task = useTask(notice);
  return (
    <Dialog
      title={row ? "编辑学习素材" : "上传与发布素材"}
      onClose={onClose}
      busy={task.busy}
      wide
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          task.run(async () => {
            const url = String(f.get("url") || "").trim();
            if (source === "link" && !/^https:\/\//i.test(url))
              throw Error("请输入完整的HTTPS链接");
            if (source === "upload" && file) validateFile(file, kind);
            if (source === "text" && !String(f.get("body")).trim())
              throw Error("请填写正文");
            await api.saveItem(
              {
                id,
                institution_id: scope,
                topic_id: f.get("topic_id") || null,
                title: f.get("title").trim(),
                description: f.get("description").trim(),
                kind,
                source_type: source,
                url: source === "link" ? url : null,
                body: source === "text" ? String(f.get("body")).trim() : "",
                status: f.get("status"),
                ...(!file && row?.object_path
                  ? {
                      object_path: row.object_path,
                      file_name: row.file_name,
                      file_size: row.file_size,
                      mime_type: row.mime_type,
                    }
                  : {}),
              },
              source === "upload" ? file : null,
            );
            notice("素材已保存");
            onClose();
          });
        }}
      >
        <div className="p-form-grid">
          <ScopeSelect
            user={user}
            institutions={institutions}
            value={scope}
            onChange={setScope}
            disabled={!!row}
          />
          <label>
            归置主题
            <select
              key={scope || "global"}
              name="topic_id"
              defaultValue={row?.topic_id || ""}
            >
              <option value="">未归类</option>
              {api.learning_topics
                .filter((t) => t.institution_id === scope)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label>
          素材名称
          <input
            name="title"
            defaultValue={row?.title || file?.name?.replace(/\.[^.]+$/, "")}
            maxLength={150}
            required
            placeholder="给素材起一个清晰、容易检索的名字"
          />
        </label>
        <label>
          内容简介
          <textarea
            name="description"
            rows={3}
            maxLength={4000}
            defaultValue={row?.description}
          />
        </label>
        <div className="p-form-grid">
          <label>
            素材类型
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {Object.entries(KINDS).map(([k, v]) => (
                <option value={k} key={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label>
            添加方式
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="upload">上传本地文件</option>
              <option value="link">HTTPS学习链接</option>
              <option value="text">在线正文 / 知识路径</option>
            </select>
          </label>
        </div>
        {source === "upload" && (
          <div className="p-upload">
            <Upload size={30} />
            <h3>从电脑选择素材</h3>
            <p>单文件≤40MB。支持视频、PDF、Office课件、图片和纯文本。</p>
            <label>
              选择本地文件
              <input
                type="file"
                accept={
                  kind === "video"
                    ? ".mp4,.webm"
                    : Object.keys(MIME)
                        .map((x) => "." + x)
                        .join(",")
                }
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            {file ? (
              <p>
                {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            ) : (
              row?.file_name && (
                <p>现有文件：{row.file_name}（不选新文件则保留）</p>
              )
            )}
            <small>
              较大视频请压缩、分段，或选择链接。文件不会上传到公开GitHub仓库。
            </small>
          </div>
        )}
        {source === "link" && (
          <label>
            HTTPS资源链接
            <input
              name="url"
              type="url"
              defaultValue={row?.url}
              placeholder="https://"
              required
            />
          </label>
        )}
        {source === "text" && (
          <label>
            正文或知识路径
            <textarea
              name="body"
              defaultValue={row?.body}
              rows={12}
              maxLength={60000}
              required
              placeholder={
                "按行整理知识节点，例如：\n基础语法\n→ 数组与字符串\n→ 图论与动态规划"
              }
            />
          </label>
        )}
        <StatusField value={row?.status} />
        <FormError error={task.error} />
        {task.busy && (
          <div className="platform-status" role="status">
            <progress aria-label="正在保存素材" />
            <p>正在保存或上传，请勿关闭窗口…</p>
          </div>
        )}
        <div className="p-form-actions">
          <button className="p-button" disabled={task.busy}>
            {task.busy ? "正在保存…" : "保存素材"}
          </button>
          <button
            className="p-button secondary"
            type="button"
            disabled={task.busy}
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function Preview({ row, api, onClose }) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true,
      local;
    setUrl("");
    setError("");
    if (row.source_type !== "text")
      api
        .assetUrl(row)
        .then((u) => {
          if (u.startsWith("blob:")) local = u;
          if (active) setUrl(u);
          else if (local) URL.revokeObjectURL(local);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
      if (local) URL.revokeObjectURL(local);
    };
  }, [row.id, row.object_path]);
  const image = /^image\//.test(row.mime_type || "");
  return (
    <Dialog title={row.title} wide onClose={onClose}>
      <div className="p-detail-meta">
        <Badge>{KINDS[row.kind]}</Badge>
        <span>{row.file_name || "在线内容"}</span>
      </div>
      <p>{row.description}</p>
      <FormError error={error} />
      {row.source_type === "text" ? (
        row.kind === "knowledge_map" ? (
          <div className="knowledge-path">
            {row.body
              .split("\n")
              .filter(Boolean)
              .map((line, i) => (
                <div key={i}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  <p>{line.replace(/^→\s*/, "")}</p>
                </div>
              ))}
          </div>
        ) : (
          <article className="p-prose">{row.body}</article>
        )
      ) : !url && !error ? (
        <p role="status">正在准备学习内容…</p>
      ) : (
        url && (
          <>
            {row.source_type === "upload" && row.kind === "video" ? (
              <video
                controls
                playsInline
                preload="metadata"
                src={url}
                onError={() =>
                  setError(
                    "视频暂时无法播放，可下载后观看；链接过期请重新打开。",
                  )
                }
              />
            ) : row.source_type === "upload" && image ? (
              <img className="p-map-image" src={url} alt={row.title} />
            ) : row.source_type === "upload" &&
              row.mime_type === "application/pdf" ? (
              <iframe
                className="p-pdf"
                title={row.title + " PDF预览"}
                src={url}
              />
            ) : (
              <div className="platform-empty">
                <FileText size={40} />
                <h3>
                  {row.source_type === "link"
                    ? "前往学习资源"
                    : "下载后使用本地软件打开"}
                </h3>
                <p>
                  {row.source_type === "link"
                    ? "外部内容以资源方当前开放情况为准。"
                    : "Office文档可使用WPS、PowerPoint或Word打开。"}
                </p>
              </div>
            )}
            <a
              className="p-button"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={18} />
              {row.source_type === "link"
                ? "打开学习链接"
                : "下载 / 打开原文件"}
            </a>
          </>
        )
      )}
    </Dialog>
  );
}
export default function LearningHub({
  user,
  demo,
  institutions,
  legacyResources,
  onLogin,
  notice,
}) {
  const api = usePlatform(user, demo, "resources"),
    [topic, setTopic] = useState("all"),
    [kind, setKind] = useState("all"),
    [search, setSearch] = useState(""),
    [manage, setManage] = useState(false),
    [editing, setEditing] = useState(null),
    [topicEdit, setTopicEdit] = useState(null),
    [preview, setPreview] = useState(null);
  const task = useTask(notice);
  useEffect(() => {
    setPreview(null);
    setEditing(null);
    setTopicEdit(null);
    setManage(false);
  }, [user?.id]);
  const admin = isAdmin(user);
  const rows = api.learning_items.filter(
    (r) =>
      (!manage || manages(user, r.institution_id)) &&
      (topic === "all" ||
        (topic === "uncategorized" ? !r.topic_id : r.topic_id === topic)) &&
      (kind === "all" || r.kind === kind) &&
      (r.title + r.description).toLowerCase().includes(search.toLowerCase()),
  );
  const official = (legacyResources || []).filter(
    (r) =>
      (kind === "all" ||
        (kind === "video" && r.kind === "视频") ||
        (kind === "courseware" && r.kind === "课件")) &&
      (r.title + r.school + r.description)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <main className="platform-main">
      <Hero
        title="让知识，连接每一次成长。"
        description="视频、课件与知识地图，按主题有序归置。找到你的下一站，建立属于自己的知识体系。"
      >
        <div className="p-hero-actions">
          {admin && (
            <>
              <button className="p-button" onClick={() => setManage(!manage)}>
                {manage ? "返回学习视图" : "进入资源管理"}
              </button>
              <button
                className="p-button light-outline"
                disabled={!!api.error}
                onClick={() => setEditing({})}
              >
                <Upload size={18} />
                上传素材
              </button>
            </>
          )}
          <a className="p-button light-outline" href="#competitions">
            探索竞赛活动
            <ArrowUpRight size={18} />
          </a>
        </div>
      </Hero>
      <LoadState api={api} admin={admin} />
      {demo && user && (
        <p className="platform-note">
          演示模式：文件存于本浏览器，内容不会同步至正式服务。
        </p>
      )}
      {!user && <LoginPrompt onLogin={onLogin} />}
      <div className="p-library-layout">
        <aside className="p-topic-sidebar">
          <div>
            <h2>主题导航</h2>
            {admin && (
              <button
                className="p-icon"
                aria-label="新建主题"
                disabled={!!api.error}
                onClick={() => setTopicEdit({})}
              >
                <Plus size={20} />
              </button>
            )}
          </div>
          <button
            className={topic === "all" ? "active" : ""}
            onClick={() => setTopic("all")}
          >
            <FolderOpen size={18} />
            全部主题
          </button>
          {api.learning_topics.map((t) => (
            <div className="topic-row" key={t.id}>
              <button
                className={topic === t.id ? "active" : ""}
                onClick={() => setTopic(t.id)}
              >
                {t.title}
              </button>
              {admin && manages(user, t.institution_id) && manage && (
                <button
                  className="p-icon"
                  aria-label={"编辑主题" + t.title}
                  onClick={() => setTopicEdit(t)}
                >
                  <Edit3 size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            className={topic === "uncategorized" ? "active" : ""}
            onClick={() => setTopic("uncategorized")}
          >
            未归类素材
          </button>
          <p>先选择主题，再按素材类型筛选。管理员可随时调整名称与归类。</p>
        </aside>
        <section className="p-library-body">
          <div className="p-toolbar">
            <div className="p-filters">
              {[["all", "全部素材"], ...Object.entries(KINDS)].map(([k, t]) => (
                <button
                  key={k}
                  className={kind === k ? "active" : ""}
                  onClick={() => setKind(k)}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="p-search">
              <Search size={19} />
              <input
                aria-label="搜索资源"
                placeholder="搜索标题、课程与关键词"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="p-section-heading">
            <h2>
              {manage
                ? "素材管理"
                : topic === "all"
                  ? "学习素材"
                  : topic === "uncategorized"
                    ? "未归类"
                    : api.learning_topics.find((t) => t.id === topic)?.title}
            </h2>
            <span>{rows.length} 项素材</span>
          </div>
          {rows.length ? (
            <div className="p-resource-grid">
              {rows.map((r) => {
                const Icon =
                  r.kind === "video"
                    ? Play
                    : r.kind === "knowledge_map"
                      ? Network
                      : FileText;
                return (
                  <article className="p-resource-card" key={r.id}>
                    <div className={"resource-art " + r.kind}>
                      <Icon size={42} />
                      <span>{KINDS[r.kind]}</span>
                    </div>
                    <div className="resource-card-content">
                      <div className="p-card-meta">
                        <Badge tone={r.status === "draft" ? "muted" : ""}>
                          {r.status === "draft" ? "草稿" : KINDS[r.kind]}
                        </Badge>
                        <small>
                          {scopeName(r.institution_id, institutions)}
                        </small>
                      </div>
                      <h3>{r.title}</h3>
                      <p>{r.description || "点击查看学习内容。"}</p>
                      <div className="p-card-footer">
                        <button
                          className="p-button secondary"
                          onClick={() => setPreview(r)}
                        >
                          开始学习
                          <ArrowUpRight size={17} />
                        </button>
                        {admin && manages(user, r.institution_id) && (
                          <button
                            className="p-icon"
                            aria-label={"编辑素材" + r.title}
                            onClick={() => setEditing(r)}
                          >
                            <Edit3 size={18} />
                          </button>
                        )}
                      </div>
                      {manage && (
                        <div className="p-card-footer">
                          <button
                            className="p-text-button"
                            disabled={
                              task.busy ||
                              (r.status === "draft" &&
                                r.source_type === "upload" &&
                                !r.object_path)
                            }
                            onClick={() =>
                              task.run(async () => {
                                await api.save("learning_items", {
                                  id: r.id,
                                  status:
                                    r.status === "published"
                                      ? "draft"
                                      : "published",
                                });
                                notice(
                                  r.status === "published"
                                    ? "素材已撤为草稿"
                                    : "素材已发布",
                                );
                              })
                            }
                          >
                            {r.status === "published"
                              ? "撤为草稿"
                              : r.source_type === "upload" && !r.object_path
                                ? "等待上传"
                                : "发布素材"}
                          </button>
                          <button
                            className="p-text-button p-danger"
                            disabled={task.busy}
                            aria-label={"删除素材" + r.title}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "删除“" +
                                    r.title +
                                    "”及其文件？删除后不可恢复。",
                                )
                              )
                                task.run(async () => {
                                  await api.removeItem(r);
                                  notice("素材与文件已删除");
                                });
                            }}
                          >
                            删除素材
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title={user ? "还没有匹配的学习素材" : "登录后查看机构素材"}
              text={
                user
                  ? "换个关键词试试，或由管理员上传并发布。"
                  : "下方仍可访问公开课程入口。"
              }
            />
          )}
          <FormError error={task.error} />
          {topic === "all" && !manage && (
            <section className="p-official">
              <div className="p-section-heading">
                <h2>官方公开课程</h2>
                <Badge>外部学习入口</Badge>
              </div>
              <div className="p-official-grid">
                {official.map((r) => (
                  <article className="resource-card p-official-card" key={r.id}>
                    <span>{r.school}</span>
                    <h3>{r.title}</h3>
                    <p>{r.description}</p>
                    <div className="p-card-footer">
                      <a
                        className="p-text-button"
                        href={safeUrl(r.url) || "#resources"}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        访问官网
                        <ArrowUpRight size={17} />
                      </a>
                      <button
                        className="p-icon"
                        aria-label={"收藏" + r.title}
                        onClick={() => {
                          const key =
                            "flowspark-bookmarks-" + (user?.id || "guest");
                          let list = [];
                          try {
                            list = JSON.parse(
                              localStorage.getItem(key) || "[]",
                            );
                          } catch {}
                          const found = list.includes(r.id);
                          localStorage.setItem(
                            key,
                            JSON.stringify(
                              found
                                ? list.filter((x) => x !== r.id)
                                : [...list, r.id],
                            ),
                          );
                          notice(found ? "已取消收藏" : "已收藏在当前浏览器");
                        }}
                      >
                        <Bookmark size={18} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      </div>
      {admin && editing && (
        <ItemEditor
          key={editing.id || "new-item"}
          row={editing.id ? editing : null}
          user={user}
          institutions={institutions}
          api={api}
          onClose={() => setEditing(null)}
          notice={notice}
        />
      )}{" "}
      {admin && topicEdit && (
        <TopicEditor
          key={topicEdit.id || "new-topic"}
          row={topicEdit.id ? topicEdit : null}
          user={user}
          institutions={institutions}
          api={api}
          onClose={() => setTopicEdit(null)}
          notice={notice}
        />
      )}{" "}
      {user && preview && (
        <Preview row={preview} api={api} onClose={() => setPreview(null)} />
      )}
    </main>
  );
}
