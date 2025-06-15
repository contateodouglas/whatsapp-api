import { makeInMemoryStore } from '@whiskeysockets/baileys/lib/store/index.js';
import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

function createFolderIfNotExists(folderPath) {
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }
}

export function createStore(sessionId, options = {}) {
  const baseDir = options.baseDir || './sessions';
  const dir = join(baseDir, sessionId);
  createFolderIfNotExists(dir);

  const filePath = join(dir, 'store.json');

  const store = makeInMemoryStore({});

  if (existsSync(filePath)) {
    try {
      const rawData = readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(rawData);
      store.fromJSON(jsonData);
    } catch (e) {
      console.error('❌ Failed to load store:', e);
    }
  }

  const save = () => {
    try {
      const json = JSON.stringify(store.toJSON(), null, 2);
      writeFileSync(filePath, json);
    } catch (e) {
      console.error('❌ Error saving store:', e);
    }
  };

  const saveInterval = options.saveInterval ?? 10000;
  setInterval(save, saveInterval);

  store.writeToFile = save;

  return store;
}
