import { useEffect, useState } from "react";
import {
  Plus,
  Trophy,
  CalendarDays,
  Clock,
  ArrowRight,
  Edit3,
  Copy,
  Code2,
  CheckCircle2,
  Search,
} from "lucide-react";
import {
  usePlatform,
  isAdmin,
  manages,
  eventPhase,
  toInput,
  fromInput,
  fmtTime,
} from "./platform-data";
import {
  Hero,
  Dialog,
  ScopeSelect,
  LoadState,
  EmptyState,
  LoginPrompt,
  FormError,
  useTask,
  Badge,
  scopeName,
} from "./PlatformUI";
function EventEditor({ row, user, institutions, api, onClose, notice }) {
  const [scope, setScope] = useState(
    row?.institution_id ??
      (user.role === "platform_admin" ? null : user.institution_id),
  );
  const task = useTask(notice);
  const start =
      row?.starts_at || new Date(Date.now() + 7 * 86400000).toISOString(),
    end =
      row?.ends_at ||
      new Date(Date.now() + 7 * 86400000 + 2 * 3600000).toISOString();
  return (
    <Dialog
      title={row ? "编辑竞赛活动" : "创建竞赛活动"}
      wide
      onClose={onClose}
      busy={task.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          task.run(async () => {
            const starts = fromInput(f.get("starts_at")),
              ends = fromInput(f.get("ends_at")),
              deadline = fromInput(f.get("registration_deadline"));
            if (ends <= starts || deadline > starts)
              throw Error("结束须晚于开始，报名截止不得晚于开赛");
            await api.save("competitions", {
              id: row?.id || crypto.randomUUID(),
              institution_id: scope,
              title: f.get("title").trim(),
              description: f.get("description").trim(),
              requirements: f.get("requirements").trim(),
              audience: f.get("audience").trim(),
              starts_at: starts,
              ends_at: ends,
              registration_deadline: deadline,
              recurrence: f.get("recurrence"),
              status: row?.status || "draft",
            });
            notice("活动已保存，请添加题目后发布");
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
          活动名称
          <input
            name="title"
            defaultValue={row?.title}
            maxLength={150}
            required
            placeholder="例如：算法探索 · 周末挑战赛"
          />
        </label>
        <label>
          活动简介
          <textarea
            name="description"
            rows={3}
            defaultValue={row?.description}
            maxLength={4000}
          />
        </label>
        <div className="p-form-grid">
          <label>
            开始时间（北京时间）
            <input
              name="starts_at"
              type="datetime-local"
              defaultValue={toInput(start)}
              required
            />
          </label>
          <label>
            结束时间（北京时间）
            <input
              name="ends_at"
              type="datetime-local"
              defaultValue={toInput(end)}
              required
            />
          </label>
          <label>
            报名截止（北京时间）
            <input
              name="registration_deadline"
              type="datetime-local"
              defaultValue={toInput(row?.registration_deadline || start)}
              required
            />
          </label>
          <label>
            举办频率
            <select name="recurrence" defaultValue={row?.recurrence || "none"}>
              <option value="none">单次活动</option>
              <option value="weekly">每周 · 可复制下一期</option>
              <option value="monthly">每月 · 可复制下一期</option>
            </select>
          </label>
        </div>
        <label>
          参赛对象
          <input
            name="audience"
            maxLength={500}
            defaultValue={row?.audience || "发布范围内已开通账号的学生"}
            required
          />
        </label>
        <label>
          参赛要求与规则
          <textarea
            name="requirements"
            rows={7}
            defaultValue={row?.requirements}
            maxLength={12000}
            required
            placeholder={
              "请写明：\n1. 参赛对象与基础要求\n2. 比赛时长、提交方式\n3. 是否允许使用资料、AI或交流\n4. 评分方式与结果反馈安排"
            }
          />
        </label>
        <p className="platform-note">
          新活动先保存为草稿。添加题目并核对后发布；开赛后题目和赛程锁定。定期活动需由管理员“复制下一期”并审核发布，不会自动对外开赛。
        </p>
        <FormError error={task.error} />
        <div className="p-form-actions">
          <button className="p-button" disabled={task.busy}>
            {task.busy ? "正在保存…" : "保存活动信息"}
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
function ProblemEditor({ row, event, api, onClose, notice }) {
  const task = useTask(notice);
  return (
    <Dialog
      title={row ? "编辑竞赛题目" : "添加竞赛题目"}
      wide
      onClose={onClose}
      busy={task.busy}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          task.run(async () => {
            await api.save("competition_problems", {
              id: row?.id || crypto.randomUUID(),
              competition_id: event.id,
              title: f.get("title").trim(),
              statement: f.get("statement").trim(),
              input_format: f.get("input_format").trim(),
              output_format: f.get("output_format").trim(),
              sample_input: String(f.get("sample_input")),
              sample_output: String(f.get("sample_output")),
              max_score: Number(f.get("max_score")),
              position: Number(f.get("position")),
            });
            notice("题目已保存");
            onClose();
          });
        }}
      >
        <label>
          题目名称
          <input
            name="title"
            maxLength={150}
            defaultValue={row?.title}
            required
          />
        </label>
        <div className="p-form-grid">
          <label>
            题目序号
            <input
              name="position"
              type="number"
              min={1}
              max={100}
              defaultValue={
                row?.position ||
                Math.max(
                  0,
                  ...api.competition_problems
                    .filter((p) => p.competition_id === event.id)
                    .map((p) => p.position),
                ) + 1
              }
              required
            />
          </label>
          <label>
            题目满分
            <input
              name="max_score"
              type="number"
              min={1}
              max={1000}
              defaultValue={row?.max_score || 100}
              required
            />
          </label>
        </div>
        <label>
          题目描述与约束
          <textarea
            name="statement"
            rows={7}
            maxLength={20000}
            defaultValue={row?.statement}
            required
          />
        </label>
        <div className="p-form-grid">
          <label>
            输入格式
            <textarea
              name="input_format"
              rows={3}
              maxLength={4000}
              defaultValue={row?.input_format}
            />
          </label>
          <label>
            输出格式
            <textarea
              name="output_format"
              rows={3}
              maxLength={4000}
              defaultValue={row?.output_format}
            />
          </label>
          <label>
            样例输入
            <textarea
              name="sample_input"
              rows={3}
              maxLength={4000}
              defaultValue={row?.sample_input}
            />
          </label>
          <label>
            样例输出
            <textarea
              name="sample_output"
              rows={3}
              maxLength={4000}
              defaultValue={row?.sample_output}
            />
          </label>
        </div>
        <FormError error={task.error} />
        <div className="p-form-actions">
          <button className="p-button" disabled={task.busy}>
            保存题目
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
function ProblemView({ problem, event, user, api, onClose, notice }) {
  const [language, setLanguage] = useState("C++17"),
    [code, setCode] = useState("");
  const task = useTask(notice);
  const active = eventPhase(event) === "进行中";
  const entered = api.competition_entries.some(
    (e) => e.competition_id === event.id && e.student_id === user.id,
  );
  const mine = api.competition_submissions.filter(
    (s) => s.problem_id === problem.id && s.student_id === user.id,
  );
  return (
    <Dialog title={problem.title} wide onClose={onClose} busy={task.busy}>
      <div className="p-detail-meta">
        <Badge>第 {problem.position} 题</Badge>
        <Badge>{problem.max_score} 分</Badge>
        <span>{event.title}</span>
      </div>
      <h3>题目描述</h3>
      <article className="p-prose">{problem.statement}</article>
      {problem.input_format && (
        <>
          <h3>输入格式</h3>
          <p className="p-prose">{problem.input_format}</p>
        </>
      )}
      {problem.output_format && (
        <>
          <h3>输出格式</h3>
          <p className="p-prose">{problem.output_format}</p>
        </>
      )}
      <div className="p-form-grid">
        <div>
          <h3>样例输入</h3>
          <pre className="p-code">{problem.sample_input || "无"}</pre>
        </div>
        <div>
          <h3>样例输出</h3>
          <pre className="p-code">{problem.sample_output || "无"}</pre>
        </div>
      </div>
      {user.role === "student" && entered && active ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            task.run(async () => {
              await api.submit(problem, code, language);
              notice("代码已提交，等待管理员人工评阅");
            });
          }}
        >
          <h3>提交你的解答</h3>
          <label>
            编程语言
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {["C++17", "Python 3", "Java 17"].map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            竞赛代码编辑器
            <textarea
              className="p-code-editor"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              rows={12}
              maxLength={100000}
              spellCheck={false}
              required
            />
          </label>
          <p className="platform-note">
            不自动运行代码或判定AC/WA。请自行测试样例，提交后由管理员人工评阅。本编辑器不自动保存未提交内容。
          </p>
          <button className="p-button" disabled={task.busy}>
            提交竞赛代码
          </button>
          <FormError error={task.error} />
        </form>
      ) : (
        <p className="platform-note">
          只有已报名学生可在比赛时间内提交，当前可阅读题目。
        </p>
      )}
      {mine.length > 0 && (
        <section>
          <h3>我的提交记录</h3>
          {mine
            .slice()
            .reverse()
            .map((s) => (
              <article className="p-submission" key={s.id}>
                <Badge>
                  {s.status === "graded"
                    ? `${s.score} / ${problem.max_score} 分`
                    : "待人工评阅"}
                </Badge>
                <small>
                  {user.display_name || "我的提交"} · {fmtTime(s.submitted_at)}{" "}
                  · {s.language}
                </small>
                {s.feedback && <p>{s.feedback}</p>}
              </article>
            ))}
        </section>
      )}
    </Dialog>
  );
}
function Review({ submission, problem, student, api, onClose, notice }) {
  const task = useTask(notice);
  const [code, setCode] = useState(""),
    [readError, setReadError] = useState("");
  useEffect(() => {
    let active = true;
    api
      .submissionCode(submission)
      .then((value) => {
        if (active) setCode(value);
      })
      .catch((e) => {
        if (active) setReadError(e.message);
      });
    return () => {
      active = false;
    };
  }, [submission.id]);
  return (
    <Dialog
      title={"评阅 · " + problem.title}
      wide
      onClose={onClose}
      busy={task.busy}
    >
      <p>
        参赛学生：{student?.display_name || "参赛学生"}
        {student?.username ? `（${student.username}）` : ""} ·{" "}
        {submission.language}
      </p>
      <pre className="p-code p-submitted-code">
        {code || "正在读取提交代码…"}
      </pre>
      <FormError error={readError} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          task.run(async () => {
            await api.grade(
              submission,
              Number(f.get("score")),
              f.get("feedback"),
            );
            notice("评分已保存");
            onClose();
          });
        }}
      >
        <label>
          评分（满分{problem.max_score}分）
          <input
            type="number"
            name="score"
            min={0}
            max={problem.max_score}
            step={0.5}
            defaultValue={submission.score ?? ""}
            required
          />
        </label>
        <label>
          评阅反馈
          <textarea
            name="feedback"
            rows={4}
            maxLength={4000}
            defaultValue={submission.feedback}
            required
          />
        </label>
        <FormError error={task.error} />
        <button
          className="p-button"
          disabled={task.busy || !code || !!readError}
        >
          保存评分
        </button>
      </form>
    </Dialog>
  );
}
export default function Competitions({
  user,
  demo,
  institutions,
  profiles = [],
  onLogin,
  notice,
}) {
  const api = usePlatform(user, demo, "competitions"),
    [search, setSearch] = useState(""),
    [phase, setPhase] = useState("全部"),
    [selected, setSelected] = useState(null),
    [editing, setEditing] = useState(null),
    [problemEdit, setProblemEdit] = useState(null),
    [problemView, setProblemView] = useState(null),
    [review, setReview] = useState(null),
    [tick, setTick] = useState(0);
  const task = useTask(notice);
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 15000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setSelected(null);
    setEditing(null);
    setProblemEdit(null);
    setProblemView(null);
    setReview(null);
  }, [user?.id]);
  const admin = isAdmin(user);
  const event = api.competitions.find((c) => c.id === selected),
    canManage = event && manages(user, event.institution_id);
  const problems = event
    ? api.competition_problems
        .filter((p) => p.competition_id === event.id)
        .sort((a, b) => a.position - b.position)
    : [];
  const locked =
    event?.status === "published" && Date.now() >= +new Date(event.starts_at);
  const rows = api.competitions.filter(
    (c) =>
      (phase === "全部" || eventPhase(c) === phase) &&
      (c.title + c.description).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <main className="platform-main">
      <Hero
        type="competitions"
        title="用一场挑战，看见新的自己。"
        description="定期竞赛、专题挑战与阶段测评。从认真准备，到独立解题，让每一次实践都有回响。"
      >
        <div className="p-hero-actions">
          {admin && (
            <button
              className="p-button"
              disabled={!!api.error}
              onClick={() => setEditing({})}
            >
              <Plus size={18} />
              创建竞赛活动
            </button>
          )}
          <button className="p-button light-outline" onClick={api.refresh}>
            刷新活动与题目
          </button>
        </div>
      </Hero>
      <LoadState api={api} admin={admin} />
      {!user ? (
        <LoginPrompt onLogin={onLogin} />
      ) : event ? (
        <>
          <button className="p-text-button" onClick={() => setSelected(null)}>
            ← 返回活动列表
          </button>
          <section className="p-event-detail">
            <div className="p-section-heading">
              <div>
                <Badge>{eventPhase(event)}</Badge>
                <h2>{event.title}</h2>
              </div>
              <Badge>{scopeName(event.institution_id, institutions)}</Badge>
            </div>
            <p>{event.description}</p>
            <div className="p-event-facts">
              <div>
                <span>比赛时间 · 北京时间</span>
                <b>
                  {fmtTime(event.starts_at)} — {fmtTime(event.ends_at)}
                </b>
              </div>
              <div>
                <span>报名截止</span>
                <b>{fmtTime(event.registration_deadline)}</b>
              </div>
              <div>
                <span>参赛对象</span>
                <b>{event.audience}</b>
              </div>
              <div>
                <span>举办频率</span>
                <b>
                  {
                    { none: "单次活动", weekly: "每周", monthly: "每月" }[
                      event.recurrence
                    ]
                  }
                </b>
              </div>
            </div>
            <h3>活动要求与竞赛规则</h3>
            <article className="p-prose">{event.requirements}</article>
            <p className="platform-note">
              代码提交采用人工评阅。开赛前，题目仅管理人员可见；开赛后，已报名学生可答题。结束后题目开放为学习资料。
            </p>
            <div className="p-form-actions">
              {user.role === "student" &&
                (api.competition_entries.some(
                  (e) =>
                    e.competition_id === event.id && e.student_id === user.id,
                ) ? (
                  <Badge>
                    <CheckCircle2 size={16} />
                    已报名
                  </Badge>
                ) : (
                  <button
                    className="p-button"
                    disabled={
                      task.busy ||
                      event.status !== "published" ||
                      Date.now() >= +new Date(event.registration_deadline)
                    }
                    onClick={() =>
                      task.run(async () => {
                        await api.register(event);
                        notice("报名成功，请按时参赛");
                      })
                    }
                  >
                    报名参加
                  </button>
                ))}
              {canManage && (
                <>
                  {!locked && (
                    <button
                      className="p-button secondary"
                      onClick={() => setEditing(event)}
                    >
                      <Edit3 size={17} />
                      编辑活动
                    </button>
                  )}
                  {event.status === "draft" && (
                    <button
                      className="p-button"
                      disabled={task.busy || !problems.length}
                      onClick={() =>
                        task.run(async () => {
                          await api.save("competitions", {
                            id: event.id,
                            status: "published",
                          });
                          notice("竞赛活动已发布");
                        })
                      }
                    >
                      发布竞赛活动
                    </button>
                  )}
                  {event.status === "published" && !locked && (
                    <button
                      className="p-button secondary"
                      disabled={task.busy}
                      onClick={() =>
                        task.run(() =>
                          api.save("competitions", {
                            id: event.id,
                            status: "draft",
                          }),
                        )
                      }
                    >
                      撤回草稿
                    </button>
                  )}
                  {event.status === "published" && (
                    <button
                      className="p-button secondary"
                      disabled={task.busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "取消活动后将停止报名和提交。确认取消？",
                          )
                        )
                          task.run(() =>
                            api.save("competitions", {
                              id: event.id,
                              status: "cancelled",
                            }),
                          );
                      }}
                    >
                      取消活动
                    </button>
                  )}
                  <button
                    className="p-button secondary"
                    disabled={task.busy}
                    onClick={() =>
                      task.run(async () => {
                        const next = await api.clone(event);
                        setSelected(next.id);
                        notice("下一期已复制为草稿，请核对赛程后发布");
                      })
                    }
                  >
                    <Copy size={17} />
                    复制下一期
                  </button>
                </>
              )}
            </div>
            <FormError error={task.error} />
          </section>
          <section className="p-event-problems">
            <div className="p-section-heading">
              <h2>竞赛题目</h2>
              {canManage && !locked && (
                <button className="p-button" onClick={() => setProblemEdit({})}>
                  <Plus size={18} />
                  添加题目
                </button>
              )}
            </div>
            {problems.length ? (
              problems.map((p) => (
                <article className="p-problem-row" key={p.id}>
                  <span className="problem-index">
                    {String(p.position).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{p.title}</h3>
                    <small>
                      满分 {p.max_score} 分 · {eventPhase(event)}
                    </small>
                  </div>
                  <button
                    className="p-button secondary"
                    onClick={() => setProblemView(p)}
                  >
                    查看题目
                    <ArrowRight size={17} />
                  </button>
                  {canManage && !locked && (
                    <button
                      className="p-icon"
                      aria-label={"编辑题目" + p.title}
                      onClick={() => setProblemEdit(p)}
                    >
                      <Edit3 size={18} />
                    </button>
                  )}
                </article>
              ))
            ) : (
              <EmptyState
                title={canManage ? "请添加至少一道竞赛题目" : "题目暂未开放"}
                text={
                  canManage
                    ? "添加完整题目、样例和分值后，即可发布活动。"
                    : "开赛前不公开题目；开赛后请已报名学生刷新活动查看。"
                }
              />
            )}
          </section>
          {canManage && (
            <section className="p-event-detail">
              <h2>报名与人工评阅</h2>
              <p>
                已报名{" "}
                {
                  api.competition_entries.filter(
                    (e) => e.competition_id === event.id,
                  ).length
                }{" "}
                人 ·{" "}
                {
                  api.competition_submissions.filter((s) =>
                    problems.some((p) => p.id === s.problem_id),
                  ).length
                }{" "}
                次提交
              </p>
              {api.competition_submissions
                .filter((s) => problems.some((p) => p.id === s.problem_id))
                .slice()
                .reverse()
                .map((s) => (
                  <article className="p-problem-row" key={s.id}>
                    <Code2 size={23} />
                    <div>
                      <h3>
                        {problems.find((p) => p.id === s.problem_id)?.title}
                      </h3>
                      <small>
                        {profiles.find((p) => p.id === s.student_id)
                          ?.display_name || "参赛学生"}{" "}
                        · {fmtTime(s.submitted_at)} · {s.language} ·{" "}
                        {s.status === "graded" ? `${s.score}分` : "待评阅"}
                      </small>
                    </div>
                    <button
                      className="p-button secondary"
                      onClick={() => setReview(s)}
                    >
                      查看与评阅
                    </button>
                  </article>
                ))}
            </section>
          )}
        </>
      ) : (
        <>
          <div className="p-toolbar">
            <div className="p-filters">
              {[
                "全部",
                "报名中",
                "待开赛",
                "进行中",
                "已结束",
                ...(admin ? ["草稿", "已取消"] : []),
              ].map((p) => (
                <button
                  key={p}
                  className={phase === p ? "active" : ""}
                  onClick={() => setPhase(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <label className="p-search">
              <Search size={18} />
              <input
                aria-label="搜索竞赛活动"
                placeholder="搜索活动或专题"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          <div className="p-section-heading">
            <h2>竞赛日历</h2>
            <span>北京时间 UTC+8</span>
          </div>
          {rows.length ? (
            <div className="p-event-grid">
              {rows
                .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                .map((c) => (
                  <article className="p-event-card" key={c.id}>
                    <div className="event-topline">
                      <Badge>{eventPhase(c)}</Badge>
                      <Trophy size={32} />
                    </div>
                    <h2>{c.title}</h2>
                    <p>{c.description || "准备好，迎接下一次挑战。"}</p>
                    <div className="event-date">
                      <CalendarDays size={20} />
                      <span>{fmtTime(c.starts_at)} 开始</span>
                    </div>
                    <small>
                      {scopeName(c.institution_id, institutions)} ·{" "}
                      {
                        { none: "单次", weekly: "每周", monthly: "每月" }[
                          c.recurrence
                        ]
                      }
                    </small>
                    <button
                      className="p-button"
                      onClick={() => setSelected(c.id)}
                    >
                      活动详情与题目
                      <ArrowRight size={17} />
                    </button>
                  </article>
                ))}
            </div>
          ) : (
            <EmptyState
              title="新的挑战，正在准备中。"
              text="管理员发布活动后，可在这里查看要求、报名并参与。"
            />
          )}
        </>
      )}
      {admin && editing && (
        <EventEditor
          key={editing.id || "new-event"}
          row={editing.id ? editing : null}
          user={user}
          institutions={institutions}
          api={api}
          notice={notice}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {canManage && problemEdit && (
        <ProblemEditor
          key={problemEdit.id || "new-problem"}
          row={problemEdit.id ? problemEdit : null}
          event={event}
          api={api}
          notice={notice}
          onClose={() => setProblemEdit(null)}
        />
      )}{" "}
      {user && event && problemView && (
        <ProblemView
          key={problemView.id}
          problem={problemView}
          event={event}
          user={user}
          api={api}
          notice={notice}
          onClose={() => setProblemView(null)}
        />
      )}{" "}
      {canManage && review && (
        <Review
          submission={review}
          student={profiles.find((p) => p.id === review.student_id)}
          problem={problems.find((p) => p.id === review.problem_id)}
          api={api}
          notice={notice}
          onClose={() => setReview(null)}
        />
      )}
    </main>
  );
}
