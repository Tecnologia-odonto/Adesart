import { X } from 'lucide-react';
import { Button } from '../Button';

interface VisualizarArquivoModalProps {
  arquivo: {
    nome: string;
    base64: string;
  };
  onClose: () => void;
}

export function VisualizarArquivoModal({ arquivo, onClose }: VisualizarArquivoModalProps) {
  const isPDF = arquivo.nome.toLowerCase().endsWith('.pdf');
  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(arquivo.nome);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Visualizar Arquivo
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          <div className="mb-3">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Nome do arquivo:</span> {arquivo.nome}
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {isPDF ? (
              <iframe
                src={arquivo.base64}
                className="w-full h-[70vh]"
                title={arquivo.nome}
              />
            ) : isImage ? (
              <div className="flex items-center justify-center p-4">
                <img
                  src={arquivo.base64}
                  alt={arquivo.nome}
                  className="max-w-full h-auto max-h-[70vh] object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center p-8 text-gray-500">
                <p>Tipo de arquivo não suportado para visualização</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
