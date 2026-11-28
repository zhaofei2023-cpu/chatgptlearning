import assert from "node:assert/strict";
import {
  statistics,
  statisticalReport,
  analysisMaterial,
} from "../src/study-statistics.js";
const rows = [
  {
    id: "1",
    student_id: "s",
    assignment_id: "a",
    submitted_at: "2026-11-20T00:00:00.000Z",
    score: 100,
    status: "graded",
    code: "old",
  },
  {
    id: "2",
    student_id: "s",
    assignment_id: "a",
    submitted_at: "2026-11-27T00:00:00.000Z",
    score: null,
    status: "pending",
    code: "new",
    feedback: "张三 a@b.com 13812345678",
  },
  {
    id: "3",
    student_id: "other",
    assignment_id: "a",
    submitted_at: "2026-11-27T00:00:00.000Z",
    status: "graded",
    score: 10,
  },
];
const s = statistics(
  rows,
  [{ id: "a", title: "循环", tags: ["基础"] }],
  "s",
  14,
  new Date("2026-11-28T00:00:00Z"),
);
assert.equal(s.latest_questions, 1);
assert.equal(s.average_score, null);
assert.equal(s.pending_questions, 1);
assert.match(statisticalReport(s), /不含竞赛/);
const safe = analysisMaterial(
  { ...s, questions: s.questions.map(({ code, ...q }) => q) },
  "按事实分析",
  ["张三"],
);
assert.doesNotMatch(safe, /张三|a@b.com|13812345678|"new"/);
assert.match(analysisMaterial(s, "分析"), /new/);
assert.equal(
  statistics(rows, [], "s", 7, new Date("2026-11-21T00:00:00Z"))
    .latest_questions,
  0,
);
console.log(
  "Free statistics: latest-only, period boundaries, score evidence and export privacy passed",
);
