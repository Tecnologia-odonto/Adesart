import { X, AlertTriangle } from 'lucide-react';
import { Button } from '../Button';

interface ObservacoesEmpresaModalProps {
  observacoes: string;
  nomeEmpresa: string;
  onClose: () => void;
}

export function ObservacoesEmpresaModal({ observacoes, nomeEmpresa, onClose }: ObservacoesEmpresaModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Observações da Empresa</h2>
              <p className="text-sm text-slate-600 mt-0.5">{nomeEmpresa}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-amber-100 rounded-lg transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-amber-900 whitespace-pre-wrap leading-relaxed">
              {observacoes}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <Button onClick={onClose} variant="primary">
            Entendi
          </Button>
        </div>
      </div>
    </div>
  );
}
