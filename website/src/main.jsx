import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Code2,
  Sparkles,
  BookOpen,
  Play,
  Check,
  Plus,
  Search,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Terminal,
  Send,
  FileCode2,
  Users,
  Clock,
  Layers,
  Bookmark,
  Download,
  GraduationCap,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Copy,
  Loader2,
  Compass,
} from "lucide-react";
import {
  cloud,
  supabase,
  readDemo,
  writeDemo,
  fetchCloud,
  safeUrl,
  starter,
  offlineHint,
  initial,
} from "./data";
import "./styles.css";
import AdminPanel, { PasswordChange, roleNames } from "./AdminPanel";
import { aiEnabled } from "./data";
const I = { ArrowUpRight, ArrowRight, Code2, Sparkles, BookOpen };
const date = (s) =>
  s
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "short",
        day: "numeric",
      }).format(new Date(s))
    : "未设置";
const brandIntro =
  "山西慧动科技是一家专注于AI内容生成与行业落地的解决方案提供商。致力于以人工智能为核心驱动力，推动AI技术在文旅、教育、商业等领域的场景化应用。";
function Orbital() {
  const ref = useRef();
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas.getContext("2d");
    let raf;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w, h;
    function resize() {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    }
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvas);
    function draw(ms) {
      ctx.clearRect(0, 0, w, h);
      const t = reduced ? 0 : ms * 0.00016,
        cx = w * 0.5,
        cy = h * 0.49,
        R = Math.min(w, h) * 0.32;
      const dots = [];
      for (let j = 0; j < 170; j++) {
        const a = j * 2.399963,
          yy = 1 - (2 * (j + 0.5)) / 170,
          r = Math.sqrt(1 - yy * yy),
          xx = r * Math.cos(a + t),
          zz = r * Math.sin(a + t),
          ry = yy * Math.cos(0.4) - zz * Math.sin(0.4),
          rz = yy * Math.sin(0.4) + zz * Math.cos(0.4);
        dots.push({ x: cx + xx * R, y: cy + ry * R, z: rz });
      }
      for (let i = 0; i < dots.length; i++) {
        const p = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const q = dots[j],
            dist = Math.hypot(p.x - q.x, p.y - q.y);
          if (dist < 54 && Math.abs(p.z - q.z) < 0.3) {
            ctx.strokeStyle = `rgba(104,210,221,${0.12 * (1 - dist / 54) * (p.z + 1.4)})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(143,235,234,${0.25 + (0.6 * (p.z + 1)) / 2})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.2 + (p.z + 1) * 0.75, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let k = 0; k < 3; k++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-0.5 + k * 0.8);
        ctx.strokeStyle = ["#6dcfcf40", "#9b95ec40", "#7ba5e340"][k];
        ctx.beginPath();
        ctx.ellipse(0, 0, R * 1.36, R * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        const a = t * (k + 1) + k * 2;
        ctx.fillStyle = ["#9df4e5", "#b9b4fc", "#a3cdfc"][k];
        ctx.shadowBlur = 20;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(
          Math.cos(a) * R * 1.36,
          Math.sin(a) * R * 0.45,
          4,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.restore();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    }
    draw(0);
    return () => {
      cancelAnimationFrame(raf);
      obs.disconnect();
    };
  }, []);
  return <canvas ref={ref} aria-hidden="true" />;
}
function App() {
  const [page, setPage] = useState(location.hash.slice(1) || "home"),
    [user, setUser] = useState(null),
    [demo, setDemo] = useState(!cloud),
    [data, setData] = useState(
      cloud
        ? {
            classes: [],
            assignments: [],
            submissions: [],
            resources: initial().resources,
          }
        : readDemo,
    ),
    [auth, setAuth] = useState(false),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [menu, setMenu] = useState(false),
    [selected, setSelected] = useState(null),
    [search, setSearch] = useState(""),
    [resourceFilter, setResourceFilter] = useState("全部"),
    [modal, setModal] = useState(null),
    [messages, setMessages] = useState([]),
    [chat, setChat] = useState(""),
    [sending, setSending] = useState(false);
  const isTeacher = user?.role === "teacher";
  const isAdmin = ["platform_admin", "org_admin"].includes(user?.role);
  const localMentor = demo || !aiEnabled;
  useEffect(() => {
    const fn = () => {
      setPage(location.hash.slice(1) || "home");
      setMenu(false);
      setSearch("");
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    let generation = 0;
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      const request = ++generation;
      setTimeout(async () => {
        if (!active || request !== generation) return;
        if (!session) {
          setUser(null);
          setDemo(false);
          setData({
            classes: [],
            assignments: [],
            submissions: [],
            resources: initial().resources,
          });
          return;
        }
        const { data: p, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();
        if (!active || request !== generation) return;
        if (error) {
          setUser(null);
          setData({
            classes: [],
            assignments: [],
            submissions: [],
            resources: initial().resources,
          });
          notice("账号资料加载失败，请联系管理员");
          return;
        }
        if (!p.is_active) {
          notice("账号尚未启用或已停用，请联系机构管理员");
          await supabase.auth.signOut();
          return;
        }
        setDemo(false);
        setUser(p);
        if (p.must_change_password) return;
        try {
          const next = await fetchCloud();
          if (active && request === generation) setData(next);
        } catch (e) {
          notice(e.message);
        }
      }, 0);
    });
    return () => {
      active = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (demo) writeDemo(data);
  }, [data, demo]);
  function notice(t) {
    setToast(t);
    setTimeout(() => setToast(""), 5000);
  }
  function nav(p) {
    location.hash = p;
    setPage(p);
    setMenu(false);
    setSearch("");
    window.scrollTo({ top: 0 });
  }
  async function refresh() {
    if (!demo) setData(await fetchCloud());
  }
  async function action(fn) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notice(e.message || "操作失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }
  function requireUser() {
    if (!user) {
      setAuth(true);
      return false;
    }
    return true;
  }
  function loginDemo(role) {
    setDemo(true);
    setData(readDemo());
    setUser({
      id:
        role === "teacher"
          ? "teacher-demo"
          : role === "student"
            ? "student-demo"
            : role + "-demo",
      institution_id: "org-demo",
      role,
      display_name: role.includes("admin")
        ? roleNames[role]
        : role === "teacher"
          ? "探索者老师"
          : "探索者同学",
    });
    setAuth(false);
    nav(
      role.includes("admin")
        ? "admin"
        : role === "teacher"
          ? "teacher"
          : "assignments",
    );
    notice("已进入" + roleNames[role] + "演示空间，数据仅存于当前浏览器");
  }
  async function signOut() {
    if (cloud && !demo) await supabase.auth.signOut();
    setUser(null);
    setMessages([]);
    nav("home");
  }
  function openAssignment(a) {
    setSelected(a.id);
    nav("workspace");
  }
  const assignment =
    data.assignments.find((a) => a.id === selected) || data.assignments[0];
  async function insert(table, row) {
    if (demo) {
      const newRow = { ...row, id: crypto.randomUUID() };
      setData((d) => ({ ...d, [table]: [newRow, ...d[table]] }));
      return newRow;
    }
    const { data: r, error } = await supabase
      .from(table)
      .insert(row)
      .select()
      .single();
    if (error) throw error;
    await refresh();
    return r;
  }
  async function saveSubmission(code, language) {
    if (!requireUser()) return;
    if (user.role !== "student") {
      notice("请使用学生账号提交");
      return;
    }
    if (!code.trim()) {
      notice("请先填写代码");
      return;
    }
    if (code.length > 100000) {
      notice("代码不可超过100000字符");
      return;
    }
    if (
      assignment.due_at &&
      Date.now() > new Date(assignment.due_at).getTime()
    ) {
      notice("作业已截止，请联系老师");
      return;
    }
    await action(async () => {
      await insert("submissions", {
        assignment_id: assignment.id,
        student_id: user.id,
        ...(demo ? { student_name: user.display_name } : {}),
        language,
        code,
        status: "pending",
        submitted_at: new Date().toISOString(),
      });
      notice(
        demo ? "演示提交已保存，等待教师演示批阅" : "提交成功，等待老师批阅",
      );
    });
  }
  async function ask(e) {
    e.preventDefault();
    if (!chat.trim() || sending) return;
    if (!requireUser()) return;
    const question = chat.trim();
    setChat("");
    const history = [...messages, { role: "user", content: question }];
    setMessages(history);
    setSending(true);
    try {
      let answer;
      if (localMentor) {
        answer = offlineHint(question, assignment);
      } else {
        const { data: r, error } = await supabase.functions.invoke("mentor", {
          body: { messages: history.slice(-6), assignment_id: assignment?.id },
        });
        if (error)
          throw new Error(
            "AI服务尚未接通或请求失败，请联系管理员检查函数与配额。",
          );
        answer = r.answer;
      }
      setMessages([...history, { role: "assistant", content: answer }]);
    } catch (e) {
      setMessages([
        ...history,
        { role: "assistant", content: "服务提示：" + e.message },
      ]);
    } finally {
      setSending(false);
    }
  }
  const visibleAssignments = data.assignments.filter(
    (a) => isTeacher || a.status === "published",
  );
  if (user?.must_change_password && !demo)
    return (
      <>
        <PasswordChange
          notice={notice}
          onDone={async () => {
            const { data: p, error } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", user.id)
              .single();
            if (error || p.must_change_password)
              throw Error("改密状态尚未更新，请重新登录");
            setUser(p);
            setData(await fetchCloud());
            nav(p.role.includes("admin") ? "admin" : "assignments");
          }}
        />
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
        <button onClick={signOut}>退出登录</button>
      </>
    );
  return (
    <>
      <header className="header">
        <a className="brand" href="#home" aria-label="慧动科技首页">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <span>
            <b>
              FlowSpark<span className="brand-dot">.</span>
            </b>
            <small>慧动科技 · 学习探索</small>
          </span>
        </a>
        <nav className={menu ? "nav open" : "nav"} aria-label="主导航">
          {[
            ["home", "探索首页"],
            ["assignments", "竞赛作业"],
            ["resources", "学习资源"],
            ["mentor", "学习助手"],
            ["guide", "使用指南"],
          ].map(([k, t]) => (
            <a key={k} href={"#" + k} className={page === k ? "active" : ""}>
              {t}
            </a>
          ))}
          {isTeacher && (
            <a href="#teacher" className={page === "teacher" ? "active" : ""}>
              教师工作台
            </a>
          )}
          {isAdmin && <a href="#admin">机构与账号</a>}
        </nav>
        <div className="header-end">
          {user ? (
            <>
              <span className="user-pill">
                <span className="avatar">{user.display_name?.[0] || "学"}</span>
                <span>
                  {user.display_name}
                  <small>
                    {demo ? "演示 · " : ""}
                    {roleNames[user.role]}
                  </small>
                </span>
              </span>
              <button
                className="icon-button"
                onClick={signOut}
                title="退出登录"
                aria-label="退出登录"
              >
                <LogOut size={17} />
              </button>
            </>
          ) : (
            <button
              className="button small light"
              onClick={() => setAuth(true)}
            >
              进入学习空间 <ArrowUpRight size={15} />
            </button>
          )}
          <button
            className="mobile-menu icon-button"
            onClick={() => setMenu(!menu)}
            aria-label="打开导航"
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      {page !== "home" && (
        <div className="mode-note">
          <span className="dot" />
          {demo
            ? "演示体验 · 数据只保存在当前浏览器，不用于正式教学"
            : cloud
              ? "云端学习空间 · 权限由服务端校验"
              : "学习空间"}
          {demo && (
            <a href="#guide">
              了解正式接入 <ArrowUpRight size={13} />
            </a>
          )}
        </div>
      )}
      {page === "home" && (
        <>
          <section className="hero">
            <div className="hero-grid" />
            <div className="hero-inner">
              <div className="hero-copy">
                <div className="eyebrow">
                  <span className="pulse" /> FLOWSPARK / AI LEARNING LAB
                </div>
                <h1>
                  把好奇心，
                  <br />
                  写成<span className="gradient-text">未来。</span>
                </h1>
                <p>
                  在 AI 时代，让每一次提问都通往新的发现。
                  <br />
                  与算法同行，在探索中成长，把想法变成作品。
                </p>
                <div className="hero-actions">
                  <button
                    className="button mint"
                    onClick={() => (user ? nav("assignments") : setAuth(true))}
                  >
                    开启学习之旅 <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => nav("resources")}
                  >
                    <span className="play-circle">
                      <Play size={13} />
                    </span>
                    探索学习资源
                  </button>
                </div>
                <div className="hero-caption">
                  <span className="tiny-avatars">
                    <i>思</i>
                    <i>考</i>
                    <i>创</i>
                  </span>
                  <span>
                    从第一行代码，到独立解决问题。
                    <br />
                    <b>探索没有标准答案，成长有迹可循。</b>
                  </span>
                </div>
              </div>
              <div className="hero-visual">
                <Orbital />
                <div className="orbit-label label-one">
                  <Code2 size={15} /> while (curiosity) &#123; explore(); &#125;
                </div>
                <div className="orbit-label label-two">
                  <Sparkles size={16} /> HUMAN × AI
                </div>
                <div className="orbit-center">
                  <span className="spark-icon">
                    <Sparkles size={66} strokeWidth={1.1} />
                  </span>
                  <small>IDEAS INTO POSSIBILITIES</small>
                </div>
                <div className="visual-coordinates">
                  EXPLORE / THINK / CREATE <span>001 — ∞</span>
                </div>
              </div>
            </div>
            <div className="hero-bottom">
              <span>BUILT FOR THE NEXT GENERATION OF EXPLORERS</span>
              <span>
                向下探索 <span className="down">↓</span>
              </span>
            </div>
          </section>
          <section className="path-strip">
            <span>一个平台，连接学习的每一步</span>
            {[
              [Code2, "竞赛编程"],
              [Sparkles, "启发式答疑"],
              [BookOpen, "公开课资源"],
              [Users, "师生协作"],
            ].map(([Icon, t]) => (
              <div key={t}>
                <Icon size={20} />
                {t}
              </div>
            ))}
          </section>
          <section className="section">
            <div className="section-top">
              <div>
                <div className="eyebrow dark">01 / THE LEARNING JOURNEY</div>
                <h2>让学习，真正发生。</h2>
              </div>
              <p>
                从理解一个问题，到创造一种可能。
                <br />
                找到你的节奏，构建自己的知识地图。
              </p>
            </div>
            <div className="journey-grid">
              {[
                {
                  n: "01",
                  icon: "Code2",
                  title: "在代码中，找到答案",
                  text: "接收老师发布的任务，拆解问题、编写代码、提交思考。用一次次实践，建立算法思维。",
                  page: "assignments",
                  tag: "信息学竞赛 / CSP / 基础算法",
                  cls: "mint-card",
                },
                {
                  n: "02",
                  icon: "Sparkles",
                  title: "好问题，值得被回应",
                  text: "遇到困难时，从思路、边界和复杂度开始提问。让启发帮助你前进，而不是替你思考。",
                  page: "mentor",
                  tag: "思路启发 / 概念解释 / 调试",
                  cls: "violet-card",
                },
                {
                  n: "03",
                  icon: "BookOpen",
                  title: "把世界，变成课堂",
                  text: "走进名校开放课程与开源知识库，用高质量材料拓展视野，按自己的节奏深入学习。",
                  page: "resources",
                  tag: "公开课 / 官方讲义 / 知识地图",
                  cls: "blue-card",
                },
              ].map((c) => {
                const Icon = I[c.icon];
                return (
                  <button
                    key={c.n}
                    className={"journey-card " + c.cls}
                    onClick={() => nav(c.page)}
                  >
                    <div className="card-top">
                      <span>{c.n} /</span>
                      <Icon size={27} />
                    </div>
                    <div className="card-art">
                      <div className="art-shape" />
                      <span>
                        {c.n === "01" ? "{ }" : c.n === "02" ? "✳︎" : "↗"}
                      </span>
                    </div>
                    <small>{c.tag}</small>
                    <h3>{c.title}</h3>
                    <p>{c.text}</p>
                    <span className="card-link">
                      开始探索 <ArrowUpRight size={17} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
          <section className="featured section">
            <div className="section-top">
              <div>
                <div className="eyebrow dark">02 / OPEN KNOWLEDGE</div>
                <h2>与更广阔的知识相遇。</h2>
              </div>
              <button
                className="button outline"
                onClick={() => nav("resources")}
              >
                浏览资源库 <ArrowUpRight size={17} />
              </button>
            </div>
            <div className="resource-grid">
              {initial()
                .resources.slice(0, 3)
                .map((r) => (
                  <ResourceCard
                    key={r.id}
                    r={r}
                    onSave={() => notice("请在资源库中收藏课程")}
                  />
                ))}
            </div>
            <p className="footnote">
              资源指向院校或项目的公开官方入口，不代表合作或授权。资源版权归原作者所有。
            </p>
          </section>
          <section className="brand-section">
            <div className="brand-about">
              <img
                src={`${import.meta.env.BASE_URL}brand-logo.svg`}
                alt="FlowSpark 慧动科技"
              />
              <div className="eyebrow dark">
                POWERED BY SHANXI HUIDONG TECHNOLOGY
              </div>
              <h2>
                让每一个行业，
                <br />
                都拥有自己的AI内容工厂。
              </h2>
              <p>{brandIntro}</p>
              <button
                className="text-button dark"
                onClick={() => setAuth(true)}
              >
                从教育场景出发，探索更多可能 <ArrowUpRight size={18} />
              </button>
            </div>
            <div className="brand-manifesto">
              <span>慧</span>
              <div>
                以智能为引擎
                <br />
                以创造为方向
                <br />
                <b>让探索持续发生。</b>
              </div>
              <small>FLOWSPARK / THINK BEYOND</small>
            </div>
          </section>
          <section className="cta">
            <span>YOUR NEXT IDEA STARTS HERE</span>
            <h2>下一次突破，从现在开始。</h2>
            <button className="button mint" onClick={() => setAuth(true)}>
              进入学习空间 <ArrowUpRight size={18} />
            </button>
          </section>
        </>
      )}
      {page === "assignments" && (
        <main className="app-main">
          <PageHeading
            kicker="LEARN BY DOING"
            title="今天，探索什么？"
            subtitle="把复杂的问题，拆成可以迈出的下一步。"
          />
          <div className="workspace-toolbar">
            <div className="tabs">
              <button className="selected">
                {isTeacher ? "我的教学作业" : "我的竞赛作业"}
              </button>
              <span>{visibleAssignments.length} 项任务</span>
            </div>
            <div className="search">
              <Search size={16} />
              <input
                aria-label="搜索作业"
                placeholder="搜索题目、算法标签…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {user?.role === "student" && (
            <JoinClass
              onJoin={async (code) =>
                action(async () => {
                  if (demo) {
                    if (code !== "SPARK2026")
                      throw new Error("演示班级邀请码为 SPARK2026");
                    notice("已加入演示班级");
                  } else {
                    const { error } = await supabase.rpc("join_class", {
                      invite: code,
                    });
                    if (error) throw error;
                    await refresh();
                    notice("加入班级成功");
                  }
                })
              }
            />
          )}
          <div className="assignment-grid">
            {visibleAssignments
              .filter((a) =>
                (a.title + a.tags?.join(""))
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((a, i) => {
                const own = data.submissions.filter(
                  (s) => s.assignment_id === a.id && s.student_id === user?.id,
                );
                const graded = own.find((s) => s.status === "graded");
                return (
                  <article className="assignment-card" key={a.id}>
                    <div className="card-top">
                      <span
                        className={
                          "level " + (a.level === "挑战" ? "purple" : "")
                        }
                      >
                        {a.level}
                      </span>
                      <span className="muted">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h3>{a.title}</h3>
                    <p>{a.statement?.slice(0, 68)}…</p>
                    <div className="tags">
                      {a.tags?.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                    <div className="assignment-bottom">
                      <span>
                        <Clock size={14} />
                        {date(a.due_at)} 截止
                      </span>
                      <button
                        className="text-button dark"
                        onClick={() => openAssignment(a)}
                      >
                        {graded
                          ? `已批阅 ${graded.score} 分`
                          : own.length
                            ? "查看提交"
                            : "开始挑战"}
                        <ArrowUpRight size={17} />
                      </button>
                    </div>
                    {a.status === "draft" && <small>草稿 · 学生不可见</small>}
                  </article>
                );
              })}
          </div>
          {!visibleAssignments.length && (
            <Empty
              text={
                user
                  ? "还没有作业，请先加入班级或由老师发布。"
                  : "登录后即可查看分配给你的作业。"
              }
            />
          )}
        </main>
      )}
      {page === "workspace" && (
        <main className="app-main editor-main">
          <button
            className="text-button dark"
            onClick={() => nav("assignments")}
          >
            <ArrowLeft size={16} />
            返回作业
          </button>
          {assignment ? (
            <Editor
              key={assignment.id}
              a={assignment}
              user={user}
              demo={demo}
              busy={busy}
              onSubmit={saveSubmission}
              submissions={data.submissions.filter(
                (s) =>
                  s.assignment_id === assignment.id &&
                  s.student_id === user?.id,
              )}
              onMentor={() => nav("mentor")}
              notice={notice}
            />
          ) : (
            <Empty text="请先选择一道作业。" />
          )}
        </main>
      )}
      {page === "resources" && (
        <main className="app-main">
          <PageHeading
            kicker="KNOWLEDGE WITHOUT BORDERS"
            title="把世界，变成课堂。"
            subtitle="官方公开课、精选讲义与算法知识库。让好奇心有处可去。"
          />
          <div className="workspace-toolbar">
            <div className="tabs">
              {["全部", "视频", "课件"].map((t) => (
                <button
                  className={resourceFilter === t ? "selected" : ""}
                  key={t}
                  onClick={() => setResourceFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="search">
              <Search size={16} />
              <input
                aria-label="搜索资源"
                placeholder="课程、学校或关键词…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="resource-grid">
            {data.resources
              .filter(
                (r) =>
                  (resourceFilter === "全部" || r.kind === resourceFilter) &&
                  (r.title + r.school + r.description)
                    .toLowerCase()
                    .includes(search.toLowerCase()),
              )
              .map((r) => (
                <ResourceCard
                  key={r.id}
                  r={r}
                  onSave={() => {
                    const k = "flowspark-bookmarks-" + (user?.id || "guest");
                    const v = JSON.parse(localStorage.getItem(k) || "[]");
                    localStorage.setItem(
                      k,
                      JSON.stringify(
                        v.includes(r.id)
                          ? v.filter((x) => x !== r.id)
                          : [...v, r.id],
                      ),
                    );
                    notice(
                      v.includes(r.id) ? "已取消收藏" : "已收藏在当前浏览器",
                    );
                  }}
                />
              ))}
          </div>
          <p className="footnote">
            课程链接指向官方网站。部分课程为英语；部分材料可能需要在官网登录。本站不托管或转载未经授权的课件及视频。
          </p>
        </main>
      )}
      {page === "mentor" && (
        <main className="app-main">
          <PageHeading
            kicker="THINK WITH A LITTLE SPARK"
            title="把卡住的地方，说出来。"
            subtitle="先理解，再动手。这里更关心你的思路，而不只是答案。"
          />
          <div className="mentor-layout">
            <aside className="mentor-aside">
              <div className="mentor-symbol">
                <Sparkles size={32} />
              </div>
              <h3>{localMentor ? "离线学习提示" : "AI学习助手"}</h3>
              <p>
                {localMentor
                  ? "当前未接入AI服务，以下是本地规则生成的学习提示，不是AI对话。"
                  : "从概念、边界与调试方法入手，启发独立思考。请不要输入个人敏感信息。"}
              </p>
              <label>
                关联作业
                <select
                  value={assignment?.id || ""}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {visibleAssignments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mentor-prompts">
                <small>试着这样问</small>
                {[
                  "这道题可以从哪里开始？",
                  "我该怎样检查边界情况？",
                  "如何分析时间复杂度？",
                ].map((s) => (
                  <button key={s} onClick={() => setChat(s)}>
                    {s}
                    <Plus size={14} />
                  </button>
                ))}
              </div>
              <button
                className="text-button dark"
                onClick={() => setMessages([])}
              >
                清空本次对话
              </button>
            </aside>
            <section className="chat-panel">
              <div className="chat-top">
                <span className="dot" />
                {localMentor ? "离线提示模式 · 非AI" : "启发式对话"}
                <span>先尝试，再求助</span>
              </div>
              <div className="messages" aria-live="polite">
                {!messages.length ? (
                  <div className="chat-empty">
                    <Sparkles size={36} />
                    <h3>每一个好问题，都值得探索。</h3>
                    <p>告诉我你正在解决什么问题，已经尝试了什么。</p>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div className={"message " + m.role} key={i}>
                      <span className="message-avatar">
                        {m.role === "user" ? "你" : "✳"}
                      </span>
                      <div>
                        <small>
                          {m.role === "user"
                            ? "我的问题"
                            : localMentor
                              ? "离线提示"
                              : "FlowSpark 学习助手"}
                        </small>
                        <p>{m.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {sending && (
                  <p className="muted">
                    <Loader2 className="spin" size={17} />
                    正在组织思路…
                  </p>
                )}
              </div>
              <form className="chat-form" onSubmit={ask}>
                <textarea
                  aria-label="输入学习问题"
                  maxLength={4000}
                  value={chat}
                  onChange={(e) => setChat(e.target.value)}
                  placeholder="描述你的问题，也可以粘贴报错或一小段代码…"
                />
                <button
                  className="button dark-button"
                  disabled={sending || !chat.trim()}
                >
                  <Send size={17} />
                  发送
                </button>
              </form>
              <small className="chat-disclaimer">
                {localMentor
                  ? "本地提示不理解任意对话，请接入AI服务后使用完整答疑功能。"
                  : "AI可能出错，请结合题目与老师建议核对。代码提交不等于自动评测。"}
              </small>
            </section>
          </div>
        </main>
      )}
      {page === "admin" &&
        (isAdmin ? (
          <AdminPanel
            user={user}
            data={data}
            demo={demo}
            refresh={refresh}
            notice={notice}
          />
        ) : (
          <main className="app-main">
            <p>请使用机构或平台管理员账号登录。</p>
          </main>
        ))}
      {page === "teacher" && (
        <main className="app-main">
          {isTeacher ? (
            <>
              <PageHeading
                kicker="TEACHER STUDIO"
                title="点亮下一段探索。"
                subtitle="发布学习任务，理解学生的思考，为每一次尝试提供反馈。"
              />
              <div className="teacher-stats">
                {[
                  ["我的班级", data.classes.length, Users],
                  ["发布的作业", data.assignments.length, FileCode2],
                  [
                    "待批阅提交",
                    data.submissions.filter((s) => s.status === "pending")
                      .length,
                    Clock,
                  ],
                ].map(([t, n, Icon]) => (
                  <div key={t}>
                    <Icon size={24} />
                    <span>
                      {t}
                      <b>{n}</b>
                    </span>
                  </div>
                ))}
              </div>
              <div className="teacher-actions">
                <button
                  className="button dark-button"
                  onClick={() => setModal("assignment")}
                >
                  <Plus size={17} />
                  发布作业
                </button>
                <button
                  className="button outline"
                  onClick={() => setModal("class")}
                >
                  <Users size={17} />
                  创建班级
                </button>
                <button
                  className="button outline"
                  onClick={() => setModal("resource")}
                >
                  <BookOpen size={17} />
                  添加资源
                </button>
              </div>
              <div className="class-list">
                {data.classes.map((c) => (
                  <div key={c.id}>
                    <span>{c.name}</span>
                    <small>
                      邀请码 <b>{c.join_code}</b>
                    </small>
                    <button
                      className="icon-button"
                      aria-label="复制邀请码"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(c.join_code)
                          .then(() => notice("邀请码已复制"))
                          .catch(() => notice("邀请码：" + c.join_code))
                      }
                    >
                      <Copy size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <h3 className="subheading">
                学生提交 <span>{data.submissions.length}</span>
              </h3>
              {!data.submissions.length ? (
                <Empty text="学生提交后，代码和批阅入口会显示在这里。" />
              ) : (
                <div className="submission-list">
                  {data.submissions.map((s) => (
                    <article key={s.id}>
                      <div>
                        <span
                          className={
                            "status " + (s.status === "graded" ? "done" : "")
                          }
                        >
                          {s.status === "graded" ? "已批阅" : "待批阅"}
                        </span>
                        <h3>
                          {data.assignments.find(
                            (a) => a.id === s.assignment_id,
                          )?.title || "作业"}
                        </h3>
                        <small>
                          {s.student_name || s.student_id.slice(0, 8)} ·{" "}
                          {s.language} · {date(s.submitted_at)}
                        </small>
                      </div>
                      <button
                        className="button outline"
                        onClick={() => setModal({ review: s })}
                      >
                        查看与批阅 <ArrowUpRight size={16} />
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <Empty text="此页面仅对教师开放。请登录教师账号；演示身份不代表正式权限。" />
          )}
        </main>
      )}
      {page === "guide" && (
        <main className="app-main guide">
          <PageHeading
            kicker="A GUIDE TO GETTING STARTED"
            title="从第一次登录，到独立探索。"
            subtitle="面向学生、教师与管理员的使用说明。"
          />
          <div className="guide-grid">
            {[
              {
                icon: GraduationCap,
                title: "学生使用",
                steps: [
                  "正式账号使用机构代码、用户名和密码登录；演示账号仅用于体验。",
                  "在竞赛作业页输入老师提供的邀请码，加入班级。",
                  "选择作业，阅读题目与样例，编写代码后提交给老师。",
                  "查看老师的评分和反馈；在学习助手中讨论思路。",
                ],
              },
              {
                icon: Users,
                title: "教师使用",
                steps: [
                  "教师演示可直接体验；正式教师身份由管理员在服务端授予。",
                  "创建班级，将邀请码发给学生。",
                  "发布题目、输入输出说明、样例和截止时间。",
                  "在工作台查看学生代码，填写评分及有针对性的反馈。",
                ],
              },
              {
                icon: ShieldCheck,
                title: "部署与服务接入",
                steps: [
                  "GitHub Pages托管网站，不运行账号数据库或AI后端。",
                  "正式教学请创建Supabase项目，执行仓库中的SQL迁移。",
                  "执行机构数据库迁移，部署account-admin函数；首期关闭付费AI。",
                  "完成四级角色、跨机构隔离和跨设备数据保存验收，再邀请正式用户。",
                ],
              },
            ].map((c) => (
              <article key={c.title}>
                <c.icon size={29} />
                <h3>{c.title}</h3>
                <ol>
                  {c.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
          <div className="guide-download">
            <div>
              <h3>把操作手册，放在手边。</h3>
              <p>完整说明含权限设计、部署步骤、服务费用与上线验收清单。</p>
            </div>
            <a
              className="button dark-button"
              href={`${import.meta.env.BASE_URL}docs/user-guide.md`}
              download
            >
              <Download size={17} />
              下载使用文档
            </a>
            <a
              className="button outline"
              href={`${import.meta.env.BASE_URL}docs/deployment.md`}
              download
            >
              下载部署文档
            </a>
          </div>
          <div className="notice-box">
            <b>
              当前状态：
              {cloud
                ? "已配置云端连接参数，实际可用性以登录和操作结果为准"
                : "可交互演示版"}
            </b>
            <p>
              当前代码提交采用教师人工批阅，不执行学生代码。自动编译、隐藏测试评测需要额外的隔离评测服务；演示角色切换仅方便体验，正式权限由数据库校验。
            </p>
          </div>
        </main>
      )}
      {![
        "home",
        "assignments",
        "workspace",
        "resources",
        "mentor",
        "teacher",
        "admin",
        "guide",
      ].includes(page) && (
        <main className="app-main">
          <Empty text="页面不存在，请返回首页。" />
        </main>
      )}
      <footer className="footer">
        <a className="brand" href="#home">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <span>
            <b>FlowSpark.</b>
            <small>慧动科技 · 让探索发生</small>
          </span>
        </a>
        <p>以智能为引擎，以创造为方向。</p>
        <div>
          <a href="#guide">使用指南</a>
          <a href="#resources">学习资源</a>
          <span>© {new Date().getFullYear()} 山西慧动科技</span>
        </div>
      </footer>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
        </div>
      )}
      {auth && (
        <Modal title="欢迎来到 FlowSpark" onClose={() => setAuth(false)}>
          <p className="modal-lead">每一段探索，都从这里开始。</p>
          {!cloud ? (
            <>
              <div className="notice-box">
                当前为可交互演示。无需注册，数据仅保存在当前浏览器；不同设备不会同步。
              </div>
              <div className="demo-roles">
                <button onClick={() => loginDemo("student")}>
                  <GraduationCap size={28} />
                  <b>我是学生</b>
                  <span>接收作业 · 编写代码 · 探索资源</span>
                  <ArrowRight size={19} />
                </button>
                <button onClick={() => loginDemo("teacher")}>
                  <Users size={28} />
                  <b>我是老师</b>
                  <span>创建班级 · 布置任务 · 批阅代码</span>
                  <ArrowRight size={19} />
                </button>
              </div>
              <button onClick={() => loginDemo("platform_admin")}>
                平台管理演示
              </button>{" "}
              <button onClick={() => loginDemo("org_admin")}>
                机构管理演示
              </button>
              <p className="footnote">
                演示身份选择不属于正式账号登录。正式版接入方法见使用指南。
              </p>
            </>
          ) : (
            <AuthForm
              onSuccess={() => {
                setAuth(false);
                nav("assignments");
              }}
              notice={notice}
            />
          )}
        </Modal>
      )}
      {modal === "class" && isTeacher && (
        <Modal title="创建新班级" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const v = new FormData(e.currentTarget);
              action(async () => {
                await insert("classes", {
                  name: String(v.get("name")).trim(),
                  teacher_id: user.id,
                  ...(demo
                    ? {
                        join_code: crypto
                          .randomUUID()
                          .replaceAll("-", "")
                          .slice(0, 10)
                          .toUpperCase(),
                      }
                    : {}),
                });
                setModal(null);
                notice("班级已创建，邀请码可在工作台查看");
              });
            }}
          >
            <label>
              班级名称
              <input
                name="name"
                required
                maxLength={80}
                placeholder="例如 CSP-J 算法入门班"
              />
            </label>
            <button className="button dark-button" disabled={busy}>
              创建班级
            </button>
          </form>
        </Modal>
      )}
      {modal === "assignment" && isTeacher && (
        <Modal wide title="发布一道新作业" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action(async () => {
                if (!f.get("class_id")) throw new Error("请先创建班级");
                const deadline = new Date(String(f.get("due_at")));
                if (deadline <= new Date())
                  throw new Error("截止时间须晚于当前时间");
                await insert("assignments", {
                  title: String(f.get("title")).trim(),
                  class_id: f.get("class_id"),
                  level: f.get("level"),
                  statement: String(f.get("statement")),
                  input_format: String(f.get("input_format")),
                  output_format: String(f.get("output_format")),
                  sample_input: String(f.get("sample_input")),
                  sample_output: String(f.get("sample_output")),
                  tags: String(f.get("tags"))
                    .split(/[，,]/)
                    .map((s) => s.trim())
                    .filter(Boolean),
                  due_at: deadline.toISOString(),
                  teacher_id: user.id,
                  status: "published",
                });
                setModal(null);
                notice("作业发布成功");
              });
            }}
          >
            <div className="form-grid">
              <label>
                题目名称
                <input name="title" required maxLength={120} />
              </label>
              <label>
                班级
                <select name="class_id" required>
                  {data.classes.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                难度
                <select name="level">
                  <option>入门</option>
                  <option>进阶</option>
                  <option>挑战</option>
                </select>
              </label>
              <label>
                截止时间
                <input type="datetime-local" name="due_at" required />
              </label>
            </div>
            <label>
              题目描述与约束
              <textarea name="statement" required maxLength={15000} rows={5} />
            </label>
            <div className="form-grid">
              <label>
                输入说明
                <textarea name="input_format" required maxLength={4000} />
              </label>
              <label>
                输出说明
                <textarea name="output_format" required maxLength={4000} />
              </label>
              <label>
                样例输入
                <textarea name="sample_input" maxLength={4000} />
              </label>
              <label>
                样例输出
                <textarea name="sample_output" maxLength={4000} />
              </label>
            </div>
            <label>
              算法标签（用逗号分隔）
              <input name="tags" maxLength={200} />
            </label>
            <button
              className="button dark-button"
              disabled={busy || !data.classes.length}
            >
              发布作业
            </button>
            {!data.classes.length && <p>请先创建班级。</p>}
          </form>
        </Modal>
      )}
      {modal === "resource" && isTeacher && (
        <Modal title="添加学习资源" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action(async () => {
                const url = safeUrl(f.get("url"));
                if (!url) throw new Error("请填写有效的http或https网址");
                await insert("resources", {
                  title: String(f.get("title")),
                  school: String(f.get("school")),
                  kind: f.get("kind"),
                  description: String(f.get("description")),
                  url,
                  teacher_id: user.id,
                  color: "blue",
                  tags: [],
                });
                setModal(null);
                notice("资源已添加");
              });
            }}
          >
            <label>
              资源名称
              <input required name="title" maxLength={150} />
            </label>
            <label>
              来源院校或项目
              <input required name="school" maxLength={100} />
            </label>
            <label>
              类型
              <select name="kind">
                <option>课件</option>
                <option>视频</option>
              </select>
            </label>
            <label>
              官方资源链接
              <input type="url" required name="url" />
            </label>
            <label>
              简介
              <textarea required name="description" maxLength={1000} />
            </label>
            <p className="footnote">
              请仅分享公开或已获授权的资源，不上传未经授权的课件或视频。
            </p>
            <button className="button dark-button" disabled={busy}>
              添加资源
            </button>
          </form>
        </Modal>
      )}
      {modal?.review && isTeacher && (
        <Modal wide title="代码与学习反馈" onClose={() => setModal(null)}>
          <pre className="review-code">{modal.review.code}</pre>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              action(async () => {
                const score = Number(f.get("score"));
                if (!Number.isFinite(score) || score < 0 || score > 100)
                  throw new Error("评分须在0到100之间");
                const patch = {
                  score,
                  feedback: String(f.get("feedback")),
                  status: "graded",
                };
                if (demo)
                  setData((d) => ({
                    ...d,
                    submissions: d.submissions.map((s) =>
                      s.id === modal.review.id ? { ...s, ...patch } : s,
                    ),
                  }));
                else {
                  const { error } = await supabase
                    .from("submissions")
                    .update(patch)
                    .eq("id", modal.review.id);
                  if (error) throw error;
                  await refresh();
                }
                setModal(null);
                notice("反馈已保存");
              });
            }}
          >
            <label>
              评分（0–100）
              <input
                name="score"
                type="number"
                min="0"
                max="100"
                required
                defaultValue={modal.review.score ?? ""}
              />
            </label>
            <label>
              学习反馈
              <textarea
                name="feedback"
                required
                maxLength={4000}
                rows={4}
                defaultValue={modal.review.feedback || ""}
              />
            </label>
            <button className="button dark-button" disabled={busy}>
              保存批阅结果
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
function PageHeading({ kicker, title, subtitle }) {
  return (
    <div className="page-heading">
      <div className="eyebrow dark">{kicker}</div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}
function Empty({ text }) {
  return (
    <div className="empty">
      <Compass size={34} />
      <p>{text}</p>
    </div>
  );
}
function Modal({ title, onClose, children, wide }) {
  const ref = useRef();
  useEffect(() => {
    const prev = document.activeElement;
    ref.current?.focus();
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll(
          "button,input,textarea,select,a[href]",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = old;
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        tabIndex={-1}
        className={"modal " + (wide ? "wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="关闭弹窗"
          >
            <X />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function ResourceCard({ r, onSave }) {
  return (
    <article className="resource-card">
      <div className={"resource-art " + (r.color || "blue")}>
        <span>{r.school}</span>
        <span className="resource-symbol">
          {r.kind === "视频" ? (
            <Play size={40} strokeWidth={1.3} />
          ) : (
            <Layers size={44} strokeWidth={1.3} />
          )}
        </span>
        <small>
          {r.kind === "视频" ? "OPEN COURSE / VIDEO" : "OPEN KNOWLEDGE / NOTES"}
        </small>
      </div>
      <div className="resource-body">
        <div className="card-top">
          <small>
            {r.kind} · {r.level || "学习资料"}
          </small>
          <button
            className="icon-button"
            onClick={onSave}
            aria-label={"收藏" + r.title}
          >
            <Bookmark size={17} />
          </button>
        </div>
        <h3>{r.title}</h3>
        <p>{r.description}</p>
        <a
          className="text-button dark"
          href={safeUrl(r.url) || "#"}
          target="_blank"
          rel="noopener noreferrer"
        >
          前往官方资源 <ArrowUpRight size={16} />
        </a>
      </div>
    </article>
  );
}
function JoinClass({ onJoin }) {
  const [code, setCode] = useState("");
  return (
    <form
      className="join-form"
      onSubmit={(e) => {
        e.preventDefault();
        onJoin(code.trim().toUpperCase());
      }}
    >
      <Users size={18} />
      <span>加入老师的班级</span>
      <input
        aria-label="班级邀请码"
        placeholder="输入班级邀请码"
        maxLength={30}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />
      <button className="text-button dark">
        加入 <ArrowRight size={15} />
      </button>
    </form>
  );
}
function Editor({
  a,
  user,
  demo,
  onSubmit,
  submissions,
  onMentor,
  notice,
  busy,
}) {
  const [lang, setLang] = useState("C++17");
  const draftKey = (l) => `flowspark-draft-${user?.id || "guest"}-${a.id}-${l}`;
  const [code, setCode] = useState(
    () => localStorage.getItem(draftKey("C++17")) ?? starter("C++17"),
  );
  function changeCode(v) {
    setCode(v);
    localStorage.setItem(draftKey(lang), v);
  }
  function changeLang(l) {
    localStorage.setItem(draftKey(lang), code);
    setLang(l);
    setCode(localStorage.getItem(draftKey(l)) ?? starter(l));
  }
  return (
    <>
      <div className="editor-heading">
        <div>
          <div className="tags">
            {a.tags?.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <h1>{a.title}</h1>
        </div>
        <span className="muted">{date(a.due_at)} 截止</span>
      </div>
      <div className="editor-layout">
        <article className="problem">
          <h3>题目描述</h3>
          <p>{a.statement}</p>
          <h3>输入格式</h3>
          <p>{a.input_format}</p>
          <h3>输出格式</h3>
          <p>{a.output_format}</p>
          <h3>样例输入</h3>
          <pre>{a.sample_input || "无"}</pre>
          <h3>样例输出</h3>
          <pre>{a.sample_output || "无"}</pre>
          <button className="button outline" onClick={onMentor}>
            <Sparkles size={16} />
            找一点思路
          </button>
        </article>
        <section className="code-panel">
          <div className="code-toolbar">
            <span>
              <Terminal size={16} /> Main
            </span>
            <select
              aria-label="选择编程语言"
              value={lang}
              onChange={(e) => changeLang(e.target.value)}
            >
              <option>C++17</option>
              <option>Python 3</option>
              <option>Java 17</option>
            </select>
          </div>
          <div className="editor-area">
            <div className="line-numbers" aria-hidden="true">
              {code
                .split("\n")
                .slice(0, 99)
                .map((_, i) => (
                  <span key={i}>{i + 1}</span>
                ))}
            </div>
            <textarea
              aria-label="代码编辑器"
              spellCheck="false"
              maxLength={100000}
              value={code}
              onChange={(e) => changeCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const s = e.target.selectionStart,
                    end = e.target.selectionEnd;
                  changeCode(code.slice(0, s) + "    " + code.slice(end));
                  requestAnimationFrame(() =>
                    e.target.setSelectionRange(s + 4, s + 4),
                  );
                }
              }}
            />
          </div>
          <div className="editor-footer">
            <small>草稿自动保存在当前浏览器 · 不运行代码</small>
            <button
              className="button mint"
              disabled={busy || user?.role === "teacher"}
              onClick={() => onSubmit(code, lang)}
            >
              <Send size={15} />
              {busy ? "提交中…" : "提交作业"}
            </button>
          </div>
        </section>
      </div>
      <section className="submission-history">
        <h3>我的提交记录</h3>
        {submissions.length ? (
          submissions
            .slice()
            .sort((x, y) => y.submitted_at.localeCompare(x.submitted_at))
            .map((s) => (
              <article key={s.id}>
                <div>
                  <span
                    className={
                      "status " + (s.status === "graded" ? "done" : "")
                    }
                  >
                    {s.status === "graded"
                      ? `已批阅 · ${s.score} 分`
                      : "已提交 · 等待老师批阅"}
                  </span>
                  <small>
                    {new Date(s.submitted_at).toLocaleString("zh-CN")} ·{" "}
                    {s.language}
                  </small>
                </div>
                {s.feedback && <p>{s.feedback}</p>}
              </article>
            ))
        ) : (
          <p className="muted">暂未提交。编写完成后，将代码提交给老师批阅。</p>
        )}
      </section>
    </>
  );
}
function AuthForm({ onSuccess, notice }) {
  const [platform, setPlatform] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          const email = platform
            ? String(f.get("email")).trim()
            : `${String(f.get("username")).trim().toLowerCase()}.${String(f.get("org")).trim().toLowerCase()}@users.flowspark.invalid`;
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password: f.get("password"),
          });
          if (error) throw error;
          onSuccess();
        } catch {
          notice("登录失败，请核对机构代码、用户名和密码，或联系管理员");
        } finally {
          setBusy(false);
        }
      }}
    >
      {platform ? (
        <label>
          平台管理员邮箱
          <input type="email" name="email" autoComplete="username" required />
        </label>
      ) : (
        <>
          <label>
            机构代码
            <input
              name="org"
              placeholder="机构管理员提供，例如 mkyx"
              pattern="[a-z0-9][a-z0-9_-]{2,19}"
              required
            />
          </label>
          <label>
            用户名
            <input
              name="username"
              autoComplete="username"
              pattern="[a-z0-9][a-z0-9_-]{2,31}"
              required
            />
          </label>
        </>
      )}
      <label>
        密码
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <button className="button dark-button" disabled={busy}>
        {busy ? "登录中…" : "登录学习空间"}
      </button>
      <button
        type="button"
        className="text-button dark"
        onClick={() => setPlatform(!platform)}
      >
        {platform ? "返回机构账号登录" : "平台管理员邮箱登录"}
      </button>
      <p className="footnote">
        账号由机构统一创建，不开放自行注册。忘记密码请联系管理员。
      </p>
    </form>
  );
}

createRoot(document.getElementById("root")).render(<App />);
