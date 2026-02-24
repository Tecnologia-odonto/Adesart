import { UploadedFile } from './uploadFile';

export interface DraftData {
  timestamp: number;
  formData?: any;
  arquivo?: UploadedFile | null;
  dependentes?: any[];
  selectedEmpresa?: any;
  [key: string]: any;
}

const DRAFT_PREFIX = 'draft_';
const DRAFT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getDraftKey(modalName: string, userId?: string): string {
  return `${DRAFT_PREFIX}${modalName}${userId ? `_${userId}` : ''}`;
}

export function saveDraft(modalName: string, data: Omit<DraftData, 'timestamp'>, userId?: string): void {
  try {
    const draftData: DraftData = {
      ...data,
      timestamp: Date.now()
    };

    const key = getDraftKey(modalName, userId);
    localStorage.setItem(key, JSON.stringify(draftData));
    console.log(`Draft saved for ${modalName}`, { hasArquivo: !!data.arquivo?.path });
  } catch (error) {
    console.warn('Failed to save draft:', error);
  }
}

export function loadDraft(modalName: string, userId?: string): DraftData | null {
  try {
    const key = getDraftKey(modalName, userId);
    const stored = localStorage.getItem(key);

    if (!stored) {
      return null;
    }

    const draft: DraftData = JSON.parse(stored);

    if (Date.now() - draft.timestamp > DRAFT_EXPIRY_MS) {
      console.log(`Draft expired for ${modalName}, removing...`);
      clearDraft(modalName, userId);
      return null;
    }

    console.log(`Draft loaded for ${modalName}`, {
      age: Math.round((Date.now() - draft.timestamp) / 1000 / 60),
      hasArquivo: !!draft.arquivo?.path
    });

    return draft;
  } catch (error) {
    console.warn('Failed to load draft:', error);
    return null;
  }
}

export function clearDraft(modalName: string, userId?: string): void {
  try {
    const key = getDraftKey(modalName, userId);
    localStorage.removeItem(key);
    console.log(`Draft cleared for ${modalName}`);
  } catch (error) {
    console.warn('Failed to clear draft:', error);
  }
}

export function clearAllDrafts(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(DRAFT_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
    console.log('All drafts cleared');
  } catch (error) {
    console.warn('Failed to clear all drafts:', error);
  }
}

export function setupAutosave(
  modalName: string,
  getData: () => Omit<DraftData, 'timestamp'>,
  userId?: string
): () => void {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      const data = getData();
      if (data && Object.keys(data).length > 0) {
        saveDraft(modalName, data, userId);
      }
    }
  };

  const handlePageHide = () => {
    const data = getData();
    if (data && Object.keys(data).length > 0) {
      saveDraft(modalName, data, userId);
    }
  };

  const handleBeforeUnload = () => {
    const data = getData();
    if (data && Object.keys(data).length > 0) {
      saveDraft(modalName, data, userId);
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', handlePageHide);
  window.addEventListener('beforeunload', handleBeforeUnload);

  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('pagehide', handlePageHide);
    window.removeEventListener('beforeunload', handleBeforeUnload);
  };
}
