import { useEffect, useRef, useState } from "react";
import { supabase } from "./data";
import {
  DEFAULT_REPORT_INSTRUCTIONS,
  latestSubmissions,
} from "./teaching-rules";
import { FormError } from "./PlatformUI";
async function invoke(body) {
  const { data, error } = await supabase.functions.invoke("study-report", {
    body,
  });
  let detail = data?.error;
  if (error?.context instanceof Response) {
    try {
      detail = (await error.context.clone().json()).error;
    } catch {}
  }
  if (error || detail)
    throw Error(detail || "AI分析函数未部署或请求失败，请查看升级接入说明");
  return data;
}
function ReportContent({ text }) {
  const inline = (line) =>
    line
      .split(/\*\*(.*?)\*\*/g)
      .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
  return text
    .split("\n")
    .map((line, i) =>
      /^#{1,3} /.test(line) ? (
        <h3 key={i}>{inline(line.replace(/^#{1,3} /, ""))}</h3>
      ) : line.trim() ? (
        <p key={i}>{inline(line.replace(/^[-*] /, "• "))}</p>
      ) : (
        <div key={i} className="report-spacer" />
      ),
    );
}
export default function StudyReports({ user, data, demo, notice }) {
  const students = (data.profiles || []).filter(
    (p) =>
      p.role === "student" &&
      (user.role === "platform_admin" ||
        p.institution_id === user.institution_id),
  );
  if (demo && !students.length)
    students.push({
      id: "student-demo",
      display_name: "探索者同学",
      username: "student-demo",
      institution_id: user.institution_id,
    });
  const [student, setStudent] = useState(students[0]?.id || ""),
    [days, setDays] = useState(14),
    [instructions, setInstructions] = useState(DEFAULT_REPORT_INSTRUCTIONS),
    [messages, setMessages] = useState([]),
    [question, setQuestion] = useState(""),
    [report, setReport] = useState(""),
    [reportDays, setReportDays] = useState(14),
    [history, setHistory] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [summary, setSummary] = useState(null);
  const epoch = useRef(0),
    key = "flowspark-study-reports-" + user.id;
  useEffect(() => {
    const e = ++epoch.current;
    setMessages([]);
    setReport("");
    setSummary(null);
    setError("");
    (async () => {
      try {
        if (demo) {
          const x = JSON.parse(localStorage.getItem(key) || "[]");
          if (epoch.current === e)
            setHistory(x.filter((r) => r.student_id === student));
        } else if (student) {
          const { data: r, error } = await supabase
            .from("study_reports")
            .select(
              "id,student_id,period_days,instructions,conversation,content,summary,created_at",
            )
            .eq("student_id", student)
            .order("created_at", { ascending: false })
            .limit(20);
          if (error) throw error;
          if (epoch.current === e) setHistory(r);
        }
      } catch (e2) {
        if (epoch.current === e)
          setError(
            e2.code === "PGRST205"
              ? "请先执行第四版数据库升级，再使用报告保存与历史功能。"
              : e2.message,
          );
      }
    })();
    return () => {
      epoch.current++;
    };
  }, [student, days, user.id, demo]);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (demo) {
          const s = localStorage.getItem(key + "-template");
          if (s && live) setInstructions(s);
        } else {
          const { data: r, error } = await supabase
            .from("study_report_templates")
            .select("instructions")
            .eq("owner_id", user.id)
            .maybeSingle();
          if (!error && r && live) setInstructions(r.instructions);
        }
      } catch {}
    })();
    return () => {
      live = false;
    };
  }, [user.id, demo]);
  const person = students.find((p) => p.id === student);
  async function run(action) {
    if (busy || !student) return;
    const text =
      action === "chat"
        ? question.trim()
        : "请根据当前报告要求、已确认的对话约定和服务端提交证据，生成或修订该学生的完整学情报告。";
    if (!text) return;
    setBusy(true);
    setError("");
    const ticket = epoch.current;
    const next = [...messages, { role: "user", content: text }]
      .slice(-11)
      .map((m) => ({
        ...m,
        content:
          m.content.slice(0, 3900) +
          (m.content.length > 3900
            ? "\n[较长历史内容已截断；完整报告保留在报告面板]"
            : ""),
      }));
    setQuestion("");
    try {
      let result;
      if (demo) {
        const recent = latestSubmissions(data.submissions).filter(
          (s) =>
            s.student_id === student &&
            +new Date(s.submitted_at) >= Date.now() - days * 86400000,
        );
        const graded = recent.filter((s) => s.status === "graded");
        const stats = {
          latest_questions: recent.length,
          graded_questions: graded.length,
          pending_questions: recent.length - graded.length,
          evidence_questions: recent.length,
        };
        result = {
          summary: stats,
          answer:
            action === "chat"
              ? "【本地演示，未调用AI】真实服务可按你的要求讨论报告结构、分析重点和语气。当前模板要求为：" +
                instructions +
                "\n正式AI接通后，将根据该学生服务端可见的最新代码与批阅记录回答；演示不会假装生成真实AI分析。"
              : `# ${person?.display_name || "学生"}近期学情报告（本地统计演示，非AI分析）\n\n时间范围：近${days}天\n\n## 提交概况\n最新作业记录${recent.length}题，已批阅${graded.length}题，待批阅${stats.pending_questions}题。\n\n## 现有证据\n${recent.map((s) => "- " + (data.assignments.find((a) => a.id === s.assignment_id)?.title || "已下架题目") + "：" + s.language + "，" + (s.status === "graded" ? `教师评分${s.score}分` : "待批阅")).join("\n") || "无提交，证据不足。"}\n\n## 后续核实\n请教师核实代码思路、边界条件和独立完成情况。本地演示不运行代码，也不产生AI判断。\n\n## 你的报告要求\n${instructions}`,
        };
        if (action === "generate") {
          const row = {
            id: crypto.randomUUID(),
            student_id: student,
            period_days: days,
            instructions,
            conversation: next,
            content: result.answer,
            summary: stats,
            created_at: new Date().toISOString(),
          };
          const all = JSON.parse(localStorage.getItem(key) || "[]");
          localStorage.setItem(key, JSON.stringify([row, ...all]));
          result.report = row;
        }
      } else
        result = await invoke({
          action,
          student_id: student,
          days,
          instructions,
          messages: next,
        });
      if (ticket !== epoch.current) return;
      setMessages(
        [...next, { role: "assistant", content: result.answer }].slice(-12),
      );
      setSummary(result.summary);
      if (action === "generate") {
        setReport(result.answer);
        setReportDays(days);
        if (result.report)
          setHistory((h) =>
            [
              {
                ...result.report,
                student_id: student,
                period_days: days,
                instructions,
                conversation: next,
                content: result.answer,
                summary: result.summary,
              },
              ...h,
            ].slice(0, 20),
          );
        notice(result.save_error || "报告已生成并保存");
      }
    } catch (e) {
      if (ticket === epoch.current) {
        setError(e.message);
        setQuestion(action === "chat" ? text : "");
      }
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  function download() {
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download =
      (person?.display_name || "学生") + "_近" + reportDays + "天学情报告.md";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="app-main reports-page">
      <div className="page-heading">
        <span className="eyebrow">LEARNING INSIGHTS</span>
        <h1>每一份代码，都有成长的线索。</h1>
        <p>先讨论报告要求，再依据学生最新提交形成近期学情报告。</p>
      </div>
      <a className="p-text-button" href="#admin">
        ← 返回管理员工作台
      </a>
      <p className="platform-note">
        {demo
          ? "演示模式：仅本地统计与流程预览，不调用真实AI。"
          : "报告读取服务端授权数据，不使用浏览器传入的代码证据。AI结论需教师核实；没有运行或自动判题。"}{" "}
        <a href="docs/teaching-v4.md" target="_blank" rel="noreferrer">
          升级与AI接入说明
        </a>
      </p>
      <div className="report-layout">
        <section className="admin-box">
          <h2>分析对象与报告要求</h2>
          <div className="p-form-grid">
            <label>
              学生账号
              <select
                aria-label="分析学生"
                disabled={busy}
                value={student}
                onChange={(e) => setStudent(e.target.value)}
              >
                <option value="">选择学生</option>
                {students.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} · {p.username || p.id.slice(0, 8)} ·{" "}
                    {data.institutions?.find((i) => i.id === p.institution_id)
                      ?.name || "本机构"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              近期范围
              <select
                value={days}
                disabled={busy}
                onChange={(e) => setDays(Number(e.target.value))}
              >
                {[7, 14, 30, 90].map((d) => (
                  <option key={d} value={d}>
                    近{d}天
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            报告结构、内容和表达要求
            <textarea
              aria-label="报告要求"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={6000}
              rows={7}
              disabled={busy}
            />
          </label>
          <button
            className="p-button secondary"
            disabled={busy || !instructions.trim()}
            onClick={async () => {
              try {
                if (demo) localStorage.setItem(key + "-template", instructions);
                else {
                  const { error } = await supabase
                    .from("study_report_templates")
                    .upsert({ owner_id: user.id, instructions });
                  if (error) throw error;
                }
                notice("已保存为我的报告模板");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            保存为我的默认模板
          </button>
          <h3>与AI讨论要求</h3>
          <div className="report-chat" aria-live="polite">
            {messages.length ? (
              messages.map((m, i) => (
                <article key={i} className={"report-message " + m.role}>
                  <strong>
                    {m.role === "user"
                      ? "管理员"
                      : demo
                        ? "演示提示"
                        : "AI助手"}
                  </strong>
                  <p>{m.content}</p>
                </article>
              ))
            ) : (
              <p>
                例如：“请加入错题知识点、给家长的简明摘要，以及下周分层训练计划。”
              </p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run("chat");
            }}
          >
            <label>
              补充要求或追问
              <textarea
                aria-label="分析对话"
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                maxLength={4000}
                disabled={busy}
              />
            </label>
            <div className="p-form-actions">
              <button
                className="p-button secondary"
                disabled={busy || !student || !question.trim()}
              >
                发送讨论
              </button>
              <button
                type="button"
                className="p-button"
                disabled={busy || !student || !instructions.trim()}
                onClick={() => run("generate")}
              >
                {busy ? "正在分析…" : "生成 / 修订报告"}
              </button>
              <button
                type="button"
                className="p-text-button"
                disabled={busy}
                onClick={() => {
                  setMessages([]);
                  setReport("");
                  setSummary(null);
                }}
              >
                开启新对话
              </button>
            </div>
          </form>
          <FormError error={error} />
          <small>
            服务端每名管理员每日最多30次AI对话或分析；API费用由机构自行配置和控制。
          </small>
        </section>
        <section className="admin-box">
          <div className="p-section-heading">
            <h2>近期学情报告</h2>
            <div className="p-form-actions">
              <button
                className="p-button secondary"
                disabled={!report}
                onClick={download}
              >
                下载报告
              </button>
              <button
                className="p-button secondary"
                disabled={!report}
                onClick={() => window.print()}
              >
                打印 / PDF
              </button>
            </div>
          </div>
          {summary && (
            <p className="platform-note">
              近期最新提交 {summary.latest_questions}题 · 已批阅{" "}
              {summary.graded_questions}题 · 待批阅 {summary.pending_questions}
              题
              {summary.omitted_questions > 0
                ? " · 部分题目未纳入代码分析，请查看覆盖说明"
                : ""}
            </p>
          )}
          {report ? (
            <article className="report-document">
              <h3>
                {person?.display_name || "学生"} · 近{reportDays}天学情报告
              </h3>
              <ReportContent text={report} />
            </article>
          ) : (
            <div className="platform-empty">
              <h3>报告将在这里呈现</h3>
              <p>可以先与AI讨论，再生成；没有提交时应如实说明证据不足。</p>
            </div>
          )}
          <h3>此学生的已保存报告</h3>
          {history.length ? (
            <ul className="report-history">
              {history.map((r) => (
                <li key={r.id}>
                  <button
                    className="p-text-button"
                    disabled={busy}
                    onClick={() => {
                      setReport(r.content);
                      setReportDays(r.period_days);
                      setSummary(r.summary);
                    }}
                  >
                    {new Date(r.created_at).toLocaleString("zh-CN")} · 近
                    {r.period_days}天
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">暂无已保存报告。</p>
          )}
        </section>
      </div>
    </main>
  );
}
