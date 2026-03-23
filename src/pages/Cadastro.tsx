import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { NovoCadastroCard } from '../components/cadastro/NovoCadastroCard';
import { CadastrosIncompletosList } from '../components/cadastro/CadastrosIncompletosList';
import { CadastrosCompletosList } from '../components/cadastro/CadastrosCompletosList';
import { CadastroModal } from '../components/cadastro/CadastroModal';
import { InclusaoDependenteModal } from '../components/cadastro/InclusaoDependenteModal';
import { ContinuarInclusaoDependenteModal } from '../components/cadastro/ContinuarInclusaoDependenteModal';
import { LinkCadastroCard } from '../components/cadastro/LinkCadastroCard';
import { LinksGeradosList } from '../components/cadastro/LinksGeradosList';
import { useCadastros, Cadastro as CadastroType } from '../hooks/useCadastros';
import { Plus, FileText, Loader2, CheckCircle, UserPlus, Link as LinkIcon } from 'lucide-react';

export function Cadastro() {
  console.log('[Cadastro] 🔄 Componente renderizado');

  const { cadastros, stats, loading, loadCadastros, loadStats, refresh } = useCadastros();
  const [activeTab, setActiveTab] = useState<'novo' | 'link' | 'dependente' | 'incompletos' | 'completos'>('novo');
  const [selectedCadastro, setSelectedCadastro] = useState<CadastroType | null>(null);
  const [showInclusaoDependente, setShowInclusaoDependente] = useState(false);
  const [linkListReloadKey, setLinkListReloadKey] = useState(0);

  console.log('[Cadastro] 📊 Stats:', stats);
  console.log('[Cadastro] 📋 Cadastros length:', cadastros.length);
  console.log('[Cadastro] ⏳ Loading:', loading);

  // Carrega stats apenas quando abrir as abas que precisam dos badges
  useEffect(() => {
    console.log('[Cadastro] 🔄 useEffect loadStats iniciado');
    loadStats();
  }, []);

  const handleNewCadastroSuccess = async (cadastro: CadastroType, isBlocked: boolean = false) => {
    await refresh();

    if (!isBlocked) {
      setSelectedCadastro(cadastro);
    } else {
      setActiveTab('incompletos');
    }
  };

  const handleTabChange = async (tab: 'novo' | 'link' | 'dependente' | 'incompletos' | 'completos') => {
    console.log('[Cadastro] 🔄 handleTabChange para tab:', tab);
    console.log('[Cadastro] 📋 Cadastros length atual:', cadastros.length);

    setActiveTab(tab);

    // Carrega cadastros apenas quando abrir abas que precisam deles
    if ((tab === 'incompletos' || tab === 'completos') && cadastros.length === 0) {
      console.log('[Cadastro] 📥 Chamando loadCadastros...');
      await loadCadastros();
    } else {
      console.log('[Cadastro] ⏭️ Pulando loadCadastros');
    }
  };

  const handleSelectCadastro = (cadastro: CadastroType) => {
    setSelectedCadastro(cadastro);
  };

  const handleCloseModal = () => {
    setSelectedCadastro(null);
    setActiveTab('incompletos');
  };

  const handleModalSuccess = () => {
    refresh();
    setSelectedCadastro(null);
  };

  return (
    <Layout>
      <div className="space-y-3 sm:space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">Cadastro</h1>
          <p className="text-slate-600 mt-1 text-xs sm:text-sm">
            Consulte CPF e gerencie cadastros
          </p>
        </div>

        <div className="flex border-b border-slate-200 -mx-3 sm:mx-0 px-3 sm:px-0 overflow-x-auto">
          <button
            onClick={() => handleTabChange('novo')}
            className={`flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-4 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'novo'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-2" />
            <span className="hidden xs:inline">Nova Adesão</span>
            <span className="xs:hidden">Nova Adesão</span>
          </button>
          <button
            onClick={() => handleTabChange('link')}
            className={`flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-4 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'link'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-2" />
            <span>Link</span>
          </button>
          <button
            onClick={() => {
              handleTabChange('dependente');
              setShowInclusaoDependente(true);
            }}
            className={`flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-4 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'dependente'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-2" />
            <span className="hidden xs:inline">Incluir Dep.</span>
            <span className="xs:hidden">Incluir Dep.</span>
          </button>
          <button
            onClick={() => handleTabChange('incompletos')}
            className={`flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-4 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'incompletos'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-2" />
            <span className="hidden sm:inline">Adesões Pendentes</span>
            <span className="sm:hidden">Pendentes</span>
            {(stats.cadastro_incompletos + stats.inclusao_incompletos) > 0 && (
              <span className="ml-2 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full">
                {stats.cadastro_incompletos + stats.inclusao_incompletos}
              </span>
            )}
          </button>
          <button
            onClick={() => handleTabChange('completos')}
            className={`flex-1 sm:flex-none flex items-center justify-center px-4 sm:px-4 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors relative whitespace-nowrap ${
              activeTab === 'completos'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 sm:mr-2" />
            <span className="hidden xs:inline">Cadastradas</span>
            <span className="xs:hidden">Cadastradas</span>
            {(stats.cadastro_enviados + stats.inclusao_enviados) > 0 && (
              <span className="ml-2 sm:ml-2 px-1.5 sm:px-2 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                {stats.cadastro_enviados + stats.inclusao_enviados}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 sm:py-12">
            <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600 animate-spin" />
          </div>
        ) : (
          <div className="pb-4 sm:pb-8">
            {activeTab === 'novo' && (
              <div className="max-w-2xl">
                <NovoCadastroCard onSuccess={handleNewCadastroSuccess} />
              </div>
            )}
            {activeTab === 'link' && (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] gap-6 items-start">
                <LinkCadastroCard onGenerated={() => setLinkListReloadKey((prev) => prev + 1)} />
                <div className="min-w-0">
                  <LinksGeradosList reloadKey={linkListReloadKey} />
                </div>
              </div>
            )}
            {activeTab === 'dependente' && (
              <div className="max-w-2xl">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">
                    Inclusão de Dependente
                  </h3>
                  <p className="text-sm text-blue-700 mb-4">
                    Clique no botão para buscar um responsável financeiro e adicionar novos dependentes.
                  </p>
                  <button
                    onClick={() => setShowInclusaoDependente(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                  >
                    <UserPlus className="w-4 h-4" />
                    Iniciar Inclusão
                  </button>
                </div>
              </div>
            )}
            {activeTab === 'incompletos' && (
              <CadastrosIncompletosList
                cadastros={cadastros}
                onSelect={handleSelectCadastro}
                onRefresh={refresh}
              />
            )}
            {activeTab === 'completos' && (
              <CadastrosCompletosList cadastros={cadastros} />
            )}
          </div>
        )}

        {selectedCadastro && selectedCadastro.tipo_cadastro === 'inclusao_dependente' && (
          <ContinuarInclusaoDependenteModal
            cadastro={selectedCadastro}
            onClose={handleCloseModal}
            onSuccess={handleModalSuccess}
          />
        )}

        {selectedCadastro && selectedCadastro.tipo_cadastro !== 'inclusao_dependente' && (
          <CadastroModal
            cadastro={selectedCadastro}
            onClose={handleCloseModal}
            onSuccess={handleModalSuccess}
          />
        )}

        {showInclusaoDependente && (
          <InclusaoDependenteModal
            onClose={() => {
              setShowInclusaoDependente(false);
              setActiveTab('novo');
            }}
            onSuccess={() => {
              refresh();
              setShowInclusaoDependente(false);
              setActiveTab('novo');
            }}
          />
        )}
      </div>
    </Layout>
  );
}
