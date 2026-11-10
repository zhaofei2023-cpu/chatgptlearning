import assert from "node:assert/strict";
import { successfulAccounts, credentialsCsv } from "../src/account-export.js";
const failed = { username: "zhaofei", error: "创建失败" };
assert.throws(() => credentialsCsv([failed]), /没有可导出/);
assert.throws(() => credentialsCsv([]), /没有可导出/);
assert.throws(() => credentialsCsv([{ username: "incomplete" }]), /没有可导出/);
const ok = {
  institution_code: "mkyx",
  username: "student001",
  display_name: "同学,甲",
  role: "student",
  password: "Strong-Pass123!",
};
const csv = credentialsCsv([failed, ok]);
assert.equal(successfulAccounts([failed, ok]).length, 1);
assert.ok(csv.includes("机构代码"));
assert.ok(csv.includes("同学,甲"));
assert.ok(csv.includes("Strong-Pass123!"));
assert.ok(!csv.includes("zhaofei"));
assert.equal(csv.split("\r\n").length, 2);
console.log(
  "PASS: failed-only and incomplete batches cannot export; partial success exports complete credentials with Chinese headers",
);
