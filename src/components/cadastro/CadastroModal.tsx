import { useState, useEffect } from 'react';
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
import { supabase } from '../../lib/supabase';

interface CadastroModalProps {
  cadastro: Cadastro;
  onClose: () => void;
  onSuccess: () => void;
}

export function CadastroModal({ cadastro, onClose, onSuccess }: CadastroModalProps) {
  const { updateCadastro, enviarParaERP, deleteCadastro, canDelete, consultarEnderecoCEP, searchEmpresa } = useCadastros();
  const { profile } = useAuth();
  const { planos: planosMap, config } = useConfigCadastro();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingCEP, setLoadingCEP] = useState(false);
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
  const [arquivo, setArquivo] = useState<{
    base64: string;
    nome: string;
    path: string;
  } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const funcionarioCadastroId = profile?.external_id ? parseInt(profile.external_id) : null;

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

  useEffect(() => {
    console.log('[CadastroModal] Inicializando dependentes...');
    console.log('[CadastroModal] cadastro.dependentes:', cadastro.dependentes);

    if (cadastro.dependentes && Array.isArray(cadastro.dependentes) && cadastro.dependentes.length > 0) {
      console.log('[CadastroModal] Carregando dependentes salvos do banco:', cadastro.dependentes);
      setDependentes(cadastro.dependentes as Dependente[]);
      setDependentesInicializados(true);
    } else {
      console.log('[CadastroModal] Nenhum dependente salvo no banco');
      setDependentesInicializados(true);
    }

    if (cadastro.arquivo_path) {
      const fileName = cadastro.arquivo_path.split('/').pop() || 'arquivo';

      supabase.storage
        .from('cadastros-temp-files')
        .download(cadastro.arquivo_path)
        .then(({ data, error }) => {
          if (error) {
            console.error('Erro ao baixar arquivo do bucket:', error);
            return;
          }

          if (data) {
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result as string;
              const base64Puro = base64.split(',')[1];
              setArquivo({
                base64: base64Puro,
                nome: fileName,
                path: cadastro.arquivo_path
              });
            };
            reader.readAsDataURL(data);
          }
        });
    }
  }, [cadastro.id]);

  useEffect(() => {
    const lemitRaw = cadastro.lemit_raw as { nome_mae?: string } | undefined;
    if (lemitRaw?.nome_mae && !cadastro.nome_mae) {
      setFormData((prev) => ({ ...prev, nomeMae: lemitRaw.nome_mae || '' }));
    }

    const enrichPlanos = (planos: any[]) => {
      return planos.map(plano => {
        const mapeamento = planosMap.find(p => p.plano_id === plano.Plano);
        return {
          ...plano,
          nomeExibicao: mapeamento?.nome_exibicao || `Plano ${plano.Plano}`,
          registroProduto: mapeamento?.registro_produto,
        };
      });
    };

    if (cadastro.planos_raw && Array.isArray(cadastro.planos_raw) && cadastro.planos_raw.length > 0) {
      console.log('[CadastroModal] Carregando planos do cadastro:', cadastro.planos_raw);
      const planosEnriquecidos = enrichPlanos(cadastro.planos_raw);
      setPlanosEmpresa(planosEnriquecidos);
    }

    const fetchPlanosIfNeeded = async () => {
      if (cadastro.empresa_id && (!cadastro.planos_raw || (Array.isArray(cadastro.planos_raw) && cadastro.planos_raw.length === 0))) {
        try {
          console.log('[CadastroModal] Buscando planos para empresa ID:', cadastro.empresa_id);
          const empresaData = await searchEmpresa(cadastro.empresa_id.toString(), 'id');
          console.log('[CadastroModal] Resposta da busca:', empresaData);

          if (empresaData.ok && empresaData.empresas && empresaData.empresas.length > 0) {
            const empresa = empresaData.empresas[0];
            const planos = empresa.precoPlano || [];
            console.log('[CadastroModal] Planos encontrados:', planos);

            const planosEnriquecidos = enrichPlanos(planos);
            setPlanosEmpresa(planosEnriquecidos);
            await updateCadastro(cadastro.id, {
              planos_raw: planos,
            });
          } else {
            console.warn('[CadastroModal] Nenhuma empresa ou plano encontrado');
          }
        } catch (err) {
          console.error('Error fetching empresa planos:', err);
        }
      }
    };

    fetchPlanosIfNeeded();
  }, [cadastro, planosMap]);

  useEffect(() => {
    const temDependentesSalvos = cadastro.dependentes && Array.isArray(cadastro.dependentes) && cadastro.dependentes.length > 0;

    if (!dependentesInicializados || temDependentesSalvos) {
      return;
    }

    if (dependentes.length === 0 && cadastro.cpf && planosEmpresa.length > 0) {
      console.log('[CadastroModal] Criando titular automaticamente (não há dependentes salvos)');
      const sexoDescricao = (formData.sexo === 1) ? 'Masculino' : (formData.sexo === 0) ? 'Feminino' : '';

      const responsavelComoDependente: Dependente = {
        tipo: 1,
        nome: formData.nome || '',
        dataNascimento: formData.dataNascimento || '',
        cpf: cadastro.cpf,
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
  }, [dependentesInicializados, planosEmpresa, cadastro.cpf, cadastro.dependentes, funcionarioCadastroId]);

  useEffect(() => {
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
  }, [formData.nome, formData.dataNascimento, formData.sexo, formData.nomeMae]);

  const isValidISODate = (dateStr: string): boolean => {
    if (!dateStr) return true;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return isoDateRegex.test(dateStr);
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      console.log('[CadastroModal] Salvando dependentes:', dependentes);
      console.log('[CadastroModal] Número de dependentes:', dependentes.length);

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

      console.log('[CadastroModal] Dados para atualizar:', updateData);

      await updateCadastro(cadastro.id, updateData);

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

      await updateCadastro(cadastro.id, updateData);
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
      await updateCadastro(cadastro.id, { status_adesao_id: statusId });
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
    setShowSelectStatusModal(false);
    onSuccess();
    onClose();
  };

  const handleArquivoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      setError('O arquivo deve ter no máximo 10MB');
      e.target.value = '';
      return;
    }

    setUploadingFile(true);
    setError('');

    try {
      if (arquivo) {
        try {
          await supabase.storage
            .from('cadastros-temp-files')
            .remove([arquivo.path]);
        } catch (err) {
          console.error('Erro ao remover arquivo anterior:', err);
        }
      }

      const fileExtension = file.name.split('.').pop();
      const fileName = `${formData.nome || 'arquivo'}_${removeCPFMask(cadastro.cpf)}_${Date.now()}.${fileExtension}`;
      const filePath = `cadastros/${cadastro.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('cadastros-temp-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64String = reader.result as string;
          const base64Puro = base64String.split(',')[1];
          resolve(base64Puro);
        };
        reader.readAsDataURL(file);
      });

      setArquivo({
        base64,
        nome: fileName,
        path: filePath
      });

      setSuccess('Arquivo carregado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Erro ao fazer upload do arquivo:', err);
      setError('Erro ao fazer upload do arquivo');
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

    if (cadastro.empresa_exige_matricula === 1 && !formData.numeroMatricula) {
      setError('Campo obrigatório: Matrícula (obrigatória para esta empresa)');
      return;
    }

    if (!cadastro.empresa_id) {
      setError('ID da empresa não encontrado. Por favor, busque a empresa novamente.');
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
        cpf: cadastro.cpf,
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
        cadastro.empresa_id,
        cadastro.vendedor_codigo,
        funcionarioCadastroId,
        profile?.role,
        profile?.external_id
      );

      const result = await enviarParaERP(cadastro.id, payload);

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
            arquivo: arquivo.base64,
            arquivoNome: arquivo.nome,
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

          if (!uploadResponse.ok || !uploadResult.success) {
            throw new Error(uploadResult.error || 'Erro ao enviar arquivo');
          }

          console.log('Arquivo enviado com sucesso:', uploadResult);
        } catch (uploadErr: any) {
          console.error('Erro ao enviar arquivo:', uploadErr);
          setError(`Cadastro criado, mas erro ao enviar arquivo: ${uploadErr.message}`);
          setLoading(false);
          return;
        }
      }

      const arquivoPath = arquivo?.path;
      if (arquivoPath) {
        try {
          const { error: deleteError } = await supabase.storage
            .from('cadastros-temp-files')
            .remove([arquivoPath]);

          if (deleteError) {
            console.error('Erro ao deletar arquivo do bucket:', deleteError);
          } else {
            console.log('Arquivo deletado do bucket com sucesso:', arquivoPath);
          }

          await updateCadastro(cadastro.id, { arquivo_path: null });
        } catch (deleteErr) {
          console.error('Erro ao limpar arquivo:', deleteErr);
        }
      }

      setSuccess('Cadastro enviado com sucesso para o ERP!');
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);
    } catch (err: any) {
      console.error('Error sending to ERP:', err);

      if (err.codigo === 3 && err.dependentesAtivos && err.dependentesAtivos.length > 0) {
        setDependentesAtivos(err.dependentesAtivos);
        setShowDependentesAtivosModal(true);
      } else {
        setError(err instanceof Error ? err.message : 'Erro ao enviar cadastro para o ERP');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja excluir este cadastro?')) return;

    setLoading(true);
    try {
      await deleteCadastro(cadastro.id);
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

  const [novoContato, setNovoContato] = useState({ tipo: 'celular', valor: '' });

  const handleAdicionarContato = () => {
    if (!novoContato.valor.trim()) {
      setError('Digite um valor para o contato');
      return;
    }

    const valorLimpo = removeCPFMask(novoContato.valor);

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
      console.log('[CadastroModal] Iniciando busca de CEP:', cepLimpo);

      try {
        const enderecoERP = await consultarEnderecoCEP(cepLimpo);
        console.log('[CadastroModal] ✅ Resultado da busca de CEP:', enderecoERP);
        console.log('[CadastroModal] Estrutura do retorno:', Object.keys(enderecoERP));
        console.log('[CadastroModal] enderecoERP.ok:', enderecoERP.ok);
        console.log('[CadastroModal] enderecoERP.dados existe?', !!enderecoERP.dados);
        if (enderecoERP.dados) {
          console.log('[CadastroModal] Dados recebidos:', JSON.stringify(enderecoERP.dados, null, 2));
        }

        if (enderecoERP.ok && enderecoERP.dados) {
          console.log('[CadastroModal] CEP encontrado com sucesso!');

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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {cadastro.nome || 'Editar Cadastro'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">CPF: {formatCPF(cadastro.cpf)}</p>
            {cadastro.vendedor_codigo && (
              <p className="text-sm text-emerald-600 mt-0.5">
                Vendedor: {cadastro.vendedor_nome || 'Nome não disponível'} (Código {cadastro.vendedor_codigo})
              </p>
            )}
          </div>
          <button
            onClick={handleCloseWithSave}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={loading}
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
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
              <option value="">Selecione</option>
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

            {cadastro.empresa_exige_matricula === 1 && (
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
                    value={novoContato.valor}
                    onChange={(e) => setNovoContato({ ...novoContato, valor: e.target.value })}
                    placeholder={novoContato.tipo === 'email' ? 'exemplo@email.com' : '(11) 98888-7777'}
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

          <DependentesSection
            dependentes={dependentes}
            planos={planosEmpresa}
            funcionarioCadastro={funcionarioCadastroId}
            onChange={setDependentes}
          />

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
              disabled={loading}
              className="w-full sm:w-auto"
            >
              <X className="w-4 h-4 mr-2" />
              Fechar
            </Button>

            <div className="flex-1" />

            <Button
              variant="secondary"
              onClick={handleSave}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>

            <Button onClick={handleEnviar} disabled={loading} className="w-full sm:w-auto">
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
    </div>
  );
}
