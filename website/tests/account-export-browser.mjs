import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const p = await browser.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const id = "00000000-0000-4000-8000-000000000001",
    profile = {
      id,
      role: "platform_admin",
      display_name: "测试管理员",
      institution_id: null,
      is_active: true,
      must_change_password: false,
    };
  const payload = {
    sub: id,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const token =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(JSON.stringify(payload)).toString("base64url") +
    ".mock";
  let batches = 0;
  await p.route(
    "https://iyqdrtkaqatfvvxryawf.supabase.co/**",
    async (route) => {
      const req = route.request(),
        u = new URL(req.url());
      let body = [];
      if (u.pathname === "/auth/v1/token")
        body = {
          access_token: token,
          refresh_token: "mock-only",
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id,
            email: "mock@example.org",
            aud: "authenticated",
            user_metadata: {},
          },
        };
      else if (u.pathname === "/auth/v1/user")
        body = { id, email: "mock@example.org" };
      else if (u.pathname === "/rest/v1/profiles")
        body = u.searchParams.has("id") ? profile : [profile];
      else if (u.pathname === "/rest/v1/institutions")
        body = [{ id: "org-a", name: "测试机构", code: "mkyx" }];
      else if (u.pathname === "/functions/v1/account-admin") {
        batches++;
        body = {
          results: [
            {
              username: "faileduser",
              error: "创建失败：用户名可能已存在，请到认证后台核查",
            },
            ...(batches > 1
              ? [
                  {
                    institution_code: "mkyx",
                    username: "student001",
                    display_name: "同学甲",
                    role: "student",
                    password: "Test-Pass12345!",
                  },
                ]
              : []),
          ],
        };
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
        },
        body: JSON.stringify(body),
      });
    },
  );
  await p.goto(process.env.TEST_URL || "http://127.0.0.1:4175");
  await p.getByRole("button", { name: "进入学习空间" }).first().click();
  await p
    .getByRole("button", { name: "平台管理员邮箱登录", exact: true })
    .click();
  await p.getByLabel("平台管理员邮箱").fill("mock@example.org");
  await p.getByLabel("密码", { exact: true }).fill("Test-Pass12345!");
  await p.getByRole("button", { name: "登录学习空间", exact: true }).click();
  await p.getByRole("link", { name: "机构与账号" }).click();
  await p.getByLabel("当前机构").selectOption("org-a");
  await p
    .getByLabel("账号列表", { exact: true })
    .fill("faileduser,测试,student");
  await p
    .getByRole("button", { name: "创建账号并生成临时密码", exact: true })
    .click();
  await p.getByText("本批成功 0 个，未成功 1 个。").waitFor();
  assert.equal(
    await p
      .getByRole("button", { name: "下载成功账号 CSV（0人）" })
      .isDisabled(),
    true,
  );
  await p
    .getByRole("button", { name: "创建账号并生成临时密码", exact: true })
    .click();
  await p.getByText("本批成功 1 个，未成功 1 个。").waitFor();
  const downloadPromise = p.waitForEvent("download");
  await p.getByRole("button", { name: "下载成功账号 CSV（1人）" }).click();
  const download = await downloadPromise;
  const csv = await readFile(await download.path(), "utf8");
  assert.ok(csv.includes("机构代码"));
  assert.ok(csv.includes("student001"));
  assert.ok(csv.includes("Test-Pass12345!"));
  assert.ok(!csv.includes("faileduser"));
  assert.deepEqual(errors, []);
  console.log(
    "PASS: production UI blocks failed-only download and exports successful credentials with Chinese headers (mock backend)",
  );
} finally {
  await browser.close();
}
