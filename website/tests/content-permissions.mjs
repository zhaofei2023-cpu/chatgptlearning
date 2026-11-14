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
await as(1);
const globalTopic = (
  await db.query(
    "insert into learning_topics(title) values('全平台主题') returning *",
  )
).rows[0];
const globalItem = (
  await db.query(
    "insert into learning_items(title,kind,source_type,body,status,topic_id) values('知识地图','knowledge_map','text','数组→图论','draft',$1) returning *",
    [globalTopic.id],
  )
).rows[0];
await as(3);
assert.equal((await db.query("select * from learning_items")).rows.length, 0);
await denied("insert into learning_topics(title) values('越权')");
await denied(
  "insert into learning_items(title,kind,source_type,body) values('越权','document','text','内容')",
);
await as(1);
await db.query("update learning_items set status='published' where id=$1", [
  globalItem.id,
]);
await as(5);
assert.equal((await db.query("select * from learning_items")).rows.length, 1);
await as(2);
assert.equal(
  (
    await db.query(
      "update learning_items set title='越权' where id=$1 returning id",
      [globalItem.id],
    )
  ).rows.length,
  0,
);
await denied("update learning_items set institution_id=$1 where id=$2", [
  orgs[0],
  globalItem.id,
]);
const topic = (
  await db.query(
    "insert into learning_topics(title,institution_id) values('本机构',$1) returning *",
    [orgs[0]],
  )
).rows[0];
await denied(
  "insert into learning_items(title,kind,source_type,body,institution_id,topic_id) values('错范围','document','text','正文',$1,$2)",
  [orgs[0], globalTopic.id],
);
const item = (
  await db.query(
    "insert into learning_items(title,kind,source_type,status,institution_id,topic_id) values('本地课件','courseware','upload','draft',$1,$2) returning *",
    [orgs[0], topic.id],
  )
).rows[0];
await denied("update learning_items set status='published' where id=$1", [
  item.id,
]);
const path = `${orgs[0]}/${uid(2)}/${item.id}/${uid(20)}.pdf`;
await db.query(
  "insert into storage.objects(bucket_id,name) values('learning-materials',$1)",
  [path],
);
await denied(
  "insert into storage.objects(bucket_id,name) values('learning-materials',$1)",
  [`global/${uid(2)}/${item.id}/${uid(21)}.pdf`],
);
await as(3);
assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
await denied(
  "insert into storage.objects(bucket_id,name) values('learning-materials',$1)",
  [`global/${uid(3)}/${item.id}/${uid(22)}.pdf`],
);
await as(2);
await db.query(
  "update learning_items set object_path=$1,file_name='课件.pdf',file_size=100,mime_type='application/pdf',status='published' where id=$2",
  [path, item.id],
);
await as(3);
assert.equal((await db.query("select * from storage.objects")).rows.length, 1);
await as(5);
assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
assert.equal((await db.query("select * from learning_items")).rows.length, 1);
await as(2);
const school = (
  await db.query(
    "insert into school_information(title,school_name,body,status,institution_id) values('课程资讯','学校甲','请以官网为准','draft',$1) returning *",
    [orgs[0]],
  )
).rows[0];
await as(3);
assert.equal(
  (await db.query("select * from school_information")).rows.length,
  0,
);
await as(2);
await db.query("update school_information set status='published' where id=$1", [
  school.id,
]);
await as(3);
assert.equal(
  (await db.query("select * from school_information")).rows.length,
  1,
);
await as(4);
assert.equal(
  (await db.query("select * from school_information")).rows.length,
  0,
);
await as(2);
const c = (
  await db.query(
    "insert into competitions(institution_id,title,requirements,starts_at,ends_at,registration_deadline,recurrence) values($1,'周赛','独立答题，人工评阅',now()+interval '1 day',now()+interval '2 day',now()+interval '12 hours','weekly') returning *",
    [orgs[0]],
  )
).rows[0];
await denied("update competitions set status='published' where id=$1", [c.id]);
const p = (
  await db.query(
    "insert into competition_problems(competition_id,title,statement,max_score) values($1,'求和','输入a和b，输出和',100) returning *",
    [c.id],
  )
).rows[0];
await db.query("update competitions set status='published' where id=$1", [
  c.id,
]);
await as(3);
assert.equal(
  (await db.query("select * from competition_problems")).rows.length,
  0,
);
await db.query(
  "insert into competition_entries(competition_id,student_id) values($1,$2)",
  [c.id, uid(3)],
);
await denied(
  "insert into competition_entries(competition_id,student_id) values($1,$2)",
  [c.id, uid(3)],
);
await denied(
  "insert into competition_submissions(problem_id,student_id,code,language) values($1,$2,'print(1)','Python 3')",
  [p.id, uid(3)],
);
await as(5);
await denied(
  "insert into competition_entries(competition_id,student_id) values($1,$2)",
  [c.id, uid(5)],
);
await as(6);
await denied(
  "insert into competition_entries(competition_id,student_id) values($1,$2)",
  [c.id, uid(6)],
);
await as(2);
await db.query(
  "update competitions set starts_at=now()-interval '1 hour',ends_at=now()+interval '1 hour',registration_deadline=now()-interval '2 hours' where id=$1",
  [c.id],
);
await denied(
  "update competition_problems set statement='赛中改题' where id=$1",
  [p.id],
);
await denied(
  "update competitions set ends_at=now()+interval '2 hours' where id=$1",
  [c.id],
);
await as(7);
assert.equal(
  (await db.query("select * from competition_problems")).rows.length,
  0,
);
await denied(
  "insert into competition_submissions(problem_id,student_id,code,language) values($1,$2,'print(1)','Python 3')",
  [p.id, uid(7)],
);
await as(3);
assert.equal(
  (await db.query("select * from competition_problems")).rows.length,
  1,
);
const s = (
  await db.query(
    "insert into competition_submissions(problem_id,student_id,code,language) values($1,$2,'print(3)','Python 3') returning *",
    [p.id, uid(3)],
  )
).rows[0];
assert.equal(s.status, "pending");
assert.equal(
  (
    await db.query(
      "update competition_submissions set score=100,feedback='自评',status='graded' returning id",
    )
  ).rows.length,
  0,
);
await as(2);
await denied(
  "update competition_submissions set score=101,feedback='超分',status='graded' where id=$1",
  [s.id],
);
await db.query(
  "update competition_submissions set score=95,feedback='继续加油',status='graded' where id=$1",
  [s.id],
);
await denied("update competition_submissions set code='篡改' where id=$1", [
  s.id,
]);
await as(6);
assert.equal(
  (await db.query("select * from competition_submissions")).rows.length,
  0,
);
await as(4);
assert.equal(
  (await db.query("select * from competition_submissions")).rows.length,
  0,
);
await as(3);
assert.equal(
  Number(
    (await db.query("select score from competition_submissions")).rows[0].score,
  ),
  95,
);
await as(2);
await db.query("update competitions set status='cancelled' where id=$1", [
  c.id,
]);
await as(3);
await denied(
  "insert into competition_submissions(problem_id,student_id,code,language) values($1,$2,'print(4)','Python 3')",
  [p.id, uid(3)],
);
await db.exec("reset role");
await db.query("update profiles set is_active=false where id=$1", [uid(3)]);
await as(3);
assert.equal((await db.query("select * from learning_items")).rows.length, 0);
assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
await db.exec("reset role");
await db.exec("set role anon");
await denied("select * from learning_items");
await denied("select * from competitions");
await as(5);
assert.equal(
  (
    await db.query("delete from learning_items where id=$1 returning id", [
      item.id,
    ])
  ).rows.length,
  0,
);
await as(2);
await db.query("delete from storage.objects where name=$1", [path]);
await db.query("delete from learning_items where id=$1", [item.id]);
assert.equal((await db.query("select * from storage.objects")).rows.length, 0);
await db.close();
console.log(
  "PASS: V3 SQL migration, scope isolation, admin-only publishing, private storage RLS, draft visibility, contest registration, release clock, submission window, score bounds and immutable code",
);
