import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

/**
 * Creates a directory if it doesn't exist
 * @param {string} folderPath
 */
function createFolderIfNotExists(folderPath) {
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }
}

/**
 * In-memory store with optional JSON persistence
 * @param {string} sessionId - unique identifier for the session
 * @param {object} [options]
 * @param {string} [options.baseDir='./sessions']
 * @param {number} [options.saveInterval=10000] - milliseconds between auto-saves
 * @returns {{chats:Object, messages:Object, contacts:Object, save:Function}}
 */
export function createStore(sessionId, options = {}) {
  const baseDir = options.baseDir || './sessions';
  const saveInterval = options.saveInterval ?? 10000;
  const dir = join(baseDir, sessionId);
  createFolderIfNotExists(dir);

  const filePath = join(dir, 'store.json');
  let data = { chats: {}, messages: {}, contacts: {} };

  // Load existing store if available
  if (existsSync(filePath)) {
    try {
      data = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch {
      // ignore parse errors, start fresh
    }
  }

  // Auto-save function
  function save() {
    try {
      writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
      console.error('Store save error:', e);
    }
  }

  // Periodic persistence
  setInterval(save, saveInterval);

  return {
    chats: data.chats,
    messages: data.messages,
    contacts: data.contacts,
    save
  };
}
