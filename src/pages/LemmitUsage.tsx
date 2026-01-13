import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { formatCPF } from '../lib/cpf';
import { Activity, CheckCircle2, XCircle, TrendingUp, Calendar, Clock } from 'lucide-react';

interface ApiLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  endpoint: string;
  method: string;
  request_body: any;
  response_body: any;
  status_code: number | null;
  success: boolean | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface UserProfile {
  lemmit_limite_consultas: number | null;
  lemmit_consultas_mes_atual: number;
  email?: string;
  name?: string;
}

interface LogComUsuario extends ApiLog {
  profiles?: UserProfile;
}

export function LemmitUsage() {
  const { user, isAdmin, profile } = useAuth();
  const [logs, setLogs] = useState<LogComUsuario[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    thisMonth: 0,
    avgDuration: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    loadData();
  }, [selectedMonth, isAdmin]);

  async function loadData() {
    if (!user) return;

    try {
      setLoading(true);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('lemmit_limite_consultas, lemmit_consultas_mes_atual')
        .eq('id', user.id)
        .maybeSingle();

      setUserProfile(profileData);

      const startOfMonth = new Date(selectedMonth + '-01');
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);

      let query = supabase
        .from('api_logs')
        .select(`
          *,
          profiles:user_id (
            email,
            name,
            lemmit_limite_consultas,
            lemmit_consultas_mes_atual
          )
        `)
        .eq('endpoint', '/lemit-consulta-pessoa')
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString())
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data: logsData, error } = await query;

      if (error) throw error;

      setLogs(logsData || []);

      const total = logsData?.length || 0;
      const success = logsData?.filter((l) => l.success).length || 0;
      const failed = total - success;

      const durations = logsData?.filter((l) => l.duration_ms !== null).map((l) => l.duration_ms!) || [];
      const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const isCurrentMonth = selectedMonth === currentMonth;

      setStats({
        total,
        success,
        failed,
        avgDuration,
        thisMonth: isCurrentMonth ? (profileData?.lemmit_consultas_mes_atual || 0) : total,
      });
    } catch (error) {
      console.error('Error loading Lemmit data:', error);
    } finally {
      setLoading(false);
    }
  }

  const limite = userProfile?.lemmit_limite_consultas;
  const usado = stats.thisMonth;
  const percentualUsado = limite ? Math.round((usado / limite) * 100) : 0;
  const temLimite = limite !== null && limite !== undefined;

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Consultas Lemmit</h1>
          <p className="text-gray-600 mt-1">Acompanhe o uso da API Lemmit</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total no Período</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Bem-sucedidas</p>
                <p className="text-2xl font-semibold text-green-600 mt-1">{stats.success}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Com Erro</p>
                <p className="text-2xl font-semibold text-red-600 mt-1">{stats.failed}</p>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Tempo Médio</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">{stats.avgDuration}ms</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {temLimite ? 'Uso do Limite' : 'Sem Limite'}
                </p>
                {temLimite ? (
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {usado} / {limite}
                  </p>
                ) : (
                  <p className="text-2xl font-semibold text-gray-900 mt-1">∞</p>
                )}
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
            {temLimite && (
              <div className="mt-3">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      percentualUsado >= 90
                        ? 'bg-red-600'
                        : percentualUsado >= 70
                        ? 'bg-yellow-600'
                        : 'bg-green-600'
                    }`}
                    style={{ width: `${Math.min(percentualUsado, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1 text-right">{percentualUsado}%</p>
              </div>
            )}
          </Card>
        </div>

        <Card>
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Histórico de Consultas</h2>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Carregando...</div>
            ) : logs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nenhuma consulta encontrada neste período
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Data/Hora
                    </th>
                    {isAdmin && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuário
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CPF
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duração
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mensagem
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => {
                    const cpf = log.request_body?.cpf || '-';
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {(log.profiles as any)?.name || log.user_email || '-'}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {cpf !== '-' ? formatCPF(cpf) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {log.success ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Sucesso
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <XCircle className="w-3 h-3" />
                              Erro
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {log.error_message || (log.status_code ? `Status ${log.status_code}` : '-')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
