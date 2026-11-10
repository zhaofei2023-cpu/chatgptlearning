import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
const origin = "https://example.org";
let handler,
  actor = {
    id: "admin",
    role: "org_admin",
    institution_id: "org-a",
    is_active: true,
    must_change_password: false,
  };
const profiles = new Map(),
  orgs = new Map([
    ["org-a", { id: "org-a", code: "aaa", is_active: true }],
    ["org-b", { id: "org-b", code: "bbb", is_active: true }],
  ]);
let created = 0;
const service = {
  auth: {
    admin: {
      async createUser({ email, password }) {
        assert.ok(password.length === 24);
        const id = "new-" + ++created;
        profiles.set(id, { id, email });
        return { data: { user: { id } }, error: null };
      },
      async deleteUser(id) {
        profiles.delete(id);
      },
    },
  },
  from(table) {
    let target, update, insert;
    const b = {
      select() {
        return b;
      },
      eq(_k, v) {
        target = v;
        return b;
      },
      update(v) {
        update = v;
        return b;
      },
      insert(v) {
        insert = v;
        return b;
      },
      async single() {
        if (table === "profiles")
          return { data: target === "admin" ? actor : profiles.get(target) };
        if (table === "institutions") {
          if (insert) return { data: { id: "org-new", ...insert } };
          return { data: orgs.get(target) };
        }
        return { data: null };
      },
      then(resolve, reject) {
        return Promise.resolve()
          .then(() => {
            if (update && table === "profiles") {
              Object.assign(profiles.get(target), update);
            }
            return { error: null };
          })
          .then(resolve, reject);
      },
    };
    return b;
  },
};
const userClient = {
  auth: {
    async getUser() {
      return { data: { user: { id: "admin" } }, error: null };
    },
  },
};
let calls = 0;
const code = stripTypeScriptTypes(
  (
    await readFile(
      new URL("../supabase/functions/account-admin/index.ts", import.meta.url),
      "utf8",
    )
  ).replace(/^import .*\n/, ""),
);
new Function("Deno", "createClient", "crypto", code)(
  {
    env: { get: (k) => (k === "ALLOWED_ORIGIN" ? origin : "test") },
    serve: (h) => (handler = h),
  },
  () => (++calls % 2 ? userClient : service),
  webcrypto,
);
async function request(body, requestOrigin = origin) {
  calls = 0;
  const r = await handler(
    new Request(origin, {
      method: "POST",
      headers: { origin: requestOrigin, Authorization: "Bearer test" },
      body: JSON.stringify(body),
    }),
  );
  return { status: r.status, body: await r.json() };
}
assert.equal(
  (await request({ action: "create_institution", name: "越权", code: "bad" }))
    .status,
  403,
);
assert.equal(
  (
    await request({
      action: "create_accounts",
      institution_id: "org-b",
      accounts: [],
    })
  ).status,
  403,
);
assert.equal(
  (
    await request({
      action: "create_accounts",
      institution_id: "org-a",
      accounts: [
        { username: "teacher1", display_name: "老师", role: "org_admin" },
      ],
    })
  ).status,
  400,
);
assert.equal(
  (
    await request(
      {
        action: "create_accounts",
        institution_id: "org-a",
        accounts: [
          { username: "student1", display_name: "学生", role: "student" },
        ],
      },
      "https://evil.example",
    )
  ).status,
  403,
);
actor.must_change_password = true;
assert.equal(
  (
    await request({
      action: "create_accounts",
      institution_id: "org-a",
      accounts: [],
    })
  ).status,
  403,
);
actor.must_change_password = false;
const r = await request({
  action: "create_accounts",
  institution_id: "org-a",
  accounts: [{ username: "student1", display_name: "学生", role: "student" }],
});
assert.equal(r.status, 200);
assert.equal(r.body.results.length, 1);
assert.equal(profiles.get("new-1").institution_id, "org-a");
assert.equal(profiles.get("new-1").must_change_password, true);
assert.equal(
  profiles.get("new-1").email,
  "student1.aaa@users.flowspark.invalid",
);
assert.equal(created, 1);
profiles.set("other", {
  id: "other",
  institution_id: "org-b",
  role: "student",
});
assert.equal(
  (
    await request({
      action: "set_active",
      institution_id: "org-a",
      target_id: "other",
      is_active: false,
    })
  ).status,
  403,
);
actor.role = "platform_admin";
assert.equal(
  (
    await request({
      action: "create_institution",
      name: "玛酷机器人（迎新校区）",
      code: "mkyx",
    })
  ).status,
  200,
);
console.log(
  "PASS: account handler authentication gates, CORS, org scope, role escalation, provisioning, disabling",
);
