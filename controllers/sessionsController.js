import { 
    isSessionExists, 
    createSession, 
    getSession, 
    deleteSession 
} from './../whatsapp.js';

import response from './../response.js';
import fs from 'fs';
import path from 'path';


// 🛠️ Função auxiliar para determinar o estado da sessão
const getSessionState = (session) => {
    const states = ['connecting', 'connected', 'disconnecting', 'disconnected'];

    if (!session || !session.ws) {
        return 'disconnected';
    }

    let state = states[session.ws.readyState] || 'disconnected';

    const isAuthenticated = state === 'connected' &&
        typeof (session.isLegacy ? session.state.legacy.user : session.user) !== 'undefined';

    return isAuthenticated ? 'authenticated' : state;
};


// ✅ Verifica se sessão existe
const find = (req, res) => {
    return response(res, 200, true, 'Session found.');
};


// ✅ Verifica e retorna status da sessão
const status = (req, res) => {
    const sessionId = res.locals.sessionId;
    const session = getSession(sessionId);

    if (!session) {
        return response(res, 404, false, 'Session not found.', { valid_session: false });
    }

    const state = getSessionState(session);
    const credsPath = path.join('sessions', `md_${sessionId}`, 'creds.json');

    if (fs.existsSync(credsPath)) {
        try {
            const rawData = fs.readFileSync(credsPath);
            const userData = JSON.parse(rawData);

            return response(res, 200, true, '', {
                status: state,
                valid_session: true,
                userinfo: userData.me
            });
        } catch (err) {
            console.error('Error reading creds.json:', err);
            return response(res, 500, false, 'Error reading session data.');
        }
    } else {
        return response(res, 403, true, 'Session not authenticated.', {
            status: state,
            valid_session: false
        });
    }
};


// ✅ Cria nova sessão
const add = (req, res) => {
    const { id, isLegacy } = req.body;

    if (!id) {
        return response(res, 400, false, 'Session ID is required.');
    }

    if (isSessionExists(id)) {
        return response(res, 409, false, 'Session already exists, please use another ID.');
    }

    createSession(id, isLegacy === 'true', res);
};


// ✅ Deleta sessão
const del = async (req, res) => {
    const { id } = req.params;
    const session = getSession(id);

    if (!session) {
        return response(res, 404, false, 'Session not found.');
    }

    try {
        await session.logout();
    } catch (err) {
        console.warn('Error during logout:', err.message);
    } finally {
        deleteSession(id, session.isLegacy);
    }

    return response(res, 200, true, 'The session has been successfully deleted.');
};


// 🚀 Exporta handlers
export { find, status, add, del };
