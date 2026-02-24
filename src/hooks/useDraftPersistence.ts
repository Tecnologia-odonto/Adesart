/**
 * Hook for automatic draft persistence with browser event listeners
 *
 * Automatically saves draft on:
 * - pagehide event (mobile app going to background)
 * - visibilitychange event (tab hidden)
 * - beforeunload event (page refresh/close)
 * - Manual trigger before file input opens
 */

import { useEffect, useCallback } from 'react';
import { useDraftStore, ModalDraft } from '../state/draftStore';
import { ModalName } from '../utils/draftKey';

export function useDraftPersistence(
  userId: string | undefined,
  modalName: ModalName,
  getDraftData: () => Partial<ModalDraft>,
  cadastroId?: string,
  enabled: boolean = true
) {
  const { upsertDraft, clearDraft } = useDraftStore();

  /**
   * Save draft to store
   */
  const saveDraft = useCallback(() => {
    if (!userId || !enabled) return;

    try {
      const data = getDraftData();
      upsertDraft(userId, modalName, data, cadastroId);
      console.log(`✅ Draft saved for ${modalName}`, { userId, cadastroId });
    } catch (err) {
      console.error('Error saving draft:', err);
    }
  }, [userId, modalName, cadastroId, enabled, getDraftData, upsertDraft]);

  /**
   * Clear draft from store
   */
  const clear = useCallback(() => {
    if (!userId) return;

    try {
      clearDraft(userId, modalName, cadastroId);
      console.log(`🗑️ Draft cleared for ${modalName}`, { userId, cadastroId });
    } catch (err) {
      console.error('Error clearing draft:', err);
    }
  }, [userId, modalName, cadastroId, clearDraft]);

  /**
   * Setup event listeners
   */
  useEffect(() => {
    if (!enabled || !userId) return;

    // Handler for visibility change (tab hidden)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        saveDraft();
      }
    };

    // Handler for page hide (mobile going to background)
    const handlePageHide = () => {
      saveDraft();
    };

    // Handler for before unload (page close/refresh)
    const handleBeforeUnload = () => {
      saveDraft();
    };

    // Register listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);

    console.log(`📡 Draft persistence listeners registered for ${modalName}`);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      console.log(`🔌 Draft persistence listeners cleaned up for ${modalName}`);
    };
  }, [enabled, userId, modalName, saveDraft]);

  return {
    saveDraft,
    clearDraft: clear,
  };
}

/**
 * Hook to save draft before opening file picker
 * Returns a function to be called onPointerDown/onClick of file input button
 */
export function useSaveBeforeFilePicker(
  saveDraftFn: () => void
) {
  return useCallback((e: React.PointerEvent | React.MouseEvent) => {
    console.log('💾 Saving draft before file picker opens...');
    saveDraftFn();
    // Don't prevent default - let file picker open
  }, [saveDraftFn]);
}
