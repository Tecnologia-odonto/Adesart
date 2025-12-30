import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Team } from '../lib/supabase';
import { Users, Briefcase, Shield, TrendingUp } from 'lucide-react';

export function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeams: 0,
    activeUsers: 0,
  });
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count: totalUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        const { count: activeUsers } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        const { count: totalTeams } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true });

        setStats({
          totalUsers: totalUsers || 0,
          totalTeams: totalTeams || 0,
          activeUsers: activeUsers || 0,
        });

        if (profile?.team_id) {
          const { data: teamData } = await supabase
            .from('teams')
            .select('*')
            .eq('id', profile.team_id)
            .maybeSingle();

          setTeam(teamData);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [profile]);

  const roleDescriptions: Record<string, string> = {
    ADMINISTRADOR: 'Acesso total ao sistema',
    GERENTE: 'Gerenciamento de equipes e usuários',
    SUPERVISOR: 'Supervisão de equipe',
    VENDEDOR: 'Execução de vendas',
    ADESIONISTA: 'Processos de adesão',
  };

  const canViewStats = profile?.role && ['ADMINISTRADOR', 'GERENTE'].includes(profile.role);

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">Bem-vindo ao Adesao+</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card>
            <div className="flex items-center">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Shield className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-slate-600">Seu Perfil</p>
                <p className="text-2xl font-bold text-slate-800">{profile?.role}</p>
              </div>
            </div>
            <p className="text-sm text-slate-500 mt-3">
              {profile?.role ? roleDescriptions[profile.role] : ''}
            </p>
          </Card>

          {team && (
            <Card>
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Briefcase className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-slate-600">Sua Equipe</p>
                  <p className="text-2xl font-bold text-slate-800">{team.name}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-3">
                {team.is_active ? 'Equipe ativa' : 'Equipe inativa'}
              </p>
            </Card>
          )}

          {canViewStats && (
            <Card>
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm text-slate-600">Usuários Ativos</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.activeUsers}</p>
                </div>
              </div>
              <p className="text-sm text-slate-500 mt-3">
                Total de {stats.totalUsers} usuários
              </p>
            </Card>
          )}
        </div>

        {canViewStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Estatísticas do Sistema">
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center">
                      <Users className="w-5 h-5 text-slate-600 mr-3" />
                      <span className="text-slate-700">Total de Usuários</span>
                    </div>
                    <span className="font-semibold text-slate-800">{stats.totalUsers}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center">
                      <Briefcase className="w-5 h-5 text-slate-600 mr-3" />
                      <span className="text-slate-700">Total de Equipes</span>
                    </div>
                    <span className="font-semibold text-slate-800">{stats.totalTeams}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center">
                      <Shield className="w-5 h-5 text-slate-600 mr-3" />
                      <span className="text-slate-700">Usuários Ativos</span>
                    </div>
                    <span className="font-semibold text-slate-800">{stats.activeUsers}</span>
                  </div>
                </div>
              )}
            </Card>

            <Card title="Informações do Usuário">
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-600">Nome</label>
                  <p className="text-slate-800 font-medium">{profile?.name}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">Email</label>
                  <p className="text-slate-800 font-medium">{profile?.email}</p>
                </div>
                <div>
                  <label className="text-sm text-slate-600">Função</label>
                  <p className="text-slate-800 font-medium">{profile?.role}</p>
                </div>
                {profile?.external_id && (
                  <div>
                    <label className="text-sm text-slate-600">ID Externo</label>
                    <p className="text-slate-800 font-medium">{profile.external_id}</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {!canViewStats && (
          <Card title="Informações do Usuário">
            <div className="space-y-3">
              <div>
                <label className="text-sm text-slate-600">Nome</label>
                <p className="text-slate-800 font-medium">{profile?.name}</p>
              </div>
              <div>
                <label className="text-sm text-slate-600">Email</label>
                <p className="text-slate-800 font-medium">{profile?.email}</p>
              </div>
              <div>
                <label className="text-sm text-slate-600">Função</label>
                <p className="text-slate-800 font-medium">{profile?.role}</p>
              </div>
              {profile?.external_id && (
                <div>
                  <label className="text-sm text-slate-600">ID Externo</label>
                  <p className="text-slate-800 font-medium">{profile.external_id}</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
