import baileys from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const {
    makeInMemoryStore,
    makeCacheableSignalKeyStore,
    useMultiFileAuthState,
    proto,
} = baileys;

// 📦 Cria um diretório, se não existir
export const createFolderIfNotExists = (folderPath) => {
    if (!existsSync(folderPath)) {
        mkdirSync(folderPath, { recursive: true });
    }
};

// 📄 Cria o armazenamento na memória com persistência opcional
export const createStore = (folderPath = './store') => {
    createFolderIfNotExists(folderPath);
    const logger = pino({ level: 'silent' });

    const store = makeInMemoryStore({ logger });
    const filePath = join(folderPath, 'store.json');

    // Carrega dados anteriores, se existirem
    store.readFromFile(filePath);

    // Salva dados periodicamente (a cada 10 segundos)
    setInterval(() => {
        store.writeToFile(filePath);
    }, 10_000);

    return store;
};

// 🔐 Cria armazenamento de chaves Signal
export const createSignalKeyStore = (state) => {
    return makeCacheableSignalKeyStore(state.keys.signal);
};

export {
    makeInMemoryStore,
    makeCacheableSignalKeyStore,
    proto,
    Boom,
};
