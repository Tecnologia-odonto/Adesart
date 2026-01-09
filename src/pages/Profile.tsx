import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Team } from '../lib/supabase';
import { User, Mail, Shield, Briefcase, Hash, Calendar } from 'lucide-react';

export function Profile() {
  const { profile, refreshProfile } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [name, setName] = useState('');
  const [externalId, setExternalId] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setExternalId(profile.external_id || '');
      if (profile.team_id) {
        fetchTeam();
      }
    }
  }, [profile]);

  const fetchTeam = async () => {
    if (!profile?.team_id) return;

    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', profile.team_id)
        .maybeSingle();

      if (error) throw error;
      setTeam(data);
    } catch (error) {
      console.error('Error fetching team:', error);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const updateData: { name: string; external_id?: string } = { name };

      if (externalId.trim()) {
        updateData.external_id = externalId.trim();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profile?.id);

      if (error) throw error;

      await refreshProfile();
      setSuccess('Perfil atualizado com sucesso!');
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar perfil');
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const roleLabels: Record<string, string> = {
    ADMINISTRADOR: 'Administrador',
    GERENTE: 'Gerente',
    SUPERVISOR: 'Supervisor',
    VENDEDOR: 'Vendedor',
    ADESIONISTA: 'Adesionista',
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800">Meu Perfil</h1>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">Gerencie suas informações pessoais</p>
        </div>

        <Card title="Informações Pessoais">
          <form onSubmit={handleUpdateProfile} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <User className="w-4 h-4 mr-2" />
                  <span className="font-medium">Nome</span>
                </div>
                {editing ? (
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{profile?.name}</p>
                )}
              </div>

              <div>
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <Mail className="w-4 h-4 mr-2" />
                  <span className="font-medium">Email</span>
                </div>
                <p className="text-slate-800 font-medium">{profile?.email}</p>
              </div>

              <div>
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <Shield className="w-4 h-4 mr-2" />
                  <span className="font-medium">Função</span>
                </div>
                <p className="text-slate-800 font-medium">
                  {profile?.role ? roleLabels[profile.role] : '-'}
                </p>
              </div>

              <div>
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <Hash className="w-4 h-4 mr-2" />
                  <span className="font-medium">Código do Usuário (ID Externo)</span>
                </div>
                {editing ? (
                  <Input
                    value={externalId}
                    onChange={(e) => setExternalId(e.target.value)}
                    placeholder="Insira seu código do ERP"
                  />
                ) : (
                  <p className="text-slate-800 font-medium">{profile?.external_id || '-'}</p>
                )}
                {editing && (
                  <p className="text-xs text-slate-500 mt-1">
                    Necessário para cadastrar clientes no sistema
                  </p>
                )}
              </div>

              {team && (
                <div>
                  <div className="flex items-center text-sm text-slate-600 mb-2">
                    <Briefcase className="w-4 h-4 mr-2" />
                    <span className="font-medium">Equipe</span>
                  </div>
                  <p className="text-slate-800 font-medium">{team.name}</p>
                </div>
              )}

              <div>
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span className="font-medium">Membro desde</span>
                </div>
                <p className="text-slate-800 font-medium">
                  {profile?.created_at ? formatDate(profile.created_at) : '-'}
                </p>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {success}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              {editing ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setEditing(false);
                      setName(profile?.name || '');
                      setExternalId(profile?.external_id || '');
                      setError('');
                      setSuccess('');
                    }}
                    className="w-full sm:w-auto"
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </>
              ) : (
                <Button type="button" onClick={() => setEditing(true)} className="w-full sm:w-auto">
                  Editar Perfil
                </Button>
              )}
            </div>
          </form>
        </Card>

        <Card title="Permissões">
          <div className="space-y-3">
            <p className="text-slate-600 text-sm">
              Como <span className="font-semibold">{profile?.role ? roleLabels[profile.role] : ''}</span>, você tem as seguintes permissões:
            </p>
            <ul className="list-disc list-inside space-y-2 text-slate-700 text-sm">
              {profile?.role === 'ADMINISTRADOR' && (
                <>
                  <li>Acesso total ao sistema</li>
                  <li>Criar, editar e excluir usuários e equipes</li>
                  <li>Visualizar todos os dados do sistema</li>
                </>
              )}
              {profile?.role === 'GERENTE' && (
                <>
                  <li>Visualizar todas as equipes e usuários</li>
                  <li>Criar e editar usuários</li>
                  <li>Acesso a relatórios e estatísticas</li>
                </>
              )}
              {profile?.role === 'SUPERVISOR' && (
                <>
                  <li>Visualizar e gerenciar sua equipe</li>
                  <li>Criar e editar usuários da sua equipe</li>
                  <li>Acesso aos dados da sua equipe</li>
                </>
              )}
              {(profile?.role === 'VENDEDOR' || profile?.role === 'ADESIONISTA') && (
                <>
                  <li>Visualizar seu próprio perfil</li>
                  <li>Editar suas informações pessoais</li>
                  <li>Acesso às funcionalidades básicas do sistema</li>
                </>
              )}
            </ul>
          </div>
        </Card>
      </div>
    </Layout>
  );
}
