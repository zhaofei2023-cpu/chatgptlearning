import { useEffect, useId, useRef, useState } from "react";
import {
  X,
  ArrowUpRight,
  BookOpen,
  Library,
  Trophy,
  GraduationCap,
  Upload,
  Plus,
  RefreshCw,
} from "lucide-react";
import { isAdmin, manages, fmtTime } from "./platform-data";
export function Hero({ type = "resources", title, description, children }) {
  const icons = {
    resources: Library,
    competitions: Trophy,
    schools: GraduationCap,
  };
  const Icon = icons[type];
  return (
    <section className={"platform-hero " + type}>
      <div className="hero-grid" aria-hidden="true" />
      <div>
        <span className="platform-eyebrow">
          <Icon size={18} /> FLOWSPARK / {type.toUpperCase()}
        </span>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </div>
      <div className="hero-emblem" aria-hidden="true">
        <Icon size={68} />
        <span>EXPLORE · LEARN · CREATE</span>
      </div>
    </section>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  busy = false,
  wide = false,
}) {
  const ref = useRef(),
    id = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const prior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => {
      document.body.style.overflow = prior;
      previous?.focus?.();
    };
  }, []);
  return (
    <div
      className="platform-overlay"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !busy) onClose();
        if (e.key === "Tab") {
          const nodes = ref.current.querySelectorAll(
            'button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]',
          );
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={"platform-dialog " + (wide ? "wide" : "")}
      >
        <header>
          <div>
            <span className="platform-eyebrow">FLOWSPARK STUDIO</span>
            <h2 id={id}>{title}</h2>
          </div>
          <button
            type="button"
            className="p-icon"
            onClick={onClose}
            disabled={busy}
            aria-label="关闭窗口"
          >
            <X size={22} />
          </button>
        </header>
        <div className="dialog-body">{children}</div>
      </section>
    </div>
  );
}
export function ScopeSelect({
  user,
  institutions,
  value,
  onChange,
  disabled = false,
}) {
  return (
    <label>
      内容发布范围
      <select
        name="institution_id"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value || null)}
        disabled={disabled}
      >
        {user.role === "platform_admin" && <option value="">全平台师生</option>}
        {institutions
          .filter(
            (i) =>
              user.role === "platform_admin" || i.id === user.institution_id,
          )
          .map((i) => (
            <option value={i.id} key={i.id}>
              {i.name}
            </option>
          ))}
      </select>
      <small>已有内容不能转移范围；需要时请在目标范围新建。</small>
    </label>
  );
}
export function StatusField({ value = "draft" }) {
  return (
    <label>
      发布状态
      <select name="status" defaultValue={value}>
        <option value="draft">草稿 · 仅管理员可见</option>
        <option value="published">已发布 · 对应范围师生可见</option>
      </select>
    </label>
  );
}
export function LoadState({ api, admin = false }) {
  return (
    <>
      {api.loading && (
        <p className="platform-status" role="status">
          正在加载内容…
        </p>
      )}
      {api.error && (
        <div className="platform-alert" role="alert">
          <b>暂时无法加载新模块</b>
          <p>
            {!admin && api.error.includes("尚未初始化")
              ? "新功能正在配置中，请联系机构管理员。"
              : api.error}
          </p>
          <button className="p-button secondary" onClick={api.refresh}>
            <RefreshCw size={17} />
            重新加载
          </button>
          {admin && api.error.includes("尚未初始化") && (
            <a
              className="p-button secondary"
              href="https://github.com/zhaofei2023-cpu/chatgptlearning/blob/flowspark-website/website/supabase/migrations/003_content_and_competitions.sql"
              target="_blank"
              rel="noreferrer"
            >
              打开升级脚本
            </a>
          )}
        </div>
      )}
    </>
  );
}
export function EmptyState({
  title = "这里还没有内容",
  text = "管理员发布后将在这里展示。",
  children,
}) {
  return (
    <div className="platform-empty">
      <BookOpen size={34} />
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function LoginPrompt({ onLogin }) {
  return (
    <div className="platform-login">
      <h2>登录，开启你的探索空间。</h2>
      <p>机构师生登录后，可查看所属范围内的学习资源、竞赛活动和名校信息。</p>
      <button className="p-button" onClick={onLogin}>
        登录学习空间
        <ArrowUpRight size={18} />
      </button>
    </div>
  );
}
export function FormError({ error }) {
  return error ? (
    <p className="platform-alert" role="alert">
      {error}
    </p>
  ) : null;
}
export function useTask(notice) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(e.message || "操作失败，请重试");
      notice?.(e.message || "操作失败");
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}
export function Badge({ children, tone = "" }) {
  return <span className={"p-badge " + tone}>{children}</span>;
}
export function scopeName(scope, institutions) {
  return scope
    ? institutions.find((i) => i.id === scope)?.name || "所属机构"
    : "全平台";
}
