export const TABLES = [
  "learning_topics",
  "learning_items",
  "school_information",
  "competitions",
  "competition_problems",
  "competition_entries",
  "competition_submissions",
];
export const KINDS = {
  video: "视频课程",
  courseware: "课件资料",
  knowledge_map: "知识地图",
  document: "学习文档",
};
export const MIME = {
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  txt: "text/plain",
  md: "text/markdown",
};
export const FILE_LIMIT = 40 * 1024 * 1024;
export const isAdmin = (u) => ["platform_admin", "org_admin"].includes(u?.role);
export const manages = (u, scope) =>
  u?.role === "platform_admin" ||
  (u?.role === "org_admin" && scope === u.institution_id);
export const scopeReadable = (u, scope) =>
  !!u &&
  (scope === null || scope === u.institution_id || u.role === "platform_admin");
export const fmtTime = (s) =>
  new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(s));
export function toInput(s) {
  return new Date(new Date(s).getTime() + 8 * 3600000)
    .toISOString()
    .slice(0, 16);
}
export function fromInput(s) {
  const n = new Date(s + ":00+08:00");
  if (!Number.isFinite(n.getTime())) throw Error("日期无效");
  return n.toISOString();
}
export function eventPhase(c, now = Date.now()) {
  return c.status === "cancelled"
    ? "已取消"
    : c.status === "draft"
      ? "草稿"
      : now < +new Date(c.starts_at)
        ? now < +new Date(c.registration_deadline || c.starts_at)
          ? "报名中"
          : "待开赛"
        : now < +new Date(c.ends_at)
          ? "进行中"
          : "已结束";
}
export function nextPeriod(c) {
  const oldStart = +new Date(c.starts_at);
  const d = new Date(oldStart + 8 * 3600000);
  if (c.recurrence === "monthly") {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
    ).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  } else d.setUTCDate(d.getUTCDate() + 7);
  const nextStart = d.getTime() - 8 * 3600000;
  return {
    ...c,
    title: c.title + " · 下一期",
    starts_at: new Date(nextStart).toISOString(),
    ends_at: new Date(
      nextStart + (+new Date(c.ends_at) - oldStart),
    ).toISOString(),
    registration_deadline: new Date(
      nextStart - (oldStart - +new Date(c.registration_deadline)),
    ).toISOString(),
    status: "draft",
  };
}
export function validateFile(file, kind) {
  if (!file?.size) throw Error("请选择非空文件");
  if (file.size > FILE_LIMIT)
    throw Error("单文件上限40MB，请压缩、分段或使用HTTPS官方外链");
  const ext = file.name.split(".").pop().toLowerCase();
  if (!MIME[ext])
    throw Error(
      "不支持该文件格式，请使用MP4/WebM、PDF、Office文档、PNG/JPG/WebP或纯文本",
    );
  if (kind === "video" && !["mp4", "webm"].includes(ext))
    throw Error("视频课程只支持MP4或WebM文件");
  return { ext, mime: MIME[ext] };
}
