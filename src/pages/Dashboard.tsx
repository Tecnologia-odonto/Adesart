import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Team } from '../lib/supabase';
import { Users, Briefcase, Shield, TrendingUp, FileText, Loader2, CheckCircle } from 'lucide-react';
import { useCadastros } from '../hooks/useCadastros';
import { StatsByVendedorModal } from '../components/dashboard/StatsByVendedorModal';

interface VendedorStats {
  vendedor_id: string;
  vendedor_nome: string;
  total: number;
  incompletos: number;
  enviados: number;
}

export function Dashboard() {
  const { profile } = useAuth();
  const { stats: cadastroStats, loading: cadastroLoading } = useCadastros();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTeams: 0,
    activeUsers: 0,
  });
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'total' | 'pendentes' | 'cadastrados'>('total');
  const [modalTipoCadastro, setModalTipoCadastro] = useState<'cadastro' | 'inclusao_dependente'>('cadastro');
  const [vendedorStats, setVendedorStats] = useState<VendedorStats[]>([]);

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
  const canViewByVendedor = profile?.role && ['ADMINISTRADOR', 'GERENTE', 'SUPERVISOR'].includes(profile.role);

  const handleCardClick = async (
    type: 'total' | 'pendentes' | 'cadastrados',
    tipoCadastro: 'cadastro' | 'inclusao_dependente'
  ) => {
    if (!canViewByVendedor || !profile?.id) return;

    try {
      const { data, error } = await supabase.rpc('get_cadastros_stats_by_vendedor', {
        p_user_id: profile.id,
        p_tipo_cadastro: tipoCadastro,
      });

      if (error) throw error;

      setVendedorStats(data || []);
      setModalType(type);
      setModalTipoCadastro(tipoCadastro);
      setModalOpen(true);
    } catch (error) {
      console.error('Error fetching stats by vendedor:', error);
    }
  };

  const getModalTitle = () => {
    const tipoLabel = modalTipoCadastro === 'cadastro' ? 'Cadastro' : 'Inclusão de Dependente';
    switch (modalType) {
      case 'total':
        return `Total de ${tipoLabel} por Vendedor`;
      case 'pendentes':
        return `${tipoLabel} Pendentes por Vendedor`;
      case 'cadastrados':
        return `${tipoLabel} Enviados por Vendedor`;
      default:
        return '';
    }
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">Bem-vindo ao Adesao+</p>
        </div>

        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800 mb-4">Estatísticas - Mês Atual</h2>
          {cadastroLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Bloco de Cadastro */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-700 mb-3">Cadastro</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div
                    onClick={() => handleCardClick('total', 'cadastro')}
                    className={`bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 sm:p-6 transition-all hover:shadow-md ${canViewByVendedor ? 'cursor-pointer hover:scale-105' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-blue-900">
                      {cadastroStats.cadastro_total}
                    </p>
                    <p className="text-sm sm:text-base text-blue-700 font-medium mt-2">Total</p>
                    <p className="text-xs text-blue-600 mt-1">
                      {cadastroStats.cadastro_cadastros} cadastros + {cadastroStats.cadastro_dependentes} dependentes
                    </p>
                  </div>

                  <div
                    onClick={() => handleCardClick('pendentes', 'cadastro')}
                    className={`bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4 sm:p-6 transition-all hover:shadow-md ${canViewByVendedor ? 'cursor-pointer hover:scale-105' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-amber-500 rounded-lg">
                        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-amber-900">
                      {cadastroStats.cadastro_incompletos}
                    </p>
                    <p className="text-sm sm:text-base text-amber-700 font-medium mt-2">Pendentes</p>
                    <p className="text-xs text-amber-600 mt-1">
                      {cadastroStats.cadastro_incompletos_cadastros} cadastros + {cadastroStats.cadastro_incompletos_dependentes} dependentes
                    </p>
                  </div>

                  <div
                    onClick={() => handleCardClick('cadastrados', 'cadastro')}
                    className={`bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 sm:p-6 transition-all hover:shadow-md ${canViewByVendedor ? 'cursor-pointer hover:scale-105' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-emerald-500 rounded-lg">
                        <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-emerald-900">
                      {cadastroStats.cadastro_enviados}
                    </p>
                    <p className="text-sm sm:text-base text-emerald-700 font-medium mt-2">Cadastrados</p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {cadastroStats.cadastro_enviados_cadastros} cadastros + {cadastroStats.cadastro_enviados_dependentes} dependentes
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloco de Inclusão de Dependente */}
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-700 mb-3">Inclusão de Dependente</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div
                    onClick={() => handleCardClick('total', 'inclusao_dependente')}
                    className={`bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4 sm:p-6 transition-all hover:shadow-md ${canViewByVendedor ? 'cursor-pointer hover:scale-105' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-blue-500 rounded-lg">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-blue-900">
                      {cadastroStats.inclusao_total}
                    </p>
                    <p className="text-sm sm:text-base text-blue-700 font-medium mt-2">Total</p>
                    <p className="text-xs text-blue-600 mt-1">
                      {cadastroStats.inclusao_cadastros} cadastros + {cadastroStats.inclusao_dependentes} dependentes
                    </p>
                  </div>

                  <div
                    onClick={() => handleCardClick('pendentes', 'inclusao_dependente')}
                    className={`bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4 sm:p-6 transition-all hover:shadow-md ${canViewByVendedor ? 'cursor-pointer hover:scale-105' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-amber-500 rounded-lg">
                        <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-amber-900">
                      {cadastroStats.inclusao_incompletos}
                    </p>
                    <p className="text-sm sm:text-base text-amber-700 font-medium mt-2">Pendentes</p>
                    <p className="text-xs text-amber-600 mt-1">
                      {cadastroStats.inclusao_incompletos_cadastros} cadastros + {cadastroStats.inclusao_incompletos_dependentes} dependentes
                    </p>
                  </div>

                  <div
                    onClick={() => handleCardClick('cadastrados', 'inclusao_dependente')}
                    className={`bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4 sm:p-6 transition-all hover:shadow-md ${canViewByVendedor ? 'cursor-pointer hover:scale-105' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 bg-emerald-500 rounded-lg">
                        <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold text-emerald-900">
                      {cadastroStats.inclusao_enviados}
                    </p>
                    <p className="text-sm sm:text-base text-emerald-700 font-medium mt-2">Cadastrados</p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {cadastroStats.inclusao_enviados_cadastros} cadastros + {cadastroStats.inclusao_enviados_dependentes} dependentes
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <StatsByVendedorModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={getModalTitle()}
          stats={vendedorStats}
          type={modalType}
        />

        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-slate-800 mb-3">Visão Geral</h2>
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
