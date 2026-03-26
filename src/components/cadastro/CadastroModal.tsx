import { useState, useEffect, useRef } from 'react';
import { X, Save, Send, Trash2, Loader2, Plus, Trash } from 'lucide-react';
import { Input } from '../Input';
import { DateInput } from '../DateInput';
import { Button } from '../Button';
import { Select } from '../Select';
import { Cadastro, useCadastros } from '../../hooks/useCadastros';
import { formatCPF, formatPhone, formatCEP, formatDate, removeCPFMask } from '../../lib/cpf';
import { CadastroFormData, buildERPPayload } from '../../lib/mappers';
import { DependentesSection, Dependente } from './DependentesSection';
import { useAuth } from '../../contexts/AuthContext';
import { useConfigCadastro } from '../../contexts/ConfigCadastroContext';
import { DependenteAtivoModal } from './DependenteAtivoModal';
import { SelectStatusModal } from './SelectStatusModal';
import { ParceiroInvalidoModal } from './ParceiroInvalidoModal';
import { EmpresaSearchCard } from './EmpresaSearchCard';
import { supabase } from '../../lib/supabase';
import { uploadToStorage, UploadedFile, validateFile } from '../../utils/uploadFile';
import { loadDraft, saveDraft, clearDraft, saveBeforeFilePicker } from '../../utils/draftStorage';

interface CadastroModalProps {
  cadastro: Cadastro;
  onClose: () => void;
  onSuccess: () => void;
}

interface Empresa {
  id: number;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  enderecoEmpresa: any;
  precoPlano: any[];
  exigeMatricula?: number;
  observacoes?: string;
  raw: any;
}

export function CadastroModal({ cadastro, onClose, onSuccess }: CadastroModalProps) {
  const draftHydratedRef = useRef(false);
  const { updateCadastro, enviarParaERP, deleteCadastro, canDelete, consultarEnderecoCEP, searchEmpresa } = useCadastros();
  const { profile } = useAuth();
  const { planos: planosMap, config } = useConfigCadastro();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [cadastroFresh, setCadastroFresh] = useState<Cadastro | null>(null);
  const [dependentes, setDependentes] = useState<Dependente[]>([]);
  const [planosEmpresa, setPlanosEmpresa] = useState<any[]>([]);
  const [dependentesInicializados, setDependentesInicializados] = useState(false);
  const [dependentesAtivos, setDependentesAtivos] = useState<Array<{
    nome: string;
    cpf: string;
    empresa: string;
    situacao: string;
  }>>([]);
  const [showDependentesAtivosModal, setShowDependentesAtivosModal] = useState(false);
  const [showSelectStatusModal, setShowSelectStatusModal] = useState(false);
  const [showParceiroInvalidoModal, setShowParceiroInvalidoModal] = useState(false);
  const [selectedEmpresa, setSelectedEmpresa] = useState<Empresa | null>(null);
  const [arquivo, setArquivo] = useState<UploadedFile | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [novoContato, setNovoContato] = useState({ tipo: 'celular', valor: '' });

  const funcionarioCadastroId = profile?.external_id ? parseInt(profile.external_id) : null;

  const cadastroAtual = cadastroFresh || cadastro;
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const [formData, setFormData] = useState({
    nome: cadastro.nome || '',
    dataNascimento: cadastro.data_nascimento || '',
    sexo: cadastro.sexo_codigo || 0,
    contatos: (cadastro.contatos as Array<{ tipo: string; valor: string; principal?: boolean }>) || [],
    endereco: (cadastro.endereco as {
      cep: string;
      tipoLogradouro: string;
      logradouro: string;
      numero: string;
      complemento: string;
      bairro: string;
      cidade: string;
      uf: string;
      idTipoLogradouro?: number;
      idBairro?: number;
      idMunicipio?: number;
      idUf?: number;
      ufSigla?: string;
    }) || {
      cep: '',
      tipoLogradouro: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
    },
    nomeMae: cadastro.nome_mae || '',
    numeroMatricula: cadastro.numero_matricula || '',
  });

  const clearModalDraft = () => {
    if (profile?.id) {
      clearDraft('cadastro-modal', profile.id, cadastro.id);
    }
  };

  const buildDraftPayload = () => ({
    formData,
    dependentes,
    arquivo,
    selectedEmpresa,
    novoContato,
    step: cadastroFresh?.status === 'incompleto' ? 2 : 1,
    currentTab: 0,
  });

  useEffect(() => {
    const fetchFreshCadastro = async () => {
      try {
        const { data, error } = await supabase
          .from('cadastros')
          .select('*')
          .eq('id', cadastro.id)
          .maybeSingle();

        if (error) {
          console.error('[CadastroModal] Erro ao buscar cadastro:', error);
          setInitialLoadComplete(true);
          return;
        }

        if (data) {
          setCadastroFresh(data as Cadastro);
        }
      } catch (err) {
        console.error('[CadastroModal] Exceção ao buscar cadastro fresh:', err);
      } finally {
        setInitialLoadComplete(true);
      }
    };

    fetchFreshCadastro();
  }, [cadastro.id]);

  useEffect(() => {
    try {
      if (!cadastroAtual) {
        console.warn('[CadastroModal] cadastroAtual não disponível');
        return;
      }

      if (cadastroAtual.dependentes && Array.isArray(cadastroAtual.dependentes) && cadastroAtual.dependentes.length > 0) {
        const dependentesNormalizados = (cadastroAtual.dependentes as any[]).map((dep: any) => {
          const tipoRaw = dep?.tipo ?? dep?.parentesco;
          const tipo = tipoRaw === null || tipoRaw === undefined || tipoRaw === '' ? 0 : Number(tipoRaw);

          const planoRaw = dep?.plano ?? dep?.codigoPlano ?? dep?.plano_codigo;
          const plano = planoRaw === null || planoRaw === undefined || planoRaw === '' ? 0 : Number(planoRaw);

          const sexoRaw = dep?.sexo ?? dep?.sexo_codigo ?? dep?.sexoCodigo;
          const sexo = sexoRaw === null || sexoRaw === undefined || sexoRaw === '' ? -1 : Number(sexoRaw);

          const sexoDescricao =
            dep?.sexoDescricao ||
            (sexo === 1 ? 'Masculino' : sexo === 0 ? 'Feminino' : '');

          return {
            tipo: Number.isFinite(tipo) ? tipo : 0,
            nome: dep?.nome ?? '',
            dataNascimento: dep?.dataNascimento ?? dep?.data_nascimento ?? '',
            cpf: removeCPFMask(String(dep?.cpf ?? '')),
            sexo: Number.isFinite(sexo) ? sexo : -1,
            sexoDescricao,
            plano: Number.isFinite(plano) ? plano : 0,
            planoValor: String(dep?.planoValor ?? dep?.valorPlano ?? dep?.plano_valor ?? '0,00'),
            nomeMae: dep?.nomeMae ?? dep?.nome_mae ?? '',
            carenciaAtendimento: Number(dep?.carenciaAtendimento ?? 0) || 0,
            funcionarioCadastro: Number(dep?.funcionarioCadastro ?? funcionarioCadastroId ?? 0) || 0,
          } as Dependente;
        });

        setDependentes(dependentesNormalizados);
        setDependentesInicializados(true);
      } else {
        setDependentesInicializados(true);
      }

      if (cadastroAtual.arquivo_path) {
        const fileName = cadastroAtual.arquivo_path.split('/').pop() || 'arquivo';
        setArquivo({
          nome: fileName,
          path: cadastroAtual.arquivo_path,
          mime: 'application/octet-stream',
          size: 0
        });
      }
    } catch (err) {
      console.error('[CadastroModal] Erro ao inicializar dependentes:', err);
      setDependentesInicializados(true);
    }
  }, [cadastroAtual?.dependentes, cadastroAtual?.arquivo_path]);

  useEffect(() => {
    try {
      if (!cadastroAtual) return;

      const lemitRaw = cadastroAtual.lemit_raw as { nome_mae?: string } | undefined;
      if (lemitRaw?.nome_mae && !cadastroAtual.nome_mae) {
        setFormData((prev) => ({ ...prev, nomeMae: lemitRaw.nome_mae || '' }));
      }
    } catch (err) {
      console.error('[CadastroModal] Erro ao processar lemit_raw:', err);
    }
  }, [cadastroAtual?.lemit_raw, cadastroAtual?.nome_mae]);

  useEffect(() => {
    if (cadastroAtual && cadastroAtual.empresa_id && cadastroAtual.empresa_nome) {
      const empresaRaw = cadastroAtual.empresa_raw as any;
      const observacoes = empresaRaw?.observacoes || empresaRaw?.observacao || '';

      setSelectedEmpresa({
        id: cadastroAtual.empresa_id,
        razaoSocial: empresaRaw?.razaoSocial || cadastroAtual.empresa_nome || '',
        nomeFantasia: empresaRaw?.nomeFantasia || cadastroAtual.empresa_nome || '',
        cnpj: empresaRaw?.cnpj || cadastroAtual.empresa_cnpj || '',
        enderecoEmpresa: empresaRaw?.enderecoEmpresa || null,
        precoPlano: empresaRaw?.precoPlano || cadastroAtual.planos_raw || [],
        exigeMatricula: empresaRaw?.exigeMatricula || cadastroAtual.empresa_exige_matricula,
        observacoes: observacoes,
        raw: empresaRaw || null,
      });
    }
  }, [cadastroAtual?.empresa_id, cadastroAtual?.empresa_nome, cadastroAtual?.empresa_raw]);

  useEffect(() => {
    const enrichPlanos = (planos: any[]) => {
      try {
        return planos.map(plano => {
          const mapeamento = planosMap.find(p => p.plano_id === plano.Plano);
          return {
            ...plano,
            nomeExibicao: mapeamento?.nome_exibicao || `Plano ${plano.Plano}`,
            registroProduto: mapeamento?.registro_produto,
          };
        });
      } catch (err) {
        console.error('[CadastroModal] Erro ao enriquecer planos:', err);
        return planos;
      }
    };

    const loadPlanos = async () => {
      try {
        setLoadingPlanos(true);

        if (!cadastroAtual || !cadastroAtual.id) {
          console.warn('[CadastroModal] cadastroAtual inválido, abortando loadPlanos');
          setLoadingPlanos(false);
          return;
        }

        if (cadastroAtual.planos_raw && Array.isArray(cadastroAtual.planos_raw) && cadastroAtual.planos_raw.length > 0) {
          const planosEnriquecidos = enrichPlanos(cadastroAtual.planos_raw);
          setPlanosEmpresa(planosEnriquecidos);
          setLoadingPlanos(false);
          return;
        }

        if (cadastroAtual.empresa_id) {
          try {
            const empresaData = await searchEmpresa(cadastroAtual.empresa_id.toString(), 'id');

            if (empresaData.ok && empresaData.empresas && empresaData.empresas.length > 0) {
              const empresa = empresaData.empresas[0];
              const planos = empresa.precoPlano || [];

              if (planos.length > 0) {
                const planosEnriquecidos = enrichPlanos(planos);
                setPlanosEmpresa(planosEnriquecidos);

                await updateCadastro(cadastroAtual.id, {
                  planos_raw: planos,
                });
              } else {
                console.warn('[CadastroModal] ⚠️ Empresa encontrada mas sem planos');
              }
            } else {
              console.warn('[CadastroModal] ⚠️ Empresa não encontrada ou resposta inválida');
            }
          } catch (err) {
            console.error('[CadastroModal] ❌ Erro ao buscar planos da empresa:', err);
          }
        } else {
          console.warn('[CadastroModal] ⚠️ Nenhum empresa_id disponível');
        }
      } catch (err) {
        console.error('[CadastroModal] ❌ Erro geral em loadPlanos:', err);
      } finally {
        setLoadingPlanos(false);
      }
    };

    if (cadastroAtual && cadastroAtual.id && planosMap) {
      loadPlanos();
    } else {
      console.warn('[CadastroModal] Condições para loadPlanos não atendidas:', { cadastroAtual: !!cadastroAtual, id: cadastroAtual?.id, planosMap: !!planosMap });
      setLoadingPlanos(false);
    }
  }, [cadastroAtual.id, cadastroAtual.empresa_id, cadastroAtual.planos_raw, planosMap]);

  useEffect(() => {
    try {
      if (!cadastroAtual) return;

      const temDependentesSalvos = cadastroAtual.dependentes && Array.isArray(cadastroAtual.dependentes) && cadastroAtual.dependentes.length > 0;

      if (!dependentesInicializados || temDependentesSalvos || loadingPlanos) {
        return;
      }

      if (dependentes.length === 0 && cadastroAtual.cpf && planosEmpresa.length > 0) {
        const sexoDescricao = (formData.sexo === 1) ? 'Masculino' : (formData.sexo === 0) ? 'Feminino' : '';

        const responsavelComoDependente: Dependente = {
          tipo: 1,
          nome: formData.nome || '',
          dataNascimento: formData.dataNascimento || '',
          cpf: cadastroAtual.cpf,
          sexo: formData.sexo || 0,
          sexoDescricao: sexoDescricao,
          plano: 0,
          planoValor: '0,00',
          nomeMae: formData.nomeMae || '',
          carenciaAtendimento: 0,
          funcionarioCadastro: funcionarioCadastroId || 0,
        };

        setDependentes([responsavelComoDependente]);
      }
    } catch (err) {
      console.error('[CadastroModal] Erro ao criar titular automático:', err);
    }
  }, [dependentesInicializados, planosEmpresa, cadastroAtual?.cpf, cadastroAtual?.dependentes, funcionarioCadastroId, loadingPlanos, formData.sexo, formData.nome, formData.dataNascimento, formData.nomeMae, dependentes.length]);

  useEffect(() => {
    try {
      if (dependentes.length > 0 && dependentes[0].tipo === 1) {
        const sexoDescricao = (formData.sexo === 1) ? 'Masculino' : (formData.sexo === 0) ? 'Feminino' : '';

        setDependentes(prev => {
          const titularAtualizado = [...prev];
          titularAtualizado[0] = {
            ...titularAtualizado[0],
            nome: formData.nome || '',
            dataNascimento: formData.dataNascimento || '',
            sexo: formData.sexo || 0,
            sexoDescricao: sexoDescricao,
            nomeMae: formData.nomeMae || '',
          };
          return titularAtualizado;
        });
      }
    } catch (err) {
      console.error('[CadastroModal] Erro ao atualizar titular:', err);
    }
  }, [formData.nome, formData.dataNascimento, formData.sexo, formData.nomeMae]);

  useEffect(() => {
    if (!profile?.id || !initialLoadComplete || draftHydratedRef.current) return;

    const draft = loadDraft('cadastro-modal', profile.id, cadastro.id) as any;
    if (draft) {
      if (draft.formData) {
        setFormData((prev) => ({
          ...prev,
          ...draft.formData,
          contatos: draft.formData.contatos || prev.contatos,
          endereco: {
            ...prev.endereco,
            ...(draft.formData.endereco || {}),
          },
        }));
      }

      if (Array.isArray(draft.dependentes)) {
        setDependentes(draft.dependentes);
      }

      setArquivo(draft.arquivo || null);
      setSelectedEmpresa(draft.selectedEmpresa || null);
      setNovoContato(draft.novoContato || { tipo: 'celular', valor: '' });
    }

    draftHydratedRef.current = true;
  }, [profile?.id, initialLoadComplete, cadastro.id]);

  useEffect(() => {
    if (!profile?.id || !initialLoadComplete || !draftHydratedRef.current) return;

    saveDraft('cadastro-modal', buildDraftPayload(), profile.id, cadastro.id);
  }, [profile?.id, initialLoadComplete, formData, dependentes, arquivo, selectedEmpresa, novoContato, cadastro.id]);


  const isValidISODate = (dateStr: string): boolean => {
    if (!dateStr) return true;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return isoDateRegex.test(dateStr);
  };

  const handleEmpresaSelected = async (empresa: Empresa) => {
    setSelectedEmpresa(empresa);
    setError('');

    try {
      await updateCadastro(cadastroAtual.id, {
        empresa_id: empresa.id,
        empresa_codigo: empresa.id,
        empresa_nome: empresa.nomeFantasia,
        empresa_cnpj: empresa.cnpj,
        empresa_exige_matricula: empresa.exigeMatricula || 0,
        empresa_raw: empresa.raw || empresa,
        planos_raw: empresa.precoPlano,
      });

      const { data, error } = await supabase
        .from('cadastros')
        .select('*')
        .eq('id', cadastroAtual.id)
        .maybeSingle();

      if (!error && data) {
        setCadastroFresh(data as Cadastro);
      }
    } catch (err) {
      console.error('Error updating empresa:', err);
      setError('Erro ao atualizar empresa do cadastro');
    }
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let dataNascimento = null;
      if (formData.dataNascimento && formData.dataNascimento.trim() !== '') {
        if (isValidISODate(formData.dataNascimento)) {
          dataNascimento = formData.dataNascimento;
        } else {
          console.warn('[CadastroModal] Data de nascimento incompleta, salvando como null:', formData.dataNascimento);
        }
      }

      const updateData: any = {
        nome: formData.nome || null,
        data_nascimento: dataNascimento,
        sexo_codigo: formData.sexo !== '' && formData.sexo !== null && formData.sexo !== undefined ? formData.sexo : null,
        nome_mae: formData.nomeMae || null,
        numero_matricula: formData.numeroMatricula || null,
        contatos: formData.contatos,
        endereco: formData.endereco,
        dependentes: dependentes,
        arquivo_path: arquivo ? arquivo.path : null,
      };

      await updateCadastro(cadastroAtual.id, updateData);

      setShowSelectStatusModal(true);
    } catch (err: any) {
      console.error('Error saving cadastro:', err);

      let errorMessage = 'Erro ao salvar cadastro';

      if (err?.code === '22007') {
        errorMessage = 'Erro: Data de nascimento inválida. Por favor, preencha a data corretamente ou deixe em branco.';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      if (err?.code === '22007') {
        console.error('[CadastroModal] Erro de data inválida:', err);
      } else {
        if (err?.details) {
          console.error('[CadastroModal] Detalhes do erro:', err.details);
        }
        if (err?.hint) {
          console.error('[CadastroModal] Dica:', err.hint);
        }
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseWithSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      let dataNascimento = null;
      if (formData.dataNascimento && formData.dataNascimento.trim() !== '') {
        if (isValidISODate(formData.dataNascimento)) {
          dataNascimento = formData.dataNascimento;
        } else {
          console.warn('[CadastroModal] Data de nascimento incompleta ao fechar, salvando como null:', formData.dataNascimento);
        }
      }

      const updateData: any = {
        nome: formData.nome || null,
        data_nascimento: dataNascimento,
        sexo_codigo: formData.sexo !== '' && formData.sexo !== null && formData.sexo !== undefined ? formData.sexo : null,
        nome_mae: formData.nomeMae || null,
        numero_matricula: formData.numeroMatricula || null,
        contatos: formData.contatos,
        endereco: formData.endereco,
        dependentes: dependentes,
        arquivo_path: arquivo ? arquivo.path : null,
      };

      await updateCadastro(cadastroAtual.id, updateData);
      setShowSelectStatusModal(true);
    } catch (err: any) {
      console.error('Error saving cadastro on close:', err);
      setShowSelectStatusModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusSelect = async (statusId: string) => {
    try {
      await updateCadastro(cadastroAtual.id, { status_adesao_id: statusId });
      clearModalDraft();
      setShowSelectStatusModal(false);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Erro ao atualizar status');
      setShowSelectStatusModal(false);
    }
  };

  const handleStatusCancel = () => {
    clearModalDraft();
    setShowSelectStatusModal(false);
    onSuccess();
    onClose();
  };

  const handleArquivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];

    const validation = validateFile(file);
    if (!validation.valid) {
      setError(validation.error || 'Arquivo inválido');
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    setError('');

    try {
      if (arquivo?.path) {
        try {
          await supabase.storage
            .from('cadastros-temp-files')
            .remove([arquivo.path]);
        } catch (err) {
          console.error('Erro ao remover arquivo anterior:', err);
        }
      }

      if (!profile?.id) {
        throw new Error('Usuário não autenticado');
      }

      const uploadedFile = await uploadToStorage(
        file,
        profile.id,
        'cadastros-temp-files',
        `cadastros/${cadastroAtual.id}`
      );

      setArquivo(uploadedFile);

      await updateCadastro(cadastroAtual.id, {
        arquivo_path: uploadedFile.path
      });

      setSuccess('Arquivo carregado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao fazer upload do arquivo:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer upload do arquivo';
      setError(errorMessage);
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const handleEnviar = async () => {
    setError('');
    setSuccess('');

    if (!formData.nome) {
      setError('Campo obrigatório: Nome Completo');
      return;
    }

    if (!formData.nomeMae) {
      setError('Campo obrigatório: Nome da Mãe');
      return;
    }

    if (!formData.dataNascimento) {
      setError('Campo obrigatório: Data de Nascimento');
      return;
    }

    if (formData.sexo === null || formData.sexo === undefined || formData.sexo === '') {
      setError('Campo obrigatório: Sexo');
      return;
    }

    if (!funcionarioCadastroId) {
      setError('Código do usuário (External ID) não configurado. Configure seu código na página de Perfil antes de cadastrar.');
      return;
    }

    if (config?.exigir_arquivo && !arquivo) {
      setError('Campo obrigatório: Arquivo (documento)');
      return;
    }

    const telefones = formData.contatos.filter(
      (c) => c.tipo === 'celular' || c.tipo === 'fixo' || c.tipo === 'whatsapp'
    );

    if (telefones.length === 0) {
      setError('Adicione pelo menos um telefone antes de enviar');
      return;
    }

    const telefonePrincipal = telefones.find(c => c.principal);
    if (!telefonePrincipal && telefones.length > 0) {
      formData.contatos = formData.contatos.map(c => {
        if (c.tipo === 'celular' || c.tipo === 'fixo' || c.tipo === 'whatsapp') {
          if (c === telefones[0]) {
            return { ...c, principal: true };
          }
        }
        return c;
      });
    }

    if (!formData.endereco.cep) {
      setError('Campo obrigatório: CEP');
      return;
    }

    if (!formData.endereco.logradouro) {
      setError('Campo obrigatório: Logradouro');
      return;
    }

    if (!formData.endereco.numero) {
      setError('Campo obrigatório: Número do endereço');
      return;
    }

    if (!formData.endereco.bairro) {
      setError('Campo obrigatório: Bairro');
      return;
    }

    if (!formData.endereco.cidade) {
      setError('Campo obrigatório: Cidade');
      return;
    }

    if (!formData.endereco.uf) {
      setError('Campo obrigatório: UF');
      return;
    }

    if (cadastroAtual.empresa_exige_matricula === 1 && !formData.numeroMatricula) {
      setError('Campo obrigatório: Matrícula (obrigatória para esta empresa)');
      return;
    }

    if (!selectedEmpresa || !selectedEmpresa.id) {
      setError('Selecione uma empresa antes de continuar');
      return;
    }

    const titulares = dependentes.filter(d => d.tipo === 1);
    if (titulares.length === 0) {
      setError('É necessário ter pelo menos 1 titular nos dependentes');
      return;
    }

    if (titulares.length > 1) {
      setError('Só pode haver 1 titular nos dependentes');
      return;
    }

    const dependentesSemPlano = dependentes.filter(d => !d.plano || d.plano === 0);
    if (dependentesSemPlano.length > 0) {
      setError('Todos os dependentes devem ter um plano selecionado');
      return;
    }

    setLoading(true);

    try {
      const cadastroCompleto: CadastroFormData = {
        cpf: cadastroAtual.cpf,
        nome: formData.nome,
        dataNascimento: formData.dataNascimento,
        sexo: formData.sexo === 1 ? 'M' : 'F',
        sexoCodigo: formData.sexo,
        contatos: formData.contatos,
        endereco: formData.endereco,
        nomeMae: formData.nomeMae,
        numeroMatricula: formData.numeroMatricula,
        dependentes: dependentes,
      };

      const payload = buildERPPayload(
        cadastroCompleto,
        selectedEmpresa.id,
        cadastroAtual.vendedor_codigo,
        funcionarioCadastroId,
        profile?.role,
        profile?.external_id,
        cadastroAtual.adesionista_codigo
      );

      const result = await enviarParaERP(cadastroAtual.id, payload);

      if (arquivo && result?.data?.dados?.dependentes && result.data.dados.dependentes.length > 0) {
        try {
          const primeiroDepCodigo = result.data.dados.dependentes[0].codigo;

          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('Sessão não encontrada');
          }

          const uploadPayload = {
            idFuncionario: funcionarioCadastroId,
            idDependente: parseInt(primeiroDepCodigo),
            arquivoPath: arquivo.path,
            arquivoNome: arquivo.nome,
            bucket: 'cadastros-temp-files'
          };

          const uploadResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-upload-documento`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(uploadPayload),
            }
          );

          const uploadResult = await uploadResponse.json();

          if (uploadResponse.ok && uploadResult.success) {
            try {
              await supabase.storage
                .from('cadastros-temp-files')
                .remove([arquivo.path]);
            } catch (removeErr) {
              console.warn('Aviso ao remover arquivo do bucket:', removeErr);
            }
          } else {
            console.warn('Falha ao enviar documento, enfileirando para tentativa posterior...');

            const enqueuePayload = {
              cadastroId: cadastroAtual.id,
              idFuncionario: funcionarioCadastroId,
              idDependente: parseInt(primeiroDepCodigo),
              arquivoPath: arquivo.path,
              arquivoNome: arquivo.nome,
              tipo: 'titular',
            };

            const enqueueResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-enqueue-upload`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(enqueuePayload),
              }
            );

            const enqueueResult = await enqueueResponse.json();

            if (!enqueueResponse.ok || !enqueueResult.queued) {
              console.error('Erro ao enfileirar arquivo:', enqueueResult);
            }
          }
        } catch (uploadErr: any) {
          console.warn('Erro ao processar upload, tentando enfileirar...', uploadErr);

          try {
            const primeiroDepCodigo = result.data.dados.dependentes[0].codigo;
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
              const enqueuePayload = {
                cadastroId: cadastroAtual.id,
                idFuncionario: funcionarioCadastroId,
                idDependente: parseInt(primeiroDepCodigo),
                arquivoPath: arquivo.path,
                arquivoNome: arquivo.nome,
                tipo: 'titular',
              };

              const enqueueResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-enqueue-upload`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(enqueuePayload),
                }
              );

              await enqueueResponse.json();
            }
          } catch (enqueueErr) {
            console.error('Erro crítico ao enfileirar arquivo:', enqueueErr);
          }
        }
      }

      setSuccess('Cadastro enviado com sucesso! Arquivo em fila de envio ao ERP.');
      setTimeout(() => {
        clearModalDraft();
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error sending to ERP:', err);

      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message?: unknown }).message || 'Erro ao enviar cadastro para o ERP')
            : 'Erro ao enviar cadastro para o ERP';

      if (err.codigo === 3 && err.dependentesAtivos && err.dependentesAtivos.length > 0) {
        setDependentesAtivos(err.dependentesAtivos);
        setShowDependentesAtivosModal(true);
      } else if (errorMessage.toLowerCase().includes('parceiro') && errorMessage.toLowerCase().includes('inválido')) {
        setShowParceiroInvalidoModal(true);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRetryWithVendedor = async (vendedorCodigo: string, vendedorNome: string) => {
    setShowParceiroInvalidoModal(false);
    setLoading(true);
    setError('');

    try {
      await updateCadastro(cadastroAtual.id, {
        vendedor_codigo: vendedorCodigo,
        vendedor_nome: vendedorNome,
      });

      const cadastroCompleto: CadastroFormData = {
        cpf: cadastroAtual.cpf,
        nome: formData.nome,
        dataNascimento: formData.dataNascimento,
        sexoCodigo: formData.sexo,
        contatos: formData.contatos,
        endereco: formData.endereco,
        nomeMae: formData.nomeMae,
        numeroMatricula: formData.numeroMatricula,
        dependentes: dependentes,
      };

      const payload = buildERPPayload(
        cadastroCompleto,
        selectedEmpresa?.id || cadastroAtual.empresa_id,
        vendedorCodigo,
        funcionarioCadastroId,
        profile?.role,
        profile?.external_id,
        cadastroAtual.adesionista_codigo
      );

      const result = await enviarParaERP(cadastroAtual.id, payload);

      if (arquivo && result?.data?.dados?.dependentes && result.data.dados.dependentes.length > 0) {
        try {
          const primeiroDepCodigo = result.data.dados.dependentes[0].codigo;

          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            throw new Error('Sessão não encontrada');
          }

          const uploadPayload = {
            idFuncionario: funcionarioCadastroId,
            idDependente: parseInt(primeiroDepCodigo),
            arquivoPath: arquivo.path,
            arquivoNome: arquivo.nome,
            bucket: 'cadastros-temp-files'
          };

          const uploadResponse = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-upload-documento`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(uploadPayload),
            }
          );

          const uploadResult = await uploadResponse.json();

          if (uploadResponse.ok && uploadResult.success) {
            try {
              await supabase.storage
                .from('cadastros-temp-files')
                .remove([arquivo.path]);
            } catch (removeErr) {
              console.warn('Aviso ao remover arquivo do bucket:', removeErr);
            }
          } else {
            console.warn('Falha ao enviar documento, enfileirando para tentativa posterior...');

            const enqueuePayload = {
              cadastroId: cadastroAtual.id,
              idFuncionario: funcionarioCadastroId,
              idDependente: parseInt(primeiroDepCodigo),
              arquivoPath: arquivo.path,
              arquivoNome: arquivo.nome,
              tipo: 'titular',
            };

            const enqueueResponse = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-enqueue-upload`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${session.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(enqueuePayload),
              }
            );

            const enqueueResult = await enqueueResponse.json();

            if (!enqueueResponse.ok || !enqueueResult.queued) {
              console.error('Erro ao enfileirar arquivo:', enqueueResult);
            }
          }
        } catch (uploadErr: any) {
          console.warn('Erro ao processar upload, tentando enfileirar...', uploadErr);

          try {
            const primeiroDepCodigo = result.data.dados.dependentes[0].codigo;
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
              const enqueuePayload = {
                cadastroId: cadastroAtual.id,
                idFuncionario: funcionarioCadastroId,
                idDependente: parseInt(primeiroDepCodigo),
                arquivoPath: arquivo.path,
                arquivoNome: arquivo.nome,
                tipo: 'titular',
              };

              const enqueueResponse = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-enqueue-upload`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(enqueuePayload),
                }
              );

              await enqueueResponse.json();
            }
          } catch (enqueueErr) {
            console.error('Erro crítico ao enfileirar arquivo:', enqueueErr);
          }
        }
      }

      setSuccess('Cadastro enviado com sucesso com o novo vendedor!');
      setTimeout(() => {
        clearModalDraft();
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error retrying with new vendedor:', err);
      setError(err instanceof Error ? err.message : 'Erro ao reenviar cadastro');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja excluir este cadastro?')) return;

    setLoading(true);
    try {
      await deleteCadastro(cadastroAtual.id);
      clearModalDraft();
      onSuccess();
    } catch (err) {
      console.error('Error deleting cadastro:', err);
      setError(err instanceof Error ? err.message : 'Erro ao excluir cadastro');
    } finally {
      setLoading(false);
    }
  };

  const toggleContatoPrincipal = (index: number) => {
    const contato = formData.contatos[index];
    const novosContatos = formData.contatos.map((c, i) => {
      if (c.tipo === contato.tipo) {
        return { ...c, principal: i === index };
      }
      return c;
    });
    setFormData({ ...formData, contatos: novosContatos });
  };

  const handleAdicionarContato = () => {
    if (!novoContato.valor.trim()) {
      setError('Digite um valor para o contato');
      return;
    }

    let valorLimpo = novoContato.valor.trim();

    // Validação específica por tipo
    if (novoContato.tipo === 'email') {
      // Validação de email com regex
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(valorLimpo)) {
        setError('Email inválido. Digite um email válido (exemplo@email.com)');
        return;
      }
      // Para email, mantém o valor original (sem remover caracteres)
    } else {
      // Para telefones (celular, whatsapp, fixo), remove máscara
      valorLimpo = removeCPFMask(novoContato.valor);

      // Validação de quantidade de dígitos para telefones
      if (valorLimpo.length < 10 || valorLimpo.length > 11) {
        setError('Telefone inválido. Digite um telefone com 10 ou 11 dígitos');
        return;
      }
    }

    const contatoExiste = formData.contatos.some(
      c => c.tipo === novoContato.tipo && c.valor === valorLimpo
    );

    if (contatoExiste) {
      setError('Este contato já foi adicionado');
      return;
    }

    const telefones = formData.contatos.filter(c => c.tipo === 'celular' || c.tipo === 'fixo' || c.tipo === 'whatsapp');
    const isPrimeiroTelefone = (novoContato.tipo === 'celular' || novoContato.tipo === 'fixo' || novoContato.tipo === 'whatsapp') && telefones.length === 0;

    const novosContatos = [
      ...formData.contatos,
      {
        tipo: novoContato.tipo,
        valor: valorLimpo,
        principal: isPrimeiroTelefone,
      },
    ];

    setFormData({ ...formData, contatos: novosContatos });
    setNovoContato({ tipo: 'celular', valor: '' });
    setError('');
  };

  const handleRemoverContato = (index: number) => {
    const novosContatos = formData.contatos.filter((_, i) => i !== index);
    setFormData({ ...formData, contatos: novosContatos });
  };

  const handleCEPChange = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    setFormData({
      ...formData,
      endereco: { ...formData.endereco, cep: cepLimpo },
    });

    if (cepLimpo.length === 8) {
      setLoadingCEP(true);
      setError('');

      try {
        const enderecoERP = await consultarEnderecoCEP(cepLimpo);

        if (enderecoERP.ok && enderecoERP.dados) {

          const dados = enderecoERP.dados;

          setFormData({
            ...formData,
            endereco: {
              ...formData.endereco,
              cep: cepLimpo,
              ...(dados.IdTipoLogradouro && { idTipoLogradouro: dados.IdTipoLogradouro }),
              ...(dados.TipoLogradouro && { tipoLogradouro: dados.TipoLogradouro }),
              ...(dados.Logradouro && { logradouro: dados.Logradouro }),
              ...(dados.IdBairro && { idBairro: dados.IdBairro }),
              ...(dados.Bairro && { bairro: dados.Bairro }),
              ...(dados.IdMunicipio && { idMunicipio: dados.IdMunicipio }),
              ...(dados.Municipio && { cidade: dados.Municipio }),
              ...(dados.IdUf && { idUf: dados.IdUf }),
              ...(dados.Uf && { uf: dados.Uf }),
              ...(dados.UfSigla && { ufSigla: dados.UfSigla }),
            },
          });

          setSuccess('Endereço encontrado e preenchido automaticamente!');
          setTimeout(() => setSuccess(''), 3000);
        } else {
          console.warn('[CadastroModal] CEP não retornou dados válidos');
          setError('CEP não encontrado');
        }
      } catch (cepError) {
        console.error('[CadastroModal] ❌ Erro ao buscar CEP:', cepError);
        console.error('[CadastroModal] Tipo do erro:', typeof cepError);
        console.error('[CadastroModal] Detalhes completos:', JSON.stringify(cepError, null, 2));
        const errorMessage = cepError instanceof Error ? cepError.message : 'Erro ao consultar CEP';
        console.error('[CadastroModal] Mensagem de erro:', errorMessage);
        setError(errorMessage);
      } finally {
        setLoadingCEP(false);
      }
    }
  };

  if (!initialLoadComplete) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-slate-700 font-medium">Carregando cadastro...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!cadastroAtual || !cadastroAtual.id) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl shadow-xl p-8">
          <div className="flex flex-col items-center gap-4">
            <p className="text-red-700 font-medium">Erro: Dados do cadastro não disponíveis</p>
            <Button onClick={onClose}>Fechar</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {cadastroAtual.nome || 'Editar Cadastro'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">CPF: {formatCPF(cadastroAtual.cpf)}</p>
            {cadastroAtual.vendedor_codigo && (
              <p className="text-sm text-emerald-600 mt-0.5">
                Vendedor: {cadastroAtual.vendedor_nome || 'Nome não disponível'} (Código {cadastroAtual.vendedor_codigo})
              </p>
            )}
          </div>
          <button
            onClick={handleCloseWithSave}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={loading || uploadingFile}
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <EmpresaSearchCard
            onEmpresaSelected={handleEmpresaSelected}
            selectedEmpresa={selectedEmpresa}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Nome Completo"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <DateInput
              label="Data de Nascimento"
              value={formData.dataNascimento}
              onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
              required
            />

            <Select
              label="Sexo"
              value={formData.sexo.toString()}
              onChange={(e) => setFormData({ ...formData, sexo: parseInt(e.target.value) })}
              required
            >
              <option value="-1">Selecione</option>
              <option value="1">Masculino</option>
              <option value="0">Feminino</option>
            </Select>

            <div className="md:col-span-2">
              <Input
                label="Nome da Mãe"
                value={formData.nomeMae}
                onChange={(e) => setFormData({ ...formData, nomeMae: e.target.value })}
                required
              />
            </div>

            {cadastroAtual.empresa_exige_matricula === 1 && (
              <div className="md:col-span-2">
                <Input
                  label="Matrícula"
                  value={formData.numeroMatricula}
                  onChange={(e) => setFormData({ ...formData, numeroMatricula: e.target.value })}
                  required
                />
                <p className="text-xs text-red-600 mt-1 font-medium">
                  * Campo obrigatório para esta empresa
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-800 mb-4">Contatos</h3>

            {/* Adicionar novo contato */}
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900 mb-3">Adicionar Contato</h4>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-3">
                  <Select
                    label=""
                    value={novoContato.tipo}
                    onChange={(e) => setNovoContato({ ...novoContato, tipo: e.target.value })}
                  >
                    <option value="celular">Celular</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="fixo">Fixo</option>
                    <option value="email">Email</option>
                  </Select>
                </div>
                <div className="md:col-span-7">
                  <Input
                    label=""
                    value={novoContato.tipo === 'email' ? novoContato.valor : formatPhone(novoContato.valor)}
                    onChange={(e) => {
                      const valor = e.target.value;
                      // Se for email, permite qualquer caractere
                      // Se for telefone, formata automaticamente
                      setNovoContato({ ...novoContato, valor });
                    }}
                    placeholder={novoContato.tipo === 'email' ? 'exemplo@email.com' : '(11) 98888-7777'}
                    maxLength={novoContato.tipo === 'email' ? undefined : 15}
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <Button
                    onClick={handleAdicionarContato}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de contatos existentes */}
            <div className="space-y-3">
              {formData.contatos.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  Nenhum contato adicionado. Adicione pelo menos um telefone.
                </p>
              ) : (
                formData.contatos.map((contato, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                  >
                    <input
                      type="checkbox"
                      checked={contato.principal || false}
                      onChange={() => toggleContatoPrincipal(index)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <span className="text-xs font-medium text-slate-500 uppercase">
                        {contato.tipo}
                      </span>
                      <p className="text-sm text-slate-800">
                        {contato.tipo === 'email' ? contato.valor : formatPhone(contato.valor)}
                      </p>
                    </div>
                    {contato.principal && (
                      <span className="text-xs font-medium text-emerald-600">Principal</span>
                    )}
                    <button
                      onClick={() => handleRemoverContato(index)}
                      className="p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Remover contato"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-800 mb-4">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    CEP <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    value={formatCEP(formData.endereco.cep)}
                    onChange={(e) => handleCEPChange(e.target.value)}
                    maxLength={9}
                    disabled={loadingCEP}
                  />
                </div>
                {loadingCEP && (
                  <div className="absolute right-3 top-9">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  UF <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.endereco.uf}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, uf: e.target.value.toUpperCase() },
                    })
                  }
                  maxLength={2}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Logradouro <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.endereco.logradouro}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, logradouro: e.target.value },
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Número <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.endereco.numero}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, numero: e.target.value },
                    })
                  }
                />
              </div>

              <Input
                label="Complemento"
                value={formData.endereco.complemento}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    endereco: { ...formData.endereco, complemento: e.target.value },
                  })
                }
              />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Bairro <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.endereco.bairro}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, bairro: e.target.value },
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Cidade <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={formData.endereco.cidade}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      endereco: { ...formData.endereco, cidade: e.target.value },
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-semibold text-slate-800 mb-4">Documento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Arquivo {config?.exigir_arquivo && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleArquivoChange}
                  onPointerDown={() => {
                    if (profile?.id && draftHydratedRef.current) {
                      saveBeforeFilePicker('cadastro-modal', buildDraftPayload, profile.id, cadastro.id);
                    }
                  }}
                  onClick={() => {
                    if (profile?.id && draftHydratedRef.current) {
                      saveBeforeFilePicker('cadastro-modal', buildDraftPayload, profile.id, cadastro.id);
                    }
                  }}
                  disabled={uploadingFile}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Formatos aceitos: PDF, JPG, PNG. Tamanho máximo: 10MB.
                </p>
                {uploadingFile && (
                  <div className="flex items-center gap-2 mt-2">
                    <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                    <p className="text-xs text-emerald-600 font-medium">
                      Fazendo upload do arquivo...
                    </p>
                  </div>
                )}
                {arquivo && !uploadingFile && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <p className="text-xs text-emerald-700 font-medium">
                        {arquivo.nome}
                      </p>
                      <button
                        onClick={async () => {
                          try {
                            await supabase.storage
                              .from('cadastros-temp-files')
                              .remove([arquivo.path]);
                          } catch (err) {
                            console.error('Erro ao remover arquivo:', err);
                          }
                          setArquivo(null);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                        title="Remover arquivo"
                      >
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loadingPlanos ? (
            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center justify-center py-12 bg-slate-50 rounded-lg border border-slate-200">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-700">Carregando planos da empresa...</p>
                  <p className="text-xs text-slate-500 mt-1">Por favor, aguarde</p>
                </div>
              </div>
            </div>
          ) : planosEmpresa.length === 0 ? (
            <div className="border-t border-slate-200 pt-6">
              <div className="py-12 bg-amber-50 rounded-lg border border-amber-200">
                <div className="text-center">
                  <p className="text-sm font-medium text-amber-700">Nenhum plano disponível para esta empresa</p>
                  <p className="text-xs text-amber-600 mt-1">Entre em contato com o suporte</p>
                </div>
              </div>
            </div>
          ) : (
            <DependentesSection
              dependentes={dependentes}
              planos={planosEmpresa}
              funcionarioCadastro={funcionarioCadastroId}
              onChange={setDependentes}
            />
          )}

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
            {canDelete && (
              <Button
                variant="secondary"
                onClick={handleDelete}
                disabled={loading}
                className="w-full sm:w-auto"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </Button>
            )}

            <Button
              variant="secondary"
              onClick={handleCloseWithSave}
              disabled={loading || uploadingFile}
              className="w-full sm:w-auto"
            >
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>

            <div className="flex-1" />

            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={loading || loadingPlanos || uploadingFile}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>

            <Button onClick={handleEnviar} disabled={loading || loadingPlanos || uploadingFile} className="w-full sm:w-auto">
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Cadastrar
            </Button>
          </div>
        </div>
      </div>

      {showSelectStatusModal && (
        <SelectStatusModal
          onSelect={handleStatusSelect}
          onClose={handleStatusCancel}
        />
      )}

      <DependenteAtivoModal
        isOpen={showDependentesAtivosModal}
        onClose={() => setShowDependentesAtivosModal(false)}
        dependentesAtivos={dependentesAtivos}
      />

      {showParceiroInvalidoModal && (
        <ParceiroInvalidoModal
          onClose={() => setShowParceiroInvalidoModal(false)}
          onRetry={handleRetryWithVendedor}
        />
      )}
    </div>
  );
}
