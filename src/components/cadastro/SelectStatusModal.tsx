import { useState, useEffect } from 'react';
import { X, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../Button';

interface StatusAdesao {
  id: string;
  nome: string;
  cor: string;
}

interface SelectStatusModalProps {
  onSelect: (statusId: string) => void;
  onClose: () => void;
}

export function SelectStatusModal({ onSelect, onClose }: SelectStatusModalProps) {
  const [statusList, setStatusList] = useState<StatusAdesao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-semibold text-slate-800">
                Selecione o Status da Adesão
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-slate-600 mb-4">
            Escolha o status atual desta adesão para salvar o cadastro.
          </p>

          {loading ? (
            <div className="text-center py-8 text-slate-600">Carregando...</div>
          ) : statusList.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 mb-4">
                Nenhum status cadastrado. Configure os status em Configurações.
              </p>
              <Button onClick={onClose}>Fechar</Button>
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto">
                {statusList.map((status) => (
                  <button
                    key={status.id}
                    onClick={() => setSelectedId(status.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                      selectedId === status.id
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: status.cor }}
                      />
                      <span className="font-medium text-slate-800">{status.nome}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleConfirm}
                  disabled={!selectedId}
                  className="flex-1"
                >
                  Confirmar
                </Button>
                <Button
                  onClick={onClose}
                  variant="secondary"
                  className="flex-1"
                >
                  Cancelar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
