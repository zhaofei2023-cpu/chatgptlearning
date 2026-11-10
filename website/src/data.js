import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const aiEnabled = import.meta.env.VITE_AI_ENABLED === "true";
export const cloud = Boolean(url && key);
export const supabase = cloud ? createClient(url, key) : null;
const iso = (days) => new Date(Date.now() + days * 86400000).toISOString();
export const initial = () => ({
  institutions: [
    { id: "org-demo", name: "玛酷机器人（迎新校区） · 演示", code: "mkyx" },
  ],
  profiles: [],
  classes: [
    {
      id: "class-demo",
      name: "算法探索 · 入门班",
      teacher_id: "teacher-demo",
      join_code: "SPARK2026",
    },
  ],
  assignments: [
    {
      id: "prefix-sum",
      title: "区间里的秘密",
      level: "入门",
      tags: ["前缀和", "数组"],
      class_id: "class-demo",
      teacher_id: "teacher-demo",
      status: "published",
      due_at: iso(7),
      statement:
        "给定一个长度为 n 的整数数组与 q 次询问。每次询问给出 l、r，请输出数组中第 l 到第 r 个数之和（下标从 1 开始）。\n1 ≤ n, q ≤ 100000，|aᵢ| ≤ 10⁹。请注意整数范围与输入效率。",
      input_format:
        "第一行输入 n、q。第二行输入 n 个整数。接下来 q 行，每行输入 l、r。",
      output_format: "对每次询问，输出一行区间和。",
      sample_input: "5 3\n1 2 3 4 5\n1 3\n2 5\n4 4",
      sample_output: "6\n14\n4",
    },
    {
      id: "binary-search",
      title: "在有序世界中寻找",
      level: "进阶",
      tags: ["二分查找", "边界"],
      class_id: "class-demo",
      teacher_id: "teacher-demo",
      status: "published",
      due_at: iso(10),
      statement:
        "给定升序数组和目标值 x，输出第一个大于等于 x 的元素下标（从 0 开始）。若不存在，输出 n。\n1 ≤ n ≤ 200000，元素与 x 均在有符号32位整数范围内。",
      input_format: "第一行输入 n 和 x。第二行输入 n 个升序整数。",
      output_format: "输出满足条件的最小下标；不存在则输出 n。",
      sample_input: "5 4\n1 3 4 4 9",
      sample_output: "2",
    },
    {
      id: "bfs",
      title: "走出迷宫的第一束光",
      level: "挑战",
      tags: ["BFS", "图论"],
      class_id: "class-demo",
      teacher_id: "teacher-demo",
      status: "published",
      due_at: iso(14),
      statement:
        "在 n×m 的网格中，从左上角走到右下角。0 表示通路，1 表示障碍。每一步可以向上下左右移动一格，求最少步数，不可达输出 -1。起点、终点均为通路。\n1 ≤ n,m ≤ 1000。",
      input_format: "第一行输入 n m。随后 n 行，每行 m 个由空格分隔的 0 或 1。",
      output_format: "输出最少移动步数，不可达输出 -1。",
      sample_input: "3 3\n0 0 0\n1 1 0\n0 0 0",
      sample_output: "4",
    },
  ],
  submissions: [],
  resources: [
    {
      id: "mit",
      title: "Introduction to Algorithms",
      school: "MIT OpenCourseWare",
      kind: "视频",
      level: "进阶",
      description:
        "从算法设计到复杂度分析，建立解决问题的方法。英语公开课，含讲义与视频入口。",
      url: "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-fall-2011/",
      tags: ["算法设计", "公开课"],
      color: "mint",
    },
    {
      id: "harvard",
      title: "CS50 · 计算机科学导论",
      school: "Harvard University",
      kind: "视频",
      level: "入门",
      description:
        "从第一行代码出发，理解计算机科学与程序设计。英语课程，访问官方课程页。",
      url: "https://cs50.harvard.edu/x/",
      tags: ["计算思维", "C语言"],
      color: "violet",
    },
    {
      id: "stanford",
      title: "Programming Abstractions",
      school: "Stanford University",
      kind: "课件",
      level: "进阶",
      description:
        "递归、抽象与数据结构。查看官方课程材料，部分资源可能有访问限制。",
      url: "https://cs106b.stanford.edu/",
      tags: ["C++", "数据结构"],
      color: "blue",
    },
    {
      id: "oiwiki",
      title: "OI Wiki · 信息学知识地图",
      school: "开源竞赛学习资源",
      kind: "课件",
      level: "入门",
      description: "中文信息学竞赛知识库，系统梳理算法、数据结构与学习路径。",
      url: "https://oi-wiki.org/",
      tags: ["中文", "竞赛体系"],
      color: "orange",
    },
  ],
});
const STORE = "flowspark-demo-v1";
export function readDemo() {
  try {
    const x = JSON.parse(localStorage.getItem(STORE));
    return x?.assignments && x?.classes ? { ...initial(), ...x } : initial();
  } catch {
    return initial();
  }
}
export function writeDemo(data) {
  localStorage.setItem(STORE, JSON.stringify(data));
}
export function safeUrl(u) {
  try {
    const x = new URL(u);
    return ["https:", "http:"].includes(x.protocol) ? x.href : null;
  } catch {
    return null;
  }
}
export function starter(lang) {
  return lang === "Python 3"
    ? 'import sys\n\ndef solve():\n    # 从理解输入与边界开始\n    pass\n\nif __name__ == "__main__":\n    solve()\n'
    : lang === "Java 17"
      ? "import java.io.*;\nimport java.util.*;\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        // 在这里开始你的探索\n    }\n}\n"
      : "#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    // 在这里开始你的探索\n    return 0;\n}\n";
}
export async function fetchCloud() {
  const tables = [
    "classes",
    "assignments",
    "submissions",
    "resources",
    "institutions",
    "profiles",
  ];
  const rows = await Promise.all(
    tables.map(async (table) => {
      const records = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .order("id")
          .range(offset, offset + 499);
        if (error) throw error;
        records.push(...data);
        if (data.length < 500) break;
      }
      return records;
    }),
  );
  return Object.fromEntries(tables.map((t, i) => [t, rows[i]]));
}
export function offlineHint(question, assignment) {
  const s = question.toLowerCase();
  if (/边界|越界|index/.test(s))
    return "先用最小输入手动走一遍，再检查空区间、首尾下标与数组长度。建议把每次读写的下标写在纸上，找出第一个不符合定义的位置。你在哪个输入上遇到了问题？";
  if (/复杂度|超时|tle/.test(s))
    return "先估算“数据规模 × 每次操作次数”。如果 n 和 q 都很大，逐次遍历区间可能需要 O(nq)。想想哪些计算可以预处理并重复使用。你目前每次查询做了多少次操作？";
  if (assignment?.tags?.includes("前缀和"))
    return "试着定义 s[i] 为前 i 个数的和。画出 [1,r] 和 [1,l−1]，看看两者相减后留下哪一段。再检查 l=1、负数及大整数这三个边界。你能先写出区间和的表达式吗？";
  if (assignment?.tags?.includes("二分查找"))
    return "先写清楚区间含义，例如 [lo,hi)。每轮更新后，仍然可能包含答案吗？用包含重复元素、目标小于最小值、目标大于最大值的数组验证边界。";
  if (assignment?.tags?.includes("BFS"))
    return "把每个可走的格子看作一个顶点，每次移动看作一条等长的边。用队列按层扩展，首次访问时记录距离并标记。还要处理起终点相同和不可达的情况。";
  return "把问题拆成输入、目标、约束和边界四部分。先用一个很小的例子手算，再描述你打算维护的数据。请贴出具体题目、你的思路或报错，我可以帮你定位下一步。";
}
