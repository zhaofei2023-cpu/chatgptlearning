import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { toInput } from "../src/platform-rules.js";
const shots = process.env.SCREENSHOT_DIR || "test-artifacts/v3";
await mkdir(shots, { recursive: true });
const temp = await mkdtemp(join(tmpdir(), "flowspark-materials-")),
  video = join(temp, "course.webm");
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "color=c=0x155474:s=320x180:r=12:d=1",
  "-an",
  "-c:v",
  "libvpx-vp9",
  "-b:v",
  "80k",
  video,
]);
const browser = await chromium.launch({
  executablePath: process.env.BROWSER_EXECUTABLE || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  p.on("pageerror", (e) => {
    errors.push(e.message);
    console.log("PAGE ERROR", e.stack);
  });
  const now = Date.now();
  await p.clock.setFixedTime(new Date(now));
  await p.goto(process.env.TEST_URL || "http://127.0.0.1:4186");
  const button = (name) => p.getByRole("button", { name, exact: true });
  const fill = (name, value) => p.getByLabel(name, { exact: true }).fill(value);
  const close = () => button("关闭窗口").click();
  const hidden = () => p.getByRole("dialog").waitFor({ state: "hidden" });
  const nav = (name) =>
    p.getByRole("link", { name, exact: true }).first().click();
  const login = async (role) => {
    await button("进入学习空间").first().click();
    await p.getByRole("button", { name: role }).click();
  };
  const logout = () => button("退出登录").click();
  const card = (selector, name) =>
    p
      .locator(selector)
      .filter({ has: p.getByRole("heading", { name, exact: true }) });
  await login("平台管理演示");
  await nav("学习资源");
  await button("新建主题").click();
  await fill("主题名称", "图论专项学习");
  await fill("主题简介", "结构化学习图论基础");
  await button("保存主题").click();
  await hidden();
  await button("上传素材").click();
  await fill("素材名称", "本地视频测试课");
  await p.getByLabel("归置主题").selectOption({ label: "图论专项学习" });
  await p.getByLabel("选择本地文件").setInputFiles(video);
  await p.getByLabel("发布状态").selectOption("published");
  await button("保存素材").click();
  await hidden();
  await card(".p-resource-card", "本地视频测试课")
    .getByRole("button", { name: "开始学习", exact: true })
    .click();
  await p.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
  );
  assert.equal(await p.locator("video").evaluate((v) => v.videoWidth), 320);
  await close();
  await button("上传素材").click();
  await fill("素材名称", "管理员待发布地图");
  await p.getByLabel("素材类型").selectOption("knowledge_map");
  await p.getByLabel("添加方式").selectOption("text");
  await fill("正文或知识路径", "基础语法\n→ 图论\n→ 动态规划");
  await button("保存素材").click();
  await hidden();
  await p.screenshot({
    path: join(shots, "resources-admin-desktop.png"),
    fullPage: true,
  });
  await nav("名校探索");
  await button("新建名校信息").click();
  await fill("学校名称", "公开课程学校");
  await fill("信息标题", "算法公开课程学习指南");
  await fill("摘要", "从官方公开课程开始学习");
  await fill("详细内容", "请访问官方课程页面，核实当前开放材料。");
  await fill("学校官方来源链接（选填）", "https://ocw.mit.edu/");
  await button("保存名校信息").click();
  await hidden();
  await button("进入信息管理").click();
  await card(".p-school-card", "算法公开课程学习指南")
    .getByRole("button", { name: "发布信息", exact: true })
    .click();
  await card(".p-school-card", "算法公开课程学习指南")
    .getByText("学校介绍", { exact: true })
    .waitFor();
  await nav("竞赛活动");
  await button("创建竞赛活动").click();
  await fill("活动名称", "算法探索周赛");
  await fill("活动简介", "图论与思维训练");
  await fill("开始时间（北京时间）", toInput(new Date(now + 3600000)));
  await fill("结束时间（北京时间）", toInput(new Date(now + 7200000)));
  await fill("报名截止（北京时间）", toInput(new Date(now + 1800000)));
  await p.getByLabel("举办频率").selectOption("weekly");
  await fill(
    "参赛要求与规则",
    "独立完成；不可使用AI代写；提交后管理员人工评阅。",
  );
  await button("保存活动信息").click();
  await hidden();
  await card(".p-event-card", "算法探索周赛")
    .getByRole("button", { name: "活动详情与题目", exact: true })
    .click();
  assert.ok(await button("发布竞赛活动").isDisabled());
  await button("添加题目").click();
  await fill("题目名称", "竞赛整数求和");
  await fill("题目描述与约束", "输入两个整数，输出它们的和。");
  await fill("输入格式", "a b");
  await fill("输出格式", "a+b");
  await fill("样例输入", "1 2");
  await fill("样例输出", "3");
  await button("保存题目").click();
  await hidden();
  await button("发布竞赛活动").click();
  await p.getByText("竞赛活动已发布", { exact: true }).waitFor();
  await button("复制下一期").click();
  await p
    .getByRole("heading", { name: "算法探索周赛 · 下一期", exact: true })
    .waitFor();
  await p.getByRole("heading", { name: "竞赛整数求和", exact: true }).waitFor();
  await logout();
  await login("我是学生");
  await nav("学习资源");
  assert.equal(await button("上传素材").count(), 0);
  assert.equal(
    await p
      .getByRole("heading", { name: "管理员待发布地图", exact: true })
      .count(),
    0,
  );
  await card(".p-resource-card", "本地视频测试课")
    .getByRole("button", { name: "开始学习", exact: true })
    .click();
  await p.waitForFunction(
    () => document.querySelector("video")?.readyState >= 2,
  );
  await close();
  await nav("名校探索");
  await p
    .getByRole("heading", { name: "算法公开课程学习指南", exact: true })
    .waitFor();
  assert.equal(await button("新建名校信息").count(), 0);
  await nav("竞赛活动");
  assert.equal(
    await p
      .getByRole("heading", { name: "算法探索周赛 · 下一期", exact: true })
      .count(),
    0,
  );
  await button("活动详情与题目").click();
  await p.getByRole("heading", { name: "题目暂未开放", exact: true }).waitFor();
  await button("报名参加").click();
  await p.getByText("已报名", { exact: true }).waitFor();
  await p.clock.setFixedTime(new Date(now + 3700000));
  await button("刷新活动与题目").click();
  await button("查看题目").click();
  await fill("竞赛代码编辑器", "print(sum(map(int,input().split())))");
  await p.getByLabel("编程语言").selectOption("Python 3");
  await button("提交竞赛代码").click();
  await p
    .getByText("代码已提交，等待管理员人工评阅", { exact: true })
    .waitFor();
  await p.getByText("待人工评阅", { exact: true }).waitFor();
  await close();
  await p.screenshot({
    path: join(shots, "competition-student-desktop.png"),
    fullPage: true,
  });
  await logout();
  await login("平台管理演示");
  await nav("竞赛活动");
  await card(".p-event-card", "算法探索周赛")
    .getByRole("button", { name: "活动详情与题目", exact: true })
    .click();
  assert.equal(await button("添加题目").count(), 0);
  await button("查看与评阅").click();
  await fill("评分（满分100分）", "95");
  await fill("评阅反馈", "思路清晰，注意大整数范围。");
  await button("保存评分").click();
  await hidden();
  await logout();
  await login("我是学生");
  await nav("竞赛活动");
  await button("活动详情与题目").click();
  await button("查看题目").click();
  await p.getByText("95 / 100 分", { exact: true }).waitFor();
  await p.getByText("思路清晰，注意大整数范围。", { exact: true }).waitFor();
  await close();
  for (const [route, title] of [
    ["resources", "学习资源"],
    ["competitions", "竞赛活动"],
    ["schools", "名校探索"],
  ]) {
    await nav(title);
    for (const width of [360, 390, 768, 1024, 1440]) {
      await p.setViewportSize({ width, height: 900 });
      await p.waitForTimeout(80);
      assert.equal(
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${route} overflow at ${width}`,
      );
    }
    await p.setViewportSize({ width: 390, height: 844 });
    await p.screenshot({
      path: join(shots, route + "-mobile.png"),
      fullPage: true,
    });
    await p.setViewportSize({ width: 1440, height: 1000 });
  }
  await logout();
  await login("我是老师");
  await nav("学习资源");
  assert.equal(await button("上传素材").count(), 0);
  await nav("竞赛活动");
  assert.equal(await button("创建竞赛活动").count(), 0);
  await logout();
  await login("平台管理演示");
  await nav("学习资源");
  await button("进入资源管理").click();
  p.once("dialog", (d) => d.accept());
  await button("删除素材管理员待发布地图").click();
  await p
    .getByRole("heading", { name: "管理员待发布地图", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(
    await p
      .getByRole("heading", { name: "管理员待发布地图", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: local video upload/preview persistence, topics, drafts, school publish, contest schedule/problems/next period, signup/time gate/submission/grading, teacher guard, responsive layouts and no page errors (local demo)",
  );
} catch (e) {
  const page = browser.contexts()[0]?.pages()[0];
  if (page) {
    await page.screenshot({ path: join(shots, "failure.png"), fullPage: true });
    console.log((await page.locator("body").innerText()).slice(-5000));
  }
  throw e;
} finally {
  await browser.close();
}
