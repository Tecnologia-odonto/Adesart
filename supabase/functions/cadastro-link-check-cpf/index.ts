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

const normalizeDigits = (value?: string | null) => (value || "").replace(/\D/g, "");

const hashToken = async (token: string) => {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const checkLocalBlockedCpf = async (
  supabase: ReturnType<typeof createClient>,
  cpf: string,
) => {
  const { data, error } = await supabase.rpc("check_public_link_blocked_cpf", {
    p_cpf: cpf,
  });

  if (error) {
    throw error;
  }

  return data as { blocked?: boolean; reason?: string | null; code?: string | null } | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido" }, 405);
  }

  try {
    const { token, cpf } = await req.json() as {
      token?: string;
      cpf?: string;
    };

    if (!token || typeof token !== "string") {
      return jsonResponse({ error: "Token obrigatorio" }, 400);
    }

    const normalizedCpf = normalizeDigits(cpf);
    if (normalizedCpf.length !== 11) {
      return jsonResponse({ error: "CPF invalido" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const tokenHash = await hashToken(token.trim());

    const { data: link, error: linkError } = await supabase
      .from("cadastro_links")
      .select("id, is_active")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (linkError) {
      console.error("[cadastro-link-check-cpf] link error:", linkError);
      return jsonResponse({ error: "Erro ao validar link" }, 500);
    }

    if (!link) {
      return jsonResponse({ error: "Link nao encontrado ou invalido" }, 404);
    }

    if (!link.is_active) {
      return jsonResponse({ error: "Link inativo" }, 410);
    }

    const { data: existingCadastro, error: existingCadastroError } = await supabase
      .from("cadastros")
      .select("id")
      .eq("origem_link_id", link.id)
      .eq("cpf", normalizedCpf)
      .eq("status", "enviado")
      .limit(1)
      .maybeSingle();

    if (existingCadastroError) {
      console.error("[cadastro-link-check-cpf] existing cadastro error:", existingCadastroError);
      return jsonResponse({ error: "Erro ao verificar uso anterior do CPF" }, 500);
    }

    if (existingCadastro) {
      return jsonResponse({
        error: "Este CPF ja concluiu uma adesao por este link e nao pode reutiliza-lo.",
        code: "CPF_ALREADY_USED_ON_LINK",
      }, 409);
    }

    const localBlockedCpf = await checkLocalBlockedCpf(supabase, normalizedCpf);
    if (localBlockedCpf?.blocked) {
      return jsonResponse({
        error: localBlockedCpf.reason || "Este CPF nao pode utilizar este link.",
        code: localBlockedCpf.code || "CPF_BLOCKED_LOCALLY",
      }, 409);
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    console.error("[cadastro-link-check-cpf] unexpected error:", error);
    const message = error instanceof Error ? error.message : "Erro inesperado";
    return jsonResponse({ error: message }, 500);
  }
});
