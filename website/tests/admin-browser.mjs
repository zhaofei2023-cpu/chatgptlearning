import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.TEST_URL || "http://127.0.0.1:4173");
  await p.getByRole("button", { name: "进入学习空间" }).first().click();
  await p.getByRole("button", { name: "平台管理演示", exact: true }).click();
  await p.getByRole("heading", { name: "平台管理员工作台" }).waitFor();
  await p
    .getByLabel("机构名称", { exact: true })
    .fill("玛酷机器人（迎新校区）");
  await p
    .getByLabel("机构代码（3–20位小写英文、数字）", { exact: true })
    .fill("mkyx");
  await p.getByRole("button", { name: "创建机构", exact: true }).click();
  await p
    .getByRole("status")
    .filter({ hasText: "管理演示不创建真实账号" })
    .waitFor();
  await p.getByRole("button", { name: "退出登录" }).click();
  await p.getByRole("button", { name: "进入学习空间" }).first().click();
  await p.getByRole("button", { name: "机构管理演示", exact: true }).click();
  await p.getByRole("heading", { name: "机构管理员工作台" }).waitFor();
  assert.equal(
    await p.getByRole("button", { name: "创建机构", exact: true }).count(),
    0,
  );
  await p.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  await p.getByRole("button", { name: "退出登录" }).click();
  await p.goto((process.env.TEST_URL || "http://127.0.0.1:4173") + "/#admin");
  await p.getByText("请使用机构或平台管理员账号登录。").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: platform/org admin UI, no fake cloud accounts, role guard, mobile overflow, no page errors",
  );
} finally {
  await browser.close();
}
