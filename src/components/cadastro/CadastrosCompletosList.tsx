import { FileText, CheckCircle2, Eye, Building2, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Cadastro } from '../../hooks/useCadastros';
import { formatCPF, formatDate } from '../../lib/cpf';
import { Input } from '../Input';
import { Select } from '../Select';
import { useAuth } from '../../contexts/AuthContext';
import { CadastrosSupervisorView } from './CadastrosSupervisorView';
import { CadastrosGerenteView } from './CadastrosGerenteView';

interface CadastrosCompletosListProps {
  cadastros: Cadastro[];
}

interface EmpresaGroup {
  empresaId: number | null;
  empresaNome: string;
  empresaCnpj: string | null;
  cadastros: Cadastro[];
}

export function CadastrosCompletosList({ cadastros }: CadastrosCompletosListProps) {
  const { profile } = useAuth();
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<string>>(new Set());
  const [viewDetails, setViewDetails] = useState<Cadastro | null>(null);
  const [filtroEmpresa, setFiltroEmpresa] = useState<string>('');
  const [filtroBusca, setFiltroBusca] = useState<string>('');
  const [dataInicio, setDataInicio] = useState<string>('');
  const [dataFim, setDataFim] = useState<string>('');

  const completos = cadastros.filter((c) => c.status === 'enviado');

  if (profile?.role === 'SUPERVISOR') {
    return <CadastrosSupervisorView cadastros={cadastros} statusFilter="enviado" />;
  }

  if (profile?.role === 'GERENTE') {
    return <CadastrosGerenteView cadastros={cadastros} statusFilter="enviado" />;
  }

  const empresasUnicas = useMemo(() => {
    const empresasSet = new Map<string, { id: number | null; nome: string }>();
    completos.forEach((cadastro) => {
      const key = cadastro.empresa_id !== null ? `${cadastro.empresa_id}` : 'sem_empresa';
      if (!empresasSet.has(key)) {
        empresasSet.set(key, {
          id: cadastro.empresa_id,
          nome: cadastro.empresa_nome || 'Empresa não informada',
        });
      }
    });
    return Array.from(empresasSet.values()).sort((a, b) => {
      if (a.id === null) return 1;
      if (b.id === null) return -1;
      return a.nome.localeCompare(b.nome);
    });
  }, [completos]);

  const cadastrosFiltrados = useMemo(() => {
    return completos.filter((cadastro) => {
      const matchEmpresa = !filtroEmpresa ||
        (filtroEmpresa === 'sem_empresa' && cadastro.empresa_id === null) ||
        (cadastro.empresa_id !== null && cadastro.empresa_id.toString() === filtroEmpresa);

      const matchBusca = !filtroBusca ||
        cadastro.nome?.toLowerCase().includes(filtroBusca.toLowerCase()) ||
        cadastro.cpf.includes(filtroBusca.replace(/\D/g, ''));

      const dataEnvio = cadastro.data_envio ? new Date(cadastro.data_envio) : null;
      const matchDataInicio = !dataInicio || !dataEnvio || dataEnvio >= new Date(dataInicio);
      const matchDataFim = !dataFim || !dataEnvio || dataEnvio <= new Date(dataFim + 'T23:59:59');

      return matchEmpresa && matchBusca && matchDataInicio && matchDataFim;
    });
  }, [completos, filtroEmpresa, filtroBusca, dataInicio, dataFim]);

  const empresasGrouped: EmpresaGroup[] = [];
  const cadastrosMap = new Map<string, Cadastro[]>();

  cadastrosFiltrados.forEach((cadastro) => {
    const key = cadastro.empresa_id !== null ? `empresa_${cadastro.empresa_id}` : 'sem_empresa';
    if (!cadastrosMap.has(key)) {
      cadastrosMap.set(key, []);
    }
    cadastrosMap.get(key)!.push(cadastro);
  });

  cadastrosMap.forEach((cads, key) => {
    const firstCadastro = cads[0];
    empresasGrouped.push({
      empresaId: firstCadastro.empresa_id,
      empresaNome: firstCadastro.empresa_nome || 'Empresa não informada',
      empresaCnpj: firstCadastro.empresa_cnpj,
      cadastros: cads,
    });
  });

  empresasGrouped.sort((a, b) => {
    if (a.empresaId === null) return 1;
    if (b.empresaId === null) return -1;
    return a.empresaNome.localeCompare(b.empresaNome);
  });

  const toggleEmpresa = (empresaKey: string) => {
    const newExpanded = new Set(expandedEmpresas);
    if (newExpanded.has(empresaKey)) {
      newExpanded.delete(empresaKey);
    } else {
      newExpanded.add(empresaKey);
    }
    setExpandedEmpresas(newExpanded);
  };

  if (completos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
        <div className="text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum atendimento completo</p>
        </div>
      </div>
    );
  }

  const limparFiltros = () => {
    setFiltroEmpresa('');
    setFiltroBusca('');
    setDataInicio('');
    setDataFim('');
  };

  const temFiltrosAtivos = filtroEmpresa || filtroBusca || dataInicio || dataFim;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-slate-500" />
          <h3 className="font-semibold text-slate-800">Filtros</h3>
          {temFiltrosAtivos && (
            <button
              onClick={limparFiltros}
              className="ml-auto text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select
            label="Empresa"
            value={filtroEmpresa}
            onChange={(e) => setFiltroEmpresa(e.target.value)}
          >
            <option value="">Todas as empresas</option>
            {empresasUnicas.map((empresa) => (
              <option
                key={empresa.id !== null ? empresa.id : 'sem_empresa'}
                value={empresa.id !== null ? empresa.id.toString() : 'sem_empresa'}
              >
                {empresa.nome}
              </option>
            ))}
          </Select>

          <div className="relative">
            <Input
              label="Buscar por CPF ou Nome"
              value={filtroBusca}
              onChange={(e) => setFiltroBusca(e.target.value)}
              placeholder="Digite o CPF ou nome..."
            />
            {filtroBusca && (
              <button
                onClick={() => setFiltroBusca('')}
                className="absolute right-2 top-9 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Input
            type="date"
            label="Data Início (Envio)"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />

          <Input
            type="date"
            label="Data Fim (Envio)"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>

        {temFiltrosAtivos && (
          <div className="mt-3 text-sm text-slate-600">
            Mostrando {cadastrosFiltrados.length} de {completos.length} cadastros
          </div>
        )}
      </div>

      {cadastrosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
          <div className="text-center">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum cadastro encontrado com os filtros aplicados</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
        {empresasGrouped.map((empresa) => {
          const empresaKey = empresa.empresaId !== null ? `empresa_${empresa.empresaId}` : 'sem_empresa';
          const isExpanded = expandedEmpresas.has(empresaKey);

          return (
            <div key={empresaKey} className="bg-white rounded-xl shadow-sm border border-slate-200">
              <button
                onClick={() => toggleEmpresa(empresaKey)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-800">{empresa.empresaNome}</h3>
                    {empresa.empresaCnpj && (
                      <p className="text-xs text-slate-500">CNPJ: {empresa.empresaCnpj}</p>
                    )}
                  </div>
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    {empresa.cadastros.length}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 p-4 space-y-3">
                  {empresa.cadastros.map((cadastro) => {
                    return (
                      <div
                        key={cadastro.id}
                        className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h4 className="font-medium text-slate-800 truncate">
                                {cadastro.nome || formatCPF(cadastro.cpf)}
                              </h4>
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Completo
                              </span>
                            </div>

                            <div className="space-y-1 text-sm text-slate-600">
                              <p>
                                <span className="font-medium">CPF:</span> {formatCPF(cadastro.cpf)}
                              </p>
                              {cadastro.data_nascimento && (
                                <p>
                                  <span className="font-medium">Nascimento:</span>{' '}
                                  {formatDate(cadastro.data_nascimento)}
                                </p>
                              )}
                              <p className="text-xs text-slate-500">
                                Enviado em {new Date(cadastro.updated_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>

                          <div className="flex-shrink-0 flex gap-2">
                            <button
                              onClick={() => setViewDetails(cadastro)}
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver detalhes"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      {viewDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Detalhes do Cadastro</h3>
              <button
                onClick={() => setViewDetails(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Nome</p>
                <p className="text-slate-800">{viewDetails.nome}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-600">CPF</p>
                <p className="text-slate-800">{formatCPF(viewDetails.cpf)}</p>
              </div>

              {viewDetails.data_nascimento && (
                <div>
                  <p className="text-sm font-medium text-slate-600">Data de Nascimento</p>
                  <p className="text-slate-800">{formatDate(viewDetails.data_nascimento)}</p>
                </div>
              )}

              {viewDetails.erp_response && (
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">Resposta do ERP</p>
                  <pre className="bg-slate-50 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(viewDetails.erp_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
