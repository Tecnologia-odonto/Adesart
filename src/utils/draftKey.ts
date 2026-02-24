/**
 * Utility functions to generate standardized draft keys
 * for localStorage persistence
 */

export type ModalName = 'cadastro-modal' | 'inclusao-dependente-modal' | 'continuar-inclusao-dependente-modal';

/**
 * Generate a standardized draft key
 * @param userId - User ID
 * @param modalName - Modal identifier
 * @param cadastroId - Optional cadastro ID for continuations
 */
export function generateDraftKey(
  userId: string,
  modalName: ModalName,
  cadastroId?: string
): string {
  if (cadastroId) {
    return `draft:${userId}:${modalName}:${cadastroId}`;
  }
  return `draft:${userId}:${modalName}`;
}

/**
 * Parse a draft key to extract components
 */
export function parseDraftKey(key: string): {
  userId: string;
  modalName: ModalName;
  cadastroId?: string;
} | null {
  const parts = key.split(':');

  if (parts[0] !== 'draft' || parts.length < 3) {
    return null;
  }

  return {
    userId: parts[1],
    modalName: parts[2] as ModalName,
    cadastroId: parts[3] || undefined
  };
}

/**
 * List all draft keys for a user
 */
export function getUserDraftKeys(userId: string): string[] {
  const keys: string[] = [];
  const prefix = `draft:${userId}:`;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keys.push(key);
    }
  }

  return keys;
}

/**
 * Clear all drafts for a user
 */
export function clearUserDrafts(userId: string): void {
  const keys = getUserDraftKeys(userId);
  keys.forEach(key => localStorage.removeItem(key));
}

/**
 * Clear old drafts (older than 7 days)
 */
export function clearOldDrafts(daysOld: number = 7): void {
  const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith('draft:')) {
      try {
        const value = localStorage.getItem(key);
        if (value) {
          const data = JSON.parse(value);
          if (data.timestamp && data.timestamp < cutoffTime) {
            localStorage.removeItem(key);
          }
        }
      } catch (err) {
        console.error('Error parsing draft key:', key, err);
      }
    }
  }
}
