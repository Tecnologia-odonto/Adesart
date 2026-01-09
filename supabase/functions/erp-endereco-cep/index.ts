import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EnderecoERPResponse {
  dados: {
    IdTipoLogradouro: number;
    TipoLogradouro: string;
    Logradouro: string;
    IdBairro: number;
    Bairro: string;
    IdMunicipio: number;
    Municipio: string;
    IdUf: number;
    Uf: string;
    CodigoMunicipioIBGE: string;
  };
}

const UF_MAP: Record<string, string> = {
  'ACRE': 'AC',
  'ALAGOAS': 'AL',
  'AMAPA': 'AP',
  'AMAZONAS': 'AM',
  'BAHIA': 'BA',
  'CEARA': 'CE',
  'DISTRITO FEDERAL': 'DF',
  'ESPIRITO SANTO': 'ES',
  'GOIAS': 'GO',
  'MARANHAO': 'MA',
  'MATO GROSSO': 'MT',
  'MATO GROSSO DO SUL': 'MS',
  'MINAS GERAIS': 'MG',
  'PARA': 'PA',
  'PARAIBA': 'PB',
  'PARANA': 'PR',
  'PERNAMBUCO': 'PE',
  'PIAUI': 'PI',
  'RIO DE JANEIRO': 'RJ',
  'RIO GRANDE DO NORTE': 'RN',
  'RIO GRANDE DO SUL': 'RS',
  'RONDONIA': 'RO',
  'RORAIMA': 'RR',
  'SANTA CATARINA': 'SC',
  'SAO PAULO': 'SP',
  'SERGIPE': 'SE',
  'TOCANTINS': 'TO',
};

Deno.serve(async (req: Request) => {
  console.log('[erp-endereco-cep] Request received:', req.method, req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    console.error('[erp-endereco-cep] Method not allowed:', req.method);
    return new Response(
      JSON.stringify({ error: `Method ${req.method} not allowed. Use POST.` }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  try {
    const ERP_TOKEN = Deno.env.get("ERP_TOKEN");

    if (!ERP_TOKEN) {
      throw new Error("ERP_TOKEN not configured");
    }

    const bodyText = await req.text();
    console.log('[erp-endereco-cep] Request body:', bodyText);

    let requestData;
    try {
      requestData = JSON.parse(bodyText);
    } catch (e) {
      console.error('[erp-endereco-cep] Invalid JSON:', e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { cep } = requestData;
    console.log('[erp-endereco-cep] CEP received:', cep);

    if (!cep) {
      return new Response(
        JSON.stringify({ error: "CEP é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const cepLimpo = cep.replace(/\D/g, "");

    if (cepLimpo.length !== 8) {
      return new Response(
        JSON.stringify({ error: "CEP deve conter 8 dígitos" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const erpUrl = `https://odontoart.s4e.com.br/api/redeatendimento/Endereco?token=${ERP_TOKEN}&cep=${cepLimpo}`;

    console.log('[erp-endereco-cep] Calling ERP API:', erpUrl.replace(ERP_TOKEN, '***'));

    const erpResponse = await fetch(erpUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });

    console.log('[erp-endereco-cep] ERP response status:', erpResponse.status);

    if (!erpResponse.ok) {
      const errorText = await erpResponse.text();
      console.error("[erp-endereco-cep] ERP API error:", errorText);

      return new Response(
        JSON.stringify({
          error: "Erro ao consultar CEP no ERP",
          details: errorText,
        }),
        {
          status: erpResponse.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const responseText = await erpResponse.text();
    console.log('[erp-endereco-cep] ERP raw response:', responseText);

    let responseData: EnderecoERPResponse;
    try {
      responseData = JSON.parse(responseText);
      console.log('[erp-endereco-cep] Parsed response data:', JSON.stringify(responseData, null, 2));
    } catch (parseError) {
      console.error('[erp-endereco-cep] Failed to parse ERP response:', parseError);
      console.error('[erp-endereco-cep] Response was:', responseText);
      return new Response(
        JSON.stringify({
          error: "Resposta do ERP não está em formato JSON válido",
          details: responseText.substring(0, 500),
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('[erp-endereco-cep] responseData.dados exists?', !!responseData.dados);
    console.log('[erp-endereco-cep] responseData structure:', Object.keys(responseData));

    if (!responseData.dados) {
      return new Response(
        JSON.stringify({
          error: "CEP não encontrado no ERP",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const ufNormalizado = responseData.dados.Uf.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const ufSigla = UF_MAP[ufNormalizado] || responseData.dados.Uf.substring(0, 2).toUpperCase();

    console.log('[erp-endereco-cep] Success! Returning data for CEP:', cepLimpo);

    return new Response(
      JSON.stringify({
        ok: true,
        dados: {
          ...responseData.dados,
          UfSigla: ufSigla,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[erp-endereco-cep] Error in erp-endereco-cep:", error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno do servidor",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
