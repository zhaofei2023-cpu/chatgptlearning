import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
await db.exec(
  `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb,encrypted_password text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text unique);alter table storage.objects enable row level security;grant usage on schema storage to authenticated,anon;grant select,insert,delete on storage.objects to authenticated;`,
);
for (const path of [
  "../supabase/schema.sql",
  "../supabase/migrations/002_institutions.sql",
  "../supabase/migrations/003_content_and_competitions.sql",
])
  await db.exec(await readFile(new URL(path, import.meta.url), "utf8"));
const bucket = (
  await db.query("select * from storage.buckets where id='learning-materials'")
).rows[0];
assert.equal(bucket.public, false);
assert.equal(Number(bucket.file_size_limit), 41943040);
assert.ok(!bucket.allowed_mime_types.includes("text/html"));
const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const orgs = [];
for (const code of ["aaa", "bbb"])
  orgs.push(
    (
      await db.query(
        "insert into institutions(name,code) values($1,$1) returning id",
        [code],
      )
    ).rows[0].id,
  );
for (const [n, role, scope] of [
  [1, "platform_admin", null],
  [2, "org_admin", orgs[0]],
  [3, "student", orgs[0]],
  [4, "org_admin", orgs[1]],
  [5, "student", orgs[1]],
  [6, "teacher", orgs[0]],
  [7, "student", orgs[0]],
]) {
  await db.query(
    `insert into auth.users values($1,'{"display_name":"测试账号"}','pwd')`,
    [uid(n)],
  );
  await db.query(
    "update profiles set role=$2,institution_id=$3,is_active=true,must_change_password=false where id=$1",
    [uid(n), role, scope],
  );
}
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
// Seed two old versions before the migration and verify deterministic consolidation.
await as(6);
const cls = (
  await db.query(
    "insert into classes(name,teacher_id,institution_id) values('测试班',$1,$2) returning *",
    [uid(6), orgs[0]],
  )
).rows[0];
const oldProblem = (
  await db.query(
    "insert into assignments(class_id,teacher_id,title,statement,input_format,output_format,status,due_at) values($1,$2,'旧题','求和','整数','整数','published',now()+interval '7 days') returning *",
    [cls.id, uid(6)],
  )
).rows[0];
await as(3);
await db.query("select join_class($1)", [cls.join_code]);
await db.query(
  "insert into submissions(assignment_id,student_id,code,language) values($1,$2,'old code','Python 3'),($1,$2,'latest code','Python 3')",
  [oldProblem.id, uid(3)],
);
await db.exec("reset role");
await db.query(
  "update submissions set submitted_at=now()-interval '1 day' where code='old code'",
);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/004_teaching_reports_covers.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
assert.equal(
  (await db.query("select count(*) n from submissions")).rows[0].n,
  1,
);
assert.equal(
  (await db.query("select code,attempt_count from submissions")).rows[0].code,
  "latest code",
);
assert.equal(
  (await db.query("select attempt_count from submissions")).rows[0]
    .attempt_count,
  2,
);
await as(6);
const cat = (
  await db.query(
    "insert into assignment_categories(title) values('图论专项') returning *",
  )
).rows[0];
const a = (
  await db.query(
    "insert into assignments(class_id,teacher_id,title,statement,input_format,output_format,due_at,category_id) values($1,$2,'新题','求和','输入','输出',now()+interval '7 days',$3) returning *",
    [cls.id, uid(6), cat.id],
  )
).rows[0];
await as(3);
await denied("select submit_solution($1,'print(1)','Python 3')", [a.id]);
await as(6);
await db.query("update assignments set status='published' where id=$1", [a.id]);
await as(3);
const first = (
  await db.query("select * from submit_solution($1,'print(1)','Python 3')", [
    a.id,
  ])
).rows[0];
const second = await db.query(
  "select submit_solution($1,'print(2)','Python 3')",
  [a.id],
);
let row = (
  await db.query("select * from submissions where assignment_id=$1", [a.id])
).rows[0];
// Read RPC as a scalar to avoid PostgreSQL expanding a volatile composite once per column.
assert.equal(first.attempt_count, 1);
assert.equal(row.attempt_count, 2);
assert.equal(row.id, first.id);
assert.equal(row.code, "print(2)");
assert.equal(
  (
    await db.query(
      "select count(*) n from submissions where assignment_id=$1",
      [a.id],
    )
  ).rows[0].n,
  1,
);
const revision = row.attempt_count;
await denied("update submissions set code='tamper' where id=$1", [row.id]);
await denied("update submissions set score=100 where id=$1", [row.id]);
await denied(
  "insert into submissions(assignment_id,student_id,code,language) values($1,$2,'tamper','Python 3')",
  [a.id, uid(3)],
);
await as(6);
await db.query("select grade_solution($1,$2,90,'边界仍需检查')", [
  row.id,
  revision,
]);
await as(3);
await db.query("select submit_solution($1,'print(3)','Python 3')", [a.id]);
row = (await db.query("select * from submissions where id=$1", [row.id]))
  .rows[0];
assert.equal(row.score, null);
assert.equal(row.feedback, null);
assert.equal(row.status, "pending");
assert.equal(row.attempt_count, revision + 1);
await as(6);
await denied("select grade_solution($1,$2,80,'过期批阅')", [row.id, revision]);
await as(5);
await denied("select submit_solution($1,'cross org','Python 3')", [a.id]);
assert.equal(
  (await db.query("select * from assignment_categories")).rows.length,
  0,
);
await as(6);
await db.query("update assignments set status='archived' where id=$1", [a.id]);
await as(3);
assert.equal(
  (await db.query("select * from assignments where id=$1", [a.id])).rows.length,
  0,
);
await denied("select submit_solution($1,'new','Python 3')", [a.id]);
assert.equal(
  (await db.query("select * from submissions where assignment_id=$1", [a.id]))
    .rows.length,
  1,
);
await as(6);
await db.query("delete from assignment_categories where id=$1", [cat.id]);
assert.equal(
  (await db.query("select category_id from assignments where id=$1", [a.id]))
    .rows[0].category_id,
  null,
);
// Report and cover isolation.
await as(2);
const item = (
  await db.query(
    "insert into learning_items(institution_id,title,kind,source_type,url) values($1,'视频外链','video','link','https://example.com/video') returning *",
    [orgs[0]],
  )
).rows[0];
const cover = `${orgs[0]}/${uid(2)}/${item.id}/${uid(55)}.png`;
await db.query(
  "insert into storage.objects(bucket_id,name) values('learning-covers',$1)",
  [cover],
);
await db.query("update learning_items set cover_path=$1 where id=$2", [
  cover,
  item.id,
]);
const report = (
  await db.query(
    "insert into study_reports(student_id,institution_id,period_days,content) values($1,$2,14,'证据不足，等待教师核实') returning *",
    [uid(3), orgs[0]],
  )
).rows[0];
await denied(
  "insert into study_reports(student_id,institution_id,period_days,content) values($1,$2,14,'越权')",
  [uid(5), orgs[0]],
);
await db.query(
  "insert into study_report_templates(instructions) values('概况、依据、建议')",
);
await as(3);
assert.equal(
  (
    await db.query(
      "select * from storage.objects where bucket_id='learning-covers'",
    )
  ).rows.length,
  0,
);
assert.equal((await db.query("select * from study_reports")).rows.length, 0);
await denied("select consume_study_report_quota()");
await as(2);
await db.query("update learning_items set status='published' where id=$1", [
  item.id,
]);
await as(3);
assert.equal(
  (
    await db.query(
      "select * from storage.objects where bucket_id='learning-covers'",
    )
  ).rows.length,
  1,
);
await denied(
  "insert into storage.objects(bucket_id,name) values('learning-covers',$1)",
  [cover.replace(uid(55), uid(56))],
);
await as(4);
assert.equal((await db.query("select * from study_reports")).rows.length, 0);
assert.equal(
  (
    await db.query(
      "select * from storage.objects where bucket_id='learning-covers'",
    )
  ).rows.length,
  0,
);
assert.equal(
  (await db.query("select * from study_report_templates")).rows.length,
  0,
);
await as(6);
assert.equal((await db.query("select * from study_reports")).rows.length, 0);
await as(1);
assert.equal(
  (await db.query("select * from study_reports where id=$1", [report.id])).rows
    .length,
  1,
);
await as(2);
for (let n = 0; n < 30; n++)
  await db.query("select consume_study_report_quota()");
await denied("select consume_study_report_quota()");
// Concurrent-safe contest overwrite uses the same one-student/one-problem invariant.
await as(2);
const contest = (
  await db.query(
    "insert into competitions(institution_id,title,requirements,starts_at,ends_at,registration_deadline) values($1,'限时练习','独立完成',now()+interval '1 day',now()+interval '2 days',now()+interval '1 day') returning *",
    [orgs[0]],
  )
).rows[0];
const problem = (
  await db.query(
    "insert into competition_problems(competition_id,title,statement) values($1,'求和','输出和') returning *",
    [contest.id],
  )
).rows[0];
await db.query("update competitions set status='published' where id=$1", [
  contest.id,
]);
await as(3);
await db.query(
  "insert into competition_entries(competition_id,student_id) values($1,$2)",
  [contest.id, uid(3)],
);
await db.exec("reset role");
await db.exec("alter table competitions disable trigger competition_valid");
await db.query(
  "update competitions set status='published',starts_at=now()-interval '1 hour',registration_deadline=now()-interval '2 hours' where id=$1",
  [contest.id],
);
await db.exec("alter table competitions enable trigger competition_valid");
await as(3);
await db.query("select submit_competition_solution($1,'first','Python 3')", [
  problem.id,
]);
await db.query("select submit_competition_solution($1,'latest','Python 3')", [
  problem.id,
]);
const cr = (
  await db.query("select * from competition_submissions where problem_id=$1", [
    problem.id,
  ])
).rows;
assert.equal(cr.length, 1);
assert.equal(cr[0].code, "latest");
assert.equal(cr[0].attempt_count, 2);
await as(5);
await denied("select submit_competition_solution($1,'bad','Python 3')", [
  problem.id,
]);
await db.close();
console.log(
  "PASS: v4 migration deduplication, latest-only overwrite, grade revision race, archive, category, private covers, report isolation and quota",
);
