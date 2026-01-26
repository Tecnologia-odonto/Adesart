import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { formatCPF } from '../lib/cpf';
import { Activity, CheckCircle2, XCircle, Clock, DollarSign, Edit2, Save, X as XIcon, Filter } from 'lucide-react';
import { Input } from '../components/Input';
import { Select } from '../components/Select';

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
  cost: number | null;
  created_at: string;
}

interface UserBalance {
  id: string;
  name: string;
  email: string;
  lemmit_balance: number;
  total_consultas: number;
  total_gasto: number;
}

export function LemmitUsage() {
  const { user, isAdmin, profile } = useAuth();
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ApiLog[]>([]);
  const [userBalances, setUserBalances] = useState<UserBalance[]>([]);
  const [userMap, setUserMap] = useState<Map<string, string>>(new Map());
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editBalance, setEditBalance] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('todos');
  const [stats, setStats] = useState({
    total: 0,
    success: 0,
    failed: 0,
    totalCost: 0,
    avgDuration: 0,
  });
  const [loading, setLoading] = useState(true);
  const [myBalance, setMyBalance] = useState<number>(0);
  const [totalBalance, setTotalBalance] = useState<number>(0);

  useEffect(() => {
    loadData();
  }, [isAdmin, user]);

  useEffect(() => {
    if (!user) return;

    const profileChannel = supabase
      .channel('profile-lemmit-balance-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] Profile atualizado:', payload);
          if (payload.new && 'lemmit_balance' in payload.new) {
            setMyBalance(payload.new.lemmit_balance);
          }
        }
      )
      .subscribe();

    let allProfilesChannel: any = null;

    if (isAdmin) {
      allProfilesChannel = supabase
        .channel('all-profiles-balance-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
          },
          async (payload) => {
            console.log('[Realtime] Algum profile atualizado (admin):', payload);
            const { data: profilesData } = await supabase
              .from('profiles')
              .select('lemmit_balance');

            const total = (profilesData || []).reduce((sum, p) => sum + (p.lemmit_balance || 0), 0);
            console.log('[Realtime] Novo saldo geral:', total);
            setTotalBalance(total);

            setUserBalances((prev) =>
              prev.map((u) =>
                u.id === payload.new.id
                  ? { ...u, lemmit_balance: payload.new.lemmit_balance }
                  : u
              )
            );
          }
        )
        .subscribe();
    }

    const logsChannel = supabase
      .channel('api-logs-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'api_logs',
        },
        (payload) => {
          console.log('[Realtime] Novo log inserido:', payload);
          loadData();
        }
      )
      .subscribe();

    return () => {
      profileChannel.unsubscribe();
      if (allProfilesChannel) {
        allProfilesChannel.unsubscribe();
      }
      logsChannel.unsubscribe();
    };
  }, [user, isAdmin]);

  useEffect(() => {
    filterLogs();
  }, [selectedUserId, logs]);

  function filterLogs() {
    if (selectedUserId === 'todos') {
      setFilteredLogs(logs);
    } else {
      setFilteredLogs(logs.filter(log => log.user_id === selectedUserId));
    }
  }

  useEffect(() => {
    const total = filteredLogs.length;
    const success = filteredLogs.filter((l) => l.success).length;
    const failed = total - success;
    const totalCost = filteredLogs.reduce((sum, log) => sum + (log.cost || 0), 0);

    const durations = filteredLogs.filter((l) => l.duration_ms !== null).map((l) => l.duration_ms!);
    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;

    setStats({
      total,
      success,
      failed,
      totalCost,
      avgDuration,
    });
  }, [filteredLogs]);

  async function loadData() {
    if (!user) return;

    try {
      setLoading(true);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('lemmit_balance')
        .eq('id', user.id)
        .maybeSingle();

      setMyBalance(profileData?.lemmit_balance || 0);

      let query = supabase
        .from('api_logs')
        .select('*')
        .eq('endpoint', 'lemit-consulta-pessoa')
        .order('created_at', { ascending: false })
        .limit(500);

      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data: logsData, error } = await query;

      if (error) throw error;

      setLogs(logsData || []);
      setFilteredLogs(logsData || []);

      if (isAdmin) {
        const { data: allLogs } = await supabase
          .from('api_logs')
          .select('user_id, user_email, success, cost')
          .eq('endpoint', 'lemit-consulta-pessoa');

        const userStats = new Map<string, { email: string; total: number; gasto: number }>();

        allLogs?.forEach((log) => {
          if (log.user_id) {
            const existing = userStats.get(log.user_id) || { email: log.user_email || '', total: 0, gasto: 0 };
            existing.total += 1;
            existing.gasto += log.cost || 0;
            userStats.set(log.user_id, existing);
          }
        });

        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, name, email, lemmit_balance')
          .order('name');

        const balances: UserBalance[] = (profilesData || []).map((p) => {
          const stats = userStats.get(p.id) || { email: p.email, total: 0, gasto: 0 };
          return {
            id: p.id,
            name: p.name || p.email,
            email: p.email,
            lemmit_balance: p.lemmit_balance || 0,
            total_consultas: stats.total,
            total_gasto: stats.gasto,
          };
        });

        setUserBalances(balances);

        const total = balances.reduce((sum, b) => sum + b.lemmit_balance, 0);
        setTotalBalance(total);

        const nameMap = new Map<string, string>();
        profilesData?.forEach((p) => {
          nameMap.set(p.id, p.name || p.email);
        });
        setUserMap(nameMap);
      }
    } catch (error) {
      console.error('Error loading Lemmit data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleEditBalance = (userId: string, currentBalance: number) => {
    setEditingUserId(userId);
    setEditBalance(currentBalance.toFixed(2));
  };

  const handleSaveBalance = async (userId: string) => {
    try {
      const newBalance = parseFloat(editBalance);
      if (isNaN(newBalance) || newBalance < 0) {
        alert('Saldo inválido');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ lemmit_balance: newBalance })
        .eq('id', userId);

      if (error) throw error;

      setEditingUserId(null);
      await loadData();
    } catch (error) {
      console.error('Error updating balance:', error);
      alert('Erro ao atualizar saldo');
    }
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditBalance('');
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Uso Lemmit</h1>
          <p className="text-gray-600 mt-1">Acompanhe consultas e saldo da API Lemmit (R$ 0,12 por consulta)</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {isAdmin ? 'Saldo Geral' : 'Meu Saldo'}
                </p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">
                  R$ {isAdmin ? totalBalance.toFixed(2) : myBalance.toFixed(2)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Consultas</p>
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
                <p className="text-sm text-gray-600">Custo Total</p>
                <p className="text-2xl font-semibold text-gray-900 mt-1">R$ {stats.totalCost.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </Card>
        </div>

        {isAdmin && (
          <Card className="mb-6">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Saldo dos Usuários</h2>
            </div>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-gray-500">Carregando...</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Usuário
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        E-mail
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Saldo Atual
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Consultas
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Gasto
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {userBalances.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {editingUserId === user.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editBalance}
                                onChange={(e) => setEditBalance(e.target.value)}
                                className="w-24"
                              />
                              <button
                                onClick={() => handleSaveBalance(user.id)}
                                className="p-1 text-green-600 hover:text-green-800"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 text-gray-600 hover:text-gray-800"
                              >
                                <XIcon className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className={user.lemmit_balance < 0.12 ? 'text-red-600 font-semibold' : ''}>
                              R$ {user.lemmit_balance.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {user.total_consultas}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          R$ {user.total_gasto.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {editingUserId !== user.id && (
                            <button
                              onClick={() => handleEditBalance(user.id, user.lemmit_balance)}
                              className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              <Edit2 className="w-4 h-4" />
                              Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        )}

        <Card>
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Histórico de Consultas (Últimas 500)
              </h2>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-400" />
                  <Select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="min-w-[200px]"
                  >
                    <option value="todos">Todos os Usuários</option>
                    {userBalances.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-gray-500">Carregando...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                Nenhuma consulta encontrada
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
                      Custo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mensagem
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.map((log) => {
                    const cpf = log.request_body?.cpf || '-';
                    const userName = log.user_id ? userMap.get(log.user_id) || log.user_email || '-' : '-';
                    return (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {userName}
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.cost ? `R$ ${log.cost.toFixed(2)}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
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
