/**
 * Draft Storage V2 - Zustand-backed implementation
 *
 * Drop-in replacement for old draftStorage.ts but using Zustand store
 * Maintains same API for backward compatibility
 *
 * CRITICAL: Only stores file metadata (path, nome, size, mime).
 * NEVER stores base64 or file content.
 */

import { useDraftStore, ModalDraft, FileMetadata } from '../state/draftStore';
import { ModalName } from '../utils/draftKey';
import { UploadedFile } from './uploadFile';

export interface DraftData {
  timestamp: number;
  formData?: any;
  arquivo?: UploadedFile | FileMetadata | null;
  dependentes?: any[];
  selectedEmpresa?: any;
  responsavelSelecionado?: any;
  selectedVendedor?: string;
  selectedAdesionista?: string;
  step?: number;
  currentTab?: number;
  [key: string]: any;
}

const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Map modal names to ModalName type
 */
function normalizeModalName(modalName: string): ModalName {
  if (modalName === 'cadastro-modal') return 'cadastro-modal';
  if (modalName === 'inclusao-dependente-modal') return 'inclusao-dependente-modal';
  if (modalName === 'continuar-inclusao-dependente-modal') return 'continuar-inclusao-dependente-modal';
  return modalName as ModalName;
}

/**
 * Convert UploadedFile to FileMetadata (remove base64 if present)
 */
function sanitizeFile(arquivo: any): FileMetadata | null {
  if (!arquivo) return null;

  return {
    path: arquivo.path,
    nome: arquivo.nome,
    size: arquivo.size || 0,
    mime: arquivo.mime || arquivo.type || 'application/octet-stream'
  };
}

/**
 * Sanitize draft data to remove any base64
 */
function sanitizeDraftData(data: DraftData): DraftData {
  const sanitized = { ...data };

  // Remove base64 from arquivo
  if (sanitized.arquivo) {
    sanitized.arquivo = sanitizeFile(sanitized.arquivo);
  }

  // Remove base64 from dependentes
  if (sanitized.dependentes && Array.isArray(sanitized.dependentes)) {
    sanitized.dependentes = sanitized.dependentes.map(dep => {
      if (dep.arquivo) {
        return {
          ...dep,
          arquivo: sanitizeFile(dep.arquivo)
        };
      }
      return dep;
    });
  }

  return sanitized;
}

/**
 * Save draft (backward compatible API)
 */
export function saveDraft(modalName: string, data: Omit<DraftData, 'timestamp'>, userId?: string): void {
  try {
    if (!userId) {
      console.warn('No userId provided, draft not saved');
      return;
    }

    const sanitized = sanitizeDraftData({
      ...data,
      timestamp: Date.now()
    });

    const store = useDraftStore.getState();
    const normalizedName = normalizeModalName(modalName);

    store.upsertDraft(userId, normalizedName, sanitized as Partial<ModalDraft>);
  } catch (error) {
    console.warn('Failed to save draft:', error);
  }
}

/**
 * Load draft (backward compatible API)
 */
export function loadDraft(modalName: string, userId?: string, cadastroId?: string): DraftData | null {
  try {
    if (!userId) {
      return null;
    }

    const store = useDraftStore.getState();
    const normalizedName = normalizeModalName(modalName);

    const draft = store.loadDraft(userId, normalizedName, cadastroId);

    if (!draft) {
      return null;
    }

    // Check expiry
    if (Date.now() - draft.timestamp > DRAFT_EXPIRY_MS) {
      clearDraft(modalName, userId, cadastroId);
      return null;
    }

    return draft as unknown as DraftData;
  } catch (error) {
    console.warn('Failed to load draft:', error);
    return null;
  }
}

/**
 * Clear draft (backward compatible API)
 */
export function clearDraft(modalName: string, userId?: string, cadastroId?: string): void {
  try {
    if (!userId) {
      return;
    }

    const store = useDraftStore.getState();
    const normalizedName = normalizeModalName(modalName);

    store.clearDraft(userId, normalizedName, cadastroId);
  } catch (error) {
    console.warn('Failed to clear draft:', error);
  }
}

/**
 * Clear all drafts (backward compatible API)
 */
export function clearAllDrafts(userId?: string): void {
  try {
    if (!userId) {
      console.warn('No userId provided for clearAllDrafts');
      return;
    }

    const store = useDraftStore.getState();
    store.clearAllUserDrafts(userId);
  } catch (error) {
    console.warn('Failed to clear all drafts:', error);
  }
}

/**
 * Setup auto-save with enhanced listeners
 * Now includes pagehide and saves before file picker opens
 */
export function setupAutosave(
  modalName: string,
  getData: () => Omit<DraftData, 'timestamp'>,
  userId?: string,
  cadastroId?: string
): () => void {
  if (!userId) {
    console.warn('No userId provided for setupAutosave');
    return () => {};
  }

  const saveNow = () => {
    const data = getData();
    if (data && Object.keys(data).length > 0) {
      saveDraft(modalName, data, userId, cadastroId);
    }
  };

  // visibilitychange - when tab is hidden
  const handleVisibilityChange = () => {
    if (document.hidden) {
      saveNow();
    }
  };

  // pagehide - when page is being unloaded (critical for mobile!)
  const handlePageHide = (e: PageTransitionEvent) => {
    saveNow();
  };

  // beforeunload - when page is about to unload
  const handleBeforeUnload = () => {
    saveNow();
  };

  // Register all listeners
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}

/**
 * Helper to save draft before file picker opens
 * Call this onPointerDown or onClick of file input trigger
 */
export function saveBeforeFilePicker(
  modalName: string,
  getData: () => Omit<DraftData, 'timestamp'>,
  userId?: string,
  cadastroId?: string
): void {
  if (!userId) {
    console.warn('No userId provided for saveBeforeFilePicker');
    return;
  }

  const data = getData();
  if (data && Object.keys(data).length > 0) {
    saveDraft(modalName, data, userId, cadastroId);
  }
}
