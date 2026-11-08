import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
const screenshots = process.env.SCREENSHOT_DIR || "test-artifacts";
await mkdir(screenshots, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath:
    process.env.BROWSER_EXECUTABLE ||
    (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const base = process.env.TEST_URL || "http://127.0.0.1:4173";
await page.goto(base);
await page.waitForSelector("canvas");
await page.screenshot({
  path: screenshots + "/home-desktop.png",
  fullPage: true,
});
assert.equal(await page.title(), "慧动科技 FlowSpark · 让探索发生");
await page.getByRole("button", { name: "进入学习空间" }).first().click();
await page.getByRole("button", { name: "我是老师" }).click();
await page.getByRole("heading", { name: "点亮下一段探索。" }).waitFor();
await page.getByRole("button", { name: "创建班级", exact: true }).click();
await page.getByLabel("班级名称").fill("测试算法班");
await page
  .getByRole("button", { name: "创建班级", exact: true })
  .last()
  .click();
await page.getByText("班级已创建").waitFor();
await page.getByRole("button", { name: "发布作业", exact: true }).click();
await page.getByLabel("题目名称").fill("浏览器测试题：整数求和");
await page.getByLabel("截止时间").fill("2099-11-08T18:00");
await page.getByLabel("题目描述与约束").fill("输入两个整数，输出它们的和。");
await page.getByLabel("输入说明").fill("两个整数");
await page.getByLabel("输出说明").fill("一个整数");
await page
  .getByRole("button", { name: "发布作业", exact: true })
  .last()
  .click();
await page.getByText("作业发布成功").waitFor();
await page.getByRole("button", { name: "退出登录", exact: true }).click();
await page.getByRole("button", { name: "进入学习空间" }).first().click();
await page.getByRole("button", { name: "我是学生" }).click();
await page.getByText("浏览器测试题：整数求和", { exact: true }).waitFor();
await page.getByRole("button", { name: "开始挑战" }).first().click();
await page
  .getByLabel("代码编辑器")
  .fill(
    "#include <iostream>\nint main(){long long a,b;std::cin>>a>>b;std::cout<<a+b;}",
  );
await page.getByRole("button", { name: "提交作业" }).click();
await page.getByText("已提交 · 等待老师批阅").waitFor();
assert.ok(
  await page.evaluate(() =>
    Object.entries(localStorage).some(
      ([k, v]) =>
        k.includes("flowspark-draft-student-demo") &&
        v.includes("long long a,b"),
    ),
  ),
  "student draft saved",
);
await page.reload();
await page.getByLabel("代码编辑器").waitFor();
// Demo login is intentionally session-only; previous submissions remain in demo data.
await page.getByRole("button", { name: "进入学习空间" }).first().click();
await page.getByRole("button", { name: "我是老师" }).click();
await page.getByRole("button", { name: "查看与批阅" }).first().click();
await page.getByLabel("评分（0–100）").fill("95");
await page
  .getByLabel("学习反馈", { exact: true })
  .fill("思路清晰，请继续注意边界情况。");
await page.getByRole("button", { name: "保存批阅结果" }).click();
await page.getByText("反馈已保存").waitFor();
await page.getByRole("button", { name: "退出登录" }).click();
await page.getByRole("button", { name: "进入学习空间" }).first().click();
await page.getByRole("button", { name: "我是学生" }).click();
await page.getByRole("button", { name: "已批阅 95 分" }).click();
await page.getByText("思路清晰，请继续注意边界情况。").waitFor();
await page.getByRole("link", { name: "学习助手", exact: true }).click();
await page.getByLabel("输入学习问题").fill("如何检查边界情况？");
await page.getByRole("button", { name: "发送", exact: true }).click();
await page.getByText("先用最小输入手动走一遍", { exact: false }).waitFor();
await page.getByRole("link", { name: "学习资源", exact: true }).first().click();
await page.getByLabel("搜索资源").fill("MIT");
assert.equal(await page.locator(".resource-card").count(), 1);
await page
  .getByRole("button", { name: "收藏Introduction to Algorithms" })
  .click();
await page.getByText("已收藏在当前浏览器").waitFor();
await page.goto(base + "/#teacher");
await page.getByText("此页面仅对教师开放。", { exact: false }).waitFor();
assert.equal(
  await page.getByRole("button", { name: "发布作业", exact: true }).count(),
  0,
);
await page.getByRole("button", { name: "退出登录" }).click();
await page.goto(base);
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: screenshots + "/home-mobile.png",
  fullPage: true,
});
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
  "Mobile horizontal overflow",
);
await page.getByRole("button", { name: "打开导航" }).click();
await page.getByRole("link", { name: "使用指南", exact: true }).first().click();
await page
  .getByRole("heading", { name: "从第一次登录，到独立探索。" })
  .waitFor();
assert.deepEqual(errors, []);
console.log(
  "PASS: teacher create class/publish, student submit, teacher grade, feedback, draft persistence, offline help, resource search, role guard, mobile navigation, no browser errors",
);
await browser.close();
