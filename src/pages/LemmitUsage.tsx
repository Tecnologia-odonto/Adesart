import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { formatCPF } from '../lib/cpf';
import { Activity, CheckCircle2, XCircle, TrendingUp, Calendar } from 'lucide-react';

interface LemmitConsulta {
  id: string;
  cpf: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
  user_id: string;
}

interface UserProfile {
  lemmit_limite_consultas: number | null;
  lemmit_consultas_mes_atual: number;
  email?: string;
  full_name?: string;
}

interface ConsultaComUsuario extends LemmitConsulta {
  profiles?: UserProfile;
}

export function LemmitUsage() {
  const { user, isAdmin } = useAuth();
  const [consultas, setConsultas] = useState<ConsultaComUsuario[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    thisMonth: 0,
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('lemmit_limite_consultas, lemmit_consultas_mes_atual')
        .eq('id', user.id)
        .maybeSingle();

      setUserProfile(profile);

      const startOfMonth = new Date(selectedMonth + '-01');
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0, 23, 59, 59);

      let query = supabase
        .from('lemmit_consultas')
        .select(`
          *,
          profiles:user_id (
            email,
            full_name,
            lemmit_limite_consultas,
            lemmit_consultas_mes_atual
          )
        `)
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString())
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data: consultasData, error } = await query;

      if (error) throw error;

      setConsultas(consultasData || []);

      const total = consultasData?.length || 0;
      const success = consultasData?.filter((c) => c.success).length || 0;
      const failed = total - success;

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const isCurrentMonth = selectedMonth === currentMonth;

      setStats({
        total,
        success,
        failed,
        thisMonth: isCurrentMonth ? (profile?.lemmit_consultas_mes_atual || 0) : total,
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
            ) : consultas.length === 0 ? (
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
                      Mensagem
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consultas.map((consulta) => (
                    <tr key={consulta.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(consulta.created_at).toLocaleString('pt-BR')}
                      </td>
                      {isAdmin && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(consulta.profiles as any)?.full_name || (consulta.profiles as any)?.email || '-'}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCPF(consulta.cpf)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {consulta.success ? (
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
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {consulta.error_message || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>
    </Layout>
  );
}
