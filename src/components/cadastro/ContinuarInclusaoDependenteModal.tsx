import { X, Loader2, AlertCircle, CheckCircle2, Upload, Plus, Trash2, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../Button';
import { Input } from '../Input';
import { Select } from '../Select';
import { DateInput } from '../DateInput';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useConfigCadastro } from '../../contexts/ConfigCadastroContext';
import { formatCPF, removeCPFMask, validateCPF } from '../../lib/cpf';
import { Cadastro } from '../../hooks/useCadastros';
import { useCadastros } from '../../hooks/useCadastros';
import { EmpresaSearchCard } from './EmpresaSearchCard';
import { LemmitLimitModal } from './LemmitLimitModal';
import { SelectStatusModal } from './SelectStatusModal';

interface ContinuarInclusaoDependenteModalProps {
  cadastro: Cadastro;
  onClose: () => void;
  onSuccess: () => void;
}

interface Vendedor {
  id: string;
  name: string;
  external_id: string;
}

interface Adesionista {
  id: string;
  name: string;
  external_id: string;
}

interface DependenteForm {
  id: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  sexo: number;
  parentesco: number;
  plano: number;
  planoValor: string;
  nomeMae: string;
  arquivo: { base64: string; nome: string; path: string } | null;
  cpfValidationError: string;
  uploadingFile: boolean;
  consultingLemmit: boolean;
}

const normalizeToISO = (dateStr: string): string | null => {
  if (!dateStr) return null;

  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (y && m && d && y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/').map(Number);
    if (y && m && d && y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return null;
};

const formatDateFromISO = (isoDate: string): string => {
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const getIdade = (dataNascimento?: string) => {
  if (!dataNascimento) return null;

  const [yyyy, mm, dd] = dataNascimento.split('-').map(Number);
  if (!yyyy || !mm || !dd) return null;

  const hoje = new Date();
  const nascimento = new Date(yyyy, mm - 1, dd);

  let idade = hoje.getFullYear() - nascimento.getFullYear();

  const jaFezAniversarioEsteAno =
    hoje.getMonth() > nascimento.getMonth() ||
    (hoje.getMonth() === nascimento.getMonth() && hoje.getDate() >= nascimento.getDate());

  if (!jaFezAniversarioEsteAno) idade--;

  return idade;
};

const isMenorDeIdade = (dataNascimento?: string) => {
  const idade = getIdade(dataNascimento);
  return idade !== null && idade < 18;
};

export function ContinuarInclusaoDependenteModal({ cadastro, onClose, onSuccess }: ContinuarInclusaoDependenteModalProps) {
  const { profile } = useAuth();
  const { config, planos, parentescos } = useConfigCadastro();
  const { searchEmpresa } = useCadastros();

  const [showEmpresaSearch, setShowEmpresaSearch] = useState(false);
  const [empresaCodigo, setEmpresaCodigo] = useState(cadastro.empresa_codigo);
  const [empresaNome, setEmpresaNome] = useState(cadastro.empresa_nome);
  const [empresaObservacao, setEmpresaObservacao] = useState('');

  const [dependentes, setDependentes] = useState<DependenteForm[]>([
    {
      id: crypto.randomUUID(),
      nome: cadastro.nome || '',
      cpf: cadastro.cpf || '',
      dataNascimento: cadastro.data_nascimento || '',
      sexo: cadastro.sexo === 'Masculino' ? 1 : cadastro.sexo === 'Feminino' ? 2 : 0,
      parentesco: cadastro.parentesco || 0,
      plano: cadastro.plano_codigo || 0,
      planoValor: '0.00',
      nomeMae: cadastro.nome_mae || '',
      arquivo: null,
      cpfValidationError: '',
      uploadingFile: false,
      consultingLemmit: false
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lemmitLimitExceeded, setLemmitLimitExceeded] = useState<{
    limiteFormatado?: string;
    consumoFormatado?: string;
    saldoFormatado?: string;
    isUnlimited?: boolean;
  } | null>(null);
  const [showSelectStatusModal, setShowSelectStatusModal] = useState(false);
  const [pendingClose, setPendingClose] = useState(false);

  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [selectedVendedor, setSelectedVendedor] = useState<string>(cadastro.vendedor_id || '');
  const [adesionistas, setAdesionistas] = useState<Adesionista[]>([]);
  const [selectedAdesionista, setSelectedAdesionista] = useState<string>(cadastro.adesionista_id || '');

  const [planosEmpresa, setPlanosEmpresa] = useState<any[]>([]);
  const [loadingEmpresa, setLoadingEmpresa] = useState(false);

  const funcionarioCadastroId = profile?.external_id ? parseInt(profile.external_id) : null;

  useEffect(() => {
    if (profile?.role === 'VENDEDOR') {
      if (profile.id && profile.name && profile.external_id) {
        setSelectedVendedor(profile.id);
        setVendedores([{
          id: profile.id,
          name: profile.name,
          external_id: profile.external_id
        }]);
      }
    } else if (profile?.role === 'ADESIONISTA') {
      if (profile.id && profile.name && profile.external_id) {
        setSelectedAdesionista(profile.id);
        setAdesionistas([{
          id: profile.id,
          name: profile.name,
          external_id: profile.external_id
        }]);
      }
      fetchVendedores();
    } else {
      fetchVendedores();
      fetchAdesionistas();
    }
  }, [profile]);

  useEffect(() => {
    if (!empresaCodigo) {
      setShowEmpresaSearch(true);
    } else {
      fetchEmpresaPlanos();
    }
  }, [empresaCodigo]);

  const fetchEmpresaPlanos = async () => {
    if (!empresaCodigo) return;

    setLoadingEmpresa(true);
    try {
      const result = await searchEmpresa(empresaCodigo.toString(), 'id');

      if (result.ok && result.empresas && result.empresas.length > 0) {
        const empresa = result.empresas[0];
        setPlanosEmpresa(empresa.precoPlano || []);
        setEmpresaObservacao(empresa.observacao || '');

        if (cadastro.plano_codigo && empresa.precoPlano) {
          const planoEncontrado = empresa.precoPlano.find((p: any) => p.codigoPlano === cadastro.plano_codigo);
          if (planoEncontrado) {
            setDependentes(prev => prev.map((dep, idx) =>
              idx === 0 ? { ...dep, planoValor: planoEncontrado.valorPlano?.toString() || '0.00' } : dep
            ));
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar planos:', err);
    } finally {
      setLoadingEmpresa(false);
    }
  };

  const handleEmpresaSelected = async (codigo: number, nomeFantasia: string) => {
    setEmpresaCodigo(codigo);
    setEmpresaNome(nomeFantasia);
    setShowEmpresaSearch(false);

    const { error: updateError } = await supabase
      .from('cadastros')
      .update({
        empresa_codigo: codigo,
        empresa_nome: nomeFantasia
      })
      .eq('id', cadastro.id);

    if (updateError) {
      console.error('Erro ao atualizar cadastro:', updateError);
    }

    const result = await searchEmpresa(codigo.toString(), 'id');
    if (result.ok && result.empresas && result.empresas.length > 0) {
      const empresa = result.empresas[0];
      setPlanosEmpresa(empresa.precoPlano || []);
      setEmpresaObservacao(empresa.observacao || '');
    }
  };

  const fetchVendedores = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, external_id, email')
        .eq('role', 'VENDEDOR')
        .eq('is_active', true)
        .not('external_id', 'is', null)
        .order('name');

      if (error) throw error;

      setVendedores(data || []);
    } catch (err) {
      console.error('Error fetching vendedores:', err);
    }
  };

  const fetchAdesionistas = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, external_id, email')
        .eq('role', 'ADESIONISTA')
        .eq('is_active', true)
        .not('external_id', 'is', null)
        .order('name');

      if (error) throw error;

      setAdesionistas(data || []);
    } catch (err) {
      console.error('Error fetching adesionistas:', err);
    }
  };

  const handleCpfChange = async (index: number, value: string) => {
    const formatted = formatCPF(value);
    const cpfLimpo = removeCPFMask(formatted);

    setDependentes(prev => prev.map((dep, idx) => {
      if (idx === index) {
        let cpfError = '';
        if (cpfLimpo.length === 11 && !validateCPF(formatted)) {
          cpfError = 'CPF inválido';
        }
        return { ...dep, cpf: formatted, cpfValidationError: cpfError };
      }
      return dep;
    }));

    if (cpfLimpo.length === 11) {
      if (!validateCPF(formatted)) {
        return;
      }

      await consultarLemmitDependente(index, cpfLimpo);
    }
  };

  const consultarLemmitDependente = async (index: number, cpfLimpo: string) => {
    if (!config?.lemmit_inclusao_dependente) {
      return;
    }

    setDependentes(prev => prev.map((dep, idx) =>
      idx === index ? { ...dep, consultingLemmit: true } : dep
    ));
    setError('');

    try {
      const { data: canUse } = await supabase.rpc('can_use_lemmit', {
        p_user_id: profile?.id,
      });

      if (!canUse) {

        const { data: limitInfo } = await supabase.rpc('get_lemmit_limit_info', {
          p_user_id: profile?.id,
        });

        if (limitInfo && limitInfo.length > 0) {
          const info = limitInfo[0];
          if (info.limite_mensal !== null) {
            const limiteFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(info.limite_mensal);
            const consumoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(info.consumo_mensal);
            const saldoFormatado = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(info.saldo_disponivel);

            setLemmitLimitExceeded({
              limiteFormatado,
              consumoFormatado,
              saldoFormatado,
            });
          } else {
            setLemmitLimitExceeded({
              isUnlimited: true,
            });
          }
        } else {
          setLemmitLimitExceeded({});
        }

        setDependentes(prev => prev.map((dep, idx) =>
          idx === index ? { ...dep, consultingLemmit: false } : dep
        ));
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lemit-consulta-pessoa`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cpf: cpfLimpo }),
        }
      );

      if (!response.ok) {
        console.warn('Erro na consulta Lemmit para dependente:', response.status, response.statusText);
        setDependentes(prev => prev.map((dep, idx) =>
          idx === index ? { ...dep, consultingLemmit: false } : dep
        ));
        return;
      }

      const lemitData = await response.json();

      if (lemitData.success && lemitData.data) {
        const lemmitInfo = lemitData.data;
        const nomeCompleto = `${lemmitInfo.nome || ''} ${lemmitInfo.sobrenome || ''}`.trim();
        const dataNascimento = lemmitInfo.dataNascimento ? lemmitInfo.dataNascimento.split('T')[0] : '';
        const nomeMae = lemmitInfo.nomeMae || '';

        setDependentes(prev => prev.map((dep, idx) => {
          if (idx === index) {
            return {
              ...dep,
              nome: nomeCompleto || dep.nome,
              dataNascimento: dataNascimento || dep.dataNascimento,
              nomeMae: nomeMae || dep.nomeMae,
              sexo: lemmitInfo.sexo === 'M' ? 1 : lemmitInfo.sexo === 'F' ? 2 : dep.sexo,
              consultingLemmit: false
            };
          }
          return dep;
        }));
      } else {
        setDependentes(prev => prev.map((dep, idx) =>
          idx === index ? { ...dep, consultingLemmit: false } : dep
        ));
      }
    } catch (err: any) {
      console.error('Erro ao consultar Lemmit:', err);
      setDependentes(prev => prev.map((dep, idx) =>
        idx === index ? { ...dep, consultingLemmit: false } : dep
      ));
    }
  };

  const handlePlanoChange = (index: number, planoId: number) => {
    const planoEncontrado = planosEmpresa.find((p: any) => p.codigoPlano === planoId);
    setDependentes(prev => prev.map((dep, idx) => {
      if (idx === index) {
        return {
          ...dep,
          plano: planoId,
          planoValor: planoEncontrado?.valorPlano?.toString() || '0.00'
        };
      }
      return dep;
    }));
  };

  const handleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Apenas arquivos JPG, PNG ou PDF são permitidos');
      e.target.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError('Arquivo muito grande. Tamanho máximo: 5MB');
      e.target.value = '';
      return;
    }

    setDependentes(prev => prev.map((dep, idx) =>
      idx === index ? { ...dep, uploadingFile: true } : dep
    ));
    setError('');

    try {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${profile?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cadastros-temp-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        const timeout = setTimeout(() => {
          reader.abort();
          reject(new Error('Tempo limite excedido ao processar arquivo'));
        }, 30000);

        reader.onloadend = () => {
          clearTimeout(timeout);
          try {
            const base64 = reader.result as string;
            const base64Puro = base64.split(',')[1];
            resolve(base64Puro);
          } catch (err) {
            reject(err);
          }
        };

        reader.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Erro ao ler arquivo'));
        };

        reader.onabort = () => {
          clearTimeout(timeout);
          reject(new Error('Leitura do arquivo cancelada'));
        };

        reader.readAsDataURL(file);
      });

      setDependentes(prev => prev.map((dep, idx) => {
        if (idx === index) {
          return {
            ...dep,
            arquivo: {
              base64: base64Data,
              nome: file.name,
              path: filePath
            },
            uploadingFile: false
          };
        }
        return dep;
      }));

      setSuccess('Arquivo carregado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao fazer upload:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao fazer upload do arquivo';
      setError(errorMessage);
      setDependentes(prev => prev.map((dep, idx) =>
        idx === index ? { ...dep, uploadingFile: false } : dep
      ));
    } finally {
      e.target.value = '';
    }
  };

  const adicionarDependente = () => {
    setDependentes(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        nome: '',
        cpf: '',
        dataNascimento: '',
        sexo: 0,
        parentesco: 0,
        plano: 0,
        planoValor: '0.00',
        nomeMae: '',
        arquivo: null,
        cpfValidationError: '',
        uploadingFile: false,
        consultingLemmit: false
      }
    ]);
  };

  const removerDependente = (index: number) => {
    if (dependentes.length === 1) {
      setError('É necessário ter pelo menos um dependente');
      return;
    }
    setDependentes(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateDependente = (index: number, field: keyof DependenteForm, value: any) => {
    setDependentes(prev => prev.map((dep, idx) =>
      idx === index ? { ...dep, [field]: value } : dep
    ));
  };

  const handleRequestClose = () => {
    setPendingClose(true);
    setShowSelectStatusModal(true);
  };

  const handleStatusSelected = async (statusId: string) => {
    try {
      const { error: updateError } = await supabase
        .from('cadastros')
        .update({ status_adesao_id: statusId })
        .eq('id', cadastro.id);

      if (updateError) throw updateError;

      setShowSelectStatusModal(false);

      if (pendingClose) {
        onClose();
      }
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      setError('Erro ao atualizar status da adesão');
      setShowSelectStatusModal(false);
    }
  };

  const handleSalvarRascunho = async () => {
    setSalvando(true);
    setError('');
    setSuccess('');

    try {
      const dependentesData = dependentes.map(dep => ({
        nome: dep.nome,
        cpf: dep.cpf,
        data_nascimento: dep.dataNascimento,
        sexo: dep.sexo === 1 ? 'Masculino' : dep.sexo === 2 ? 'Feminino' : null,
        parentesco: dep.parentesco,
        plano_codigo: dep.plano,
        nome_mae: dep.nomeMae,
        arquivo_path: dep.arquivo?.path || null
      }));

      const updateData: any = {
        dependentes: dependentesData,
        updated_at: new Date().toISOString()
      };

      if (selectedVendedor) {
        const vendedor = vendedores.find(v => v.id === selectedVendedor);
        if (vendedor) {
          updateData.vendedor_id = vendedor.id;
          updateData.vendedor_codigo = vendedor.external_id;
          updateData.vendedor_nome = vendedor.name;
        }
      }

      if (selectedAdesionista) {
        const adesionista = adesionistas.find(a => a.id === selectedAdesionista);
        if (adesionista) {
          updateData.adesionista_id = adesionista.id;
          updateData.adesionista_codigo = adesionista.external_id;
          updateData.adesionista_nome = adesionista.name;
        }
      }

      const { error: updateError } = await supabase
        .from('cadastros')
        .update(updateData)
        .eq('id', cadastro.id);

      if (updateError) throw updateError;

      setSuccess('Rascunho salvo com sucesso!');
      setTimeout(() => {
        setSuccess('');
      }, 3000);
    } catch (err: any) {
      console.error('Erro ao salvar rascunho:', err);
      setError(err.message || 'Erro ao salvar rascunho');
    } finally {
      setSalvando(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    for (let i = 0; i < dependentes.length; i++) {
      const dep = dependentes[i];

      if (!dep.nome) {
        setError(`Dependente ${i + 1}: Nome é obrigatório`);
        return;
      }

      if (!isMenorDeIdade(dep.dataNascimento) && !dep.cpf) {
        setError(`Dependente ${i + 1}: CPF é obrigatório para maiores de 18 anos`);
        return;
      }

      if (dep.cpf && dep.cpfValidationError) {
        setError(`Dependente ${i + 1}: CPF inválido`);
        return;
      }

      if (!dep.dataNascimento) {
        setError(`Dependente ${i + 1}: Data de nascimento é obrigatória`);
        return;
      }

      const dataNascimentoISO = normalizeToISO(dep.dataNascimento);
      if (!dataNascimentoISO) {
        setError(`Dependente ${i + 1}: Data de nascimento inválida`);
        return;
      }

      if (dep.sexo === 0) {
        setError(`Dependente ${i + 1}: Sexo é obrigatório`);
        return;
      }

      if (!dep.parentesco || dep.parentesco === 0) {
        setError(`Dependente ${i + 1}: Parentesco é obrigatório`);
        return;
      }

      if (!dep.plano || dep.plano === 0) {
        setError(`Dependente ${i + 1}: Plano é obrigatório`);
        return;
      }

      if (!dep.nomeMae) {
        setError(`Dependente ${i + 1}: Nome da mãe é obrigatório`);
        return;
      }

      if (config?.exigir_arquivo && !dep.arquivo) {
        if (i === 0 && cadastro.arquivo_path) {
        } else {
          setError(`Dependente ${i + 1}: Arquivo é obrigatório`);
          return;
        }
      }
    }

    if (!selectedVendedor) {
      setError('Vendedor é obrigatório');
      return;
    }

    if (!cadastro.responsavel_financeiro_codigo) {
      setError('Responsável financeiro não encontrado no cadastro');
      return;
    }

    setLoading(true);

    try {
      const vendedorSelecionado = vendedores.find(v => v.id === selectedVendedor);
      if (!vendedorSelecionado?.external_id) {
        setError('Vendedor selecionado não possui código externo válido');
        setLoading(false);
        return;
      }

      const codigoParceiro = parseInt(vendedorSelecionado.external_id);
      const codigoAdesionista = adesionistas.find(a => a.id === selectedAdesionista)?.external_id
        ? parseInt(adesionistas.find(a => a.id === selectedAdesionista)!.external_id)
        : undefined;

      const mesAnoAtual = new Date().toISOString().slice(0, 7);

      const dependentesPayload = dependentes.map(dep => {
        const cpfLimpo = removeCPFMask(dep.cpf || '').trim();
        const dataNascimentoISO = normalizeToISO(dep.dataNascimento)!;

        return {
          tipo: dep.parentesco,
          nome: dep.nome,
          cpf: cpfLimpo ? cpfLimpo : '',
          sexo: dep.sexo,
          plano: dep.plano,
          planoValor: dep.planoValor,
          nomeMae: dep.nomeMae,
          numeroProposta: "",
          carenciaAtendimento: 1,
          rcaId: 0,
          cd_orientacao_sexual: 0,
          OutraOrientacaoSexual: "",
          cd_ident_genero: 0,
          OutraIdentidadeGenero: "",
          idExterno: "",
          MMYYYY1Pagamento: mesAnoAtual,
          numeroCarteira: "",
          observacaoUsuario: "",
          dataNascimento: formatDateFromISO(dataNascimentoISO),
          funcionarioCadastro: funcionarioCadastroId,
          dataCadastroLoteContrato: "",
          estadoCivil: 0
        };
      });

      const parceiroObj = {
        codigo: codigoParceiro,
        adesionista: codigoAdesionista || 0
      };

      const payload = {
        dados: {
          parceiro: parceiroObj,
          responsavelFinanceiro: {
            codigo: cadastro.responsavel_financeiro_codigo,
            dataAssinaturaContrato: ""
          },
          dependente: dependentesPayload,
          contatoDependente: []
        }
      };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/erp-novo-dependente`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Erro ao incluir dependente');
      }

      if (!result.data || !result.data.dados) {
        const errorMsg = result.data?.mensagem || 'Erro: Resposta inválida da API';
        throw new Error(errorMsg);
      }

      if (result?.data?.dados?.dependentes && result.data.dados.dependentes.length > 0) {
        for (let i = 0; i < dependentes.length; i++) {
          const dep = dependentes[i];
          if (dep.arquivo && result.data.dados.dependentes[i]) {
            try {
              const dependenteCodigo = result.data.dados.dependentes[i].codigo;

              const uploadPayload = {
                idFuncionario: funcionarioCadastroId,
                idDependente: parseInt(dependenteCodigo),
                arquivo: dep.arquivo.base64,
                arquivoNome: dep.arquivo.nome,
              };

              console.log(`Tentando enviar arquivo do dependente ${i + 1} diretamente para o ERP...`);

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
                console.log(`Documento do dependente ${i + 1} enviado com sucesso ao ERP!`);

                try {
                  await supabase.storage
                    .from('cadastros-temp-files')
                    .remove([dep.arquivo.path]);
                  console.log(`Arquivo do dependente ${i + 1} removido do bucket temporário`);
                } catch (removeErr) {
                  console.warn(`Aviso ao remover arquivo do dependente ${i + 1} do bucket:`, removeErr);
                }
              } else {
                console.warn(`Falha ao enviar documento do dependente ${i + 1}, enfileirando...`);

                const enqueuePayload = {
                  cadastroId: cadastro.id,
                  idFuncionario: funcionarioCadastroId,
                  idDependente: parseInt(dependenteCodigo),
                  arquivoPath: dep.arquivo.path,
                  arquivoNome: dep.arquivo.nome,
                  tipo: 'dependente',
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
                  console.error(`Erro ao enfileirar arquivo do dependente ${i + 1}:`, enqueueResult);
                } else {
                  console.log(`Arquivo do dependente ${i + 1} enfileirado para processamento automático:`, enqueueResult);
                }
              }
            } catch (uploadErr) {
              console.warn(`Erro ao processar upload do dependente ${i + 1}, tentando enfileirar...`, uploadErr);

              try {
                const dependenteCodigo = result.data.dados.dependentes[i].codigo;

                const enqueuePayload = {
                  cadastroId: cadastro.id,
                  idFuncionario: funcionarioCadastroId,
                  idDependente: parseInt(dependenteCodigo),
                  arquivoPath: dep.arquivo.path,
                  arquivoNome: dep.arquivo.nome,
                  tipo: 'dependente',
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

                if (enqueueResponse.ok && enqueueResult.queued) {
                  console.log(`Arquivo do dependente ${i + 1} enfileirado com sucesso após erro`);
                }
              } catch (enqueueErr) {
                console.error(`Erro crítico ao enfileirar arquivo do dependente ${i + 1}:`, enqueueErr);
              }
            }
          }
        }
      }

      const { error: updateError } = await supabase
        .from('cadastros')
        .update({ status: 'enviado' })
        .eq('id', cadastro.id);

      if (updateError) throw updateError;

      setSuccess('Dependentes incluídos com sucesso!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (err: any) {
      console.error('Erro ao incluir dependente:', err);
      setError(err.message || 'Erro ao incluir dependentes');
    } finally {
      setLoading(false);
    }
  };

  if (showEmpresaSearch) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-amber-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
            <div>
              <h2 className="text-xl font-bold">Empresa não identificada</h2>
              <p className="text-sm text-amber-100">Busque e selecione a empresa antes de continuar</p>
            </div>
            <button
              onClick={handleRequestClose}
              className="text-white hover:bg-amber-700 p-2 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            <EmpresaSearchCard onEmpresaSelected={handleEmpresaSelected} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-emerald-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl z-10">
          <h2 className="text-xl font-bold">Continuar Inclusão de Dependentes</h2>
          <button
            onClick={handleRequestClose}
            className="text-white hover:bg-emerald-700 p-2 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-emerald-800">{success}</p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Responsável Financeiro</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p><strong>Nome:</strong> {cadastro.responsavel_financeiro_nome}</p>
              <p><strong>CPF:</strong> {formatCPF(cadastro.responsavel_financeiro_cpf || '')}</p>
              <p><strong>Empresa:</strong> {empresaNome}</p>
            </div>
          </div>

          {empresaObservacao && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <h3 className="font-semibold text-amber-900 mb-2">Observação da Empresa</h3>
              <p className="text-sm text-amber-800 whitespace-pre-wrap">{empresaObservacao}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile?.role !== 'VENDEDOR' && (
              <Select
                label="Vendedor"
                value={selectedVendedor}
                onChange={(e) => setSelectedVendedor(e.target.value)}
                required
              >
                <option value="">Selecione</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            )}

            {profile?.role !== 'ADESIONISTA' && profile?.role !== 'VENDEDOR' && (
              <Select
                label="Adesionista (Opcional)"
                value={selectedAdesionista}
                onChange={(e) => setSelectedAdesionista(e.target.value)}
              >
                <option value="">Nenhum</option>
                {adesionistas.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">Dependentes</h3>
              <Button
                onClick={adicionarDependente}
                variant="secondary"
                className="flex items-center gap-2"
                disabled={loading}
              >
                <Plus className="w-4 h-4" />
                Adicionar Dependente
              </Button>
            </div>

            {dependentes.map((dep, index) => (
              <div key={dep.id} className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-slate-700">Dependente {index + 1}</h4>
                  {dependentes.length > 1 && (
                    <button
                      onClick={() => removerDependente(index)}
                      className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remover dependente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <Input
                      label="Nome Completo"
                      value={dep.nome}
                      onChange={(e) => updateDependente(index, 'nome', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Input
                      label="CPF"
                      value={dep.cpf}
                      onChange={(e) => handleCpfChange(index, e.target.value)}
                      required={!isMenorDeIdade(dep.dataNascimento)}
                      disabled={dep.consultingLemmit}
                    />
                    {dep.consultingLemmit && (
                      <div className="flex items-center gap-2 mt-1 text-blue-600 text-xs">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Consultando Lemmit...</span>
                      </div>
                    )}
                    {dep.cpfValidationError && (
                      <p className="text-xs text-red-600 mt-1">{dep.cpfValidationError}</p>
                    )}
                  </div>

                  <DateInput
                    label="Data de Nascimento"
                    value={dep.dataNascimento}
                    onChange={(e) => updateDependente(index, 'dataNascimento', e.target.value)}
                    required
                  />

                  <Select
                    label="Sexo"
                    value={dep.sexo.toString()}
                    onChange={(e) => updateDependente(index, 'sexo', parseInt(e.target.value))}
                    required
                  >
                    <option value="0">Selecione</option>
                    <option value="1">Masculino</option>
                    <option value="2">Feminino</option>
                  </Select>

                  <Select
                    label="Parentesco"
                    value={dep.parentesco.toString()}
                    onChange={(e) => updateDependente(index, 'parentesco', parseInt(e.target.value))}
                    required
                  >
                    <option value="0">Selecione</option>
                    {parentescos
                      .filter(p => p.ativo && p.parentesco_id !== 1)
                      .map(p => (
                        <option key={p.parentesco_id} value={p.parentesco_id}>
                          {p.nome_exibicao}
                        </option>
                      ))}
                  </Select>

                  <Select
                    label="Plano"
                    value={dep.plano.toString()}
                    onChange={(e) => handlePlanoChange(index, parseInt(e.target.value))}
                    required
                    disabled={loadingEmpresa}
                  >
                    <option value="0">
                      {loadingEmpresa ? 'Carregando planos...' : 'Selecione'}
                    </option>
                    {planosEmpresa
                      .filter((p: any) => !config?.planos_ocultos?.includes(p.codigoPlano?.toString()))
                      .map((p: any) => (
                        <option key={p.codigoPlano} value={p.codigoPlano}>
                          {p.nomePlano} - R$ {p.valorPlano?.toFixed(2)}
                        </option>
                      ))}
                  </Select>

                  <div className="md:col-span-2">
                    <Input
                      label="Nome da Mãe"
                      value={dep.nomeMae}
                      onChange={(e) => updateDependente(index, 'nomeMae', e.target.value)}
                      required
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Arquivo {config?.exigir_arquivo && <span className="text-red-500">*</span>}
                    </label>
                    {(dep.arquivo || (index === 0 && cadastro.arquivo_path)) ? (
                      <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        <span className="text-sm text-emerald-700 flex-1">
                          {dep.arquivo ? dep.arquivo.nome : 'Arquivo já enviado'}
                        </span>
                      </div>
                    ) : (
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,application/pdf"
                          onChange={(e) => handleFileUpload(index, e)}
                          disabled={dep.uploadingFile}
                          className="hidden"
                          id={`file-upload-${index}`}
                        />
                        <label
                          htmlFor={`file-upload-${index}`}
                          className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 rounded-lg hover:border-emerald-400 hover:bg-emerald-50 transition-colors cursor-pointer"
                        >
                          {dep.uploadingFile ? (
                            <>
                              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                              <span className="text-sm text-emerald-700">Enviando...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-5 h-5 text-slate-500" />
                              <span className="text-sm text-slate-600">
                                Clique para selecionar arquivo (JPG, PNG ou PDF)
                              </span>
                            </>
                          )}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 px-6 py-4 flex justify-between gap-3 border-t border-slate-200 rounded-b-xl">
          <Button
            onClick={handleSalvarRascunho}
            variant="secondary"
            disabled={loading || salvando}
            className="flex items-center gap-2"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Rascunho
              </>
            )}
          </Button>
          <div className="flex gap-3">
            <Button onClick={handleRequestClose} variant="secondary" disabled={loading || salvando}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || salvando || dependentes.some(d => d.uploadingFile || d.consultingLemmit)}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                `Incluir ${dependentes.length} ${dependentes.length === 1 ? 'Dependente' : 'Dependentes'}`
              )}
            </Button>
          </div>
        </div>
      </div>

      {lemmitLimitExceeded && (
        <LemmitLimitModal
          limiteFormatado={lemmitLimitExceeded.limiteFormatado}
          consumoFormatado={lemmitLimitExceeded.consumoFormatado}
          saldoFormatado={lemmitLimitExceeded.saldoFormatado}
          isUnlimited={lemmitLimitExceeded.isUnlimited}
          onClose={() => setLemmitLimitExceeded(null)}
        />
      )}

      {showSelectStatusModal && (
        <SelectStatusModal
          onSelect={handleStatusSelected}
          onClose={() => {
            setShowSelectStatusModal(false);
            setPendingClose(false);
          }}
        />
      )}
    </div>
  );
}
