import { FileText, CheckCircle2, Eye, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Cadastro } from '../../hooks/useCadastros';
import { formatCPF, formatDate } from '../../lib/cpf';

interface CadastrosCompletosListProps {
  cadastros: Cadastro[];
}

interface EmpresaGroup {
  empresaId: number | null;
  empresaNome: string;
  empresaCnpj: string | null;
  cadastros: Cadastro[];
}

export function CadastrosCompletosList({ cadastros }: CadastrosCompletosListProps) {
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<string>>(new Set());
  const [viewDetails, setViewDetails] = useState<Cadastro | null>(null);
  const completos = cadastros.filter((c) => c.status === 'enviado');

  const empresasGrouped: EmpresaGroup[] = [];
  const cadastrosMap = new Map<string, Cadastro[]>();

  completos.forEach((cadastro) => {
    const key = cadastro.empresa_id !== null ? `empresa_${cadastro.empresa_id}` : 'sem_empresa';
    if (!cadastrosMap.has(key)) {
      cadastrosMap.set(key, []);
    }
    cadastrosMap.get(key)!.push(cadastro);
  });

  cadastrosMap.forEach((cads, key) => {
    const firstCadastro = cads[0];
    empresasGrouped.push({
      empresaId: firstCadastro.empresa_id,
      empresaNome: firstCadastro.empresa_nome || 'Empresa não informada',
      empresaCnpj: firstCadastro.empresa_cnpj,
      cadastros: cads,
    });
  });

  empresasGrouped.sort((a, b) => {
    if (a.empresaId === null) return 1;
    if (b.empresaId === null) return -1;
    return a.empresaNome.localeCompare(b.empresaNome);
  });

  const toggleEmpresa = (empresaKey: string) => {
    const newExpanded = new Set(expandedEmpresas);
    if (newExpanded.has(empresaKey)) {
      newExpanded.delete(empresaKey);
    } else {
      newExpanded.add(empresaKey);
    }
    setExpandedEmpresas(newExpanded);
  };

  if (completos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
        <div className="text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum atendimento completo</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {empresasGrouped.map((empresa) => {
          const empresaKey = empresa.empresaId !== null ? `empresa_${empresa.empresaId}` : 'sem_empresa';
          const isExpanded = expandedEmpresas.has(empresaKey);

          return (
            <div key={empresaKey} className="bg-white rounded-xl shadow-sm border border-slate-200">
              <button
                onClick={() => toggleEmpresa(empresaKey)}
                className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                  <div className="text-left">
                    <h3 className="font-semibold text-slate-800">{empresa.empresaNome}</h3>
                    {empresa.empresaCnpj && (
                      <p className="text-xs text-slate-500">CNPJ: {empresa.empresaCnpj}</p>
                    )}
                  </div>
                  <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    {empresa.cadastros.length}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 p-4 space-y-3">
                  {empresa.cadastros.map((cadastro) => {
                    return (
                      <div
                        key={cadastro.id}
                        className="bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h4 className="font-medium text-slate-800 truncate">
                                {cadastro.nome || 'Nome não informado'}
                              </h4>
                              <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-green-50 text-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Completo
                              </span>
                            </div>

                            <div className="space-y-1 text-sm text-slate-600">
                              <p>
                                <span className="font-medium">CPF:</span> {formatCPF(cadastro.cpf)}
                              </p>
                              {cadastro.data_nascimento && (
                                <p>
                                  <span className="font-medium">Nascimento:</span>{' '}
                                  {formatDate(cadastro.data_nascimento)}
                                </p>
                              )}
                              <p className="text-xs text-slate-500">
                                Enviado em {new Date(cadastro.updated_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>

                          <div className="flex-shrink-0 flex gap-2">
                            <button
                              onClick={() => setViewDetails(cadastro)}
                              className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Ver detalhes"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {viewDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-800">Detalhes do Cadastro</h3>
              <button
                onClick={() => setViewDetails(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-600">Nome</p>
                <p className="text-slate-800">{viewDetails.nome}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-600">CPF</p>
                <p className="text-slate-800">{formatCPF(viewDetails.cpf)}</p>
              </div>

              {viewDetails.data_nascimento && (
                <div>
                  <p className="text-sm font-medium text-slate-600">Data de Nascimento</p>
                  <p className="text-slate-800">{formatDate(viewDetails.data_nascimento)}</p>
                </div>
              )}

              {viewDetails.erp_response && (
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-2">Resposta do ERP</p>
                  <pre className="bg-slate-50 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(viewDetails.erp_response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
