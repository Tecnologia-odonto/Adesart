import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Team } from '../lib/supabase';
import { Plus, X, Users as UsersIcon, CheckCircle, XCircle } from 'lucide-react';

export function Teams() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [error, setError] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamMemberCounts, setTeamMemberCounts] = useState<Record<string, number>>({});

  const canCreate = profile?.role === 'ADMINISTRADOR';

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (error) throw error;

      setTeams(data || []);

      const counts: Record<string, number> = {};
      for (const team of data || []) {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id)
          .eq('is_active', true);

        counts[team.id] = count || 0;
      }
      setTeamMemberCounts(counts);
    } catch (error) {
      console.error('Error fetching teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreateLoading(true);

    try {
      const { error } = await supabase
        .from('teams')
        .insert({ name: teamName });

      if (error) throw error;

      setShowCreateModal(false);
      setTeamName('');
      fetchTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar equipe');
      console.error('Error creating team:', err);
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Equipes</h1>
            <p className="text-slate-600 mt-1 text-sm sm:text-base">Gerencie as equipes do sistema</p>
          </div>
          {canCreate && (
            <Button onClick={() => setShowCreateModal(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Nova Equipe
            </Button>
          )}
        </div>

        <Card>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
            </div>
          ) : teams.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-slate-500">Nenhuma equipe encontrada</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow bg-white"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-slate-800 mb-1">
                        {team.name}
                      </h3>
                      <div className="flex items-center text-sm text-slate-600">
                        <UsersIcon className="w-4 h-4 mr-1" />
                        {teamMemberCounts[team.id] || 0} {teamMemberCounts[team.id] === 1 ? 'membro' : 'membros'}
                      </div>
                    </div>
                    {team.is_active ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      team.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {team.is_active ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full my-8">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-800">Nova Equipe</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeam} className="p-6 space-y-4">
              <Input
                label="Nome da Equipe"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Digite o nome da equipe"
                required
              />

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full sm:flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={createLoading} className="w-full sm:flex-1">
                  {createLoading ? 'Criando...' : 'Criar Equipe'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
