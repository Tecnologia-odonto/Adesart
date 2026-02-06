import { FileText, Clock, AlertCircle, CheckCircle2, Eye, Ban, User, Search, X, Filter, Tag } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { Cadastro } from '../../hooks/useCadastros';
import { formatCPF, formatDate } from '../../lib/cpf';
import { AlreadyExistsModal } from './AlreadyExistsModal';
import { Input } from '../Input';
import { Select } from '../Select';
import { Button } from '../Button';
import { useAuth } from '../../contexts/AuthContext';
import { CadastrosSupervisorView } from './CadastrosSupervisorView';
import { CadastrosGerenteView } from './CadastrosGerenteView';
import { supabase } from '../../lib/supabase';

interface CadastrosIncompletosListProps {
  cadastros: Cadastro[];
  onSelect: (cadastro: Cadastro) => void;
  onRefresh?: () => void;
}

interface StatusAdesao {
  id: string;
  nome: string;
  cor: string;
}

interface ClienteGroup {
  cpf: string;
  nome: string | null;
  cadastros: Cadastro[];
}

interface UserProfile {
  id: string;
  name: string;
}

export function CadastrosIncompletosList({ cadastros, onSelect, onRefresh }: CadastrosIncompletosListProps) {
  const { profile } = useAuth();
  const [viewERPData, setViewERPData] = useState<Cadastro | null>(null);
  const [statusList, setStatusList] = useState<StatusAdesao[]>([]);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [buscaClienteAplicada, setBuscaClienteAplicada] = useState('');
  const [buscaEmpresa, setBuscaEmpresa] = useState('');
  const [buscaEmpresaAplicada, setBuscaEmpresaAplicada] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [dataInicioAplicada, setDataInicioAplicada] = useState('');
  const [dataFimAplicada, setDataFimAplicada] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'cadastro' | 'inclusao_dependente'>('todos');
  const [tipoFiltroAplicado, setTipoFiltroAplicado] = useState<'todos' | 'cadastro' | 'inclusao_dependente'>('todos');
  const [statusAdesaoFiltro, setStatusAdesaoFiltro] = useState('');
  const [statusAdesaoFiltroAplicado, setStatusAdesaoFiltroAplicado] = useState('');
  const [criadoPorFiltro, setCriadoPorFiltro] = useState('');
  const [criadoPorFiltroAplicado, setCriadoPorFiltroAplicado] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);

  const incompletos = cadastros.filter((c) => c.status === 'incompleto');

  const criadoresPorUnicos = useMemo(() => {
    const criadoresSet = new Map<string, string>();
    incompletos.forEach((c) => {
      if (c.created_by) {
        const user = users.find(u => u.id === c.created_by);
        if (user) {
          criadoresSet.set(c.created_by, user.name);
        }
      }
    });
    return Array.from(criadoresSet.entries())
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [incompletos, users]);

  useEffect(() => {
    fetchStatus();
    fetchUsers();
    setDefaultDateFilter();
  }, []);

  const setDefaultDateFilter = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayStr = firstDay.toISOString().split('T')[0];
    setDataInicio(firstDayStr);
    setDataInicioAplicada(firstDayStr);
  };

  const fetchStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('status_adesoes')
        .select('*')
        .order('ordem', { ascending: true });

      if (error) throw error;
      setStatusList(data || []);
    } catch (error) {
      console.error('Error fetching status:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleAplicarFiltros = () => {
    setBuscaClienteAplicada(buscaCliente);
    setBuscaEmpresaAplicada(buscaEmpresa);
    setDataInicioAplicada(dataInicio);
    setDataFimAplicada(dataFim);
    setTipoFiltroAplicado(tipoFiltro);
    setStatusAdesaoFiltroAplicado(statusAdesaoFiltro);
    setCriadoPorFiltroAplicado(criadoPorFiltro);
  };

  const handleChangeStatus = async (cadastroId: string, statusId: string) => {
    try {
      const { error } = await supabase
        .from('cadastros')
        .update({ status_adesao_id: statusId })
        .eq('id', cadastroId);

      if (error) throw error;

      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status');
    }
  };

  if (profile?.role === 'SUPERVISOR') {
    return <CadastrosSupervisorView cadastros={cadastros} onSelect={onSelect} statusFilter="incompleto" />;
  }

  if (profile?.role === 'GERENTE') {
    return <CadastrosGerenteView cadastros={cadastros} onSelect={onSelect} statusFilter="incompleto" />;
  }

  const cadastrosFiltrados = useMemo(() => {
    return incompletos.filter((cadastro) => {
      const buscaClienteLower = buscaClienteAplicada.toLowerCase().trim();
      const buscaClienteNumeros = buscaClienteAplicada.replace(/\D/g, '');

      let matchCliente = true;
      if (buscaClienteAplicada) {
        matchCliente =
          cadastro.nome?.toLowerCase().includes(buscaClienteLower) ||
          cadastro.cpf.includes(buscaClienteNumeros) ||
          false;

        if (!matchCliente && cadastro.dependentes) {
          const dependentesArray = Array.isArray(cadastro.dependentes) ? cadastro.dependentes : [];
          matchCliente = dependentesArray.some((dep: any) => {
            return (
              dep.nome?.toLowerCase().includes(buscaClienteLower) ||
              (dep.cpf && dep.cpf.replace(/\D/g, '').includes(buscaClienteNumeros))
            );
          });
        }
      }

      const buscaEmpresaLower = buscaEmpresaAplicada.toLowerCase().trim();
      const buscaEmpresaNumeros = buscaEmpresaAplicada.replace(/\D/g, '');

      let matchEmpresa = true;
      if (buscaEmpresaAplicada) {
        matchEmpresa =
          cadastro.empresa_nome?.toLowerCase().includes(buscaEmpresaLower) ||
          cadastro.empresa_cnpj?.replace(/\D/g, '').includes(buscaEmpresaNumeros) ||
          (cadastro.empresa_codigo && cadastro.empresa_codigo.toString().includes(buscaEmpresaNumeros)) ||
          false;
      }

      const dataCadastro = new Date(cadastro.created_at);
      const matchDataInicio = !dataInicioAplicada || dataCadastro >= new Date(dataInicioAplicada);
      const matchDataFim = !dataFimAplicada || dataCadastro <= new Date(dataFimAplicada + 'T23:59:59');

      let matchTipo = true;
      if (tipoFiltroAplicado !== 'todos') {
        matchTipo = cadastro.tipo_cadastro === tipoFiltroAplicado;
      }

      let matchStatusAdesao = true;
      if (statusAdesaoFiltroAplicado) {
        matchStatusAdesao = cadastro.status_adesao_id === statusAdesaoFiltroAplicado;
      }

      let matchCriadoPor = true;
      if (criadoPorFiltroAplicado) {
        matchCriadoPor = cadastro.created_by === criadoPorFiltroAplicado;
      }

      return matchCliente && matchEmpresa && matchDataInicio && matchDataFim && matchTipo && matchStatusAdesao && matchCriadoPor;
    });
  }, [incompletos, buscaClienteAplicada, buscaEmpresaAplicada, dataInicioAplicada, dataFimAplicada, tipoFiltroAplicado, statusAdesaoFiltroAplicado, criadoPorFiltroAplicado]);

  const clientesGrouped: ClienteGroup[] = useMemo(() => {
    const clientesMap = new Map<string, Cadastro[]>();

    cadastrosFiltrados.forEach((cadastro) => {
      const cpf = cadastro.cpf;
      if (!clientesMap.has(cpf)) {
        clientesMap.set(cpf, []);
      }
      clientesMap.get(cpf)!.push(cadastro);
    });

    const groups: ClienteGroup[] = [];
    clientesMap.forEach((cads, cpf) => {
      groups.push({
        cpf,
        nome: cads[0].nome,
        cadastros: cads,
      });
    });

    return groups.sort((a, b) => {
      const nomeA = a.nome || '';
      const nomeB = b.nome || '';
      return nomeA.localeCompare(nomeB);
    });
  }, [cadastrosFiltrados]);

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

  const limparFiltros = () => {
    setBuscaCliente('');
    setBuscaClienteAplicada('');
    setBuscaEmpresa('');
    setBuscaEmpresaAplicada('');
    setDataInicio('');
    setDataFim('');
    setDataInicioAplicada('');
    setDataFimAplicada('');
    setTipoFiltro('todos');
    setTipoFiltroAplicado('todos');
    setStatusAdesaoFiltro('');
    setStatusAdesaoFiltroAplicado('');
    setCriadoPorFiltro('');
    setCriadoPorFiltroAplicado('');
    setDefaultDateFilter();
  };

  const temFiltrosAtivos = buscaClienteAplicada || buscaEmpresaAplicada || dataInicioAplicada || dataFimAplicada || tipoFiltroAplicado !== 'todos' || statusAdesaoFiltroAplicado || criadoPorFiltroAplicado;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-5 h-5 text-slate-500" />
          <h3 className="font-semibold text-slate-800">Filtros</h3>
          {temFiltrosAtivos && (
            <button
              onClick={limparFiltros}
              className="ml-auto text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Limpar filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="relative">
            <Input
              label="Busca Cliente"
              value={buscaCliente}
              onChange={(e) => setBuscaCliente(e.target.value)}
              placeholder="CPF ou Nome do cliente/dependente"
            />
            {buscaCliente && (
              <button
                onClick={() => setBuscaCliente('')}
                className="absolute right-2 top-9 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="relative">
            <Input
              label="Busca Empresa"
              value={buscaEmpresa}
              onChange={(e) => setBuscaEmpresa(e.target.value)}
              placeholder="Nome, CNPJ ou Código da empresa"
            />
            {buscaEmpresa && (
              <button
                onClick={() => setBuscaEmpresa('')}
                className="absolute right-2 top-9 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Select
            label="Tipo"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as typeof tipoFiltro)}
          >
            <option value="todos">Todos</option>
            <option value="cadastro">Cadastro</option>
            <option value="inclusao_dependente">Inclusão</option>
          </Select>

          <Select
            label="Status da Adesão"
            value={statusAdesaoFiltro}
            onChange={(e) => setStatusAdesaoFiltro(e.target.value)}
          >
            <option value="">Todos os Status</option>
            {statusList.map((status) => (
              <option key={status.id} value={status.id}>
                {status.nome}
              </option>
            ))}
          </Select>

          {profile?.role !== 'VENDEDOR' && (
            <Select
              label="Criado por"
              value={criadoPorFiltro}
              onChange={(e) => setCriadoPorFiltro(e.target.value)}
            >
              <option value="">Todos</option>
              {criadoresPorUnicos.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </Select>
          )}

          <Input
            type="date"
            label="Data Início"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />

          <Input
            type="date"
            label="Data Fim"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button onClick={handleAplicarFiltros} className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtrar
          </Button>

          {temFiltrosAtivos && (
            <div className="text-sm text-slate-600">
              Mostrando {cadastrosFiltrados.length} de {incompletos.length} cadastros
            </div>
          )}
        </div>
      </div>

      {cadastrosFiltrados.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12">
          <div className="text-center">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Nenhum cadastro encontrado com os filtros aplicados</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
        {clientesGrouped.map((cliente) => (
          <div key={cliente.cpf} className="bg-white rounded-xl shadow-sm border border-slate-200">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-semibold text-slate-800">
                    {cliente.nome || 'Nome não informado'}
                  </h3>
                  <p className="text-sm text-slate-600">CPF: {formatCPF(cliente.cpf)}</p>
                </div>
                <span className="ml-auto px-2 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                  {cliente.cadastros.length} {cliente.cadastros.length === 1 ? 'adesão' : 'adesões'}
                </span>
              </div>
            </div>

            <div className="p-4 space-y-3">
              {cliente.cadastros.map((cadastro) => {
                const isBlocked = !!cadastro.motivo_bloqueio;
                const hasERPData = cadastro.erp_dados_associado && Object.keys(cadastro.erp_dados_associado as object).length > 0;
                const statusAdesao = statusList.find(s => s.id === cadastro.status_adesao_id);

                return (
                  <div
                    key={cadastro.id}
                    className="bg-slate-50 rounded-lg p-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2 flex-wrap">
                          {cadastro.empresa_nome && (
                            <span className="text-sm font-medium text-slate-700">
                              {cadastro.empresa_nome}
                            </span>
                          )}
                          {cadastro.tipo_cadastro === 'inclusao_dependente' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-600">
                              Inclusão de Dependente
                            </span>
                          )}
                          {isBlocked && (
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600">
                              <Ban className="w-3 h-3 mr-1" />
                              Bloqueado
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-sm text-slate-600">
                          {cadastro.data_nascimento && (
                            <p>
                              <span className="font-medium">Nascimento:</span>{' '}
                              {formatDate(cadastro.data_nascimento)}
                            </p>
                          )}
                          {cadastro.empresa_cnpj && (
                            <p>
                              <span className="font-medium">CNPJ:</span> {cadastro.empresa_cnpj}
                            </p>
                          )}
                          {cadastro.vendedor_nome && (
                            <p>
                              <span className="font-medium">Vendedor:</span> {cadastro.vendedor_nome}
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

                        <div className="mt-3">
                          <label className="block text-xs font-medium text-slate-600 mb-1">
                            Status da Adesão
                          </label>
                          <select
                            value={cadastro.status_adesao_id || ''}
                            onChange={(e) => handleChangeStatus(cadastro.id, e.target.value)}
                            className="w-full sm:w-auto px-3 py-2 rounded-lg border border-slate-300 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            style={{
                              backgroundColor: statusAdesao?.cor || '#6B7280',
                            }}
                          >
                            <option value="" style={{ color: '#000', backgroundColor: '#fff' }}>
                              Selecione um status
                            </option>
                            {statusList.map((status) => (
                              <option
                                key={status.id}
                                value={status.id}
                                style={{ color: '#000', backgroundColor: '#fff' }}
                              >
                                {status.nome}
                              </option>
                            ))}
                          </select>
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
                            className="text-emerald-600 hover:text-emerald-700 font-medium text-sm px-4 py-2 bg-white rounded-lg border border-emerald-200 hover:border-emerald-300 transition-colors"
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
          </div>
        ))}
        </div>
      )}

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
