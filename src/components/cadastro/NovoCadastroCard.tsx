import { useState, useEffect } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '../Input';
import { Button } from '../Button';
import { Select } from '../Select';
import { formatCPF, validateCPF, removeCPFMask } from '../../lib/cpf';
import { mapLemitToCadastro, CadastroFormData } from '../../lib/mappers';
import { useCadastros } from '../../hooks/useCadastros';
import { useConfigCadastro } from '../../contexts/ConfigCadastroContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ClientExistsModal } from './ClientExistsModal';
import { EmpresaSearchCard } from './EmpresaSearchCard';
import { LemmitErrorModal } from './LemmitErrorModal';

interface NovoCadastroCardProps {
  onSuccess: (cadastro: any, isBlocked?: boolean) => void;
}

interface ClientExistsData {
  cpf: string;
  nome: string;
  erpData: any;
}

interface LemmitError {
  message: string;
  details?: any;
  cpf: string;
  cadastroData: any;
  vendedorSelecionado: any;
}

interface Empresa {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  enderecoEmpresa: any;
  precoPlano: any[];
  exigeMatricula?: number;
  raw: any;
}

interface Vendedor {
  id: string;
  name: string;
  external_id: string;
}

interface Adesionista {
  id: string;
  name: string;
  external_id: string;
}

export function NovoCadastroCard({ onSuccess }: NovoCadastroCardProps) {
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientExists, setClientExists] = useState<ClientExistsData | null>(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState<string>('');
  const [adesionistas, setAdesionistas] = useState<Adesionista[]>([]);
  const [selectedAdesionista, setSelectedAdesionista] = useState<string>('');
  const [lemmitError, setLemmitError] = useState<LemmitError | null>(null);
  const { checkERPAssociado, consultarCPF, consultarEnderecoCEP, findClienteByCPF, createOrUpdateRascunho } = useCadastros();
  const { loadConfig } = useConfigCadastro();
  const { profile } = useAuth();

  useEffect(() => {
    const fetchVendedores = async () => {
      if (profile && (profile.role === 'CADASTRO' || profile.role === 'ADESIONISTA')) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, name, external_id, email')
            .eq('role', 'VENDEDOR')
            .eq('is_active', true)
            .not('external_id', 'is', null)
            .order('name');

          if (error) throw error;

          setVendedores(data || []);
        } catch (err) {
          console.error('Error fetching vendedores:', err);
        }
      }
    };

    fetchVendedores();
  }, [profile]);

  useEffect(() => {
    const fetchAdesionistas = async () => {
      if (profile && ['GESTOR', 'SUPERVISOR', 'VENDEDOR', 'CADASTRO'].includes(profile.role || '')) {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, name, external_id, email')
            .eq('role', 'ADESIONISTA')
            .eq('is_active', true)
            .not('external_id', 'is', null)
            .order('name');

          if (error) throw error;

          console.log('Adesionistas carregados:', data);
          setAdesionistas(data || []);
        } catch (err) {
          console.error('Error fetching adesionistas:', err);
        }
      }
    };

    fetchAdesionistas();
  }, [profile]);

  const needsVendedor = profile && (profile.role === 'CADASTRO' || profile.role === 'ADESIONISTA');

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
    setError('');
  };

  const handleConsultar = async () => {
    setError('');

    if (!validateCPF(cpf)) {
      setError('CPF inválido. Verifique os dígitos.');
      return;
    }

    if (needsVendedor && !selectedVendedor) {
      setError('Selecione um vendedor antes de consultar.');
      return;
    }

    setLoading(true);

    try {
      const cpfLimpo = removeCPFMask(cpf);

      const erpCheck = await checkERPAssociado(cpfLimpo);

      if (erpCheck.exists && erpCheck.shouldBlock) {
        setError(erpCheck.blockReason || 'Cliente já cadastrado no sistema');
        setLoading(false);
        return;
      }

      console.log('🔍 Buscando dados anteriores do cliente no banco...');
      const clienteAnterior = await findClienteByCPF(cpfLimpo);

      let cadastroData: any = {
        nome: '',
        dataNascimento: null,
        sexo: null,
        sexoCodigo: null,
        contatos: null,
        endereco: null,
      };
      let lemitData = null;

      const configAtual = await loadConfig();
      const lemitAtivo = configAtual?.ativar_lemmit ?? true;

      if (clienteAnterior) {
        console.log('✅ Cliente encontrado no banco. Usando dados anteriores:', clienteAnterior);

        cadastroData = {
          nome: clienteAnterior.nome || '',
          nomeMae: clienteAnterior.nomeMae || null,
          dataNascimento: clienteAnterior.dataNascimento || null,
          sexo: clienteAnterior.sexo || null,
          sexoCodigo: clienteAnterior.sexoCodigo || null,
          contatos: clienteAnterior.contatos || null,
          endereco: clienteAnterior.endereco || null,
        };

        const temCEP = !!(cadastroData.endereco?.cep);
        const temTelefones = !!(cadastroData.contatos && cadastroData.contatos.length > 0);

        console.log('📋 Dados do cadastro:', {
          temNome: !!cadastroData.nome,
          temNomeMae: !!cadastroData.nomeMae,
          temCEP,
          temTelefones,
          totalContatos: cadastroData.contatos?.length || 0,
        });

        if (!temCEP || !temTelefones) {
          console.log('⚠️ Falta CEP ou telefones. Consultando Lemmit para complementar dados...');

          if (lemitAtivo) {
            try {
              const { data: canUse } = await supabase.rpc('can_use_lemmit', {
                p_user_id: profile?.id,
              });

              if (canUse) {
                console.log('✅ Lemmit ATIVO - Consultando API para complementar dados');

                try {
                  lemitData = await consultarCPF(cpfLimpo);

                  if (!lemitData || Object.keys(lemitData).length === 0) {
                    throw new Error('Lemmit retornou dados vazios');
                  }

                  const lemitMapped = mapLemitToCadastro(lemitData, cpfLimpo);

                  await supabase.from('lemmit_consultas').insert({
                    user_id: profile?.id,
                    cpf: cpfLimpo,
                    success: true,
                    response_data: lemitData,
                  });

                  await supabase.rpc('increment_lemmit_counter', {
                    p_user_id: profile?.id,
                  });

                  if (!temCEP && lemitMapped.endereco) {
                    cadastroData.endereco = lemitMapped.endereco;
                  }
                  if (!temTelefones && lemitMapped.contatos) {
                    cadastroData.contatos = lemitMapped.contatos;
                  }
                  if (!cadastroData.nomeMae && lemitMapped.nomeMae) {
                    cadastroData.nomeMae = lemitMapped.nomeMae;
                  }

                  console.log('✅ Dados complementados com sucesso');
                } catch (lemitError) {
                  console.error('❌ Erro ao consultar Lemmit:', lemitError);

                  const errorMessage = lemitError instanceof Error ? lemitError.message : 'Erro desconhecido';

                  await supabase.from('lemmit_consultas').insert({
                    user_id: profile?.id,
                    cpf: cpfLimpo,
                    success: false,
                    error_message: errorMessage,
                  });

                  await supabase.rpc('increment_lemmit_counter', {
                    p_user_id: profile?.id,
                  });

                  setLemmitError({
                    message: errorMessage,
                    details: lemitError,
                    cpf: cpfLimpo,
                    cadastroData,
                    vendedorSelecionado: vendedores.find(v => v.id === selectedVendedor),
                  });

                  setLoading(false);
                  return;
                }
              } else {
                console.log('❌ Limite de consultas Lemmit atingido');
                setError('Limite de consultas Lemmit atingido para este mês');
                setLoading(false);
                return;
              }
            } catch (error) {
              console.error('Erro ao verificar limite Lemmit:', error);
            }
          } else {
            console.log('❌ Lemmit DESATIVADO - Dados podem estar incompletos');
          }
        }
      } else {
        console.log('❌ Cliente não encontrado no banco. Consultando APIs externas...');

        if (lemitAtivo) {
          try {
            const { data: canUse } = await supabase.rpc('can_use_lemmit', {
              p_user_id: profile?.id,
            });

            if (canUse) {
              console.log('✅ Lemmit ATIVO - Consultando API');

              try {
                lemitData = await consultarCPF(cpfLimpo);

                if (!lemitData || Object.keys(lemitData).length === 0) {
                  throw new Error('Lemmit retornou dados vazios');
                }

                cadastroData = mapLemitToCadastro(lemitData, cpfLimpo);

                await supabase.from('lemmit_consultas').insert({
                  user_id: profile?.id,
                  cpf: cpfLimpo,
                  success: true,
                  response_data: lemitData,
                });

                await supabase.rpc('increment_lemmit_counter', {
                  p_user_id: profile?.id,
                });
              } catch (lemitError) {
                console.error('❌ Erro ao consultar Lemmit:', lemitError);

                const errorMessage = lemitError instanceof Error ? lemitError.message : 'Erro desconhecido';

                await supabase.from('lemmit_consultas').insert({
                  user_id: profile?.id,
                  cpf: cpfLimpo,
                  success: false,
                  error_message: errorMessage,
                });

                await supabase.rpc('increment_lemmit_counter', {
                  p_user_id: profile?.id,
                });

                setLemmitError({
                  message: errorMessage,
                  details: lemitError,
                  cpf: cpfLimpo,
                  cadastroData,
                  vendedorSelecionado: vendedores.find(v => v.id === selectedVendedor),
                });

                setLoading(false);
                return;
              }
            } else {
              console.log('❌ Limite de consultas Lemmit atingido');
              setError('Limite de consultas Lemmit atingido para este mês');
              setLoading(false);
              return;
            }
          } catch (error) {
            console.error('Erro ao verificar limite Lemmit:', error);
          }
        } else {
          console.log('❌ Lemmit DESATIVADO - Pulando consulta');
        }
      }

      if (cadastroData.endereco?.cep) {
        try {
          const enderecoERP = await consultarEnderecoCEP(cadastroData.endereco.cep);
          if (enderecoERP.ok && enderecoERP.dados) {
            const dados = enderecoERP.dados;
            cadastroData.endereco = {
              ...cadastroData.endereco,
              ...(dados.IdTipoLogradouro && { idTipoLogradouro: dados.IdTipoLogradouro }),
              ...(dados.TipoLogradouro && { tipoLogradouro: dados.TipoLogradouro }),
              ...(dados.Logradouro && { logradouro: dados.Logradouro }),
              ...(dados.IdBairro && { idBairro: dados.IdBairro }),
              ...(dados.Bairro && { bairro: dados.Bairro }),
              ...(dados.IdMunicipio && { idMunicipio: dados.IdMunicipio }),
              ...(dados.Municipio && { cidade: dados.Municipio }),
              ...(dados.IdUf && { idUf: dados.IdUf }),
              ...(dados.Uf && { uf: dados.Uf }),
              ...(dados.UfSigla && { ufSigla: dados.UfSigla }),
            };
          }
        } catch (cepError) {
          console.warn('Error fetching CEP from ERP:', cepError);
        }
      }

      const vendedorSelecionado = vendedores.find(v => v.id === selectedVendedor);
      const adesionistaSelecionado = profile?.role === 'ADESIONISTA'
        ? { id: profile.id, external_id: profile.external_id || '', name: profile.name || '' }
        : adesionistas.find(a => a.id === selectedAdesionista);

      const rascunho = await createOrUpdateRascunho({
        cpf: cpfLimpo,
        nome: cadastroData.nome,
        nome_mae: cadastroData.nomeMae,
        data_nascimento: cadastroData.dataNascimento,
        sexo: cadastroData.sexo,
        sexo_codigo: cadastroData.sexoCodigo,
        contatos: cadastroData.contatos,
        endereco: cadastroData.endereco,
        lemit_raw: lemitData,
        cliente_sera_usuario: true,
        empresa_id: selectedEmpresa?.id,
        empresa_nome: selectedEmpresa?.nomeFantasia,
        empresa_cnpj: selectedEmpresa?.cnpj,
        empresa_raw: selectedEmpresa?.raw,
        empresa_exige_matricula: selectedEmpresa?.exigeMatricula || 0,
        planos_raw: selectedEmpresa?.precoPlano,
        ...(needsVendedor && vendedorSelecionado && {
          vendedor_id: vendedorSelecionado.id,
          vendedor_codigo: vendedorSelecionado.external_id,
          vendedor_nome: vendedorSelecionado.name,
        }),
        ...(adesionistaSelecionado && {
          adesionista_id: adesionistaSelecionado.id,
          adesionista_codigo: adesionistaSelecionado.external_id,
          adesionista_nome: adesionistaSelecionado.name,
        }),
      });

      setCpf('');
      onSuccess(rascunho);
    } catch (err) {
      console.error('Error consulting CPF:', err);
      setError(err instanceof Error ? err.message : 'Erro ao consultar CPF');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConsultar();
    }
  };

  const handleCloseClientExistsModal = async () => {
    if (!clientExists) return;

    try {
      const cpfLimpo = removeCPFMask(clientExists.cpf);
      const rascunhoBloqueado = await createOrUpdateRascunho({
        cpf: cpfLimpo,
        nome: clientExists.nome,
        motivo_bloqueio: 'Cliente já cadastrado no ERP',
        erp_dados_associado: clientExists.erpData,
        cliente_sera_usuario: false,
      });

      setCpf('');
      setClientExists(null);
      onSuccess(rascunhoBloqueado, true);
    } catch (err) {
      console.error('Error creating blocked registration:', err);
      setError('Erro ao criar registro bloqueado');
      setClientExists(null);
    }
  };

  const handleLemmitErrorContinue = async () => {
    if (!lemmitError) return;

    try {
      const { cadastroData, cpf, vendedorSelecionado } = lemmitError;

      if (cadastroData.endereco?.cep) {
        try {
          const enderecoERP = await consultarEnderecoCEP(cadastroData.endereco.cep);
          if (enderecoERP.ok && enderecoERP.dados) {
            const dados = enderecoERP.dados;
            cadastroData.endereco = {
              ...cadastroData.endereco,
              ...(dados.IdTipoLogradouro && { idTipoLogradouro: dados.IdTipoLogradouro }),
              ...(dados.TipoLogradouro && { tipoLogradouro: dados.TipoLogradouro }),
              ...(dados.Logradouro && { logradouro: dados.Logradouro }),
              ...(dados.IdBairro && { idBairro: dados.IdBairro }),
              ...(dados.Bairro && { bairro: dados.Bairro }),
              ...(dados.IdMunicipio && { idMunicipio: dados.IdMunicipio }),
              ...(dados.Municipio && { cidade: dados.Municipio }),
              ...(dados.IdUf && { idUf: dados.IdUf }),
              ...(dados.Uf && { uf: dados.Uf }),
              ...(dados.UfSigla && { ufSigla: dados.UfSigla }),
            };
          }
        } catch (cepError) {
          console.warn('Error fetching CEP from ERP:', cepError);
        }
      }

      const adesionistaSelecionado = profile?.role === 'ADESIONISTA'
        ? { id: profile.id, external_id: profile.external_id || '', name: profile.name || '' }
        : adesionistas.find(a => a.id === selectedAdesionista);

      const rascunho = await createOrUpdateRascunho({
        cpf,
        nome: cadastroData.nome,
        nome_mae: cadastroData.nomeMae,
        data_nascimento: cadastroData.dataNascimento,
        sexo: cadastroData.sexo,
        sexo_codigo: cadastroData.sexoCodigo,
        contatos: cadastroData.contatos,
        endereco: cadastroData.endereco,
        lemit_raw: null,
        cliente_sera_usuario: true,
        empresa_id: selectedEmpresa?.id,
        empresa_nome: selectedEmpresa?.nomeFantasia,
        empresa_cnpj: selectedEmpresa?.cnpj,
        empresa_raw: selectedEmpresa?.raw,
        empresa_exige_matricula: selectedEmpresa?.exigeMatricula || 0,
        planos_raw: selectedEmpresa?.precoPlano,
        ...(needsVendedor && vendedorSelecionado && {
          vendedor_id: vendedorSelecionado.id,
          vendedor_codigo: vendedorSelecionado.external_id,
          vendedor_nome: vendedorSelecionado.name,
        }),
        ...(adesionistaSelecionado && {
          adesionista_id: adesionistaSelecionado.id,
          adesionista_codigo: adesionistaSelecionado.external_id,
          adesionista_nome: adesionistaSelecionado.name,
        }),
      });

      setLemmitError(null);
      setCpf('');
      onSuccess(rascunho);
    } catch (err) {
      console.error('Error continuing after Lemmit error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao continuar cadastro');
      setLemmitError(null);
    }
  };

  const handleLemmitErrorCancel = () => {
    setLemmitError(null);
    setCpf('');
    setLoading(false);
  };

  return (
    <>
    <div className="space-y-6">
      <EmpresaSearchCard
        onEmpresaSelected={setSelectedEmpresa}
        selectedEmpresa={selectedEmpresa}
      />

      {selectedEmpresa && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Consultar CPF</h3>

          <div className="space-y-4">
            {needsVendedor && (
              <>
                <Select
                  label="Vendedor"
                  value={selectedVendedor}
                  onChange={(e) => setSelectedVendedor(e.target.value)}
                  disabled={loading || vendedores.length === 0}
                  required
                >
                  <option value="">Selecione um vendedor</option>
                  {vendedores.map((vendedor) => (
                    <option key={vendedor.id} value={vendedor.id}>
                      {vendedor.name || vendedor.email || 'Vendedor sem nome'} - Código: {vendedor.external_id}
                    </option>
                  ))}
                </Select>
                {vendedores.length === 0 && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
                    ⚠️ Nenhum vendedor disponível. Entre em contato com o administrador para cadastrar vendedores com código (ID Externo).
                  </div>
                )}
              </>
            )}

            {adesionistas.length > 0 && profile?.role !== 'ADESIONISTA' && (
              <Select
                label="Adesionista (Opcional)"
                value={selectedAdesionista}
                onChange={(e) => setSelectedAdesionista(e.target.value)}
                disabled={loading}
              >
                <option value="">Selecione um adesionista (opcional)</option>
                {adesionistas.map((adesionista) => (
                  <option key={adesionista.id} value={adesionista.id}>
                    {adesionista.name || adesionista.email || 'Adesionista sem nome'} - Código: {adesionista.external_id}
                  </option>
                ))}
              </Select>
            )}

            <Input
              label="CPF"
              type="text"
              value={cpf}
              onChange={handleCPFChange}
              onKeyPress={handleKeyPress}
              placeholder="000.000.000-00"
              maxLength={14}
              disabled={loading}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleConsultar}
              disabled={loading || !cpf || (needsVendedor && !selectedVendedor)}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Consultando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Consultar
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>

    {clientExists && (
      <ClientExistsModal
        cpf={clientExists.cpf}
        nome={clientExists.nome}
        onClose={handleCloseClientExistsModal}
      />
    )}

    {lemmitError && (
      <LemmitErrorModal
        error={lemmitError.message}
        details={lemmitError.details}
        onContinue={handleLemmitErrorContinue}
        onCancel={handleLemmitErrorCancel}
      />
    )}
    </>
  );
}
