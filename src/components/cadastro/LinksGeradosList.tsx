import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Copy, ExternalLink, Link2, Loader2, RefreshCcw, Trash2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { generateCadastroLinkToken, hashCadastroLinkToken } from '../../lib/cadastroLink';
import { CadastroLinkQrButton } from './CadastroLinkQrButton';
import { LinkActionIconButton } from './LinkActionIconButton';
import { buildPublicAdesaoUrl } from '../../lib/publicUrl';

interface CadastroLinkRow {
  id: string;
  created_by: string;
  team_id: string | null;
  empresa_codigo: number;
  empresa_nome: string;
  empresa_cnpj: string | null;
  empresa_raw: any;
  empresa_exige_matricula: number;
  planos_raw: any[];
  vendedor_id: string | null;
  vendedor_nome: string;
  vendedor_codigo: string;
  link_url: string | null;
  is_active: boolean;
  click_count: number | null;
  used_at: string | null;
  used_cpf: string | null;
  created_at: string;
  updated_at?: string;
}

interface EmpresaGroup {
  empresaCodigo: number;
  empresaNome: string;
  empresaCnpj: string | null;
  links: CadastroLinkRow[];
}

interface LinkMetrics {
  associadosCount: number;
  dependentesCount: number;
}

interface AssociadoResumo {
  nome: string;
  dependentes: string[];
}

interface LinksGeradosListProps {
  reloadKey?: number;
}

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString('pt-BR');
  } catch {
    return value;
  }
};

const formatCpf = (value?: string | null) => {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.length !== 11) return value || '-';
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const countDependentesCadastrados = (dependentes: unknown) => {
  if (!Array.isArray(dependentes)) {
    return 0;
  }

  return dependentes.reduce((total, dependente) => {
    if (!dependente || typeof dependente !== 'object') {
      return total;
    }

    const tipo = Number((dependente as { tipo?: unknown }).tipo);
    return tipo === 1 ? total : total + 1;
  }, 0);
};

export function LinksGeradosList({ reloadKey = 0 }: LinksGeradosListProps) {
  const { profile } = useAuth();
  const [links, setLinks] = useState<CadastroLinkRow[]>([]);
  const [linkMetricsById, setLinkMetricsById] = useState<Record<string, LinkMetrics>>({});
  const [associadosByLinkId, setAssociadosByLinkId] = useState<Record<string, AssociadoResumo[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyFeedbackId, setCopyFeedbackId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [selectedAssociadosGroup, setSelectedAssociadosGroup] = useState<{
    empresaNome: string;
    associados: AssociadoResumo[];
  } | null>(null);

  const loadLinks = async () => {
    setLoading(true);
    setError('');

    try {
      const { data, error: queryError } = await supabase
        .from('cadastro_links')
        .select('id, created_by, team_id, empresa_codigo, empresa_nome, empresa_cnpj, empresa_raw, empresa_exige_matricula, planos_raw, vendedor_id, vendedor_nome, vendedor_codigo, link_url, is_active, click_count, used_at, used_cpf, created_at, updated_at')
        .eq('is_active', true)
        .order('empresa_nome', { ascending: true })
        .order('updated_at', { ascending: false });

      if (queryError) {
        throw queryError;
      }

      const linkRows = (data || []) as CadastroLinkRow[];
      setLinks(linkRows);

      const linkIds = linkRows.map((link) => link.id);
      if (linkIds.length === 0) {
        setLinkMetricsById({});
        return;
      }

      const { data: cadastrosData, error: cadastrosError } = await supabase
        .from('cadastros')
        .select('origem_link_id, nome, dependentes')
        .in('origem_link_id', linkIds)
        .eq('status', 'enviado');

      if (cadastrosError) {
        throw cadastrosError;
      }

      const metrics = (cadastrosData || []).reduce<Record<string, LinkMetrics>>((acc, cadastro) => {
        const linkId = String((cadastro as { origem_link_id?: string | null }).origem_link_id || '');
        if (!linkId) {
          return acc;
        }

        const current = acc[linkId] || { associadosCount: 0, dependentesCount: 0 };
        current.associadosCount += 1;
        current.dependentesCount += countDependentesCadastrados(
          (cadastro as { dependentes?: unknown }).dependentes
        );
        acc[linkId] = current;
        return acc;
      }, {});

      const associados = (cadastrosData || []).reduce<Record<string, AssociadoResumo[]>>((acc, cadastro) => {
        const linkId = String((cadastro as { origem_link_id?: string | null }).origem_link_id || '');
        if (!linkId) {
          return acc;
        }

        const dependentes = Array.isArray((cadastro as { dependentes?: unknown }).dependentes)
          ? ((cadastro as { dependentes?: Array<{ nome?: string; tipo?: number }> }).dependentes || [])
              .filter((dependente) => Number(dependente?.tipo) !== 1)
              .map((dependente) => dependente?.nome?.trim())
              .filter((nome): nome is string => Boolean(nome))
          : [];

        const current = acc[linkId] || [];
        current.push({
          nome: String((cadastro as { nome?: string | null }).nome || 'Associado sem nome'),
          dependentes,
        });
        acc[linkId] = current;
        return acc;
      }, {});

      setLinkMetricsById(metrics);
      setAssociadosByLinkId(associados);
    } catch (err) {
      console.error('Error loading cadastro links:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar links gerados');
    } finally {
      setLoading(false);
    }
  };

  const groupedLinks = useMemo<EmpresaGroup[]>(() => {
    const map = new Map<string, EmpresaGroup>();

    for (const link of links) {
      const key = `${link.empresa_codigo}-${link.empresa_nome}`;
      const current = map.get(key);

      if (!current) {
        map.set(key, {
          empresaCodigo: link.empresa_codigo,
          empresaNome: link.empresa_nome,
          empresaCnpj: link.empresa_cnpj,
          links: [link],
        });
        continue;
      }

      current.links.push(link);
    }

    return Array.from(map.values()).sort((a, b) => a.empresaNome.localeCompare(b.empresaNome));
  }, [links]);

  useEffect(() => {
    loadLinks();
  }, [reloadKey]);

  const handleCopyLink = async (link: CadastroLinkRow) => {
    if (!link.link_url) return;

    try {
      await navigator.clipboard.writeText(link.link_url);
      setCopyFeedbackId(link.id);
      setTimeout(() => setCopyFeedbackId(null), 2500);
    } catch (err) {
      console.error('Error copying generated link:', err);
      setError('Nao foi possivel copiar o link');
    }
  };

  const handleDeleteLink = async (link: CadastroLinkRow) => {
    const confirmed = window.confirm(`Excluir o link da empresa ${link.empresa_nome}?`);
    if (!confirmed) return;

    setActionLoadingId(link.id);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('cadastro_links')
        .delete()
        .eq('id', link.id);

      if (deleteError) {
        throw deleteError;
      }

      await loadLinks();
    } catch (err) {
      console.error('Error deleting cadastro link:', err);
      setError(err instanceof Error ? err.message : 'Erro ao excluir o link');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRegenerateLink = async (link: CadastroLinkRow) => {
    if (!profile?.id) {
      setError('Usuario nao autenticado');
      return;
    }

    const confirmed = window.confirm(`Regerar um novo link para ${link.empresa_nome}? O link atual sera inativado.`);
    if (!confirmed) return;

    setActionLoadingId(link.id);
    setError('');

    try {
      const rawToken = generateCadastroLinkToken();
      const tokenHash = await hashCadastroLinkToken(rawToken);
      const url = buildPublicAdesaoUrl(rawToken);

      const { error: updateError } = await supabase
        .from('cadastro_links')
        .update({
          token_hash: tokenHash,
          link_url: url,
          is_active: true,
        })
        .eq('id', link.id);

      if (updateError) {
        throw updateError;
      }

      try {
        await navigator.clipboard.writeText(url);
        setCopyFeedbackId(link.id);
        setTimeout(() => setCopyFeedbackId(null), 2500);
      } catch (clipboardError) {
        console.warn('Could not copy regenerated link automatically:', clipboardError);
      }

      await loadLinks();
    } catch (err) {
      console.error('Error regenerating cadastro link:', err);
      setError(err instanceof Error ? err.message : 'Erro ao regerar o link');
    } finally {
      setActionLoadingId(null);
    }
  };

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
        {error}
      </div>
    );
  }

  if (groupedLinks.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <Link2 className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-slate-800">Nenhum link gerado</h3>
        <p className="text-sm text-slate-600 mt-1">
          Gere um link na aba `Link` para que ele apareca aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedLinks.map((group) => {
        const groupKey = `${group.empresaCodigo}-${group.empresaNome}`;
        const isExpanded = Boolean(expandedGroups[groupKey]);
        const groupClicks = group.links.reduce((total, link) => total + Number(link.click_count || 0), 0);
        const groupAssociados = group.links.reduce(
          (total, link) => total + (linkMetricsById[link.id]?.associadosCount || 0),
          0
        );
        const groupDependentes = group.links.reduce(
          (total, link) => total + (linkMetricsById[link.id]?.dependentesCount || 0),
          0
        );
        const groupAssociadosDetalhes = group.links.flatMap((link) => associadosByLinkId[link.id] || []);

        return (
          <div key={groupKey} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleGroup(groupKey)}
              className="w-full border-b border-slate-200 px-6 py-5 bg-slate-50 text-left transition-colors hover:bg-slate-100"
            >
              <div className="flex items-start gap-3">
                <div className="p-3 rounded-lg bg-emerald-50">
                  <Building2 className="w-5 h-5 text-emerald-600" />
                </div>

                <div className="flex-1">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="pt-1 text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5" />
                        ) : (
                          <ChevronRight className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                      <h3 className="text-lg font-semibold text-slate-800">
                        {group.empresaNome}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">
                        Codigo {group.empresaCodigo}
                        {group.empresaCnpj ? ` • CNPJ ${group.empresaCnpj}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 mt-2">
                        {isExpanded ? 'Clique para ocultar detalhes e opcoes' : 'Clique para expandir detalhes e opcoes'}
                      </p>
                      </div>
                    </div>

                    <div className="w-full lg:w-auto rounded-xl border border-slate-200 bg-white px-1 py-1 shadow-sm">
                      <div className="grid grid-cols-3 divide-x divide-slate-200 min-w-[198px]">
                        <div className="px-1.5 py-1 text-center">
                          <p className="text-[8px] font-medium uppercase tracking-[0.08em] text-slate-400">Cliques</p>
                          <p className="text-[15px] font-semibold text-slate-800 mt-0.5">{groupClicks}</p>
                        </div>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedAssociadosGroup({
                              empresaNome: group.empresaNome,
                              associados: groupAssociadosDetalhes,
                            });
                          }}
                          className="px-1.5 py-1 text-center transition-colors hover:bg-slate-50"
                        >
                          <p className="text-[8px] font-medium uppercase tracking-[0.05em] text-slate-400">Associados</p>
                          <p className="text-[15px] font-semibold text-slate-800 mt-0.5">{groupAssociados}</p>
                        </button>

                        <div className="px-1.5 py-1 text-center">
                          <p className="text-[8px] font-medium uppercase tracking-[0.04em] text-slate-400">Dependentes</p>
                          <p className="text-[15px] font-semibold text-slate-800 mt-0.5">{groupDependentes}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </button>

            {isExpanded && (
            <div className="divide-y divide-slate-200">
              {group.links.map((link) => {
                const isCopyingCurrent = copyFeedbackId === link.id;
                const isActionLoading = actionLoadingId === link.id;
                const status = link.is_active ? 'Disponivel' : 'Inativo';
                const statusClasses = link.is_active
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700';

                return (
                  <div key={link.id} className="px-6 py-5">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-800">
                            Vendedor: {link.vendedor_nome} (Codigo {link.vendedor_codigo})
                          </p>
                          <p className="text-xs text-slate-500">
                            Gerado em {formatDateTime(link.created_at)}
                          </p>
                          {link.used_at && (
                            <p className="text-xs text-slate-500">
                              Ultimo uso em {formatDateTime(link.used_at)}{link.used_cpf ? ` • CPF ${formatCpf(link.used_cpf)}` : ''}
                            </p>
                          )}
                        </div>

                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold w-fit ${statusClasses}`}>
                          {status}
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-700 break-all">
                        {link.link_url || 'Link legado sem URL armazenada'}
                      </div>

                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">
                          {isCopyingCurrent ? 'Link copiado com sucesso.' : 'Acoes do link'}
                        </p>

                        <div className="flex flex-wrap items-center gap-2">
                          <LinkActionIconButton
                            icon={Copy}
                            label={isCopyingCurrent ? 'Link copiado' : 'Copiar link'}
                            tone={isCopyingCurrent ? 'success' : 'default'}
                            onClick={() => handleCopyLink(link)}
                            disabled={!link.link_url || isActionLoading}
                          />

                          <LinkActionIconButton
                            icon={ExternalLink}
                            label="Abrir link"
                            onClick={() => link.link_url && window.open(link.link_url, '_blank', 'noopener,noreferrer')}
                            disabled={!link.link_url || isActionLoading}
                          />

                          <CadastroLinkQrButton
                            url={link.link_url}
                            empresaNome={`${link.empresa_codigo} - ${link.empresa_nome}`}
                            disabled={isActionLoading}
                          />

                          <LinkActionIconButton
                            icon={RefreshCcw}
                            label="Regerar link"
                            onClick={() => handleRegenerateLink(link)}
                            disabled={isActionLoading}
                            loading={isActionLoading}
                          />

                          <LinkActionIconButton
                            icon={Trash2}
                            label="Excluir link"
                            tone="danger"
                            onClick={() => handleDeleteLink(link)}
                            disabled={isActionLoading}
                          />
                        </div>
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

      {selectedAssociadosGroup && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedAssociadosGroup(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Associados Cadastrados</h3>
                <p className="text-sm text-slate-600 mt-1">{selectedAssociadosGroup.empresaNome}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedAssociadosGroup(null)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Fechar lista de associados"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[calc(90vh-88px)] overflow-y-auto p-5 space-y-3">
              {selectedAssociadosGroup.associados.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhum associado concluido para esta empresa ainda.
                </div>
              ) : (
                selectedAssociadosGroup.associados.map((associado, index) => (
                  <div key={`${associado.nome}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[13px] leading-5 font-semibold text-slate-800 break-words">
                      {associado.nome}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-slate-400 mt-3">Dependentes</p>

                    {associado.dependentes.length === 0 ? (
                      <p className="text-sm text-slate-500 mt-2">Nenhum dependente cadastrado.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {associado.dependentes.map((dependente, dependenteIndex) => (
                          <span
                            key={`${dependente}-${dependenteIndex}`}
                            className="inline-flex max-w-full items-center rounded-full bg-white border border-slate-200 px-3 py-1 text-[11px] leading-4 text-slate-700 break-all"
                          >
                            {dependente}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
