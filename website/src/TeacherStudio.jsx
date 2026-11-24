import { useState } from "react";
import { supabase } from "./data";
import { groupStudents } from "./teaching-rules";
import { Dialog, FormError, useTask } from "./PlatformUI";
export default function TeacherStudio({
  user,
  data,
  demo,
  setData,
  refresh,
  notice,
  onClass,
  onReview,
}) {
  const [tab, setTab] = useState("problems"),
    [category, setCategory] = useState("all"),
    [search, setSearch] = useState(""),
    [edit, setEdit] = useState(null),
    [categoryEdit, setCategoryEdit] = useState(null);
  const task = useTask(notice),
    ready = demo || data.v4Ready;
  const categories = (data.assignment_categories || []).filter(
    (c) => c.teacher_id === user.id,
  );
  const owned = data.assignments.filter(
    (a) => a.teacher_id === user.id && a.status !== "archived",
  );
  const assignments = owned.filter(
    (a) =>
      (category === "all" ||
        (category === "none" ? !a.category_id : a.category_id === category)) &&
      (a.title + " " + a.tags?.join(" "))
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const assignmentIds = new Set(
    data.assignments.filter((a) => a.teacher_id === user.id).map((a) => a.id),
  );
  const groups = groupStudents(
    data.submissions.filter((s) => assignmentIds.has(s.assignment_id)),
  );
  async function save(table, payload) {
    if (!ready && table === "assignment_categories")
      throw Error("请管理员先完成第四版数据库升级");
    if (!ready && table === "assignments") {
      const { category_id, ...legacy } = payload;
      payload = legacy;
    }
    if (demo) {
      setData((d) => {
        const old = d[table] || [];
        return {
          ...d,
          [table]: old.some((x) => x.id === payload.id)
            ? old.map((x) => (x.id === payload.id ? { ...x, ...payload } : x))
            : [{ ...payload, id: payload.id || crypto.randomUUID() }, ...old],
        };
      });
    } else {
      const { id, teacher_id, class_id, institution_id, ...changes } = payload;
      const existing = (data[table] || []).some((x) => x.id === id);
      const query = existing
        ? supabase.from(table).update(changes).eq("id", id)
        : supabase.from(table).insert(payload);
      const { error } = await query.select().single();
      if (error) throw error;
      await refresh();
    }
  }
  function status(a, next) {
    task.run(async () => {
      await save("assignments", { id: a.id, status: next });
      notice(
        next === "published"
          ? "题目已发布"
          : next === "draft"
            ? "已撤回为草稿"
            : "题目已删除下架，学生最新提交保留用于报告",
      );
    });
  }
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">TEACHER STUDIO</span>
        <h1>题库与学生作品</h1>
        <p>按知识主题整理题目，按学生账号查看每题最新代码。</p>
      </div>
      {!ready && (
        <div className="platform-alert">
          第四版数据库尚未升级。分类、删除下架与覆盖提交待升级；原有题目发布和批阅仍可使用。请管理员查看
          <a href="docs/teaching-v4.md" target="_blank">
            升级说明
          </a>
          。
        </div>
      )}
      <div className="p-filters">
        <button
          className={tab === "problems" ? "active" : ""}
          onClick={() => setTab("problems")}
        >
          我的题库 · {owned.length}
        </button>
        <button
          className={tab === "students" ? "active" : ""}
          onClick={() => setTab("students")}
        >
          按学生查看 · {groups.length}
        </button>
        <button onClick={onClass}>创建班级</button>
      </div>
      <FormError error={task.error} />
      {tab === "problems" ? (
        <>
          <div className="p-toolbar">
            <div className="p-form-actions">
              <button className="p-button" onClick={() => setEdit({})}>
                新建题目
              </button>
              <button
                className="p-button secondary"
                disabled={!ready}
                onClick={() => setCategoryEdit({})}
              >
                新建分类
              </button>
            </div>
            <input
              aria-label="搜索我的题目"
              placeholder="搜索题名或知识点"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="p-filters">
            <button
              onClick={() => setCategory("all")}
              className={category === "all" ? "active" : ""}
            >
              全部
            </button>
            <button
              onClick={() => setCategory("none")}
              className={category === "none" ? "active" : ""}
            >
              未分类
            </button>
            {categories.map((c) => (
              <span key={c.id}>
                <button
                  onClick={() => setCategory(c.id)}
                  className={category === c.id ? "active" : ""}
                >
                  {c.title}
                </button>
                <button
                  aria-label={"编辑分类" + c.title}
                  onClick={() => setCategoryEdit(c)}
                >
                  编辑
                </button>
              </span>
            ))}
          </div>
          <div className="assignment-grid">
            {assignments.map((a) => (
              <article className="assignment-card" key={a.id}>
                <div className="p-card-meta">
                  <span className="status">
                    {a.status === "published" ? "已发布" : "草稿"}
                  </span>
                  <span>{a.level}</span>
                </div>
                <h3>{a.title}</h3>
                <p>{a.statement.slice(0, 90)}</p>
                <small>
                  {data.classes.find((c) => c.id === a.class_id)?.name} ·{" "}
                  {categories.find((c) => c.id === a.category_id)?.title ||
                    "未分类"}
                </small>
                <div className="p-form-actions">
                  <button
                    className="p-button secondary"
                    onClick={() => setEdit(a)}
                  >
                    编辑题目
                  </button>
                  <button
                    className="p-button"
                    disabled={task.busy}
                    onClick={() =>
                      status(
                        a,
                        a.status === "published" ? "draft" : "published",
                      )
                    }
                  >
                    {a.status === "published" ? "撤回草稿" : "发布题目"}
                  </button>
                  <button
                    className="p-text-button p-danger"
                    disabled={task.busy || !ready}
                    onClick={() => {
                      if (
                        confirm(
                          "删除下架“" +
                            a.title +
                            "”？学生将无法继续作答，已有最新代码仍保留供教师和管理员查看。",
                        )
                      )
                        status(a, "archived");
                    }}
                  >
                    删除题目
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!assignments.length && (
            <p className="platform-empty">此分类还没有题目。</p>
          )}
        </>
      ) : (
        <div className="student-collection">
          {groups.length ? (
            groups.map((g) => (
              <details key={g.id} open={groups.length === 1}>
                <summary>
                  <strong>{g.name}</strong>
                  <small>
                    账号 {g.id.slice(0, 8)} · {g.submissions.length}道题 ·{" "}
                    {g.submissions.filter((s) => s.status === "pending").length}
                    待批阅
                  </small>
                </summary>
                <div className="submission-list">
                  {g.submissions.map((s) => (
                    <article key={s.id}>
                      <div>
                        <h3>
                          {data.assignments.find(
                            (a) => a.id === s.assignment_id,
                          )?.title || "已下架题目"}
                        </h3>
                        <small>
                          {s.language} · 第{s.attempt_count || 1}次提交 ·{" "}
                          {new Date(s.submitted_at).toLocaleString("zh-CN")}
                        </small>
                        <p>
                          {s.status === "graded"
                            ? `已批阅 ${s.score}分`
                            : "待批阅"}{" "}
                          · 仅保存最新代码
                        </p>
                      </div>
                      <button
                        className="p-button secondary"
                        onClick={() => onReview(s)}
                      >
                        查看与批阅
                      </button>
                    </article>
                  ))}
                </div>
              </details>
            ))
          ) : (
            <p className="platform-empty">学生提交后将在其账号下归集。</p>
          )}
        </div>
      )}
      <section className="class-list">
        {data.classes
          .filter((c) => c.teacher_id === user.id)
          .map((c) => (
            <div key={c.id}>
              <b>{c.name}</b>
              <span>邀请码：{c.join_code}</span>
            </div>
          ))}
      </section>
      {edit && (
        <Dialog
          title={edit.id ? "编辑题目" : "新建题目"}
          wide
          onClose={() => setEdit(null)}
          busy={task.busy}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              task.run(async () => {
                const deadline = new Date(
                  String(f.get("due_at")) + ":00+08:00",
                );
                if (
                  !Number.isFinite(+deadline) ||
                  (+deadline <= Date.now() && !edit.id)
                )
                  throw Error("请选择有效的未来截止时间");
                const payload = {
                  id: edit.id || crypto.randomUUID(),
                  teacher_id: user.id,
                  class_id: f.get("class_id"),
                  title: f.get("title").trim(),
                  category_id: f.get("category_id") || null,
                  level: f.get("level"),
                  status: f.get("status"),
                  statement: f.get("statement").trim(),
                  input_format: f.get("input_format"),
                  output_format: f.get("output_format"),
                  sample_input: f.get("sample_input"),
                  sample_output: f.get("sample_output"),
                  tags: f
                    .get("tags")
                    .split(/[,，]/)
                    .map((x) => x.trim())
                    .filter(Boolean),
                  due_at: deadline.toISOString(),
                };
                await save("assignments", payload);
                notice("题目已保存");
                setEdit(null);
              });
            }}
          >
            <label>
              题目名称
              <input
                name="title"
                defaultValue={edit.title}
                required
                maxLength={120}
              />
            </label>
            <div className="p-form-grid">
              <label>
                班级
                <select
                  aria-label="班级"
                  name="class_id"
                  defaultValue={edit.class_id}
                  disabled={!!edit.id}
                  required
                >
                  {data.classes
                    .filter((c) => c.teacher_id === user.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                {edit.id && (
                  <input type="hidden" name="class_id" value={edit.class_id} />
                )}
              </label>
              <label>
                题目分类
                <select
                  aria-label="题目分类"
                  name="category_id"
                  defaultValue={edit.category_id || ""}
                >
                  <option value="">未分类</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                难度
                <select
                  aria-label="难度"
                  name="level"
                  defaultValue={edit.level || "入门"}
                >
                  {["入门", "进阶", "挑战"].map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </label>
              <label>
                截止时间（北京时间）
                <input
                  name="due_at"
                  type="datetime-local"
                  defaultValue={
                    edit.due_at
                      ? new Date(+new Date(edit.due_at) + 8 * 3600000)
                          .toISOString()
                          .slice(0, 16)
                      : ""
                  }
                  required
                />
              </label>
            </div>
            <label>
              题目描述
              <textarea
                name="statement"
                defaultValue={edit.statement}
                maxLength={15000}
                required
                rows={5}
              />
            </label>
            <div className="p-form-grid">
              {[
                ["input_format", "输入说明"],
                ["output_format", "输出说明"],
                ["sample_input", "样例输入"],
                ["sample_output", "样例输出"],
              ].map(([k, label]) => (
                <label key={k}>
                  {label}
                  <textarea
                    name={k}
                    defaultValue={edit[k] || ""}
                    maxLength={4000}
                    required={k.includes("format")}
                  />
                </label>
              ))}
            </div>
            <label>
              算法标签（逗号分隔）
              <input
                name="tags"
                defaultValue={edit.tags?.join("，")}
                maxLength={200}
              />
            </label>
            <label>
              发布状态
              <select name="status" defaultValue={edit.status || "draft"}>
                <option value="draft">草稿，仅自己可见</option>
                <option value="published">发布给班级学生</option>
              </select>
            </label>
            <FormError error={task.error} />
            <button
              className="p-button"
              disabled={
                task.busy || !data.classes.some((c) => c.teacher_id === user.id)
              }
            >
              保存题目
            </button>
            {!data.classes.some((c) => c.teacher_id === user.id) && (
              <p>请先创建班级。</p>
            )}
          </form>
        </Dialog>
      )}
      {categoryEdit && (
        <Dialog
          title={categoryEdit.id ? "编辑分类" : "新建分类"}
          busy={task.busy}
          onClose={() => setCategoryEdit(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              task.run(async () => {
                await save("assignment_categories", {
                  id: categoryEdit.id || crypto.randomUUID(),
                  title: f.get("title").trim(),
                  ...(!categoryEdit.id
                    ? {
                        teacher_id: user.id,
                        institution_id: user.institution_id,
                      }
                    : {}),
                });
                notice("分类已保存");
                setCategoryEdit(null);
              });
            }}
          >
            <label>
              分类名称
              <input
                name="title"
                defaultValue={categoryEdit.title}
                required
                maxLength={80}
              />
            </label>
            <FormError error={task.error} />
            <div className="p-form-actions">
              <button className="p-button" disabled={task.busy}>
                保存分类
              </button>
              {categoryEdit.id && (
                <button
                  className="p-text-button p-danger"
                  type="button"
                  disabled={task.busy}
                  onClick={() => {
                    if (
                      !confirm(
                        "删除此分类？题目会移入未分类，题目本身不会删除。",
                      )
                    )
                      return;
                    task.run(async () => {
                      if (demo)
                        setData((d) => ({
                          ...d,
                          assignment_categories: d.assignment_categories.filter(
                            (c) => c.id !== categoryEdit.id,
                          ),
                          assignments: d.assignments.map((a) =>
                            a.category_id === categoryEdit.id
                              ? { ...a, category_id: null }
                              : a,
                          ),
                        }));
                      else {
                        const { error } = await supabase
                          .from("assignment_categories")
                          .delete()
                          .eq("id", categoryEdit.id);
                        if (error) throw error;
                        await refresh();
                      }
                      setCategory("all");
                      setCategoryEdit(null);
                      notice("分类已删除，题目保留");
                    });
                  }}
                >
                  删除分类
                </button>
              )}
            </div>
          </form>
        </Dialog>
      )}
    </>
  );
}
