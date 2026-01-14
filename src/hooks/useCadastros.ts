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
  vendedor_nome: string | null;
  adesionista_id: string | null;
  adesionista_codigo: string | null;
  adesionista_nome: string | null;
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

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
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

  const findClienteByCPF = async (cpf: string) => {
    try {
      const { data, error } = await supabase
        .from('cadastros')
        .select('*')
        .eq('cpf', cpf)
        .not('erp_dados_associado', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) return null;

      const erpDados = data.erp_dados_associado as any;
      if (!erpDados || !erpDados.dados || erpDados.dados.length === 0) {
        return null;
      }

      let maisRecente = null;
      let dataMaisRecente: Date | null = null;

      for (const associado of erpDados.dados) {
        if (!associado.dependentes || associado.dependentes.length === 0) {
          continue;
        }

        for (const dependente of associado.dependentes) {
          const dataSituacao = dependente.dataSituacao
            ? new Date(dependente.dataSituacao)
            : null;

          if (dataSituacao && (!dataMaisRecente || dataSituacao > dataMaisRecente)) {
            dataMaisRecente = dataSituacao;
            maisRecente = {
              nome: associado.nome || data.nome,
              nomeMae: data.nome_mae,
              dataNascimento: dependente.dataNascimento || data.data_nascimento,
              sexo: data.sexo,
              sexoCodigo: data.sexo_codigo,
              contatos: data.contatos,
              endereco: data.endereco,
              empresa_id: associado.codigoDaEmpresa,
              empresa_nome: associado.nomeFantasiaDaEmpresa,
              codigoAssociado: associado.codigo,
              codigoPlano: dependente.codigoPlano,
              codigoSituacao: dependente.codigoSituacao,
              nomeSituacao: dependente.nomeSituacao,
              dataSituacao: dependente.dataSituacao,
            };
          }
        }
      }

      if (!maisRecente && erpDados.dados[0]) {
        const primeiroAssociado = erpDados.dados[0];
        const primeiroDependente = primeiroAssociado.dependentes?.[0];

        maisRecente = {
          nome: primeiroAssociado.nome || data.nome,
          nomeMae: data.nome_mae,
          dataNascimento: primeiroDependente?.dataNascimento || data.data_nascimento,
          sexo: data.sexo,
          sexoCodigo: data.sexo_codigo,
          contatos: data.contatos,
          endereco: data.endereco,
          empresa_id: primeiroAssociado.codigoDaEmpresa,
          empresa_nome: primeiroAssociado.nomeFantasiaDaEmpresa,
          codigoAssociado: primeiroAssociado.codigo,
          codigoPlano: primeiroDependente?.codigoPlano,
          codigoSituacao: primeiroDependente?.codigoSituacao,
          nomeSituacao: primeiroDependente?.nomeSituacao,
          dataSituacao: primeiroDependente?.dataSituacao,
        };
      }

      return maisRecente;
    } catch (error) {
      console.error('Error finding client by CPF:', error);
      return null;
    }
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
    console.log('[useCadastros] updateCadastro chamado com:', { id, data });
    console.log('[useCadastros] Dependentes sendo salvos:', data.dependentes);

    const { data: updated, error } = await supabase
      .from('cadastros')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[useCadastros] Erro ao atualizar:', error);
      throw error;
    }

    console.log('[useCadastros] Cadastro atualizado com sucesso:', updated);
    console.log('[useCadastros] Dependentes salvos no banco:', updated.dependentes);

    await fetchCadastros();
    return updated;
  };

  const enviarParaERP = async (id: string, payload: Record<string, unknown>) => {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-novo-usuario2`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        let mensagemErro = result.error || 'Erro ao enviar para o ERP';

        if (result.details?.mensagem) {
          mensagemErro = `${mensagemErro} (${result.details.mensagem.trim()})`;
        }

        await updateCadastro(id, {
          status: 'erro_envio',
          payload_erp: payload,
          erp_response: result,
        });
        throw new Error(mensagemErro);
      }

      if (result.data?.dados === null || result.data?.dados === undefined) {
        let mensagemErro = 'Erro ao cadastrar: dados inválidos retornados pelo ERP';

        if (result.data?.mensagem) {
          mensagemErro = `${mensagemErro} (${result.data.mensagem.trim()})`;
        }

        await updateCadastro(id, {
          status: 'erro_envio',
          payload_erp: payload,
          erp_response: result,
        });
        throw new Error(mensagemErro);
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
    findClienteByCPF,
    createOrUpdateRascunho,
    updateCadastro,
    enviarParaERP,
    deleteCadastro,
    refresh: fetchCadastros,
  };
}
