import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
Deno.serve(async (req) => {
  const origin = Deno.env.get("ALLOWED_ORIGIN");
  const headers = {
    "Access-Control-Allow-Origin": origin || "",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Content-Type": "application/json",
    Vary: "Origin",
  };
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (!origin || req.headers.get("origin") !== origin)
    return reply({ error: "来源不允许" }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, {
      headers: { ...headers, "Access-Control-Allow-Methods": "POST, OPTIONS" },
    });
  if (req.method !== "POST") return reply({ error: "仅支持 POST" }, 405);
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).length > 50000)
      return reply({ error: "请求过大" }, 413);
    const input = JSON.parse(raw);
    const url = Deno.env.get("SUPABASE_URL")!;
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: {
        headers: { Authorization: req.headers.get("Authorization") || "" },
      },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    if (authError || !user) return reply({ error: "请先登录" }, 401);
    const service = createClient(
      url,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: actor } = await service
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (
      !actor?.is_active ||
      actor.must_change_password ||
      !["platform_admin", "org_admin"].includes(actor.role)
    )
      return reply({ error: "没有管理权限" }, 403);
    const platform = actor.role === "platform_admin";
    if (!platform) {
      const { data: i } = await service
        .from("institutions")
        .select("is_active")
        .eq("id", actor.institution_id)
        .single();
      if (!i?.is_active) return reply({ error: "机构已停用" }, 403);
    }
    if (input.action === "create_institution") {
      if (!platform) return reply({ error: "仅平台管理员可创建机构" }, 403);
      const name = String(input.name || "").trim(),
        code = String(input.code || "")
          .trim()
          .toLowerCase();
      if (!name || name.length > 80 || !/^[a-z0-9][a-z0-9_-]{2,19}$/.test(code))
        return reply({ error: "机构名称或代码无效" }, 400);
      const { data, error } = await service
        .from("institutions")
        .insert({ name, code })
        .select()
        .single();
      if (error) throw error;
      await service.from("account_audit").insert({
        actor_id: user.id,
        institution_id: data.id,
        action: "create_institution",
      });
      return reply({ institution: data });
    }
    const institutionId = platform
      ? input.institution_id
      : actor.institution_id;
    if (!institutionId || (!platform && input.institution_id !== institutionId))
      return reply({ error: "机构范围无效" }, 403);
    const { data: org } = await service
      .from("institutions")
      .select("*")
      .eq("id", institutionId)
      .single();
    if (!org?.is_active) return reply({ error: "机构不存在或已停用" }, 400);
    if (input.action === "create_accounts") {
      if (
        !Array.isArray(input.accounts) ||
        input.accounts.length < 1 ||
        input.accounts.length > 20
      )
        return reply({ error: "每批 1–20 个账号" }, 400);
      const seen = new Set();
      for (const a of input.accounts) {
        if (
          !/^[a-z0-9][a-z0-9_-]{2,31}$/.test(a.username) ||
          typeof a.display_name !== "string" ||
          !a.display_name.trim() ||
          a.display_name.length > 60 ||
          !(
            platform
              ? ["student", "teacher", "org_admin"]
              : ["student", "teacher"]
          ).includes(a.role) ||
          seen.has(a.username)
        )
          return reply({ error: "用户名、姓名、角色或重复账号有误" }, 400);
        seen.add(a.username);
      }
      const results = [];
      for (const a of input.accounts) {
        const bytes = crypto.getRandomValues(new Uint8Array(24));
        const password = Array.from(
          bytes,
          (n) =>
            "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@"[
              n % 59
            ],
        ).join("");
        const email = `${a.username}.${org.code}@users.flowspark.invalid`;
        const { data, error } = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: a.display_name.trim() },
        });
        if (error) {
          results.push({
            username: a.username,
            error: "创建失败：用户名可能已存在，请到认证后台核查",
          });
          continue;
        }
        const { error: pError } = await service
          .from("profiles")
          .update({
            display_name: a.display_name.trim(),
            username: a.username,
            institution_id: org.id,
            role: a.role,
            is_active: true,
            must_change_password: true,
          })
          .eq("id", data.user.id);
        if (pError) {
          await service.auth.admin.deleteUser(data.user.id);
          results.push({
            username: a.username,
            error: "资料写入失败，请联系平台管理员",
          });
          continue;
        }
        await service.from("account_audit").insert({
          actor_id: user.id,
          institution_id: org.id,
          target_id: data.user.id,
          action: "create_account",
        });
        results.push({
          username: a.username,
          display_name: a.display_name.trim(),
          role: a.role,
          institution_code: org.code,
          password,
        });
      }
      return reply({ results });
    }
    if (input.action === "set_active") {
      const { data: target } = await service
        .from("profiles")
        .select("*")
        .eq("id", input.target_id)
        .single();
      if (
        !target ||
        target.institution_id !== org.id ||
        target.id === user.id ||
        target.role === "platform_admin" ||
        (!platform && !["teacher", "student"].includes(target.role)) ||
        typeof input.is_active !== "boolean"
      )
        return reply({ error: "目标账号不在可管理范围内" }, 403);
      const { error } = await service
        .from("profiles")
        .update({ is_active: input.is_active })
        .eq("id", target.id);
      if (error) throw error;
      await service.from("account_audit").insert({
        actor_id: user.id,
        institution_id: org.id,
        target_id: target.id,
        action: input.is_active ? "activate_account" : "disable_account",
      });
      return reply({ ok: true });
    }
    return reply({ error: "未知操作" }, 400);
  } catch {
    return reply({ error: "操作失败，请检查配置或联系平台管理员" }, 400);
  }
});
