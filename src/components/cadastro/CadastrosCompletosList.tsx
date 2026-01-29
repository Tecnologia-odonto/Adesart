import { FileText, CheckCircle2, Eye, Building2, Search, X, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Cadastro } from '../../hooks/useCadastros';
import { formatCPF, formatDate } from '../../lib/cpf';
import { Input } from '../Input';
import { Select } from '../Select';
import { Button } from '../Button';
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

const ITEMS_PER_PAGE = 12;

export function CadastrosCompletosList({ cadastros }: CadastrosCompletosListProps) {
  const { profile } = useAuth();
  const [viewDetails, setViewDetails] = useState<Cadastro | null>(null);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dataInicioAplicada, setDataInicioAplicada] = useState('');
  const [dataFimAplicada, setDataFimAplicada] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'cadastro' | 'inclusao_dependente'>('todos');
  const [tipoFiltroAplicado, setTipoFiltroAplicado] = useState<'todos' | 'cadastro' | 'inclusao_dependente'>('todos');
  const [currentPage, setCurrentPage] = useState(1);

  const completos = cadastros.filter((c) => c.status === 'enviado');

  useEffect(() => {
    setDefaultDateFilter();
  }, []);

  const setDefaultDateFilter = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayStr = firstDay.toISOString().split('T')[0];
    setDataInicio(firstDayStr);
    setDataInicioAplicada(firstDayStr);
  };

  const handleAplicarFiltros = () => {
    setBuscaAplicada(busca);
    setDataInicioAplicada(dataInicio);
    setDataFimAplicada(dataFim);
    setTipoFiltroAplicado(tipoFiltro);
    setCurrentPage(1);
  };

  if (profile?.role === 'SUPERVISOR') {
    return <CadastrosSupervisorView cadastros={cadastros} statusFilter="enviado" />;
  }

  if (profile?.role === 'GERENTE') {
    return <CadastrosGerenteView cadastros={cadastros} statusFilter="enviado" />;
  }

  const cadastrosFiltrados = useMemo(() => {
    return completos.filter((cadastro) => {
      const buscaLower = buscaAplicada.toLowerCase().trim();
      const buscaNumeros = buscaAplicada.replace(/\D/g, '');

      let matchBusca = true;
      if (buscaAplicada) {
        matchBusca =
          cadastro.nome?.toLowerCase().includes(buscaLower) ||
          cadastro.cpf.includes(buscaNumeros) ||
          cadastro.empresa_nome?.toLowerCase().includes(buscaLower) ||
          cadastro.empresa_cnpj?.replace(/\D/g, '').includes(buscaNumeros) ||
          (cadastro.empresa_codigo && cadastro.empresa_codigo.toString().includes(buscaNumeros)) ||
          false;
      }

      const dataEnvio = cadastro.data_envio ? new Date(cadastro.data_envio) : new Date(cadastro.updated_at);
      const matchDataInicio = !dataInicioAplicada || dataEnvio >= new Date(dataInicioAplicada);
      const matchDataFim = !dataFimAplicada || dataEnvio <= new Date(dataFimAplicada + 'T23:59:59');

      let matchTipo = true;
      if (tipoFiltroAplicado !== 'todos') {
        matchTipo = cadastro.tipo_cadastro === tipoFiltroAplicado;
      }

      return matchBusca && matchDataInicio && matchDataFim && matchTipo;
    });
  }, [completos, buscaAplicada, dataInicioAplicada, dataFimAplicada, tipoFiltroAplicado]);

  const empresasGrouped: EmpresaGroup[] = useMemo(() => {
    const cadastrosMap = new Map<string, Cadastro[]>();

    cadastrosFiltrados.forEach((cadastro) => {
      const key = cadastro.empresa_id !== null ? `empresa_${cadastro.empresa_id}` : 'sem_empresa';
      if (!cadastrosMap.has(key)) {
        cadastrosMap.set(key, []);
      }
      cadastrosMap.get(key)!.push(cadastro);
    });

    const groups: EmpresaGroup[] = [];
    cadastrosMap.forEach((cads, key) => {
      const firstCadastro = cads[0];
      groups.push({
        empresaId: firstCadastro.empresa_id,
        empresaNome: firstCadastro.empresa_nome || 'Empresa não informada',
        empresaCnpj: firstCadastro.empresa_cnpj,
        cadastros: cads,
      });
    });

    return groups.sort((a, b) => {
      if (a.empresaId === null) return 1;
      if (b.empresaId === null) return -1;
      return a.empresaNome.localeCompare(b.empresaNome);
    });
  }, [cadastrosFiltrados]);

  const totalPages = Math.ceil(empresasGrouped.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const empresasPaginadas = empresasGrouped.slice(startIndex, endIndex);

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
    setBusca('');
    setBuscaAplicada('');
    setDataInicio('');
    setDataFim('');
    setDataInicioAplicada('');
    setDataFimAplicada('');
    setTipoFiltro('todos');
    setTipoFiltroAplicado('todos');
    setCurrentPage(1);
    setDefaultDateFilter();
  };

  const temFiltrosAtivos = buscaAplicada || dataInicioAplicada || dataFimAplicada || tipoFiltroAplicado !== 'todos';

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
          <div className="relative">
            <Input
              label="Buscar"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="CPF, Nome, Empresa, CNPJ ou Código..."
            />
            {busca && (
              <button
                onClick={() => setBusca('')}
                className="absolute right-2 top-9 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Select
            label="Tipo"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as typeof tipoFiltro)}
          >
            <option value="todos">Todos</option>
            <option value="cadastro">Cadastro</option>
            <option value="inclusao_dependente">Inclusão</option>
          </Select>

          <Input
            type="date"
            label="Data Início"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />

          <Input
            type="date"
            label="Data Fim"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleAplicarFiltros} className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtrar
          </Button>

          {temFiltrosAtivos && (
            <div className="text-sm text-slate-600">
              Mostrando {cadastrosFiltrados.length} de {completos.length} cadastros em {empresasGrouped.length} {empresasGrouped.length === 1 ? 'empresa' : 'empresas'}
            </div>
          )}
        </div>
      </div>

      {cadastrosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
          <div className="text-center">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum cadastro encontrado com os filtros aplicados</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {empresasPaginadas.map((empresa) => {
              const empresaKey = empresa.empresaId !== null ? `empresa_${empresa.empresaId}` : 'sem_empresa';

              return (
                <div
                  key={empresaKey}
                  className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
                >
                  <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-blue-50">
                    <div className="flex items-start gap-3">
                      <Building2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 truncate">
                          {empresa.empresaNome}
                        </h3>
                        {empresa.empresaCnpj && (
                          <p className="text-xs text-slate-600 mt-1">
                            CNPJ: {empresa.empresaCnpj}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-slate-700">
                        {empresa.cadastros.length} {empresa.cadastros.length === 1 ? 'cadastro' : 'cadastros'}
                      </span>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {empresa.cadastros.map((cadastro) => (
                        <div
                          key={cadastro.id}
                          className="flex items-center justify-between p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">
                              {cadastro.nome || formatCPF(cadastro.cpf)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {formatCPF(cadastro.cpf)}
                            </p>
                          </div>
                          <button
                            onClick={() => setViewDetails(cadastro)}
                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors flex-shrink-0 ml-2"
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                      currentPage === page
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </>
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
                <X className="w-6 h-6" />
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

              {viewDetails.sexo && (
                <div>
                  <p className="text-sm font-medium text-slate-600">Sexo</p>
                  <p className="text-slate-800">{viewDetails.sexo}</p>
                </div>
              )}

              {viewDetails.empresa_nome && (
                <div>
                  <p className="text-sm font-medium text-slate-600">Empresa</p>
                  <p className="text-slate-800">{viewDetails.empresa_nome}</p>
                </div>
              )}

              {viewDetails.plano_nome && (
                <div>
                  <p className="text-sm font-medium text-slate-600">Plano</p>
                  <p className="text-slate-800">{viewDetails.plano_nome}</p>
                </div>
              )}

              {viewDetails.data_envio && (
                <div>
                  <p className="text-sm font-medium text-slate-600">Data de Envio</p>
                  <p className="text-slate-800">{new Date(viewDetails.data_envio).toLocaleString('pt-BR')}</p>
                </div>
              )}
            </div>

            <div className="mt-6">
              <Button onClick={() => setViewDetails(null)} variant="secondary" className="w-full">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
