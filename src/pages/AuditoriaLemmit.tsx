import { useState, useEffect } from 'react';
import {
  Calendar,
  DollarSign,
  CheckCircle,
  XCircle,
  Activity,
  TrendingUp,
  User,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { supabase } from '../lib/supabase';

interface AuditCards {
  total_limite_ajustado: number;
  total_consultas: number;
  bem_sucedidas: number;
  com_erro: number;
  custo_total: number;
}

interface UsuarioConsulta {
  user_id: string;
  nome: string;
  consultas: number;
}

interface UsuarioCusto {
  user_id: string;
  nome: string;
  custo_total: number;
}

interface UltimaConsulta {
  nome: string;
  cpf: string;
  hora: string;
}

interface AuditData {
  cards: AuditCards;
  usuario_consulta: UsuarioConsulta[];
  usuario_custo: UsuarioCusto[];
  ultimas_consultas: UltimaConsulta[];
}

export function AuditoriaLemmit() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AuditData | null>(null);
  const [error, setError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const getDefaultDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      start: firstDay.toISOString().split('T')[0],
      end: nextMonth.toISOString().split('T')[0]
    };
  };

  const [dateRange, setDateRange] = useState(getDefaultDates());

  const fetchAuditData = async () => {
    setLoading(true);
    setError('');

    try {
      const startDate = new Date(dateRange.start).toISOString();
      const endDate = new Date(dateRange.end).toISOString();

      const offset = (currentPage - 1) * itemsPerPage;

      const { data: result, error: rpcError } = await supabase.rpc('audit_lemmit', {
        p_start: startDate,
        p_end: endDate,
        p_limit: itemsPerPage,
        p_offset: offset
      });

      if (rpcError) {
        throw rpcError;
      }

      setData(result as AuditData);
    } catch (err) {
      console.error('Error fetching audit data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados de auditoria');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  const handleApplyFilter = () => {
    setCurrentPage(1);
    fetchAuditData();
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (data?.ultimas_consultas && data.ultimas_consultas.length === itemsPerPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    if (currentPage !== 1) {
      fetchAuditData();
    }
  }, [currentPage]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatCPF = (cpf: string) => {
    if (!cpf || cpf === 'N/A') return cpf;
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return cpf;
  };

  if (loading && !data) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            <p className="mt-4 text-slate-600">Carregando auditoria...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Auditoria Lemmit</h1>
          <p className="text-slate-600 mt-1">
            Acompanhe o uso e custos das consultas à API Lemmit
          </p>
        </div>

        <Card>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Data Início
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Data Fim
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleApplyFilter} disabled={loading}>
                <Calendar className="w-4 h-4 mr-2" />
                Aplicar Filtro
              </Button>
            </div>
          </div>
        </Card>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Limite Total</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      R$ {data.cards.total_limite_ajustado.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600 opacity-50" />
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-700">Total Consultas</p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">
                      {data.cards.total_consultas.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <Activity className="w-8 h-8 text-purple-600 opacity-50" />
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-700">Bem Sucedidas</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {data.cards.bem_sucedidas.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-emerald-600 opacity-50" />
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-700">Com Erro</p>
                    <p className="text-2xl font-bold text-red-900 mt-1">
                      {data.cards.com_erro.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <XCircle className="w-8 h-8 text-red-600 opacity-50" />
                </div>
              </Card>

              <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-700">Custo Total</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">
                      {formatCurrency(data.cards.custo_total)}
                    </p>
                  </div>
                  <DollarSign className="w-8 h-8 text-amber-600 opacity-50" />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2 text-emerald-600" />
                  Usuário x Consultas
                </h3>
                {data.usuario_consulta.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">
                    Nenhuma consulta no período
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {data.usuario_consulta.map((item, index) => (
                      <div
                        key={item.user_id || index}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-sm font-medium text-slate-700 truncate flex-1">
                          {item.nome}
                        </span>
                        <span className="text-sm font-bold text-emerald-600 ml-3">
                          {item.consultas.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-amber-600" />
                  Usuário x Custo
                </h3>
                {data.usuario_custo.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">
                    Nenhum custo registrado no período
                  </p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {data.usuario_custo.map((item, index) => (
                      <div
                        key={item.user_id || index}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <span className="text-sm font-medium text-slate-700 truncate flex-1">
                          {item.nome}
                        </span>
                        <span className="text-sm font-bold text-amber-600 ml-3">
                          {formatCurrency(item.custo_total)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-blue-600" />
                  Últimas Consultas
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <span className="text-sm text-slate-600 px-2">
                    Página {currentPage}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={!data.ultimas_consultas || data.ultimas_consultas.length < itemsPerPage}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Próxima página"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </button>
                </div>
              </div>

              {data.ultimas_consultas.length === 0 ? (
                <p className="text-center text-slate-500 py-8">
                  Nenhuma consulta no período
                </p>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200">
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                            Usuário
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                            CPF Consultado
                          </th>
                          <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                            Data/Hora
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ultimas_consultas.map((item, index) => (
                          <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="py-3 px-4 text-sm text-slate-700">
                              {item.nome}
                            </td>
                            <td className="py-3 px-4 text-sm font-mono text-slate-700">
                              {formatCPF(item.cpf)}
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-600">
                              {formatDateTime(item.hora)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {data.ultimas_consultas.map((item, index) => (
                      <div key={index} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-sm font-medium text-slate-700">
                            {item.nome}
                          </span>
                          <span className="text-xs text-slate-500">
                            {formatDateTime(item.hora)}
                          </span>
                        </div>
                        <div className="text-sm font-mono text-slate-600">
                          CPF: {formatCPF(item.cpf)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
