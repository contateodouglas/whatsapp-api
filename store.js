import pkg from '@whiskeysockets/baileys';
const { makeInMemoryStore } = pkg;

import { join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

/**
 * Cria a pasta se não existir
 */
function createFolderIfNotExists(folderPath) {
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true });
  }
}

/**
 * Cria e gerencia o store persistente por sessão
 */
export function createStore(sessionId, options = {}) {
  const baseDir = options.baseDir || './sessions';
  const dir = join(baseDir, sessionId);
  createFolderIfNotExists(dir);

  const filePath = join(dir, 'store.json');

  // Cria o store na memória
  const store = makeInMemoryStore({ logger: undefined });

  // Carrega os dados do arquivo se existir
  if (existsSync(filePath)) {
    try {
      const rawData = readFileSync(filePath, 'utf8');
      const jsonData = JSON.parse(rawData);
      store.fromJSON(jsonData);
    } catch (e) {
      console.error('❌ Failed to load store:', e);
    }
  }

  // Função para salvar no disco
  const save = () => {
    try {
      const json = JSON.stringify(store.toJSON(), null, 2);
      writeFileSync(filePath, json);
    } catch (e) {
      console.error('❌ Error saving store:', e);
    }
  };

  // Salva automaticamente a cada X milissegundos
  const saveInterval = options.saveInterval ?? 10000;
  setInterval(save, saveInterval);

  // Bind manual para usar como função
  store.writeToFile = save;
  store.readFromFile = () => {
    if (existsSync(filePath)) {
      try {
        const rawData = readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(rawData);
        store.fromJSON(jsonData);
      } catch (e) {
        console.error('❌ Error reading store:', e);
      }
    }
  };

  return store;
}
