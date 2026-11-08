import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
);
await db.exec(
  await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
);
const T = "11111111-1111-4111-8111-111111111111",
  S = "22222222-2222-4222-8222-222222222222",
  O = "33333333-3333-4333-8333-333333333333",
  T2 = "44444444-4444-4444-8444-444444444444";
for (const [id, name] of [
  [T, "教师甲"],
  [S, "学生甲"],
  [O, "学生乙"],
  [T2, "教师乙"],
])
  await db.query(`insert into auth.users values($1,$2)`, [
    id,
    JSON.stringify({ display_name: name, role: "teacher" }),
  ]);
assert.equal(
  (await db.query("select role from public.profiles where id=$1", [S])).rows[0]
    .role,
  "student",
  "metadata cannot assign teacher",
);
await db.exec(
  `update public.profiles set role='teacher' where id in ('${T}','${T2}')`,
);
async function as(id) {
  await db.exec("reset role");
  await db.query(`select set_config('request.jwt.claim.sub',$1,false)`, [id]);
  await db.exec("set role authenticated");
}
async function denies(fn, label) {
  let denied = false;
  try {
    await fn();
  } catch {
    denied = true;
  }
  assert.ok(denied, label);
}
await as(T);
const cls = (
  await db.query(
    `insert into public.classes(name,teacher_id) values('班级A',$1) returning *`,
    [T],
  )
).rows[0];
const a = (
  await db.query(
    `insert into public.assignments(class_id,teacher_id,title,statement,input_format,output_format,status,due_at) values($1,$2,'算法题','求和','两个数','一个数','published',now()+interval '1 day') returning *`,
    [cls.id, T],
  )
).rows[0];
await as(S);
assert.equal(
  (await db.query("select * from public.assignments")).rows.length,
  0,
  "outsider cannot read",
);
await denies(
  () =>
    db.query(
      `insert into public.classes(name,teacher_id) values('越权班级',$1)`,
      [S],
    ),
  "student cannot create class",
);
await denies(
  () => db.exec("update public.profiles set role='teacher'"),
  "student cannot promote role",
);
await db.query("select public.join_class($1)", [cls.join_code]);
assert.equal(
  (await db.query("select * from public.assignments")).rows.length,
  1,
  "member reads",
);
const sub = (
  await db.query(
    `insert into public.submissions(assignment_id,student_id,language,code,status) values($1,$2,'C++17','int main(){}','graded') returning *`,
    [a.id, S],
  )
).rows[0];
assert.equal(sub.status, "pending", "cannot submit self graded");
assert.equal(sub.student_name, "学生甲");
await denies(
  () =>
    db
      .query(`update public.submissions set score=100 where id=$1`, [sub.id])
      .then((r) => {
        if (r.affectedRows === 0) throw new Error("RLS no rows");
      }),
  "student cannot grade own submission",
);
await as(O);
assert.equal(
  (await db.query("select * from public.submissions")).rows.length,
  0,
  "other student cannot read code",
);
await denies(
  () =>
    db.query(
      `insert into public.submissions(assignment_id,student_id,language,code) values($1,$2,'C++17','int main(){}')`,
      [a.id, O],
    ),
  "unjoined student cannot submit",
);
await as(T2);
assert.equal(
  (await db.query("select * from public.submissions")).rows.length,
  0,
  "other teacher cannot read",
);
await as(T);
await db.query(
  `update public.submissions set score=90,feedback='继续努力',status='graded' where id=$1`,
  [sub.id],
);
await denies(
  () =>
    db.query(`update public.submissions set code='tamper' where id=$1`, [
      sub.id,
    ]),
  "teacher cannot rewrite code",
);
await as(S);
assert.equal(
  (await db.query("select score from public.submissions where id=$1", [sub.id]))
    .rows[0].score,
  "90",
);
for (let i = 0; i < 20; i++)
  await db.exec("select public.consume_mentor_quota()");
await denies(
  () => db.exec("select public.consume_mentor_quota()"),
  "daily AI quota capped",
);
await as(T);
await db.query(
  `update public.assignments set due_at=now()-interval '1 second' where id=$1`,
  [a.id],
);
await as(S);
await denies(
  () =>
    db.query(
      `insert into public.submissions(assignment_id,student_id,language,code) values($1,$2,'Python 3','print(1)')`,
      [a.id, S],
    ),
  "deadline enforced server side",
);
await db.exec("reset role; set role anon");
assert.equal((await db.query("select * from public.resources")).rows.length, 4);
await denies(
  () => db.exec("select * from public.submissions"),
  "anonymous cannot read code",
);
await db.close();
console.log(
  "PASS: SQL migration, server role assignment, class isolation, submission privacy, teacher boundaries, immutable submitted code, score protection, deadlines, public resources and atomic AI quota",
);
