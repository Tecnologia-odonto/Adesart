import { FileText, Clock, AlertCircle, CheckCircle2, Eye, Ban, ChevronDown, ChevronRight, Building2 } from 'lucide-react';
import { useState } from 'react';
import { Cadastro } from '../../hooks/useCadastros';
import { formatCPF, formatDate } from '../../lib/cpf';
import { AlreadyExistsModal } from './AlreadyExistsModal';

interface CadastrosIncompletosListProps {
  cadastros: Cadastro[];
  onSelect: (cadastro: Cadastro) => void;
}

interface EmpresaGroup {
  empresaId: number | null;
  empresaNome: string;
  empresaCnpj: string | null;
  cadastros: Cadastro[];
}

export function CadastrosIncompletosList({ cadastros, onSelect }: CadastrosIncompletosListProps) {
  const [viewERPData, setViewERPData] = useState<Cadastro | null>(null);
  const [expandedEmpresas, setExpandedEmpresas] = useState<Set<string>>(new Set());
  const incompletos = cadastros.filter((c) => c.status === 'incompleto');

  const empresasGrouped: EmpresaGroup[] = [];
  const cadastrosMap = new Map<string, Cadastro[]>();

  incompletos.forEach((cadastro) => {
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

  const getStatusConfig = (status: Cadastro['status']) => {
    switch (status) {
      case 'incompleto':
        return {
          icon: Clock,
          color: 'text-amber-600',
          bg: 'bg-amber-50',
          label: 'Incompleto',
        };
      case 'enviado':
        return {
          icon: CheckCircle2,
          color: 'text-green-600',
          bg: 'bg-green-50',
          label: 'Enviado',
        };
      case 'erro_envio':
        return {
          icon: AlertCircle,
          color: 'text-red-600',
          bg: 'bg-red-50',
          label: 'Erro no Envio',
        };
    }
  };

  if (incompletos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
        <div className="text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum cadastro incompleto</p>
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
                  <span className="ml-2 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
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
                    const statusConfig = getStatusConfig(cadastro.status);
                    const StatusIcon = statusConfig.icon;
                    const isBlocked = !!cadastro.motivo_bloqueio;
                    const hasERPData = cadastro.erp_dados_associado && Object.keys(cadastro.erp_dados_associado as object).length > 0;

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
                              {isBlocked && (
                                <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600">
                                  <Ban className="w-3 h-3 mr-1" />
                                  Bloqueado
                                </span>
                              )}
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
                              {isBlocked && (
                                <p className="text-red-600 text-xs">
                                  <span className="font-semibold">Motivo:</span> {cadastro.motivo_bloqueio}
                                </p>
                              )}
                              <p className="text-xs text-slate-500">
                                Atualizado em {new Date(cadastro.updated_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>

                          <div className="flex-shrink-0 flex gap-2">
                            {hasERPData && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewERPData(cadastro);
                                }}
                                className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Ver dados do ERP"
                              >
                                <Eye className="w-5 h-5" />
                              </button>
                            )}
                            {!isBlocked && (
                              <button
                                onClick={() => onSelect(cadastro)}
                                className="text-emerald-600 hover:text-emerald-700 font-medium text-sm px-3 py-1.5 bg-white rounded-lg border border-emerald-200 hover:border-emerald-300 transition-colors"
                              >
                                Continuar →
                              </button>
                            )}
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

      {viewERPData && viewERPData.erp_dados_associado && (
        <AlreadyExistsModal
          cpf={formatCPF(viewERPData.cpf)}
          summary={(viewERPData.erp_dados_associado as any).summary || {
            empresa: null,
            codigo: null,
            nomeFantasiaDaEmpresa: null,
          }}
          dados={(viewERPData.erp_dados_associado as any).dados}
          onClose={() => setViewERPData(null)}
        />
      )}
    </>
  );
}
