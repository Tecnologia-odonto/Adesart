import { useState, useEffect } from 'react';
import { Search, Loader2, Building2, CheckCircle } from 'lucide-react';
import { Input } from '../Input';
import { Button } from '../Button';
import { useCadastros } from '../../hooks/useCadastros';
import { ObservacoesEmpresaModal } from './ObservacoesEmpresaModal';

interface Empresa {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  enderecoEmpresa: any;
  precoPlano: any[];
  exigeMatricula?: number;
  observacoes?: string;
  raw: any;
}

interface EmpresaSearchCardProps {
  onEmpresaSelected: (empresa: Empresa) => void;
  selectedEmpresa: Empresa | null;
}

export function EmpresaSearchCard({ onEmpresaSelected, selectedEmpresa }: EmpresaSearchCardProps) {
  const [searchValue, setSearchValue] = useState('');
  const [searchType, setSearchType] = useState<'cnpj' | 'nome' | 'id'>('id');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [showObservacoesModal, setShowObservacoesModal] = useState(false);
  const [observacoesVistas, setObservacoesVistas] = useState(false);
  const { searchEmpresa } = useCadastros();

  useEffect(() => {
    if (selectedEmpresa && selectedEmpresa.observacoes && selectedEmpresa.observacoes.trim() !== '' && !observacoesVistas) {
      setShowObservacoesModal(true);
    }
  }, [selectedEmpresa, observacoesVistas]);

  const formatCNPJ = (value: string | undefined | null) => {
    if (!value) return '';
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 14) {
      return numbers
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return value;
  };

  const handleSearchValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;

    if (searchType === 'cnpj') {
      value = formatCNPJ(value);
    }

    setSearchValue(value);
    setError('');
  };

  const handleSearchTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSearchType(e.target.value as 'cnpj' | 'nome' | 'id');
    setSearchValue('');
    setError('');
  };

  const handleBuscar = async () => {
    setError('');
    setEmpresas([]);

    if (!searchValue.trim()) {
      setError('Digite um valor para buscar');
      return;
    }

    let searchParam = searchValue;

    if (searchType === 'cnpj') {
      const cnpjLimpo = searchValue.replace(/\D/g, '');
      if (cnpjLimpo.length !== 14) {
        setError('CNPJ inválido. Digite 14 dígitos.');
        return;
      }
      searchParam = cnpjLimpo;
    } else if (searchType === 'id') {
      const idNum = parseInt(searchValue);
      if (isNaN(idNum) || idNum <= 0) {
        setError('ID inválido. Digite apenas números.');
        return;
      }
    }

    setLoading(true);

    try {
      const result = await searchEmpresa(searchParam, searchType);

      if (!result.ok || !result.empresas || result.empresas.length === 0) {
        setError(`Nenhuma empresa encontrada com ${searchType === 'cnpj' ? 'este CNPJ' : searchType === 'nome' ? 'este nome' : 'este ID'}`);
        return;
      }

      setEmpresas(result.empresas);

      if (result.empresas.length === 1) {
        setObservacoesVistas(false);
        onEmpresaSelected(result.empresas[0]);
      }
    } catch (err) {
      console.error('Error searching empresa:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseObservacoesModal = () => {
    setShowObservacoesModal(false);
    setObservacoesVistas(true);
  };

  const handleSelectEmpresa = (empresa: Empresa) => {
    setObservacoesVistas(false);
    onEmpresaSelected(empresa);
  };

  const handleAlterarEmpresa = () => {
    onEmpresaSelected(null as any);
    setEmpresas([]);
    setSearchValue('');
    setObservacoesVistas(false);
    setShowObservacoesModal(false);
  };

  if (selectedEmpresa) {
    return (
      <>
        {showObservacoesModal && selectedEmpresa.observacoes && (
          <ObservacoesEmpresaModal
            observacoes={selectedEmpresa.observacoes}
            nomeEmpresa={selectedEmpresa.nomeFantasia}
            onClose={handleCloseObservacoesModal}
          />
        )}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            <div className="flex-1 w-full">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="p-2 sm:p-3 bg-emerald-50 rounded-lg">
                  <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-slate-800">Empresa Selecionada</h3>
                  <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                    <span className="text-xs sm:text-sm text-emerald-600 font-medium">Confirmado</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row">
                  <span className="font-medium text-slate-700 sm:w-32 mb-0.5 sm:mb-0">Razão Social:</span>
                  <span className="text-slate-600">{selectedEmpresa.razaoSocial}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-medium text-slate-700 sm:w-32 mb-0.5 sm:mb-0">Nome Fantasia:</span>
                  <span className="text-slate-600">{selectedEmpresa.nomeFantasia}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-medium text-slate-700 sm:w-32 mb-0.5 sm:mb-0">CNPJ:</span>
                  <span className="text-slate-600">{formatCNPJ(selectedEmpresa.cnpj)}</span>
                </div>
                <div className="flex flex-col sm:flex-row">
                  <span className="font-medium text-slate-700 sm:w-32 mb-0.5 sm:mb-0">Planos:</span>
                  <span className="text-slate-600">{selectedEmpresa.precoPlano.length} disponíveis</span>
                </div>
                {selectedEmpresa.exigeMatricula === 1 && (
                  <div className="flex flex-col sm:flex-row">
                    <span className="font-medium text-red-700 sm:w-32 mb-0.5 sm:mb-0">Matrícula:</span>
                    <span className="text-red-600 font-semibold">OBRIGATÓRIA</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm font-semibold text-red-700 mb-1">Observações:</p>
                  {selectedEmpresa.observacoes && selectedEmpresa.observacoes.trim() !== '' ? (
                    <p className="text-sm text-red-700 whitespace-pre-wrap">{selectedEmpresa.observacoes}</p>
                  ) : (
                    <p className="text-sm text-red-700">Empresa sem observações</p>
                  )}
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={handleAlterarEmpresa}
              className="w-full sm:w-auto sm:ml-4"
            >
              Alterar
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
      <div className="flex items-start gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="p-2 sm:p-3 bg-blue-50 rounded-lg flex-shrink-0">
          <Building2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-slate-800">Buscar Empresa</h3>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5 sm:mt-1">
            Busque por CNPJ, Nome ou ID da empresa
          </p>
        </div>
      </div>

      <div className="space-y-3 sm:space-y-4">
        <div className="flex flex-col gap-2 sm:gap-3">
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Buscar por
            </label>
            <select
              value={searchType}
              onChange={handleSearchTypeChange}
              disabled={loading}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
            >
              <option value="cnpj">CNPJ</option>
              <option value="nome">Nome da Empresa</option>
              <option value="id">ID da Empresa</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <div className="flex-1">
              <Input
                label={searchType === 'cnpj' ? 'CNPJ' : searchType === 'nome' ? 'Nome da Empresa' : 'ID da Empresa'}
                value={searchValue}
                onChange={handleSearchValueChange}
                placeholder={
                  searchType === 'cnpj'
                    ? '00.000.000/0000-00'
                    : searchType === 'nome'
                    ? 'Digite o nome da empresa'
                    : 'Digite o ID'
                }
                maxLength={searchType === 'cnpj' ? 18 : undefined}
                disabled={loading}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleBuscar} disabled={loading || !searchValue} className="w-full sm:w-auto">
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Buscar
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 sm:px-4 sm:py-3 rounded-lg text-xs sm:text-sm">
            {error}
          </div>
        )}

        {empresas.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs sm:text-sm font-medium text-slate-700">
              {empresas.length} empresas encontradas. Selecione uma:
            </p>
            {empresas.map((empresa) => (
              <button
                key={empresa.id}
                onClick={() => handleSelectEmpresa(empresa)}
                className="w-full text-left p-3 sm:p-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
              >
                <div className="font-medium text-slate-800 text-sm sm:text-base">{empresa.nomeFantasia}</div>
                <div className="text-xs sm:text-sm text-slate-600 mt-1">{empresa.razaoSocial}</div>
                <div className="text-xs text-slate-500 mt-1">CNPJ: {formatCNPJ(empresa.cnpj)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
