import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,encrypted_password text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
);
const bootstrap = await readFile(
  new URL("../supabase/bootstrap-new-project.sql", import.meta.url),
  "utf8",
);
await db.exec(bootstrap);
await assert.rejects(() => db.exec(bootstrap), /检测到已有 profiles 表/);
await db.exec("rollback");
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const orgs = [];
for (const code of ["aaa", "bbb", "ccc"])
  orgs.push(
    (
      await db.query(
        "insert into institutions(name,code) values($1,$1) returning id",
        [code],
      )
    ).rows[0].id,
  );
for (let n = 1; n <= 8; n++) {
  await db.query(
    `insert into auth.users values($1,'{"display_name":"测试","role":"platform_admin"}','old')`,
    [uid(n)],
  );
}
assert.equal(
  (await db.query("select role from profiles where id=$1", [uid(8)])).rows[0]
    .role,
  "student",
);
assert.equal(
  (await db.query("select is_active from profiles where id=$1", [uid(8)]))
    .rows[0].is_active,
  false,
);
for (const [n, role, org] of [
  [1, "teacher", orgs[0]],
  [2, "student", orgs[0]],
  [3, "teacher", orgs[1]],
  [4, "student", orgs[1]],
  [5, "org_admin", orgs[0]],
  [6, "platform_admin", null],
  [7, "student", orgs[2]],
])
  await db.query(
    "update profiles set role=$2,institution_id=$3,is_active=true,must_change_password=false where id=$1",
    [uid(n), role, org],
  );
async function as(n) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    uid(n),
  ]);
  await db.exec("set role authenticated");
}
async function denied(sql, args = []) {
  await assert.rejects(() => db.query(sql, args));
}
await as(1);
const c = (
  await db.query(
    "insert into classes(name,teacher_id) values('班级',$1) returning *",
    [uid(1)],
  )
).rows[0];
const a = (
  await db.query(
    "insert into assignments(class_id,teacher_id,title,statement,input_format,output_format,status,due_at) values($1,$2,'题目','内容','输入','输出','published',now()+interval '1 day') returning *",
    [c.id, uid(1)],
  )
).rows[0];
await as(4);
await denied("select join_class($1)", [c.join_code]);
assert.equal((await db.query("select * from classes")).rows.length, 0);
await as(3);
await denied(
  "insert into classes(name,teacher_id,institution_id) values('越权',$1,$2)",
  [uid(3), orgs[0]],
);
assert.equal((await db.query("select * from assignments")).rows.length, 0);
await as(2);
await db.query("select join_class($1)", [c.join_code]);
assert.equal((await db.query("select * from assignments")).rows.length, 1);
await denied("update profiles set role='platform_admin' where id=$1", [uid(2)]);
const submission = (
  await db.query(
    "insert into submissions(assignment_id,student_id,code,language) values($1,$2,'print(1)','Python 3') returning *",
    [a.id, uid(2)],
  )
).rows[0];
assert.equal(
  (
    await db.query(
      "update submissions set score=100,status='graded',feedback='作弊' where id=$1 returning id",
      [submission.id],
    )
  ).rows.length,
  0,
);
await as(5);
assert.equal((await db.query("select * from profiles")).rows.length, 3);
assert.equal((await db.query("select * from submissions")).rows.length, 1);
await denied("update profiles set is_active=false where id=$1", [uid(2)]);
await as(6);
assert.equal((await db.query("select * from institutions")).rows.length, 3);
await as(3);
assert.equal((await db.query("select * from submissions")).rows.length, 0);
assert.equal(
  (
    await db.query(
      "update submissions set score=90,feedback='越权',status='graded' returning id",
    )
  ).rows.length,
  0,
);
await as(1);
await db.query(
  "update submissions set score=90,feedback='继续努力',status='graded' where id=$1",
  [submission.id],
);
await db.exec("reset role");
await db.query("update profiles set must_change_password=true where id=$1", [
  uid(2),
]);
await as(2);
assert.equal((await db.query("select * from assignments")).rows.length, 0);
await db.exec("reset role");
await db.query("update auth.users set encrypted_password='new' where id=$1", [
  uid(2),
]);
await as(2);
assert.equal((await db.query("select * from assignments")).rows.length, 1);
await db.exec("reset role");
await db.query("update institutions set is_active=false where id=$1", [
  orgs[0],
]);
await as(2);
assert.equal((await db.query("select * from assignments")).rows.length, 0);
await denied("select join_class($1)", [c.join_code]);
await db.exec("reset role");
await db.exec("set role anon");
assert.equal((await db.query("select * from resources")).rows.length, 4);
await denied("select * from profiles");
await db.close();
console.log(
  "PASS: three-institution RLS, roles, password gate, disabled institution, submissions, anonymous access",
);
