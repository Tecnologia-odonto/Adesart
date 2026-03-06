import { useState, useEffect } from 'react';
import { Trash2, Search, X, FileText, Eye, Calendar, User, Building, ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatCPF, formatDate } from '../lib/cpf';
import { Input } from '../components/Input';
import { Select } from '../components/Select';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { Layout } from '../components/Layout';

interface CadastroExcluido {
  id: string;
  cadastro_id: string;
  dados_cadastro: any;
  motivo_exclusao: string;
  excluido_por: string;
  excluido_por_nome: string;
  excluido_por_role: string;
  excluido_em: string;
  team_id: string | null;
}

interface UserProfile {
  id: string;
  name: string;
}

export function AdesoesExcluidas() {
  const { profile } = useAuth();
  const [cadastrosExcluidos, setCadastrosExcluidos] = useState<CadastroExcluido[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscaNome, setBuscaNome] = useState('');
  const [buscaCPF, setBuscaCPF] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [exclusorFiltro, setExclusorFiltro] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [cadastroDetalhes, setCadastroDetalhes] = useState<CadastroExcluido | null>(null);

  const ITEMS_PER_PAGE = 15;

  useEffect(() => {
    fetchCadastrosExcluidos();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchCadastrosExcluidos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('cadastros_excluidos')
        .select('*')
        .order('excluido_em', { ascending: false });

      if (error) throw error;
      setCadastrosExcluidos(data || []);
    } catch (error) {
      console.error('Error fetching cadastros excluidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const cadastrosFiltrados = cadastrosExcluidos.filter((cadastro) => {
    const dados = cadastro.dados_cadastro;

    if (buscaNome) {
      const nomeMatch = dados.nome?.toLowerCase().includes(buscaNome.toLowerCase());
      const dependentesMatch = Array.isArray(dados.dependentes) &&
        dados.dependentes.some((dep: any) =>
          dep.nome?.toLowerCase().includes(buscaNome.toLowerCase())
        );
      if (!nomeMatch && !dependentesMatch) return false;
    }

    if (buscaCPF && !dados.cpf?.includes(buscaCPF.replace(/\D/g, ''))) {
      return false;
    }

    if (dataInicio) {
      const exclusaoDate = new Date(cadastro.excluido_em);
      const inicioDate = new Date(dataInicio);
      if (exclusaoDate < inicioDate) return false;
    }

    if (dataFim) {
      const exclusaoDate = new Date(cadastro.excluido_em);
      const fimDate = new Date(dataFim);
      fimDate.setHours(23, 59, 59, 999);
      if (exclusaoDate > fimDate) return false;
    }

    if (exclusorFiltro && cadastro.excluido_por !== exclusorFiltro) {
      return false;
    }

    return true;
  });

  const totalPages = Math.ceil(cadastrosFiltrados.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const cadastrosPaginados = cadastrosFiltrados.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const limparFiltros = () => {
    setBuscaNome('');
    setBuscaCPF('');
    setDataInicio('');
    setDataFim('');
    setExclusorFiltro('');
    setCurrentPage(1);
  };

  const temFiltrosAtivos = buscaNome || buscaCPF || dataInicio || dataFim || exclusorFiltro;

  const excluoresUnicos = Array.from(
    new Map(
      cadastrosExcluidos
        .map((c) => [c.excluido_por, c.excluido_por_nome])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]));

  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    range.forEach((i) => {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    });

    return rangeWithDots;
  };

  const visiblePages = getVisiblePages();

  if (profile?.role !== 'ADMINISTRADOR') {
    return (
      <Layout>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
          <div className="text-center">
            <Trash2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Acesso restrito a administradores</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Adesões Excluídas</h1>
          <p className="text-slate-600">
            Histórico de adesões excluídas e seus motivos para auditoria
          </p>
        </div>

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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Input
              label="Nome do Titular/Dependente"
              value={buscaNome}
              onChange={(e) => setBuscaNome(e.target.value)}
              placeholder="Nome"
            />
            <Input
              label="CPF do Titular"
              value={buscaCPF}
              onChange={(e) => setBuscaCPF(e.target.value)}
              placeholder="CPF"
            />
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
            <Select
              label="Excluído por"
              value={exclusorFiltro}
              onChange={(e) => setExclusorFiltro(e.target.value)}
            >
              <option value="">Todos</option>
              {excluoresUnicos.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Mostrando {cadastrosPaginados.length} de {cadastrosFiltrados.length} {cadastrosFiltrados.length === 1 ? 'exclusão' : 'exclusões'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-3"></div>
              <p className="text-slate-500">Carregando...</p>
            </div>
          </div>
        ) : cadastrosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
            <div className="text-center">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">
                {temFiltrosAtivos
                  ? 'Nenhuma exclusão encontrada com os filtros aplicados'
                  : 'Nenhuma adesão excluída encontrada'}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {cadastrosPaginados.map((cadastro) => {
                const dados = cadastro.dados_cadastro;
                const dependentesArray = Array.isArray(dados.dependentes) ? dados.dependentes : [];

                return (
                  <div key={cadastro.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <User className="w-5 h-5 text-red-600" />
                          <h3 className="font-semibold text-slate-900 text-lg">
                            {dados.nome || 'Nome não informado'}
                          </h3>
                          {dados.tipo_cadastro === 'inclusao_dependente' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600">
                              Inclusão de Dependente
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm text-slate-600">
                          {dados.cpf && (
                            <p>
                              <span className="font-medium">CPF:</span> {formatCPF(dados.cpf)}
                            </p>
                          )}
                          {dados.data_nascimento && (
                            <p>
                              <span className="font-medium">Nascimento:</span> {formatDate(dados.data_nascimento)}
                            </p>
                          )}
                          {dados.empresa_nome && (
                            <p>
                              <span className="font-medium">Empresa:</span> {dados.empresa_nome}
                            </p>
                          )}
                          {dados.vendedor_nome && (
                            <p>
                              <span className="font-medium">Vendedor:</span> {dados.vendedor_nome}
                            </p>
                          )}
                          {dependentesArray.length > 0 && (
                            <p>
                              <span className="font-medium">Dependentes:</span> {dependentesArray.length}
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setCadastroDetalhes(cadastro)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalhes
                      </button>
                    </div>

                    <div className="border-t border-slate-200 pt-4">
                      <div className="bg-red-50 rounded-lg p-4">
                        <p className="text-sm font-medium text-red-900 mb-2">Motivo da Exclusão:</p>
                        <p className="text-sm text-red-700">{cadastro.motivo_exclusao}</p>
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
                        <div className="flex items-center gap-4">
                          <span>
                            <span className="font-medium">Excluído por:</span> {cadastro.excluido_por_nome}
                          </span>
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded-full">
                            {cadastro.excluido_por_role}
                          </span>
                        </div>
                        <span>
                          <span className="font-medium">Em:</span> {new Date(cadastro.excluido_em).toLocaleString('pt-BR')}
                        </span>
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
                  {visiblePages.map((page, idx) =>
                    page === '...' ? (
                      <span key={`dots-${idx}`} className="text-slate-400 px-2">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                          currentPage === page
                            ? 'bg-emerald-600 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
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

        {cadastroDetalhes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900">Detalhes da Adesão Excluída</h2>
              <button
                onClick={() => setCadastroDetalhes(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <pre className="bg-slate-50 p-4 rounded-lg text-sm text-slate-700 overflow-x-auto">
                {JSON.stringify(cadastroDetalhes.dados_cadastro, null, 2)}
              </pre>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <div className="bg-red-50 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-red-900 mb-2">Motivo da Exclusão:</p>
                  <p className="text-sm text-red-700">{cadastroDetalhes.motivo_exclusao}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-600 font-medium">Excluído por:</p>
                    <p className="text-slate-900">{cadastroDetalhes.excluido_por_nome}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium">Role:</p>
                    <p className="text-slate-900">{cadastroDetalhes.excluido_por_role}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium">Data/Hora:</p>
                    <p className="text-slate-900">{new Date(cadastroDetalhes.excluido_em).toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-slate-600 font-medium">ID do Cadastro:</p>
                    <p className="text-slate-900 font-mono text-xs">{cadastroDetalhes.cadastro_id}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
    </Layout>
  );
}