import { useState } from 'react';
import { Plus, Trash2, Edit2, X, Check } from 'lucide-react';
import { Input } from '../Input';
import { Select } from '../Select';
import { Button } from '../Button';
import { formatCPF, formatDate } from '../../lib/cpf';
import { useConfigCadastro } from '../../contexts/ConfigCadastroContext';

export interface Dependente {
  tipo: number;
  nome: string;
  dataNascimento: string;
  cpf: string;
  sexo: number;
  sexoDescricao: string;
  plano: number;
  planoValor: string;
  nomeMae: string;
  carenciaAtendimento: number;
  funcionarioCadastro: number;
}

interface DependentesSectionProps {
  dependentes: Dependente[];
  planos: any[];
  funcionarioCadastro: number | null;
  onChange: (dependentes: Dependente[]) => void;
}

export function DependentesSection({
  dependentes,
  planos,
  funcionarioCadastro,
  onChange,
}: DependentesSectionProps) {
  const { parentescos } = useConfigCadastro();
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  console.log('[DependentesSection] Planos recebidos:', planos);
  console.log('[DependentesSection] Número de planos:', planos?.length || 0);

  const [formData, setFormData] = useState<{
    tipo: number;
    nome: string;
    dataNascimento: string;
    cpf: string;
    sexo: number | null;
    plano: number;
    nomeMae: string;
  }>({
    tipo: 0,
    nome: '',
    dataNascimento: '',
    cpf: '',
    sexo: null,
    plano: 0,
    nomeMae: '',
  });

  const resetForm = () => {
    setFormData({
      tipo: 0,
      nome: '',
      dataNascimento: '',
      cpf: '',
      sexo: null,
      plano: 0,
      nomeMae: '',
    });
  };

  const handleAdd = () => {
    if (!formData.nome) {
      alert('Campo obrigatório: Nome');
      return;
    }

    if (!formData.dataNascimento) {
      alert('Campo obrigatório: Data de Nascimento');
      return;
    }

    if (!formData.cpf) {
      alert('Campo obrigatório: CPF');
      return;
    }

    if (formData.sexo === null || formData.sexo === undefined) {
      alert('Campo obrigatório: Sexo');
      return;
    }

    if (!formData.tipo) {
      alert('Campo obrigatório: Grau de Parentesco');
      return;
    }

    if (!formData.plano) {
      alert('Campo obrigatório: Plano');
      return;
    }

    if (!formData.nomeMae) {
      alert('Campo obrigatório: Nome da Mãe');
      return;
    }

    if (formData.tipo === 1) {
      const titularExistente = dependentes.find((d, i) => d.tipo === 1 && i !== editingIndex);
      if (titularExistente) {
        alert('Só pode haver 1 titular nos dependentes. Já existe um titular cadastrado.');
        return;
      }
    }

    const planoSelecionado = planos.find((p) => p.Plano === formData.plano);
    if (!planoSelecionado) {
      console.error('[DependentesSection] Plano não encontrado. Planos disponíveis:', planos);
      console.error('[DependentesSection] Plano buscado:', formData.plano);
      alert('Plano não encontrado');
      return;
    }

    const dataNascimentoFormatada = formatDate(formData.dataNascimento);

    const novoDependente: Dependente = {
      tipo: formData.tipo,
      nome: formData.nome,
      dataNascimento: dataNascimentoFormatada,
      cpf: formData.cpf.replace(/\D/g, ''),
      sexo: formData.sexo ?? 0,
      sexoDescricao: formData.sexo === 1 ? 'Masculino' : (formData.sexo === 0 ? 'Feminino' : ''),
      plano: formData.plano,
      planoValor: planoSelecionado.ValorTitular?.toString() || '0,00',
      nomeMae: formData.nomeMae,
      carenciaAtendimento: 0,
      funcionarioCadastro: funcionarioCadastro || 0,
    };

    if (editingIndex !== null) {
      const novosDependentes = [...dependentes];
      novosDependentes[editingIndex] = novoDependente;
      onChange(novosDependentes);
      setEditingIndex(null);
    } else {
      onChange([...dependentes, novoDependente]);
    }

    resetForm();
    setIsAdding(false);
  };

  const handleEdit = (index: number) => {
    const dep = dependentes[index];
    setFormData({
      tipo: dep.tipo ?? 0,
      nome: dep.nome ?? '',
      dataNascimento: dep.dataNascimento ?? '',
      cpf: dep.cpf ?? '',
      sexo: dep.sexo ?? 0,
      plano: dep.plano ?? 0,
      nomeMae: dep.nomeMae ?? '',
    });
    setEditingIndex(index);
    setIsAdding(true);
  };

  const handleDelete = (index: number) => {
    if (window.confirm('Tem certeza que deseja remover este dependente?')) {
      const novosDependentes = dependentes.filter((_, i) => i !== index);
      onChange(novosDependentes);
    }
  };

  const handleCancel = () => {
    resetForm();
    setIsAdding(false);
    setEditingIndex(null);
  };

  const parentescosAtivos = parentescos.filter((p) => p.ativo);

  return (
    <div className="border-t border-slate-200 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">Dependentes</h3>
        {!isAdding && (
          <Button
            variant="secondary"
            onClick={() => setIsAdding(true)}
            className="text-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Dependente
          </Button>
        )}
      </div>

      {isAdding && (
        <div className="bg-slate-50 p-4 rounded-lg mb-4 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-slate-700">
              {editingIndex !== null ? 'Editar Dependente' : 'Novo Dependente'}
            </h4>
            <button
              onClick={handleCancel}
              className="p-1 hover:bg-slate-200 rounded transition-colors"
            >
              <X className="w-4 h-4 text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Grau de Parentesco"
              value={formData.tipo.toString()}
              onChange={(e) => setFormData({ ...formData, tipo: parseInt(e.target.value) })}
              required
            >
              <option value="0">Selecione</option>
              {parentescosAtivos.map((p) => (
                <option key={p.id} value={p.parentesco_id}>
                  {p.label}
                </option>
              ))}
            </Select>

            <div className="md:col-span-2">
              <Input
                label="Nome Completo"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>

            <Input
              label="Data de Nascimento"
              type="date"
              value={formData.dataNascimento}
              onChange={(e) => setFormData({ ...formData, dataNascimento: e.target.value })}
              required
            />

            <Input
              label="CPF"
              value={formatCPF(formData.cpf)}
              onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
              maxLength={14}
              required
            />

            <Select
              label="Sexo"
              value={formData.sexo === null ? '' : formData.sexo.toString()}
              onChange={(e) => setFormData({ ...formData, sexo: e.target.value === '' ? null : parseInt(e.target.value) })}
              required
            >
              <option value="">Selecione</option>
              <option value="1">Masculino</option>
              <option value="0">Feminino</option>
            </Select>

            <Select
              label="Plano"
              value={formData.plano.toString()}
              onChange={(e) => setFormData({ ...formData, plano: parseInt(e.target.value) })}
              required
            >
              <option value="0">Selecione</option>
              {planos.map((p) => (
                <option key={p.Plano} value={p.Plano}>
                  {p.nomeExibicao || `Plano ${p.Plano}`} - Titular: R$ {p.ValorTitular || '0,00'} / Dep: R$ {p.ValorDependente || '0,00'}
                </option>
              ))}
            </Select>

            <div className="md:col-span-2">
              <Input
                label="Nome da Mãe"
                value={formData.nomeMae}
                onChange={(e) => setFormData({ ...formData, nomeMae: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={handleCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleAdd}>
              <Check className="w-4 h-4 mr-2" />
              {editingIndex !== null ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {dependentes.map((dep, index) => {
          const parentesco = parentescos.find((p) => p.parentesco_id === dep.tipo);
          const plano = planos.find((p) => p.Plano === dep.plano);

          return (
            <div
              key={index}
              className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-slate-800">{dep.nome}</span>
                  <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">
                    {parentesco?.label || 'N/A'}
                  </span>
                </div>
                <div className="text-sm text-slate-600 space-y-0.5">
                  <p>CPF: {formatCPF(dep.cpf)} • {dep.sexoDescricao}</p>
                  <p>
                    Data Nascimento: {formatDate(dep.dataNascimento)} • Plano:{' '}
                    {plano?.nomeExibicao || `Plano ${dep.plano}`} (R$ {dep.planoValor})
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(index)}
                  className="p-2 hover:bg-slate-200 rounded transition-colors"
                  title="Editar"
                >
                  <Edit2 className="w-4 h-4 text-slate-600" />
                </button>
                <button
                  onClick={() => handleDelete(index)}
                  className="p-2 hover:bg-red-100 rounded transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          );
        })}
        {dependentes.length === 0 && !isAdding && (
          <p className="text-center text-slate-500 py-4">
            Nenhum dependente adicionado
          </p>
        )}
      </div>
    </div>
  );
}
