import { useState, useEffect } from 'react';
import { X, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../Button';
import { supabase, Team, Profile } from '../../lib/supabase';

interface EditTeamMembersModalProps {
  team: Team;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditTeamMembersModal({ team, onClose, onSuccess }: EditTeamMembersModalProps) {
  const [members, setMembers] = useState<Profile[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [team.id]);

  const fetchData = async () => {
    try {
      setLoadingData(true);

      const { data: teamMembers, error: membersError } = await supabase
        .from('profiles')
        .select('*')
        .eq('team_id', team.id)
        .in('role', ['VENDEDOR', 'ADESIONISTA'])
        .eq('is_active', true)
        .order('name');

      if (membersError) throw membersError;

      const { data: usersWithoutTeam, error: usersError } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['VENDEDOR', 'ADESIONISTA'])
        .is('team_id', null)
        .eq('is_active', true)
        .order('name');

      if (usersError) throw usersError;

      setMembers(teamMembers || []);
      setAvailableUsers(usersWithoutTeam || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoadingData(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: team.id })
        .eq('id', userId);

      if (error) throw error;

      await fetchData();
      onSuccess();
    } catch (err) {
      console.error('Error adding member:', err);
      setError(err instanceof Error ? err.message : 'Erro ao adicionar membro');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('id', userId);

      if (error) throw error;

      await fetchData();
      onSuccess();
    } catch (err) {
      console.error('Error removing member:', err);
      setError(err instanceof Error ? err.message : 'Erro ao remover membro');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Gerenciar Membros</h2>
            <p className="text-sm text-slate-600 mt-1">{team.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">Vendedores da Equipe</h3>
            {loadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
              </div>
            ) : (
              <>
                {members.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">Nenhum vendedor na equipe</p>
                ) : (
                  <div className="space-y-2 mb-4">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                      >
                        <div>
                          <p className="font-medium text-slate-800">{member.name}</p>
                          <p className="text-sm text-slate-600">
                            {member.role} {member.external_id && `- Código: ${member.external_id}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {availableUsers.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">
                      Adicionar Vendedores
                    </h4>
                    <div className="space-y-2">
                      {availableUsers.map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200 hover:border-emerald-300 transition-colors"
                        >
                          <div>
                            <p className="font-medium text-slate-800">{user.name}</p>
                            <p className="text-sm text-slate-600">
                              {user.role} {user.external_id && `- Código: ${user.external_id}`}
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={() => handleAddMember(user.id)}
                            size="sm"
                          >
                            Adicionar
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-slate-200">
            <Button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
