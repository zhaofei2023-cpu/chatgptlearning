import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./data";
import {
  TABLES,
  KINDS,
  MIME,
  FILE_LIMIT,
  isAdmin,
  manages,
  scopeReadable,
  nextPeriod,
  validateFile,
} from "./platform-rules";
export * from "./platform-rules";
const empty = () => Object.fromEntries(TABLES.map((t) => [t, []]));
const STORE = "flowspark-content-v3";
function seed() {
  const x = empty();
  x.learning_topics = [
    {
      id: "topic-algo",
      institution_id: null,
      title: "算法与编程",
      description: "从基础方法走向系统实践",
      created_by: "platform_admin-demo",
    },
  ];
  x.learning_items = [
    {
      id: "map-demo",
      institution_id: null,
      topic_id: "topic-algo",
      title: "信息学竞赛 · 知识路径",
      description: "按主题搭建自己的学习地图",
      kind: "knowledge_map",
      source_type: "text",
      body: "起点：输入输出与基本语法\n→ 数组、字符串与模拟\n→ 排序、二分与前缀和\n→ 栈、队列与树\n→ 图论：BFS / DFS\n→ 动态规划与综合训练\n\n建议：每个阶段完成一道练习，再写下自己的思路。",
      status: "published",
    },
  ];
  x.school_information = [
    {
      id: "school-demo",
      institution_id: null,
      title: "走近 MIT 的算法公开课",
      school_name: "MIT",
      category: "公开课程",
      summary: "通过官方开放课程了解算法学习。",
      body: "访问 MIT OpenCourseWare 官方网站，查阅算法课程的视频、讲义与作业材料。课程以官网当前开放内容为准。本站不代表学校，也不声称与学校有合作关系。",
      official_url: "https://ocw.mit.edu/",
      status: "published",
    },
  ];
  return x;
}
function readLocal() {
  try {
    return { ...seed(), ...JSON.parse(localStorage.getItem(STORE) || "null") };
  } catch {
    return seed();
  }
}
function visibleData(all, user) {
  const out = empty();
  const visible = (r) =>
    manages(user, r.institution_id) ||
    (r.status === "published" && scopeReadable(user, r.institution_id));
  out.learning_topics = all.learning_topics.filter((r) =>
    scopeReadable(user, r.institution_id),
  );
  for (const t of ["learning_items", "school_information", "competitions"])
    out[t] = all[t].filter(
      (r) =>
        visible(r) ||
        (t === "competitions" &&
          r.status === "cancelled" &&
          scopeReadable(user, r.institution_id)),
    );
  const contest = (id) => all.competitions.find((c) => c.id === id);
  const adminContest = (id) => manages(user, contest(id)?.institution_id);
  const registered = (id) =>
    all.competition_entries.some(
      (e) => e.competition_id === id && e.student_id === user?.id,
    );
  out.competition_problems = all.competition_problems.filter((p) => {
    const c = contest(p.competition_id);
    return (
      c &&
      (adminContest(c.id) ||
        (visible(c) &&
          c.status === "published" &&
          Date.now() >= +new Date(c.starts_at) &&
          (Date.now() >= +new Date(c.ends_at) ||
            user?.role === "teacher" ||
            registered(c.id))))
    );
  });
  out.competition_entries = all.competition_entries.filter(
    (e) => e.student_id === user?.id || adminContest(e.competition_id),
  );
  out.competition_submissions = all.competition_submissions.filter(
    (s) =>
      s.student_id === user?.id ||
      adminContest(
        all.competition_problems.find((p) => p.id === s.problem_id)
          ?.competition_id,
      ),
  );
  return out;
}
export async function blobStore(key, value) {
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open("flowspark-local-materials", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(Error("浏览器本地文件存储不可用"));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "files",
        value === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("files");
      const req =
        value === undefined
          ? store.get(key)
          : value === null
            ? store.delete(key)
            : store.put(value, key);
      let result;
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(Error("本地文件保存失败，浏览器空间可能不足"));
    });
  } finally {
    db.close();
  }
}
async function selectAll(t) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from(t)
      .select(
        t === "competition_submissions"
          ? "id,problem_id,student_id,language,status,score,feedback,submitted_at"
          : "*",
      )
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export function usePlatform(user, demo, section = "all") {
  const [data, setData] = useState(empty),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const epoch = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++epoch.current;
    if (!user) {
      setData(empty());
      setError("");
      return;
    }
    setLoading(true);
    try {
      const next = demo
        ? visibleData(readLocal(), user)
        : Object.fromEntries(
            await Promise.all(
              (section === "resources"
                ? ["learning_topics", "learning_items"]
                : section === "schools"
                  ? ["school_information"]
                  : section === "competitions"
                    ? [
                        "competitions",
                        "competition_problems",
                        "competition_entries",
                        "competition_submissions",
                      ]
                    : TABLES
              ).map(async (t) => [t, await selectAll(t)]),
            ),
          );
      if (ticket === epoch.current) {
        setData({ ...empty(), ...next });
        setError("");
      }
    } catch (e) {
      if (ticket === epoch.current) {
        setData(empty());
        setError(
          ["42P01", "PGRST205"].includes(e.code)
            ? "新模块尚未初始化。请平台管理员执行003_content_and_competitions.sql，然后刷新。"
            : e.message || "内容加载失败，请稍后重试",
        );
      }
    } finally {
      if (ticket === epoch.current) setLoading(false);
    }
  }, [user?.id, user?.role, user?.institution_id, demo, section]);
  useEffect(() => {
    refresh();
    return () => {
      epoch.current++;
    };
  }, [refresh]);
  async function save(table, payload) {
    if (!user) throw Error("请先登录");
    let row;
    if (demo) {
      const all = readLocal(),
        existing = all[table].find((r) => r.id === payload.id);
      let scope = payload.institution_id ?? existing?.institution_id ?? null;
      if (table === "competition_problems")
        scope = all.competitions.find(
          (c) =>
            c.id === payload.competition_id ||
            c.id === existing?.competition_id,
        )?.institution_id;
      if (!manages(user, scope))
        throw Error("只有对应范围的管理员可以管理内容");
      if (
        existing &&
        existing.institution_id !== undefined &&
        payload.institution_id !== undefined &&
        existing.institution_id !== payload.institution_id
      )
        throw Error("不能变更已有内容的范围");
      if (table === "competitions") {
        if (
          payload.status === "published" &&
          existing?.status !== "published" &&
          Date.now() >= +new Date(payload.starts_at || existing?.starts_at)
        )
          throw Error("请设置未来的开赛时间再发布");
        if (
          payload.status === "published" &&
          !all.competition_problems.some((p) => p.competition_id === payload.id)
        )
          throw Error("请先添加至少一道题再发布");
        if (
          existing?.status === "published" &&
          Date.now() >= +new Date(existing.starts_at) &&
          [
            "starts_at",
            "ends_at",
            "registration_deadline",
            "requirements",
          ].some((k) => payload[k] !== undefined && payload[k] !== existing[k])
        )
          throw Error("已开赛活动不能修改赛程或要求");
      }
      if (table === "competition_problems") {
        const c = all.competitions.find(
          (c) => c.id === (payload.competition_id || existing?.competition_id),
        );
        if (c?.status === "published" && Date.now() >= +new Date(c.starts_at))
          throw Error("竞赛已开赛，不能修改题目");
      }
      row = {
        ...existing,
        ...payload,
        id: payload.id || crypto.randomUUID(),
        created_by: existing?.created_by || user.id,
        created_at: existing?.created_at || new Date().toISOString(),
      };
      all[table] = existing
        ? all[table].map((r) => (r.id === row.id ? row : r))
        : [row, ...all[table]];
      localStorage.setItem(STORE, JSON.stringify(all));
    } else {
      let exists = false;
      if (payload.id) {
        const lookup = await supabase
          .from(table)
          .select("id")
          .eq("id", payload.id)
          .maybeSingle();
        if (lookup.error) throw lookup.error;
        exists = !!lookup.data;
      }
      const {
        id,
        institution_id,
        competition_id,
        created_by,
        created_at,
        ...changes
      } = payload;
      const query = exists
        ? supabase.from(table).update(changes).eq("id", id)
        : supabase.from(table).insert(payload);
      const { data: r, error } = await query.select().single();
      if (error) throw error;
      row = r;
    }
    await refresh();
    return row;
  }
  async function saveItem(payload, file) {
    if (!isAdmin(user)) throw Error("只有管理员可以上传和发布");
    const previous = data.learning_items.find((r) => r.id === payload.id);
    let current = previous,
      newPath = null;
    try {
      if (file) {
        const { ext, mime } = validateFile(file, payload.kind);
        if (!current)
          current = await save("learning_items", {
            ...payload,
            status: "draft",
            object_path: null,
          });
        newPath = `${payload.institution_id || "global"}/${user.id}/${payload.id}/${crypto.randomUUID()}.${ext}`;
        if (demo) await blobStore(newPath, file);
        else {
          const { error } = await supabase.storage
            .from("learning-materials")
            .upload(newPath, file, { contentType: mime, upsert: false });
          if (error) throw error;
        }
        payload = {
          ...payload,
          object_path: newPath,
          file_name: file.name,
          file_size: file.size,
          mime_type: mime,
        };
      }
      if (payload.source_type === "upload" && !file && !previous?.object_path)
        throw Error("请先选择要上传的文件");
      if (payload.source_type !== "upload")
        payload = {
          ...payload,
          object_path: null,
          file_name: null,
          file_size: null,
          mime_type: null,
        };
      const result = await save("learning_items", payload);
      if (
        previous?.object_path &&
        previous.object_path !== result.object_path
      ) {
        if (demo) await blobStore(previous.object_path, null);
        else
          await supabase.storage
            .from("learning-materials")
            .remove([previous.object_path]);
      }
      return result;
    } catch (e) {
      if (newPath) {
        if (demo) await blobStore(newPath, null);
        else
          await supabase.storage.from("learning-materials").remove([newPath]);
      }
      await refresh();
      throw e;
    }
  }
  async function removeItem(row) {
    if (!manages(user, row.institution_id)) throw Error("没有删除权限");
    await save("learning_items", { id: row.id, status: "draft" });
    if (row.object_path) {
      if (demo) await blobStore(row.object_path, null);
      else {
        const { error } = await supabase.storage
          .from("learning-materials")
          .remove([row.object_path]);
        if (error) throw error;
      }
    }
    if (demo) {
      const all = readLocal();
      all.learning_items = all.learning_items.filter((r) => r.id !== row.id);
      localStorage.setItem(STORE, JSON.stringify(all));
    } else {
      const { error } = await supabase
        .from("learning_items")
        .delete()
        .eq("id", row.id);
      if (error) throw error;
    }
    await refresh();
  }
  async function assetUrl(row) {
    if (row.source_type === "link") {
      if (!/^https:\/\//i.test(row.url)) throw Error("链接无效");
      return row.url;
    }
    if (!row.object_path) throw Error("文件尚未上传");
    if (demo) {
      const blob = await blobStore(row.object_path);
      if (!blob) throw Error("本地演示文件不存在，请重新上传");
      return URL.createObjectURL(blob);
    }
    const { data: r, error } = await supabase.storage
      .from("learning-materials")
      .createSignedUrl(row.object_path, 3600);
    if (error) throw error;
    return r.signedUrl;
  }
  async function register(c) {
    if (user?.role !== "student") throw Error("请使用学生账号报名");
    if (
      Date.now() >= +new Date(c.registration_deadline) ||
      c.status !== "published"
    )
      throw Error("报名已截止或活动未开放");
    if (demo) {
      const all = readLocal();
      if (
        all.competition_entries.some(
          (e) => e.competition_id === c.id && e.student_id === user.id,
        )
      )
        throw Error("你已报名");
      all.competition_entries.push({
        id: crypto.randomUUID(),
        competition_id: c.id,
        student_id: user.id,
        created_at: new Date().toISOString(),
      });
      localStorage.setItem(STORE, JSON.stringify(all));
    } else {
      const { error } = await supabase
        .from("competition_entries")
        .insert({ competition_id: c.id, student_id: user.id });
      if (error) throw error;
    }
    await refresh();
  }
  async function submit(problem, code, language) {
    if (user?.role !== "student") throw Error("请使用学生账号提交");
    if (!code.trim() || code.length > 100000)
      throw Error("代码需为1–100000字符");
    if (!["C++17", "Python 3", "Java 17"].includes(language))
      throw Error("编程语言无效");
    if (demo) {
      const all = readLocal(),
        c = all.competitions.find((c) => c.id === problem.competition_id);
      if (
        !c ||
        c.status !== "published" ||
        Date.now() < +new Date(c.starts_at) ||
        Date.now() >= +new Date(c.ends_at) ||
        !all.competition_entries.some(
          (e) => e.competition_id === c.id && e.student_id === user.id,
        )
      )
        throw Error("仅已报名学生可在竞赛时间内提交");
      all.competition_submissions.push({
        id: crypto.randomUUID(),
        problem_id: problem.id,
        student_id: user.id,
        code,
        language,
        status: "pending",
        score: null,
        submitted_at: new Date().toISOString(),
      });
      localStorage.setItem(STORE, JSON.stringify(all));
    } else {
      const { error } = await supabase.from("competition_submissions").insert({
        problem_id: problem.id,
        student_id: user.id,
        code,
        language,
      });
      if (error) throw error;
    }
    await refresh();
  }
  async function submissionCode(s) {
    if (demo) return s.code;
    const { data: r, error } = await supabase
      .from("competition_submissions")
      .select("code")
      .eq("id", s.id)
      .single();
    if (error) throw error;
    return r.code;
  }
  async function grade(s, score, feedback) {
    const p = data.competition_problems.find((p) => p.id === s.problem_id),
      c = data.competitions.find((c) => c.id === p?.competition_id);
    if (
      !c ||
      !manages(user, c.institution_id) ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > p.max_score ||
      !feedback.trim()
    )
      throw Error("请填写有效分数和评语，并核查管理权限");
    if (demo) {
      const all = readLocal();
      all.competition_submissions = all.competition_submissions.map((r) =>
        r.id === s.id ? { ...r, score, feedback, status: "graded" } : r,
      );
      localStorage.setItem(STORE, JSON.stringify(all));
    } else {
      const { error } = await supabase
        .from("competition_submissions")
        .update({ score, feedback, status: "graded" })
        .eq("id", s.id);
      if (error) throw error;
    }
    await refresh();
  }
  async function clone(c) {
    const next = nextPeriod(c),
      { id, created_at, created_by, ...payload } = next;
    const row = await save("competitions", payload);
    const sourceProblems = data.competition_problems
      .filter((p) => p.competition_id === c.id)
      .map((p) => {
        const { id, created_at, created_by, ...fields } = p;
        return { ...fields, competition_id: row.id };
      });
    if (demo) {
      for (const fields of sourceProblems)
        await save("competition_problems", fields);
    } else if (sourceProblems.length) {
      const { error } = await supabase
        .from("competition_problems")
        .insert(sourceProblems);
      if (error) throw error;
      await refresh();
    }
    return row;
  }
  return {
    ...data,
    loading,
    error,
    refresh,
    save,
    saveItem,
    assetUrl,
    removeItem,
    register,
    submit,
    grade,
    submissionCode,
    clone,
  };
}
