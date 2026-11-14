import assert from "node:assert/strict";
import {
  FILE_LIMIT,
  validateFile,
  nextPeriod,
  fromInput,
  toInput,
  manages,
  scopeReadable,
  eventPhase,
} from "../src/platform-rules.js";
assert.throws(
  () => validateFile({ size: FILE_LIMIT + 1, name: "large.mp4" }, "video"),
  /40MB/,
);
assert.throws(
  () => validateFile({ size: 100, name: "map.svg" }, "knowledge_map"),
  /不支持/,
);
assert.throws(
  () => validateFile({ size: 100, name: "fake.mp4.exe" }, "video"),
  /不支持/,
);
assert.throws(
  () => validateFile({ size: 100, name: "slides.pdf" }, "video"),
  /只支持/,
);
assert.equal(
  validateFile({ size: 100, name: "课件.PPTX" }, "courseware").mime,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
);
assert.equal(fromInput("2026-11-14T19:00"), "2026-11-14T11:00:00.000Z");
assert.equal(toInput("2026-11-14T11:00:00Z"), "2026-11-14T19:00");
const monthly = nextPeriod({
  title: "月赛",
  starts_at: fromInput("2026-01-30T19:00"),
  ends_at: fromInput("2026-01-31T18:00"),
  registration_deadline: fromInput("2026-01-29T19:00"),
  recurrence: "monthly",
  status: "published",
});
assert.equal(toInput(monthly.starts_at), "2026-02-28T19:00");
assert.ok(new Date(monthly.ends_at) > new Date(monthly.starts_at));
assert.equal(
  (+new Date(monthly.ends_at) - +new Date(monthly.starts_at)) / 3600000,
  23,
);
assert.equal(monthly.status, "draft");
assert.ok(manages({ role: "org_admin", institution_id: "a" }, "a"));
assert.ok(!manages({ role: "org_admin", institution_id: "a" }, null));
assert.ok(!manages({ role: "teacher", institution_id: "a" }, "a"));
assert.ok(scopeReadable({ role: "student", institution_id: "a" }, null));
assert.ok(!scopeReadable({ role: "student", institution_id: "a" }, "b"));
assert.equal(
  eventPhase(
    {
      status: "published",
      starts_at: "2026-11-14T00:00:00Z",
      ends_at: "2026-11-14T02:00:00Z",
    },
    +new Date("2026-11-14T01:00:00Z"),
  ),
  "进行中",
);
console.log(
  "PASS: upload bounds and allowlist, role scope, Beijing-time input, monthly month-end recurrence preserves duration and deadline offset",
);
