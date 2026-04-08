import { Settings } from 'lucide-react';
import { Layout } from '../components/Layout';
import { GeralConfigCard } from '../components/config/GeralConfigCard';
import { PlanosMapTable } from '../components/config/PlanosMapTable';
import { ParentescoMapTable } from '../components/config/ParentescoMapTable';
import { ApiLogsTable } from '../components/config/ApiLogsTable';
import { StatusAdesoesTable } from '../components/config/StatusAdesoesTable';
import { useAuth } from '../contexts/AuthContext';
import { usePersistentState } from '../hooks/usePersistentState';

export function ConfiguracoesCadastro() {
  const { profile } = useAuth();
  const { value: activeTab, setValue: setActiveTab } = usePersistentState<'geral' | 'planos' | 'parentesco' | 'status' | 'logs'>(
    profile?.id ? `ui:configuracoes-cadastro:${profile.id}:active-tab` : null,
    'geral'
  );

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6">
        <div>
          <div className="flex items-center gap-2 sm:gap-3 mb-2">
            <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-emerald-600" />
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-800">Configurações</h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-600">
            Gerencie as tabelas de correspondência para planos e parentesco
          </p>
        </div>

        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="border-b border-slate-200">
            <div className="flex overflow-x-auto">
              <button
                onClick={() => setActiveTab('geral')}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'geral'
                    ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                Geral
              </button>
              <button
                onClick={() => setActiveTab('planos')}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'planos'
                    ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                Planos
              </button>
              <button
                onClick={() => setActiveTab('parentesco')}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'parentesco'
                    ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                Parentesco
              </button>
              <button
                onClick={() => setActiveTab('status')}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'status'
                    ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                Status Adesões
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap ${
                  activeTab === 'logs'
                    ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-slate-50 active:bg-slate-100'
                }`}
              >
                Logs de API
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-4 md:p-6">
            {activeTab === 'geral' && <GeralConfigCard />}
            {activeTab === 'planos' && <PlanosMapTable />}
            {activeTab === 'parentesco' && <ParentescoMapTable />}
            {activeTab === 'status' && <StatusAdesoesTable />}
            {activeTab === 'logs' && <ApiLogsTable />}
          </div>
        </div>
      </div>
    </Layout>
  );
}
