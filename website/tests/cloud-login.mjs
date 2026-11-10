// 生产构建连接参数与登录请求测试：使用模拟响应，不代表远端认证成功。
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const value = (name) =>
  env
    .split(/\r?\n/)
    .find((l) => l.startsWith(name + "="))
    ?.slice(name.length + 1);
const url = value("VITE_SUPABASE_URL"),
  key =
    value("VITE_SUPABASE_PUBLISHABLE_KEY") || value("VITE_SUPABASE_ANON_KEY");
assert.ok(url && key, "本地公开连接参数未配置");
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const p = await browser.newPage();
  const errors = [];
  let request;
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route(url + "/**", async (route) => {
    request = route.request();
    await route.fulfill({
      status: 400,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid login credentials",
      }),
    });
  });
  await p.goto(process.env.TEST_URL || "http://127.0.0.1:4175");
  await p.getByRole("button", { name: "进入学习空间" }).first().click();
  assert.equal(await p.getByRole("button", { name: "我是学生" }).count(), 0);
  assert.equal(
    await p.getByRole("button", { name: "注册学生账号" }).count(),
    0,
  );
  await p.getByLabel("机构代码", { exact: true }).fill("mkyx");
  await p.getByLabel("用户名", { exact: true }).fill("student001");
  await p.getByLabel("密码", { exact: true }).fill("Test-password-12345");
  await p.getByRole("button", { name: "登录学习空间", exact: true }).click();
  await p.getByRole("status").filter({ hasText: "登录失败" }).waitFor();
  assert.ok(request.url().startsWith(url + "/auth/v1/token"));
  assert.equal(request.headers()["apikey"], key);
  assert.equal(
    request.postDataJSON().email,
    "student001.mkyx@users.flowspark.invalid",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: publishable-key production configuration, institution login request, no self-signup, failed login feedback (mock response only)",
  );
} finally {
  await browser.close();
}
