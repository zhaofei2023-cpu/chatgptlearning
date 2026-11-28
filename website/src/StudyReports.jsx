import { useEffect, useRef, useState } from "react";
import { supabase } from "./data";
import { DEFAULT_REPORT_INSTRUCTIONS } from "./teaching-rules";
import {
  statistics,
  statisticalReport,
  analysisMaterial,
} from "./study-statistics";
import { FormError } from "./PlatformUI";
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
      institution_id: user.institution_id,
    });
  const [student, setStudent] = useState(students[0]?.id || ""),
    [days, setDays] = useState(14),
    [instructions, setInstructions] = useState(DEFAULT_REPORT_INSTRUCTIONS),
    [history, setHistory] = useState([]),
    [report, setReport] = useState(""),
    [reportDays, setReportDays] = useState(14),
    [source, setSource] = useState(""),
    [material, setMaterial] = useState(""),
    [includeCode, setIncludeCode] = useState(false),
    [imported, setImported] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const epoch = useRef(0),
    key = "flowspark-study-reports-" + user.id;
  const person = students.find((p) => p.id === student);
  useEffect(() => {
    const ticket = ++epoch.current;
    setReport("");
    setMaterial("");
    setImported("");
    setError("");
    setHistory([]);
    (async () => {
      try {
        let rows;
        if (demo)
          rows = JSON.parse(localStorage.getItem(key) || "[]").filter(
            (r) => r.student_id === student,
          );
        else if (student) {
          const result = await supabase
            .from("study_reports")
            .select("id,student_id,period_days,content,summary,created_at")
            .eq("student_id", student)
            .order("created_at", { ascending: false })
            .limit(20);
          if (result.error) throw result.error;
          rows = result.data;
        }
        if (ticket === epoch.current) setHistory(rows || []);
      } catch (e) {
        if (ticket === epoch.current) setError(e.message);
      }
    })();
    return () => {
      epoch.current++;
    };
  }, [student, days, user.id, demo]);
  useEffect(() => {
    let live = true;
    (async () => {
      if (demo) {
        const s = localStorage.getItem(key + "-template");
        if (s && live) setInstructions(s);
      } else {
        const r = await supabase
          .from("study_report_templates")
          .select("instructions")
          .eq("owner_id", user.id)
          .maybeSingle();
        if (live && r.data) setInstructions(r.data.instructions);
      }
    })();
    return () => {
      live = false;
    };
  }, [user.id, demo]);
  async function snapshot(code = false) {
    let rows = data.submissions || [],
      assignments = data.assignments || [];
    if (!demo) {
      rows = [];
      for (let offset = 0; ; offset += 500) {
        const r = await supabase
          .from("submissions")
          .select(
            "id,assignment_id,student_id,language,status,score,feedback,submitted_at,attempt_count" +
              (code ? ",code" : ""),
          )
          .eq("student_id", student)
          .order("id")
          .range(offset, offset + 499);
        if (r.error) throw r.error;
        rows.push(...r.data);
        if (r.data.length < 500) break;
      }
    }
    if (!code) rows = rows.map(({ code, ...s }) => s);
    return statistics(rows, assignments, student, days);
  }
  async function save(content, summary) {
    if (!content.trim() || content.length > 40000)
      throw Error("报告内容须为1至40000字，请缩短后保存");
    let row = {
      student_id: student,
      institution_id: person.institution_id,
      created_by: user.id,
      period_days: days,
      instructions,
      conversation: [],
      content,
      summary,
    };
    if (demo) {
      row = {
        ...row,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
      };
      const all = JSON.parse(localStorage.getItem(key) || "[]");
      localStorage.setItem(key, JSON.stringify([row, ...all]));
    } else {
      const r = await supabase
        .from("study_reports")
        .insert(row)
        .select("id,student_id,period_days,content,summary,created_at")
        .single();
      if (r.error) throw r.error;
      row = r.data;
    }
    return row;
  }
  async function action(kind) {
    if (busy || !person) return;
    const ticket = epoch.current;
    setBusy(true);
    setError("");
    try {
      if (kind === "export") {
        const s = await snapshot(includeCode);
        const text = analysisMaterial(
          s,
          instructions,
          (data.profiles || [])
            .flatMap((p) => [p.display_name, p.username, p.id])
            .concat([person.display_name, person.username, person.id]),
        );
        if (ticket === epoch.current) setMaterial(text);
      } else {
        const s = await snapshot();
        const content =
          kind === "import" ? imported.trim() : statisticalReport(s);
        const row = await save(content, {
          ...s,
          mode: kind === "import" ? "manual_chatgpt" : "statistics",
          imported_at: kind === "import" ? new Date().toISOString() : null,
        });
        if (ticket === epoch.current) {
          setReport(row.content);
          setReportDays(row.period_days);
          setSource(row.summary.mode);
          setHistory((h) => [row, ...h].slice(0, 20));
          notice("报告已保存");
        }
      }
    } catch (e) {
      if (ticket === epoch.current) setError(e.message);
    } finally {
      if (ticket === epoch.current) setBusy(false);
    }
  }
  function download(text, name) {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/markdown;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <main className="app-main reports-page">
      <div className="page-heading">
        <span className="eyebrow">LEARNING INSIGHTS</span>
        <h1>每一份代码，都有成长的线索。</h1>
        <p>免费统计 · 手动ChatGPT分析 · 学生报告归档</p>
      </div>
      <a className="p-text-button" href="#admin">
        ← 返回管理员工作台
      </a>
      <p className="platform-note">
        本站此流程不调用付费AI
        API。管理员可将匿名资料手动上传ChatGPT，继续对话调整报告，再导入归档。
        <a href="docs/report-free-workflow.md" target="_blank" rel="noreferrer">
          {" "}
          查看使用说明
        </a>
      </p>
      <div className="report-layout">
        <section className="admin-box">
          <h2>1. 选择学生，生成免费统计</h2>
          <div className="p-form-grid">
            <label>
              学生账号
              <select
                aria-label="分析学生"
                value={student}
                disabled={busy}
                onChange={(e) => setStudent(e.target.value)}
              >
                <option value="">选择学生</option>
                {students.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} · {p.username || p.id.slice(0, 8)}
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
          <button
            className="p-button"
            disabled={busy || !student}
            onClick={() => action("statistics")}
          >
            生成并保存统计报告
          </button>
          <h2>2. 导出资料，手动分析</h2>
          <label>
            报告结构、内容和表达要求
            <textarea
              aria-label="报告要求"
              rows={7}
              value={instructions}
              maxLength={6000}
              disabled={busy}
              onChange={(e) => {
                setInstructions(e.target.value);
                setMaterial("");
              }}
            />
          </label>
          <button
            className="p-button secondary"
            disabled={busy || !instructions.trim()}
            onClick={async () => {
              try {
                if (demo) localStorage.setItem(key + "-template", instructions);
                else {
                  const r = await supabase
                    .from("study_report_templates")
                    .upsert({ owner_id: user.id, instructions });
                  if (r.error) throw r.error;
                }
                notice("已保存为我的报告模板");
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            保存为我的默认模板
          </button>
          <label className="report-code-option">
            <input
              type="checkbox"
              checked={includeCode}
              disabled={busy}
              onChange={(e) => {
                setIncludeCode(e.target.checked);
                setMaterial("");
              }}
            />
            附带最新代码（默认不选）
          </label>
          <p>
            资料使用“学生A”代号，隐藏已知账号姓名、邮箱和手机号。上传前请检查下方预览中的个人信息，尤其是代码注释。
          </p>
          <button
            className="p-button secondary"
            disabled={busy || !student || !instructions.trim()}
            onClick={() => action("export")}
          >
            准备匿名分析资料
          </button>
          {material && (
            <>
              <label>
                匿名资料预览（可编辑）
                <textarea
                  aria-label="匿名资料预览"
                  rows={12}
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                />
              </label>
              <button
                className="p-button"
                disabled={busy}
                onClick={() =>
                  download(
                    material,
                    "学生A_近" + days + "天_ChatGPT分析资料.md",
                  )
                }
              >
                下载分析资料
              </button>
              <a
                className="p-text-button"
                href="https://chatgpt.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                打开ChatGPT ↗
              </a>
            </>
          )}
          <h2>3. 导入并归档分析报告</h2>
          <p>
            粘贴ChatGPT最终报告，或读取TXT、Markdown文件。将保存至当前学生：
            {person?.display_name || "尚未选择"}，近{days}
            天。导入内容由管理员核对，网站不自动验证AI结论。
          </p>
          <label>
            读取报告文件
            <input
              aria-label="读取报告文件"
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              disabled={busy}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  if (f.size > 200000) throw Error("文件请控制在200KB以内");
                  const text = await f.text();
                  if (text.length > 40000) throw Error("报告不得超过40000字");
                  setImported(text);
                } catch (e) {
                  setError(e.message);
                }
                e.target.value = "";
              }}
            />
          </label>
          <label>
            最终报告内容
            <textarea
              aria-label="最终报告内容"
              rows={8}
              maxLength={40000}
              value={imported}
              disabled={busy}
              onChange={(e) => setImported(e.target.value)}
            />
          </label>
          <button
            className="p-button"
            disabled={busy || !student || !imported.trim()}
            onClick={() => action("import")}
          >
            保存导入报告
          </button>
          {busy && <p role="status">正在处理…</p>}
          <FormError error={error} />
        </section>
        <section className="admin-box">
          <div className="p-section-heading">
            <h2>近期学情报告</h2>
            <div className="p-form-actions">
              <button
                className="p-button secondary"
                disabled={!report}
                onClick={() =>
                  download(
                    report,
                    (person?.display_name || "学生") +
                      "_近" +
                      reportDays +
                      "天学情报告.md",
                  )
                }
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
          {report ? (
            <article className="report-document">
              <h3>
                {person?.display_name} · 近{reportDays}天学情报告
              </h3>
              <p>
                {source === "statistics"
                  ? "来源：免费客观统计（非AI分析）"
                  : source === "manual_chatgpt"
                    ? "来源：管理员手动导入ChatGPT报告，需教师核实"
                    : "来源：历史报告，需教师核实"}
              </p>
              <ReportContent text={report} />
            </article>
          ) : (
            <div className="platform-empty">
              <h3>报告将在这里呈现</h3>
              <p>先生成免费统计，或导入管理员核对后的分析报告。</p>
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
                      setSource(r.summary?.mode);
                    }}
                  >
                    {new Date(r.created_at).toLocaleString("zh-CN")} · 近
                    {r.period_days}天 ·{" "}
                    {r.summary?.mode === "statistics"
                      ? "免费统计"
                      : r.summary?.mode === "manual_chatgpt"
                        ? "手动导入"
                        : "历史报告"}
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
