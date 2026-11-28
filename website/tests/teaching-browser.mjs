import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.goto(process.env.TEST_URL || "http://127.0.0.1:4189");
  const button = (name) => p.getByRole("button", { name, exact: true });
  const fill = (label, value) =>
    p.getByLabel(label, { exact: true }).fill(value);
  async function login(role) {
    await button("进入学习空间").first().click();
    await p
      .getByRole("button", {
        name:
          role === "教师演示"
            ? /我是老师/
            : role === "学生演示"
              ? /我是学生/
              : role,
      })
      .click();
  }
  async function logout() {
    await button("退出登录").click();
  }
  await login("教师演示");
  await button("新建分类").click();
  await fill("分类名称", "循环与模拟");
  await button("保存分类").click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  await button("新建题目").click();
  await fill("题目名称", "第四版求和练习");
  await p
    .getByLabel("题目分类", { exact: true })
    .selectOption({ label: "循环与模拟" });
  await fill("截止时间（北京时间）", "2027-02-01T18:00");
  await fill("题目描述", "输入n，输出1到n之和");
  await fill("输入说明", "整数n");
  await fill("输出说明", "整数和");
  await button("保存题目").click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  const card = p.locator(".assignment-card").filter({
    has: p.getByRole("heading", { name: "第四版求和练习", exact: true }),
  });
  assert.match(await card.innerText(), /草稿/);
  await card.getByRole("button", { name: "发布题目", exact: true }).click();
  await card.getByText("已发布", { exact: true }).waitFor();
  await p
    .getByRole("button", { name: "编辑分类循环与模拟", exact: true })
    .click();
  await fill("分类名称", "基础算法");
  await button("保存分类").click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  assert.match(await card.innerText(), /基础算法/);
  await logout();
  await login("学生演示");
  await card.getByRole("button", { name: "开始挑战", exact: true }).click();
  const editor = p
    .locator('textarea.code-editor,textarea[spellcheck="false"]')
    .first();
  await editor.fill('print("first")');
  await button("提交作业").click();
  await p.getByText(/累计提交 1 次/).waitFor();
  await editor.fill('print("latest")');
  await button("提交作业").click();
  await p.getByText(/累计提交 2 次/).waitFor();
  assert.equal(await p.locator(".submission-history article").count(), 1);
  await logout();
  await login("教师演示");
  await button("按学生查看 · 1").click();
  assert.equal(await p.locator(".student-collection details").count(), 1);
  await button("查看与批阅").click();
  assert.match(await p.locator(".review-code").innerText(), /latest/);
  await fill("评分（0–100）", "92");
  await p.locator("form textarea").fill("思路正确，检查n为0的边界");
  await p.getByRole("button", { name: "保存批阅结果", exact: true }).click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  await p.getByRole("button", { name: /我的题库/ }).click();
  await card.getByRole("button", { name: "删除题目", exact: true }).click();
  await card.waitFor({ state: "hidden" });
  await button("按学生查看 · 1").click();
  assert.match(
    await p.locator(".student-collection").innerText(),
    /第四版求和练习/,
  );
  await logout();
  await login("平台管理演示");
  await p.locator('a[href="#reports"]').first().click();
  await p
    .getByRole("heading", { name: "每一份代码，都有成长的线索。" })
    .waitFor();
  await fill("报告要求", "按概况、代码依据、下周建议三部分写报告。");
  await button("保存为我的默认模板").click();
  const paidRequests = [];
  p.on("request", (r) => {
    if (/functions\/v1\/study-report|api\.openai\.com/.test(r.url()))
      paidRequests.push(r.url());
  });
  await button("生成并保存统计报告").click();
  await p.locator(".report-document").waitFor();
  assert.match(
    await p.locator(".report-document").innerText(),
    /最新作业记录1题/,
  );
  await button("准备匿名分析资料").click();
  const preview = p.getByLabel("匿名资料预览", { exact: true });
  await preview.waitFor();
  assert.doesNotMatch(
    await preview.inputValue(),
    /print\(|探索者同学|student-demo/,
  );
  await p.getByLabel("附带最新代码（默认不选）").check();
  await button("准备匿名分析资料").click();
  await preview.waitFor();
  assert.match(await preview.inputValue(), /latest/);
  await fill("最终报告内容", "# 手动分析报告\n代码边界仍需教师核实。");
  await button("保存导入报告").click();
  await p
    .locator(".report-document")
    .getByText("手动分析报告", { exact: true })
    .waitFor();
  assert.equal(await p.locator(".report-history li").count(), 2);
  assert.equal(paidRequests.length, 0);
  await p.getByRole("link", { name: "学习资源", exact: true }).first().click();
  await button("上传素材").click();
  await fill("素材名称", "带封面的外链课程");
  await p.getByLabel("添加方式").selectOption("link");
  await fill("HTTPS资源链接", "https://example.org/course");
  await p.getByLabel("上传资源封面").setInputFiles({
    name: "cover.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNagAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await p.getByLabel("发布状态").selectOption("published");
  await button("保存素材").click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  const rc = p.locator(".p-resource-card").filter({
    has: p.getByRole("heading", { name: "带封面的外链课程", exact: true }),
  });
  await rc.locator("img.resource-cover").waitFor();
  assert.ok(
    await rc.locator("img.resource-cover").evaluate((i) => i.naturalWidth > 0),
  );
  await button("进入资源管理").click();
  await rc
    .getByRole("button", { name: "删除素材带封面的外链课程", exact: true })
    .click();
  await rc.waitFor({ state: "hidden" });
  await mkdir("test-artifacts/v4", { recursive: true });
  await p.screenshot({
    path: "test-artifacts/v4/resources.png",
    fullPage: true,
  });
  await p.goto((process.env.TEST_URL || "http://127.0.0.1:4189") + "/#reports");
  await p.locator(".report-history li").first().getByRole("button").click();
  await p.screenshot({ path: "test-artifacts/v4/reports.png", fullPage: true });
  assert.equal(
    await p.getByText("页面不存在，请返回首页。", { exact: true }).count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser teacher categories/draft/publish/archive, student overwrite, account collection/review, admin free statistics/privacy/export/import/history/template and private cover upload/delete",
  );
} finally {
  await browser.close();
}
