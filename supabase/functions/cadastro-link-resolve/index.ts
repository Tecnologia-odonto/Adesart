import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido" }, 405);
  }

  try {
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return jsonResponse({ error: "Token obrigatorio" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const tokenHash = await hashToken(token.trim());

    const { data: link, error } = await supabase
      .from("cadastro_links")
      .select(`
        id,
        empresa_codigo,
        empresa_nome,
        empresa_cnpj,
        empresa_raw,
        empresa_exige_matricula,
        planos_raw,
        vendedor_codigo,
        vendedor_nome,
        is_active,
        click_count
      `)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) {
      console.error("[cadastro-link-resolve] error:", error);
      return jsonResponse({ error: "Erro ao resolver link" }, 500);
    }

    if (!link) {
      return jsonResponse({ error: "Link nao encontrado ou invalido" }, 404);
    }

    if (!link.is_active) {
      return jsonResponse({ error: "Link inativo" }, 410);
    }

    const { error: metricsError } = await supabase
      .from("cadastro_links")
      .update({
        click_count: Number(link.click_count || 0) + 1,
        last_clicked_at: new Date().toISOString(),
      })
      .eq("id", link.id);

    if (metricsError) {
      console.error("[cadastro-link-resolve] metrics error:", metricsError);
    }

    return jsonResponse({
      ok: true,
      link: {
        id: link.id,
        empresaCodigo: link.empresa_codigo,
        empresaNome: link.empresa_nome,
        empresaCnpj: link.empresa_cnpj,
        empresaRaw: link.empresa_raw,
        empresaExigeMatricula: link.empresa_exige_matricula,
        planosRaw: link.planos_raw,
        vendedorCodigo: link.vendedor_codigo,
        vendedorNome: link.vendedor_nome,
      },
    });
  } catch (error) {
    console.error("[cadastro-link-resolve] unexpected error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse({ error: message }, 500);
  }
});
