import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Cadastro {
  id: string;
  status: 'incompleto' | 'enviado' | 'erro_envio';
  created_by: string;
  team_id: string | null;
  cpf: string;
  nome: string | null;
  data_nascimento: string | null;
  sexo: string | null;
  sexo_codigo: number | null;
  nome_mae: string | null;
  contatos: unknown;
  endereco: unknown;
  lemit_raw: unknown;
  cliente_sera_usuario: boolean;
  payload_erp: unknown;
  erp_response: unknown;
  motivo_bloqueio: string | null;
  erp_dados_associado: unknown;
  empresa_id: number | null;
  empresa_nome: string | null;
  empresa_cnpj: string | null;
  empresa_raw: unknown;
  empresa_exige_matricula: number | null;
  numero_matricula: string | null;
  planos_raw: unknown;
  dependentes: unknown;
  contatos_responsavel_financeiro: unknown;
  vendedor_id: string | null;
  vendedor_codigo: string | null;
  created_at: string;
  updated_at: string;
}

export function useCadastros() {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const fetchCadastros = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cadastros')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      setCadastros(data || []);
    } catch (error) {
      console.error('Error fetching cadastros:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCadastros();
  }, []);

  const checkERPAssociado = async (cpf: string) => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-check-associado`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cpf }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao verificar CPF no ERP');
    }

    return response.json();
  };

  const consultarCPF = async (cpf: string) => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lemit-consulta-pessoa`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cpf }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao consultar CPF');
    }

    return response.json();
  };

  const consultarEnderecoCEP = async (cep: string) => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-endereco-cep`;

    console.log('[CEP] Iniciando busca de CEP:', cep);
    console.log('[CEP] URL da API:', apiUrl);

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cep }),
      });

      console.log('[CEP] Status da resposta:', response.status);
      console.log('[CEP] Headers da resposta:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CEP] Erro na resposta:', errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        throw new Error(errorData.error || `Erro ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[CEP] ✅ Dados recebidos com sucesso:');
      console.log('[CEP] - Response completo:', JSON.stringify(data, null, 2));
      console.log('[CEP] - Estrutura:', Object.keys(data));
      if (data.dados) {
        console.log('[CEP] - Campos em dados:', Object.keys(data.dados));
        console.log('[CEP] - Valores:', data.dados);
      }

      return data;
    } catch (error) {
      console.error('[CEP] ❌ Erro ao consultar CEP:', error);
      console.error('[CEP] Detalhes do erro:', error);
      throw error;
    }
  };

  const searchEmpresa = async (searchValue: string, searchType: 'cnpj' | 'nome' | 'id' = 'cnpj') => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-search-empresa`;

    const body: Record<string, string> = {};

    if (searchType === 'cnpj') {
      body.cnpj = searchValue;
    } else if (searchType === 'nome') {
      body.nome = searchValue;
    } else if (searchType === 'id') {
      body.empresaId = searchValue;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Erro ao buscar empresa');
    }

    return response.json();
  };

  const createOrUpdateRascunho = async (data: Partial<Cadastro>) => {
    if (!profile?.id) throw new Error('User not authenticated');

    const existing = cadastros.find(
      (c) => c.cpf === data.cpf && c.status === 'incompleto' && c.created_by === profile.id
    );

    if (existing) {
      const { data: updated, error } = await supabase
        .from('cadastros')
        .update(data)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;

      await fetchCadastros();
      return updated;
    } else {
      const { data: created, error } = await supabase
        .from('cadastros')
        .insert({
          ...data,
          created_by: profile.id,
          team_id: profile.team_id,
          status: 'incompleto',
        })
        .select()
        .single();

      if (error) throw error;

      await fetchCadastros();
      return created;
    }
  };

  const updateCadastro = async (id: string, data: Partial<Cadastro>) => {
    const { data: updated, error } = await supabase
      .from('cadastros')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await fetchCadastros();
    return updated;
  };

  const enviarParaERP = async (id: string, payload: Record<string, unknown>) => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-novo-usuario2`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        await updateCadastro(id, {
          status: 'erro_envio',
          payload_erp: payload,
          erp_response: result,
        });
        throw new Error(result.error || 'Erro ao enviar para o ERP');
      }

      await updateCadastro(id, {
        status: 'enviado',
        payload_erp: payload,
        erp_response: result,
      });

      return result;
    } catch (error) {
      console.error('Error sending to ERP:', error);
      throw error;
    }
  };

  const deleteCadastro = async (id: string) => {
    const { error } = await supabase.from('cadastros').delete().eq('id', id);

    if (error) throw error;

    await fetchCadastros();
  };

  const canDelete = profile?.role === 'ADMINISTRADOR';

  return {
    cadastros,
    loading,
    canDelete,
    checkERPAssociado,
    consultarCPF,
    consultarEnderecoCEP,
    searchEmpresa,
    createOrUpdateRascunho,
    updateCadastro,
    enviarParaERP,
    deleteCadastro,
    refresh: fetchCadastros,
  };
}
