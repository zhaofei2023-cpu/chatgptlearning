// 使用真实 Supabase JS 客户端与模拟 HTTP 响应；不代表真实项目已执行迁移。
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const uid = "00000000-0000-4000-8000-000000000001",
    profile = {
      id: uid,
      role: "platform_admin",
      display_name: "测试管理员",
      institution_id: null,
      is_active: true,
      must_change_password: false,
    };
  const token =
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(
      JSON.stringify({
        sub: uid,
        role: "authenticated",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString("base64url") +
    ".mock";
  const tables = {
    profiles: [profile],
    institutions: [],
    classes: [],
    assignments: [],
    submissions: [],
    resources: [],
    learning_topics: [],
    learning_items: [],
    school_information: [],
    competitions: [],
    competition_problems: [],
    competition_entries: [],
    competition_submissions: [],
  };
  let missing = true,
    failUpload = false;
  const steps = [];
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
    "base64",
  );
  await p.route(
    "https://iyqdrtkaqatfvvxryawf.supabase.co/**",
    async (route) => {
      const req = route.request(),
        u = new URL(req.url()),
        method = req.method();
      let body = {},
        status = 200,
        contentType = "application/json";
      const cors = {
        "access-control-allow-origin": "*",
        "access-control-allow-headers": "*",
      };
      if (u.pathname === "/auth/v1/token")
        body = {
          access_token: token,
          refresh_token: "mock-only",
          expires_in: 3600,
          token_type: "bearer",
          user: {
            id: uid,
            email: "mock@example.org",
            aud: "authenticated",
            user_metadata: {},
          },
        };
      else if (u.pathname === "/auth/v1/user")
        body = { id: uid, email: "mock@example.org" };
      else if (u.pathname.startsWith("/rest/v1/")) {
        const table = u.pathname.split("/").pop();
        if (missing && table === "learning_topics") {
          status = 404;
          body = { code: "PGRST205", message: "table not found" };
        } else {
          const rows = tables[table] || [];
          const id = u.searchParams.get("id")?.replace(/^eq\./, "");
          if (method === "POST") {
            const payload = req.postDataJSON();
            const row = {
              created_by: uid,
              created_at: new Date().toISOString(),
              id: payload.id || randomUUID(),
              ...payload,
            };
            rows.push(row);
            body = [row];
            if (table === "learning_items") steps.push("insert:" + row.status);
          } else if (method === "PATCH") {
            const payload = req.postDataJSON(),
              row = rows.find((r) => r.id === id);
            Object.assign(row, payload);
            body = [row];
            if (table === "learning_items") steps.push("update:" + row.status);
          } else body = id ? rows.filter((r) => r.id === id) : rows;
          if (req.headers().accept?.includes("vnd.pgrst.object+json"))
            body = body[0] || null;
        }
      } else if (
        u.pathname.startsWith("/storage/v1/object/sign/") &&
        method === "POST"
      ) {
        steps.push("signed-url");
        body = {
          signedURL:
            "/object/sign/" +
            u.pathname.split("/object/sign/")[1] +
            "?token=mock",
        };
      } else if (u.pathname.startsWith("/storage/v1/object/sign/")) {
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          headers: cors,
          body: png,
        });
        return;
      } else if (
        u.pathname.startsWith("/storage/v1/object/") &&
        method === "POST"
      ) {
        assert.equal(req.headers().authorization, "Bearer " + token);
        assert.ok(!req.headers().apikey.startsWith("sb_secret_"));
        steps.push("upload");
        if (failUpload) {
          status = 400;
          body = { statusCode: "413", message: "存储空间不足", error: "quota" };
        } else
          body = { Key: u.pathname.split("/object/")[1], Id: randomUUID() };
      } else if (
        u.pathname.startsWith("/storage/v1/object/") &&
        method === "DELETE"
      ) {
        steps.push("cleanup");
        body = [];
      }
      await route.fulfill({
        status,
        contentType,
        headers: cors,
        body: JSON.stringify(body),
      });
    },
  );
  await p.goto(process.env.TEST_URL || "http://127.0.0.1:4187");
  await p.getByRole("button", { name: "进入学习空间" }).first().click();
  await p
    .getByRole("button", { name: "平台管理员邮箱登录", exact: true })
    .click();
  await p.getByLabel("平台管理员邮箱").fill("mock@example.org");
  await p.getByLabel("密码", { exact: true }).fill("Test-Pass123!");
  await p.getByRole("button", { name: "登录学习空间", exact: true }).click();
  await p.getByRole("link", { name: "学习资源", exact: true }).first().click();
  await p
    .getByText(
      "新模块尚未初始化。请平台管理员执行003_content_and_competitions.sql，然后刷新。",
      { exact: true },
    )
    .waitFor();
  assert.ok(
    await p.getByRole("button", { name: "上传素材", exact: true }).isDisabled(),
  );
  missing = false;
  await p.getByRole("button", { name: "重新加载", exact: true }).click();
  await p.getByRole("button", { name: "上传素材", exact: true }).waitFor();
  async function fillUpload(title) {
    await p.getByRole("button", { name: "上传素材", exact: true }).click();
    await p.getByLabel("素材名称", { exact: true }).fill(title);
    await p.getByLabel("素材类型").selectOption("knowledge_map");
    await p
      .getByLabel("选择本地文件")
      .setInputFiles({ name: "map.png", mimeType: "image/png", buffer: png });
    await p.getByLabel("发布状态").selectOption("published");
    await p.getByRole("button", { name: "保存素材", exact: true }).click();
  }
  await fillUpload("云端知识地图");
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  assert.deepEqual(steps.slice(0, 3), [
    "insert:draft",
    "upload",
    "update:published",
  ]);
  assert.equal(tables.learning_items.length, 1);
  assert.ok(
    tables.learning_items[0].object_path.startsWith("global/" + uid + "/"),
  );
  assert.equal(tables.learning_items[0].mime_type, "image/png");
  await p
    .locator(".p-resource-card")
    .filter({
      has: p.getByRole("heading", { name: "云端知识地图", exact: true }),
    })
    .getByRole("button", { name: "开始学习", exact: true })
    .click();
  await p.waitForFunction(
    () => document.querySelector(".p-map-image")?.naturalWidth === 1,
  );
  assert.ok(steps.includes("signed-url"));
  await p.getByRole("button", { name: "关闭窗口", exact: true }).click();
  failUpload = true;
  await fillUpload("上传失败后保留草稿");
  await p.getByRole("alert").filter({ hasText: "存储空间不足" }).waitFor();
  const draft = tables.learning_items.find(
    (r) => r.title === "上传失败后保留草稿",
  );
  assert.equal(draft.status, "draft");
  assert.equal(draft.object_path, null);
  assert.ok(steps.includes("cleanup"));
  const draftId = draft.id;
  failUpload = false;
  await p.getByRole("button", { name: "保存素材", exact: true }).click();
  await p.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(tables.learning_items.filter((r) => r.id === draftId).length, 1);
  assert.equal(
    tables.learning_items.find((r) => r.id === draftId).status,
    "published",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: missing-migration guard, actual SDK draft-upload-publish ordering, private signed preview, upload failure remains draft, cleanup and retry reuses same row (mock HTTP backend)",
  );
} catch (e) {
  const p = browser.contexts()[0]?.pages()[0];
  if (p) console.log((await p.locator("body").innerText()).slice(-3000));
  throw e;
} finally {
  await browser.close();
}
