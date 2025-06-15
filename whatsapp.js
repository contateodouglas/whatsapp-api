import baileys from '@whiskeysockets/baileys';
import { createStore } from './store.js';
import { rmSync, readdirSync } from 'fs';
import { join } from 'path';
import pino from 'pino';
import { toDataURL } from 'qrcode';
import __dirname from './dirname.js';
import response from './response.js';
import axios from 'axios';
import express from 'express';

const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} = baileys;




const sessions = new Map();
const retries = new Map();

const app = express();
app.use(express.json());

// 📂 Diretório de sessões
const sessionsDir = (sessionId = '') => join(__dirname, 'sessions', sessionId);

// 🔍 Verifica se sessão existe
const isSessionExists = (sessionId) => sessions.has(sessionId);

// 🔄 Deve reconectar?
const shouldReconnect = (sessionId) => {
    const maxRetries = parseInt(process.env.MAX_RETRIES ?? 3);
    const attempts = retries.get(sessionId) ?? 0;

    if (attempts < maxRetries) {
        retries.set(sessionId, attempts + 1);
        console.log(`Reconnecting... Attempt ${attempts + 1} for session ${sessionId}`);
        return true;
    }
    return false;
};

// 🚀 Cria uma nova sessão
const createSession = async (sessionId, isLegacy = false, res = null) => {
    const sessionFile = `${isLegacy ? 'legacy_' : 'md_'}${sessionId}`;

const logger = pino({ level: 'silent' });

const store  = createStore(sessionId);


    const { state, saveCreds } = await useMultiFileAuthState(sessionsDir(sessionFile));
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger,
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
        patchMessageBeforeSending: (message) => {
            const requiresPatch = !!(
                message.buttonsMessage ||
                message.listMessage
            );
            if (requiresPatch) {
                message = {
                    viewOnceMessage: {
                        message: {
                            messageContextInfo: {
                                deviceListMetadataVersion: 2,
                                deviceListMetadata: {},
                            },
                            ...message,
                        },
                    },
                };
            }
            return message;
        },
    });


    sessions.set(sessionId, { ...sock, store, isLegacy });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (messages) => {
        const msg = messages.messages[0];
        if (!msg || msg.key.fromMe) return;

        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        if (!isGroup) {
            const receivedData = {
                remote_id: msg.key.remoteJid,
                sessionId,
                message_id: msg.key.id,
                message: msg.message
            };
            sentWebHook(sessionId, receivedData);
        }
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (connection === 'open') {
            retries.delete(sessionId);
            console.log(`Session ${sessionId} connected`);
        }

        if (connection === 'close') {
            if (statusCode === DisconnectReason.loggedOut || !shouldReconnect(sessionId)) {
                console.log(`Session ${sessionId} logged out or cannot reconnect`);
                if (res && !res.headersSent) {
                    response(res, 500, false, 'Unable to create session.');
                }
                return deleteSession(sessionId);
            }
            setTimeout(() => {
                createSession(sessionId, isLegacy, res);
            }, statusCode === DisconnectReason.restartRequired ? 0 : parseInt(process.env.RECONNECT_INTERVAL ?? 5000));
        }

        if (qr) {
            if (res && !res.headersSent) {
                try {
                    const qrCode = await toDataURL(qr);
                    response(res, 200, true, 'QR code received, please scan it.', { qr: qrCode });
                } catch (err) {
                    response(res, 500, false, 'Failed to generate QR code.');
                }
            }
        }
    });
};
// 🗑️ Deleta sessão
const deleteSession = (sessionId) => {
    const sessionFile = `md_${sessionId}`;
    const storeFile = `${sessionId}_store.json`;
    const options = { force: true, recursive: true };

    try {
        rmSync(sessionsDir(sessionFile), options);
        rmSync(sessionsDir(storeFile), options);
    } catch (e) {
        console.warn(`Error deleting session files for ${sessionId}`);
    }

    sessions.delete(sessionId);
    retries.delete(sessionId);
};

// 🗂️ Lista de chats
const getChatList = (sessionId, isGroup = false) => {
    const filter = isGroup ? '@g.us' : '@s.whatsapp.net';
    const session = sessions.get(sessionId);
    return session ? session.store.chats.filter(chat => chat.id.endsWith(filter)) : [];
};

// 🔍 Verifica se contato ou grupo existe
const isExists = async (session, jid, isGroup = false) => {
    try {
        if (isGroup) {
            const group = await session.groupMetadata(jid);
            return Boolean(group.id);
        }
        const [result] = await session.onWhatsApp(jid);
        return result?.exists ?? false;
    } catch {
        return false;
    }
};

// ✉️ Envia mensagem
const sendMessage = async (session, receiver, message, delayMs = 1000) => {
    try {
        await delay(parseInt(delayMs));
        return await session.sendMessage(receiver, message);
    } catch {
        return Promise.reject(null);
    }
};

// 🔢 Formata número de telefone
const formatPhone = (phone) => {
    const formatted = phone.replace(/\D/g, '');
    return formatted.endsWith('@s.whatsapp.net') ? formatted : `${formatted}@s.whatsapp.net`;
};

// 🔢 Formata ID de grupo
const formatGroup = (group) => {
    const formatted = group.replace(/[^\d-]/g, '');
    return formatted.endsWith('@g.us') ? formatted : `${formatted}@g.us`;
};

// 🚿 Cleanup antes de encerrar
const cleanup = () => {
    console.log('Running cleanup before exit.');
    sessions.forEach((session, sessionId) => {
        if (!session.isLegacy) {
            session.store.writeToFile(sessionsDir(`${sessionId}_store.json`));
        }
    });
};

// 🚀 Inicializa sessões existentes
const init = () => {
    try {
        const files = readdirSync(sessionsDir());
        files.forEach(file => {
            if (!file.startsWith('md_') && !file.startsWith('legacy_')) return;
            const filename = file.replace('.json', '');
            const isLegacy = filename.startsWith('legacy_');
            const sessionId = filename.replace(isLegacy ? 'legacy_' : 'md_', '');
            createSession(sessionId, isLegacy);
        });
    } catch (e) {
        console.warn('No existing sessions found.');
    }
};

// 🛜 Exemplo de webhook
const sentWebHook = async (sessionId, payload) => {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) return;
    try {
        await axios.post(webhookUrl, {
            sessionId,
            ...payload
        });
    } catch (err) {
        console.error('Error sending webhook:', err.message);
    }
};

// 🚀 Exports
const getSession = (sessionId) => {
    return sessions.get(sessionId) || null;
};

export {
    isSessionExists,
    createSession,
    getSession,
    deleteSession,
    getChatList,
    isExists,
    sendMessage,
    formatPhone,
    formatGroup,
    cleanup,
    init
};
