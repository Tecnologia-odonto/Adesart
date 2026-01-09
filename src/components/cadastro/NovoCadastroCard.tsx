import { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Input } from '../Input';
import { Button } from '../Button';
import { formatCPF, validateCPF, removeCPFMask } from '../../lib/cpf';
import { mapLemitToCadastro, CadastroFormData } from '../../lib/mappers';
import { useCadastros } from '../../hooks/useCadastros';
import { useConfigCadastro } from '../../contexts/ConfigCadastroContext';
import { ClientExistsModal } from './ClientExistsModal';
import { EmpresaSearchCard } from './EmpresaSearchCard';

interface NovoCadastroCardProps {
  onSuccess: (cadastro: any, isBlocked?: boolean) => void;
}

interface ClientExistsData {
  cpf: string;
  nome: string;
  erpData: any;
}

interface Empresa {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  enderecoEmpresa: any;
  precoPlano: any[];
  raw: any;
}

export function NovoCadastroCard({ onSuccess }: NovoCadastroCardProps) {
  const [cpf, setCpf] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [clientExists, setClientExists] = useState<ClientExistsData | null>(null);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const { checkERPAssociado, consultarCPF, consultarEnderecoCEP, createOrUpdateRascunho } = useCadastros();
  const { loadConfig } = useConfigCadastro();

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

    setLoading(true);

    try {
      const cpfLimpo = removeCPFMask(cpf);

      const erpCheck = await checkERPAssociado(cpfLimpo);

      if (erpCheck.exists) {
        setClientExists({
          cpf: formatCPF(cpfLimpo),
          nome: erpCheck.summary.nomeFantasiaDaEmpresa || erpCheck.summary.empresa || 'Cliente já cadastrado',
          erpData: erpCheck,
        });
        setLoading(false);
        return;
      }

      const configAtual = await loadConfig();
      const lemitAtivo = configAtual?.ativar_lemmit ?? true;

      console.log('🔍 Configuração Lemmit:', { lemitAtivo, configAtual });

      let cadastroData: any = {
        nome: '',
        dataNascimento: null,
        sexo: null,
        sexoCodigo: null,
        contatos: null,
        endereco: null,
      };
      let lemitData = null;

      if (lemitAtivo) {
        console.log('✅ Lemmit ATIVO - Consultando API');

        lemitData = await consultarCPF(cpfLimpo);
        cadastroData = mapLemitToCadastro(lemitData, cpfLimpo);

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
      } else {
        console.log('❌ Lemmit DESATIVADO - Pulando consulta');
      }

      const rascunho = await createOrUpdateRascunho({
        cpf: cpfLimpo,
        nome: cadastroData.nome,
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
        planos_raw: selectedEmpresa?.precoPlano,
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
              disabled={loading || !cpf}
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
    </>
  );
}
