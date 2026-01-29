import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { Button } from '../Button';
import { Input } from '../Input';

interface StatusAdesao {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export function StatusAdesoesTable() {
  const [statusList, setStatusList] = useState<StatusAdesao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editCor, setEditCor] = useState('#6B7280');
  const [isAdding, setIsAdding] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newCor, setNewCor] = useState('#6B7280');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('status_adesoes')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      setStatusList(data || []);
    } catch (error) {
      console.error('Error fetching status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newNome.trim()) return;

    try {
      const maxOrdem = statusList.length > 0 ? Math.max(...statusList.map(s => s.ordem)) : 0;

      const { error } = await supabase
        .from('status_adesoes')
        .insert({
          nome: newNome.trim(),
          cor: newCor,
          ordem: maxOrdem + 1,
        });

      if (error) throw error;

      setNewNome('');
      setNewCor('#6B7280');
      setIsAdding(false);
      await fetchStatus();
    } catch (error) {
      console.error('Error adding status:', error);
      alert('Erro ao adicionar status');
    }
  };

  const handleEdit = (status: StatusAdesao) => {
    setEditingId(status.id);
    setEditNome(status.nome);
    setEditCor(status.cor);
  };

  const handleSave = async (id: string) => {
    if (!editNome.trim()) return;

    try {
      const { error } = await supabase
        .from('status_adesoes')
        .update({
          nome: editNome.trim(),
          cor: editCor,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setEditingId(null);
      await fetchStatus();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status');
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja excluir o status "${nome}"?`)) return;

    try {
      const { error } = await supabase
        .from('status_adesoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await fetchStatus();
    } catch (error) {
      console.error('Error deleting status:', error);
      alert('Erro ao excluir status');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditNome('');
    setEditCor('#6B7280');
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewNome('');
    setNewCor('#6B7280');
  };

  if (loading) {
    return <div className="text-center py-4">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-slate-800">Status de Adesões</h3>
        {!isAdding && (
          <Button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar Status
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
            <Input
              label="Nome do Status"
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              placeholder="Ex: Em Análise"
            />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cor
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={newCor}
                  onChange={(e) => setNewCor(e.target.value)}
                  className="h-10 w-20 rounded border border-slate-300 cursor-pointer"
                />
                <div
                  className="px-4 py-2 rounded-lg font-medium text-white"
                  style={{ backgroundColor: newCor }}
                >
                  Prévia
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
            <button
              onClick={handleCancelAdd}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Cor</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-700">Prévia</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-700">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {statusList.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  Nenhum status cadastrado
                </td>
              </tr>
            ) : (
              statusList.map((status) => (
                <tr key={status.id} className="hover:bg-slate-50">
                  {editingId === status.id ? (
                    <>
                      <td className="px-4 py-3">
                        <Input
                          value={editNome}
                          onChange={(e) => setEditNome(e.target.value)}
                          placeholder="Nome do status"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="color"
                          value={editCor}
                          onChange={(e) => setEditCor(e.target.value)}
                          className="h-10 w-20 rounded border border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="inline-block px-3 py-1 rounded-lg font-medium text-white text-sm"
                          style={{ backgroundColor: editCor }}
                        >
                          {editNome || 'Status'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleSave(status.id)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            title="Salvar"
                          >
                            <Save className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancel}
                            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 text-slate-800">{status.nome}</td>
                      <td className="px-4 py-3 text-slate-600 font-mono text-sm">{status.cor}</td>
                      <td className="px-4 py-3">
                        <div
                          className="inline-block px-3 py-1 rounded-lg font-medium text-white text-sm"
                          style={{ backgroundColor: status.cor }}
                        >
                          {status.nome}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(status)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            title="Editar"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(status.id, status.nome)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
