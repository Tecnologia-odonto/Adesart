import { useState } from 'react';
import { useConfigCadastro } from '../../contexts/ConfigCadastroContext';
import { Loader2 } from 'lucide-react';

export function GeralConfigCard() {
  const { config, updateConfig, loading: hookLoading } = useConfigCadastro();
  const [updating, setUpdating] = useState(false);
  const [editingSituacoes, setEditingSituacoes] = useState(false);
  const [editingPlanos, setEditingPlanos] = useState(false);
  const [editingPlanosOcultos, setEditingPlanosOcultos] = useState(false);
  const [tempSituacoes, setTempSituacoes] = useState('');
  const [tempPlanos, setTempPlanos] = useState('');
  const [tempPlanosOcultos, setTempPlanosOcultos] = useState('');

  const handleToggleLemmit = async () => {
    if (!config) return;

    const novoValor = !config.ativar_lemmit;
    console.log('Toggling Lemmit:', { atual: config.ativar_lemmit, novo: novoValor });

    setUpdating(true);
    try {
      await updateConfig({ ativar_lemmit: novoValor });
      console.log('Config atualizada com sucesso');
    } catch (error) {
      console.error('Error updating config:', error);
      alert('Erro ao atualizar configuração');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleExigirArquivo = async () => {
    if (!config) return;

    const novoValor = !config.exigir_arquivo;
    console.log('Toggling Exigir Arquivo:', { atual: config.exigir_arquivo, novo: novoValor });

    setUpdating(true);
    try {
      await updateConfig({ exigir_arquivo: novoValor });
      console.log('Config atualizada com sucesso');
    } catch (error) {
      console.error('Error updating config:', error);
      alert('Erro ao atualizar configuração');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleLemmitDependente = async () => {
    if (!config) return;

    const novoValor = !config.lemmit_dependente;
    console.log('Toggling Lemmit no Dependente:', { atual: config.lemmit_dependente, novo: novoValor });

    setUpdating(true);
    try {
      await updateConfig({ lemmit_dependente: novoValor });
      console.log('Config atualizada com sucesso');
    } catch (error) {
      console.error('Error updating config:', error);
      alert('Erro ao atualizar configuração');
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleLemmitInclusaoDependente = async () => {
    if (!config) return;

    const novoValor = !config.lemmit_inclusao_dependente;
    console.log('Toggling Lemmit Incluir Dep.:', { atual: config.lemmit_inclusao_dependente, novo: novoValor });

    setUpdating(true);
    try {
      await updateConfig({ lemmit_inclusao_dependente: novoValor });
      console.log('Config atualizada com sucesso');
    } catch (error) {
      console.error('Error updating config:', error);
      alert('Erro ao atualizar configuração');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditSituacoes = () => {
    if (config) {
      setTempSituacoes(config.situacoes_que_barram.join(', '));
      setEditingSituacoes(true);
    }
  };

  const handleSaveSituacoes = async () => {
    if (!config) return;

    const valores = tempSituacoes
      .split(',')
      .map(v => parseInt(v.trim()))
      .filter(v => !isNaN(v));

    setUpdating(true);
    try {
      await updateConfig({ situacoes_que_barram: valores });
      setEditingSituacoes(false);
    } catch (error) {
      console.error('Error updating situacoes:', error);
      alert('Erro ao atualizar situações');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditPlanos = () => {
    if (config) {
      setTempPlanos(config.planos_validos.join(', '));
      setEditingPlanos(true);
    }
  };

  const handleSavePlanos = async () => {
    if (!config) return;

    const valores = tempPlanos
      .split(',')
      .map(v => parseInt(v.trim()))
      .filter(v => !isNaN(v));

    setUpdating(true);
    try {
      await updateConfig({ planos_validos: valores });
      setEditingPlanos(false);
    } catch (error) {
      console.error('Error updating planos:', error);
      alert('Erro ao atualizar planos');
    } finally {
      setUpdating(false);
    }
  };

  const handleEditPlanosOcultos = () => {
    if (config) {
      setTempPlanosOcultos(config.planos_ocultos?.join(', ') || '');
      setEditingPlanosOcultos(true);
    }
  };

  const handleSavePlanosOcultos = async () => {
    if (!config) return;

    const valores = tempPlanosOcultos
      .split(',')
      .map(v => v.trim())
      .filter(v => v !== '');

    setUpdating(true);
    try {
      await updateConfig({ planos_ocultos: valores });
      setEditingPlanosOcultos(false);
    } catch (error) {
      console.error('Error updating planos ocultos:', error);
      alert('Erro ao atualizar planos ocultos');
    } finally {
      setUpdating(false);
    }
  };

  if (hookLoading && !config) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              Consulta Lemmit
            </h3>
            <p className="text-xs text-slate-600">
              Quando ativo, o sistema consulta a API Lemmit após verificar que o CPF não existe no ERP.
              Quando desativado, pula direto para a adição de usuários.
            </p>
          </div>

          <button
            onClick={handleToggleLemmit}
            disabled={updating || !config}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              config?.ativar_lemmit ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config?.ativar_lemmit ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Status atual: <span className="font-medium text-slate-700">
                {config.ativar_lemmit ? 'Ativado' : 'Desativado'}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              Exigir Envio de Arquivo
            </h3>
            <p className="text-xs text-slate-600">
              Quando ativo, o sistema exige o upload de um documento durante o cadastro no ERP.
              O arquivo será enviado automaticamente após a criação do cadastro.
            </p>
          </div>

          <button
            onClick={handleToggleExigirArquivo}
            disabled={updating || !config}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              config?.exigir_arquivo ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config?.exigir_arquivo ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Status atual: <span className="font-medium text-slate-700">
                {config.exigir_arquivo ? 'Ativado' : 'Desativado'}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              Lemmit no Dependente
            </h3>
            <p className="text-xs text-slate-600">
              Quando ativo, ao adicionar um dependente no fluxo de Novo Cadastro e preencher o CPF, o sistema consultará
              automaticamente a API Lemmit e preencherá os campos do dependente com os dados retornados.
            </p>
          </div>

          <button
            onClick={handleToggleLemmitDependente}
            disabled={updating || !config}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              config?.lemmit_dependente ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config?.lemmit_dependente ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Status atual: <span className="font-medium text-slate-700">
                {config.lemmit_dependente ? 'Ativado' : 'Desativado'}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-800 mb-1">
              Lemmit Incluir Dep.
            </h3>
            <p className="text-xs text-slate-600">
              Quando ativo, ao digitar CPF válido no fluxo de Inclusão de Dependente, o sistema consultará automaticamente
              a API Lemmit e preencherá os campos com os dados retornados. Respeita regras de consumo e permite continuar manualmente se desejar.
            </p>
          </div>

          <button
            onClick={handleToggleLemmitInclusaoDependente}
            disabled={updating || !config}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              config?.lemmit_inclusao_dependente ? 'bg-emerald-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config?.lemmit_inclusao_dependente ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {config && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">
              Status atual: <span className="font-medium text-slate-700">
                {config.lemmit_inclusao_dependente ? 'Ativado' : 'Desativado'}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">
            Situações que Barram Cadastro
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            Códigos de situação que impedem o recadastro de um associado existente no ERP.
          </p>

          {editingSituacoes ? (
            <div className="space-y-2">
              <input
                type="text"
                value={tempSituacoes}
                onChange={(e) => setTempSituacoes(e.target.value)}
                placeholder="Ex: 1, 4, 6"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveSituacoes}
                  disabled={updating}
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingSituacoes(false)}
                  disabled={updating}
                  className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                {config?.situacoes_que_barram?.join(', ') || 'Não configurado'}
              </p>
              <button
                onClick={handleEditSituacoes}
                className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">
            Planos Válidos
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            Códigos de planos permitidos para recadastro. Se o associado tiver um plano diferente destes, será bloqueado.
          </p>

          {editingPlanos ? (
            <div className="space-y-2">
              <input
                type="text"
                value={tempPlanos}
                onChange={(e) => setTempPlanos(e.target.value)}
                placeholder="Ex: 4, 11, 3, 26"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSavePlanos}
                  disabled={updating}
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingPlanos(false)}
                  disabled={updating}
                  className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                {config?.planos_validos?.join(', ') || 'Não configurado'}
              </p>
              <button
                onClick={handleEditPlanos}
                className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-1">
            Planos Ocultos na Seleção de Dependentes
          </h3>
          <p className="text-xs text-slate-600 mb-3">
            Códigos de planos que não devem aparecer no dropdown de seleção de planos dos dependentes.
          </p>

          {editingPlanosOcultos ? (
            <div className="space-y-2">
              <input
                type="text"
                value={tempPlanosOcultos}
                onChange={(e) => setTempPlanosOcultos(e.target.value)}
                placeholder="Ex: 110, 200, 300"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSavePlanosOcultos}
                  disabled={updating}
                  className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  Salvar
                </button>
                <button
                  onClick={() => setEditingPlanosOcultos(false)}
                  disabled={updating}
                  className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700">
                {config?.planos_ocultos && config.planos_ocultos.length > 0
                  ? config.planos_ocultos.join(', ')
                  : 'Nenhum plano oculto'}
              </p>
              <button
                onClick={handleEditPlanosOcultos}
                className="px-3 py-1.5 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
              >
                Editar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
