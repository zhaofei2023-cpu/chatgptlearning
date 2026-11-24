import { createClient } from "npm:@supabase/supabase-js@2";
import {
  validateRequest,
  buildEvidence,
  systemPrompt,
} from "./report-core.mjs";
Deno.serve(async (req: Request) => {
  const origin = Deno.env.get("ALLOWED_ORIGIN") || "";
  const headers = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  const reply = (x: unknown, status = 200) =>
    new Response(JSON.stringify(x), { status, headers });
  if (!origin) return reply({ error: "请先配置ALLOWED_ORIGIN" }, 503);
  if (req.headers.get("Origin") !== origin)
    return reply({ error: "来源不允许" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "仅支持POST" }, 405);
  const token = req.headers.get("Authorization");
  if (!token) return reply({ error: "请先登录" }, 401);
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: token } },
      auth: { persistSession: false },
    },
  );
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return reply({ error: "登录已失效" }, 401);
  const { data: role, error: roleError } = await client.rpc("session_role");
  if (roleError || !["platform_admin", "org_admin"].includes(role))
    return reply({ error: "仅有效管理员可使用学情分析" }, 403);
  if (Deno.env.get("AI_ENABLED") !== "true" || !Deno.env.get("OPENAI_API_KEY"))
    return reply(
      {
        error:
          "AI尚未启用。请在Supabase服务端配置OPENAI_API_KEY和AI_ENABLED，再部署study-report函数。ChatGPT会员不等于API余额。",
      },
      503,
    );
  let body;
  try {
    const raw = await req.text();
    if (raw.length > 65000) return reply({ error: "请求内容过大" }, 413);
    body = validateRequest(JSON.parse(raw));
  } catch (e) {
    return reply({ error: e instanceof Error ? e.message : "请求无效" }, 400);
  }
  try {
    const { data: student, error: studentError } = await client
      .from("profiles")
      .select("id,role,institution_id")
      .eq("id", body.student_id)
      .eq("role", "student")
      .single();
    if (studentError || !student?.institution_id)
      return reply({ error: "学生不存在或不在你的管理范围" }, 403);
    const now = new Date(),
      until = now.toISOString(),
      since = new Date(+now - body.days * 86400000).toISOString();
    async function read(
      table: string,
      columns: string,
      studentColumn?: string,
    ) {
      let query = client.from(table).select(columns);
      if (studentColumn)
        query = query
          .eq(studentColumn, student.id)
          .gte("submitted_at", since)
          .lte("submitted_at", until)
          .order("submitted_at", { ascending: false });
      else query = query.order("id");
      const out = [];
      for (let offset = 0; ; offset += 200) {
        const { data, error } = await query.range(offset, offset + 199);
        if (error) throw error;
        out.push(...data);
        if (data.length < 200) return out;
        if (out.length >= 5000)
          throw Error("本机构数据量超出单次分析上限，请缩小管理范围");
      }
    }
    const submissions = await read(
      "submissions",
      "id,assignment_id,code,language,status,score,feedback,submitted_at,attempt_count",
      "student_id",
    );
    const cs = await read(
      "competition_submissions",
      "id,problem_id,code,language,status,score,feedback,submitted_at,attempt_count",
      "student_id",
    );
    // Only request question content referenced by this student's current evidence.
    const aids = [...new Set(submissions.map((s) => s.assignment_id))],
      pids = [...new Set(cs.map((s) => s.problem_id))];
    async function related(table: string, columns: string, ids: string[]) {
      const out = [];
      for (let i = 0; i < ids.length; i += 100) {
        const { data, error } = await client
          .from(table)
          .select(columns)
          .in("id", ids.slice(i, i + 100));
        if (error) throw error;
        out.push(...data);
      }
      return out;
    }
    const assignments = await related(
        "assignments",
        "id,title,statement,input_format,output_format,tags",
        aids,
      ),
      problems = await related(
        "competition_problems",
        "id,title,statement,input_format,output_format,max_score,competition_id",
        pids,
      );
    const contests = await related("competitions", "id,title", [
      ...new Set(problems.map((p) => p.competition_id)),
    ]);
    const evidence = buildEvidence(
      assignments,
      submissions,
      problems,
      contests,
      cs,
      since,
      until,
    );
    const { error: quotaError } = await client.rpc(
      "consume_study_report_quota",
    );
    if (quotaError)
      return reply(
        {
          error:
            "今日AI分析与对话额度已用完（每管理员30次/日），或第四版数据库尚未升级。",
        },
        429,
      );
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("OPENAI_API_KEY")}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        max_tokens: body.action === "generate" ? 2600 : 1000,
        messages: [
          { role: "system", content: systemPrompt(evidence, body.action) },
          {
            role: "user",
            content: "管理员的报告结构与内容要求：" + body.instructions,
          },
          ...body.messages,
        ],
      }),
    });
    if (!response.ok)
      return reply(
        {
          error:
            "AI供应方暂不可用，请检查API余额和服务端配置后重试。本次请求已计入每日额度。",
        },
        502,
      );
    const json = await response.json();
    const answer = json.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim())
      return reply({ error: "AI返回为空，请重试" }, 502);
    let report = null;
    if (body.action === "generate") {
      const { data, error } = await client
        .from("study_reports")
        .insert({
          student_id: student.id,
          institution_id: student.institution_id,
          created_by: auth.user.id,
          period_days: body.days,
          instructions: body.instructions,
          conversation: body.messages,
          content: answer.slice(0, 40000),
          summary: evidence.summary,
        })
        .select("id,created_at")
        .single();
      if (error)
        return reply({
          answer,
          summary: evidence.summary,
          save_error: "报告已生成，但保存失败，请下载保存并核查数据库迁移。",
        });
      report = data;
    }
    return reply({ answer, summary: evidence.summary, report });
  } catch (e) {
    console.error("study-report failed", e instanceof Error ? e.name : "error");
    return reply(
      { error: "分析请求失败或超时，请检查数据库升级与函数配置后重试。" },
      502,
    );
  }
});
