/**
 * Draft Store using Zustand
 *
 * Persists modal drafts to localStorage to prevent data loss
 * when Android reloads the page (e.g., when opening camera/gallery)
 *
 * IMPORTANT: Only stores file metadata (path, nome, size, mime).
 * NEVER stores base64 or file content.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateDraftKey, ModalName } from '../utils/draftKey';

/**
 * File metadata (NO base64!)
 */
export interface FileMetadata {
  path: string;
  nome: string;
  size: number;
  mime: string;
}

/**
 * Dependente form data
 */
export interface DependenteFormData {
  id?: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  sexo: number;
  parentesco: number;
  plano: number;
  planoValor: string;
  nomeMae: string;
  arquivo?: FileMetadata | null;
  saved?: boolean;
  cpfValidationError?: string;
  uploadingFile?: boolean;
  consultingLemmit?: boolean;
}

/**
 * Empresa data
 */
export interface EmpresaData {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  codigo: string;
}

/**
 * NovoCadastroCard draft
 */
export interface NovoCadastroCardDraft {
  modalName: 'novo-cadastro-card';
  cpf: string;
  selectedEmpresa?: EmpresaData | null;
  selectedVendedor?: string;
  selectedAdesionista?: string;
  timestamp: number;
  lastSaved: number;
}

/**
 * CadastroModal draft
 */
export interface CadastroModalDraft {
  modalName: 'cadastro-modal';
  formData: {
    tipo_cadastro: 'ADESAO' | 'INCLUSAO_DEPENDENTE';
    cpf: string;
    nome: string;
    dataNascimento: string;
    sexo: number;
    email: string;
    telefone: string;
    celular: string;
    cep: string;
    endereco: string;
    numero: string;
    complemento: string;
    bairro: string;
    cidade: string;
    uf: string;
    nomeMae: string;
    plano: number;
    planoValor: string;
    empresaCNPJ: string;
    empresaNome: string;
    empresaCodigo: string;
    codigoTitular: string;
    cpfTitular: string;
    codigoContrato: string;
    matricula: string;
    vendedor_id?: string;
    vendedor_nome?: string;
    adesionista_id?: string;
    adesionista_nome?: string;
  };
  dependentes: DependenteFormData[];
  arquivo?: FileMetadata | null;
  selectedEmpresa?: EmpresaData | null;
  step: number;
  currentTab: number;
  timestamp: number;
  lastSaved: number;
}

/**
 * InclusaoDependenteModal draft
 */
export interface InclusaoDependenteModalDraft {
  modalName: 'inclusao-dependente-modal';
  responsavelSelecionado?: {
    codigo: string;
    nome: string;
    cpf: string;
    empresa: string;
    dependentes?: any[];
  } | null;
  dependentes: DependenteFormData[];
  selectedVendedor?: string;
  selectedAdesionista?: string;
  timestamp: number;
  lastSaved: number;
}

/**
 * ContinuarInclusaoDependenteModal draft
 */
export interface ContinuarInclusaoDependenteModalDraft {
  modalName: 'continuar-inclusao-dependente-modal';
  cadastroId: string;
  dependentes: DependenteFormData[];
  selectedVendedor?: string;
  selectedAdesionista?: string;
  timestamp: number;
  lastSaved: number;
}

/**
 * Union type for all draft types
 */
export type ModalDraft =
  | NovoCadastroCardDraft
  | CadastroModalDraft
  | InclusaoDependenteModalDraft
  | ContinuarInclusaoDependenteModalDraft;

/**
 * Draft Store State
 */
interface DraftStoreState {
  drafts: Record<string, ModalDraft>;
  upsertDraft: (userId: string, modalName: ModalName, data: Partial<ModalDraft>, cadastroId?: string) => void;
  loadDraft: (userId: string, modalName: ModalName, cadastroId?: string) => ModalDraft | null;
  clearDraft: (userId: string, modalName: ModalName, cadastroId?: string) => void;
  clearAllUserDrafts: (userId: string) => void;
}

/**
 * Create Draft Store with localStorage persistence
 */
export const useDraftStore = create<DraftStoreState>()(
  persist(
    (set, get) => ({
      drafts: {},

      /**
       * Insert or update a draft
       */
      upsertDraft: (userId, modalName, data, cadastroId) => {
        const key = generateDraftKey(userId, modalName, cadastroId);
        const now = Date.now();

        set((state) => {
          const existingDraft = state.drafts[key];

          const updatedDraft: ModalDraft = {
            ...existingDraft,
            ...data,
            modalName,
            timestamp: existingDraft?.timestamp || now,
            lastSaved: now,
          } as ModalDraft;

          return {
            drafts: {
              ...state.drafts,
              [key]: updatedDraft,
            },
          };
        });
      },

      /**
       * Load a draft
       */
      loadDraft: (userId, modalName, cadastroId) => {
        const key = generateDraftKey(userId, modalName, cadastroId);
        const draft = get().drafts[key];
        return draft || null;
      },

      /**
       * Clear a specific draft
       */
      clearDraft: (userId, modalName, cadastroId) => {
        const key = generateDraftKey(userId, modalName, cadastroId);

        set((state) => {
          const newDrafts = { ...state.drafts };
          delete newDrafts[key];
          return { drafts: newDrafts };
        });
      },

      /**
       * Clear all drafts for a user
       */
      clearAllUserDrafts: (userId) => {
        set((state) => {
          const newDrafts = { ...state.drafts };
          const prefix = `draft:${userId}:`;

          Object.keys(newDrafts).forEach((key) => {
            if (key.startsWith(prefix)) {
              delete newDrafts[key];
            }
          });

          return { drafts: newDrafts };
        });
      },
    }),
    {
      name: 'modal-drafts-storage',
      version: 1,
    }
  )
);

/**
 * Hook to automatically save draft on critical browser events
 */
export function useAutoSaveDraft(
  userId: string | undefined,
  modalName: ModalName,
  getDraftData: () => Partial<ModalDraft>,
  cadastroId?: string
) {
  const { upsertDraft } = useDraftStore();

  const saveDraft = () => {
    if (!userId) return;
    const data = getDraftData();
    upsertDraft(userId, modalName, data, cadastroId);
  };

  // Setup event listeners
  if (typeof window !== 'undefined') {
    // Save on pagehide (works on mobile when app goes to background)
    window.addEventListener('pagehide', saveDraft);

    // Save on visibilitychange (when page becomes hidden)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        saveDraft();
      }
    });

    // Cleanup
    return () => {
      window.removeEventListener('pagehide', saveDraft);
      document.removeEventListener('visibilitychange', saveDraft);
    };
  }

  return undefined;
}

/**
 * Utility to clean old drafts (older than 7 days)
 */
export function cleanOldDrafts(daysOld: number = 7) {
  const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
  const store = useDraftStore.getState();

  Object.entries(store.drafts).forEach(([key, draft]) => {
    if (draft.timestamp < cutoffTime) {
      const parts = key.split(':');
      if (parts.length >= 3) {
        store.clearDraft(parts[1], parts[2] as ModalName, parts[3]);
      }
    }
  });
}
