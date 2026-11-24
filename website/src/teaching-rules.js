export function latestSubmissions(rows, key = "assignment_id") {
  const found = new Map();
  for (const s of rows || []) {
    const id = `${s.student_id}:${s[key]}`;
    const previous = found.get(id);
    if (
      !previous ||
      s.submitted_at > previous.submitted_at ||
      (s.submitted_at === previous.submitted_at && s.id > previous.id)
    )
      found.set(id, s);
  }
  return [...found.values()].sort((a, b) =>
    b.submitted_at.localeCompare(a.submitted_at),
  );
}
export function groupStudents(rows) {
  const groups = new Map();
  for (const row of latestSubmissions(rows)) {
    if (!groups.has(row.student_id))
      groups.set(row.student_id, {
        id: row.student_id,
        name: row.student_name || row.student_id.slice(0, 8),
        submissions: [],
      });
    groups.get(row.student_id).submissions.push(row);
  }
  return [...groups.values()];
}
export function validateCover(file) {
  const ext = file?.name?.split(".").pop().toLowerCase();
  const mime = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  }[ext];
  if (
    !mime ||
    !file.size ||
    file.size > 5 * 1024 * 1024 ||
    (file.type && file.type !== mime)
  )
    throw Error("封面请选择5MB以内的PNG、JPG或WebP图片");
  return { ext, mime };
}
export const DEFAULT_REPORT_INSTRUCTIONS =
  "请用中文生成近期学情报告，面向机构管理员和任课教师。结构：1.学习概况；2.已掌握的知识点及代码依据；3.主要问题与题目实例；4.下一阶段7天练习建议；5.需要教师核实的事项。区分已批阅成绩、静态代码观察和AI推测；没有提交时明确证据不足。";
