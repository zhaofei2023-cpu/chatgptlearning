import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../supabase/", import.meta.url);
const sources = ["schema.sql", "migrations/002_institutions.sql"];
const bodies = await Promise.all(
  sources.map(async (path) =>
    (await readFile(new URL(path, root), "utf8")).replace(
      /^\s*(begin|commit);\s*$/gim,
      "",
    ),
  ),
);
const sql = `-- FlowSpark 第二版：仅适用于尚未初始化的全新 Supabase 数据库。
-- 已执行过 schema.sql 的项目不要使用此文件，应按迁移文档继续。
-- 自动生成：node scripts/build-bootstrap.mjs；不要直接编辑。
begin;
do $$begin
 if to_regclass('public.profiles') is not null then
  raise exception '检测到已有 profiles 表，已停止初始化。请勿重复执行，请核查已执行的迁移。';
 end if;
end$$;
${bodies.join("\n\n")}
commit;
`;
const target = new URL("bootstrap-new-project.sql", root);
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== sql)
    throw Error("初始化文件与源迁移不一致，请重新生成");
  console.log("PASS: bootstrap SQL matches source schema and migration");
} else {
  await writeFile(target, sql);
  console.log("Generated bootstrap-new-project.sql");
}
