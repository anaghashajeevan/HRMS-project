// /**
//  * HRMS WhatsApp Gateway — v2 with QR API + Multi-Session Support
//  * Runs on http://localhost:3005
//  */

// const { 
//     default: makeWASocket, 
//     useMultiFileAuthState, 
//     DisconnectReason,
//     fetchLatestBaileysVersion,
// } = require('@whiskeysockets/baileys');
// const express = require('express');
// const pino = require('pino');
// const { Boom } = require('@hapi/boom');
// const path = require('path');
// const QRCode = require('qrcode');
// const fs = require('fs');

// // ============================================================================
// // EXPRESS SETUP
// // ============================================================================

// const app = express();
// app.use(express.json({ limit: '10mb' }));

// app.use((req, res, next) => {
//     res.header('Access-Control-Allow-Origin', '*');
//     res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
//     res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//     if (req.method === 'OPTIONS') return res.sendStatus(200);
//     next();
// });

// // ============================================================================
// // SESSION MANAGER (supports primary + fallback)
// // ============================================================================

// const sessions = {
//     primary: {
//         sock: null,
//         status: {
//             active: false,
//             connected: false,
//             phone: '',
//             state: 'idle',
//             qrDataUrl: null,
//             lastError: null,
//         },
//     },
//     fallback: {
//         sock: null,
//         status: {
//             active: false,
//             connected: false,
//             phone: '',
//             state: 'idle',
//             qrDataUrl: null,
//             lastError: null,
//         },
//     },
// };

// // Which session is currently the "active" one for sending
// let activeSessionKey = 'primary';

// // ============================================================================
// // START WHATSAPP FOR A SESSION
// // ============================================================================

// async function startSession(sessionKey) {
//     if (!sessions[sessionKey]) {
//         throw new Error(`Invalid session key: ${sessionKey}`);
//     }
    
//     const session = sessions[sessionKey];
//     const authFolder = path.join(__dirname, `auth_${sessionKey}`);
    
//     try {
//         console.log(`\n🔄 [${sessionKey}] Starting WhatsApp connection...`);
//         session.status.state = 'connecting';
//         session.status.lastError = null;
        
//         const { state, saveCreds } = await useMultiFileAuthState(authFolder);
//         const { version } = await fetchLatestBaileysVersion();
        
//         session.sock = makeWASocket({
//             version,
//             auth: state,
//             printQRInTerminal: false,
//             logger: pino({ level: 'silent' }),
//             browser: [`HRMS Gateway (${sessionKey})`, 'Chrome', '1.0.0'],
//         });
        
//         session.sock.ev.on('connection.update', async (update) => {
//             const { connection, lastDisconnect, qr } = update;
            
//             if (qr) {
//                 console.log(`\n📱 [${sessionKey}] QR code generated. Waiting for scan...`);
//                 // Convert QR to base64 data URL for frontend
//                 try {
//                     session.status.qrDataUrl = await QRCode.toDataURL(qr, {
//                         width: 300,
//                         margin: 2,
//                     });
//                     session.status.state = 'waiting_for_scan';
//                 } catch (err) {
//                     console.error('QR generation error:', err);
//                 }
//             }
            
//             if (connection === 'close') {
//                 const statusCode = 
//                     lastDisconnect?.error instanceof Boom
//                         ? lastDisconnect.error.output.statusCode
//                         : null;
                
//                 const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
//                 console.log(`\n❌ [${sessionKey}] Connection closed. Code: ${statusCode}`);
//                 session.status.connected = false;
//                 session.status.state = 'disconnected';
//                 session.status.qrDataUrl = null;
                
//                 if (statusCode === DisconnectReason.loggedOut) {
//                     console.log(`⛔ [${sessionKey}] Logged out. Auth cleared.`);
//                     session.status.state = 'logged_out';
//                     session.status.active = false;
//                     // Delete auth folder
//                     if (fs.existsSync(authFolder)) {
//                         fs.rmSync(authFolder, { recursive: true, force: true });
//                     }
                    
//                     // 🔥 AUTO-SWITCH TO FALLBACK
//                     handleSessionFailure(sessionKey);
//                 } else if (shouldReconnect && session.status.active) {
//                     console.log(`🔄 [${sessionKey}] Reconnecting in 3 seconds...`);
//                     setTimeout(() => startSession(sessionKey), 3000);
//                 }
//             }
            
//             if (connection === 'open') {
//                 console.log(`\n✅ [${sessionKey}] WhatsApp CONNECTED!`);
//                 console.log(`📞 Phone: ${session.sock.user?.id?.split(':')[0]}`);
                
//                 session.status.connected = true;
//                 session.status.active = true;
//                 session.status.phone = session.sock.user?.id?.split(':')[0] || '';
//                 session.status.state = 'ready';
//                 session.status.qrDataUrl = null;
//                 session.status.lastError = null;
                
//                 // If primary reconnects, switch back to primary
//                 if (sessionKey === 'primary') {
//                     activeSessionKey = 'primary';
//                     console.log('🎯 Switched active session to PRIMARY');
//                 }
//             }
//         });
        
//         session.sock.ev.on('creds.update', saveCreds);
        
//     } catch (error) {
//         console.error(`❌ [${sessionKey}] Failed to start:`, error.message);
//         session.status.state = 'error';
//         session.status.lastError = error.message;
//     }
// }

// // ============================================================================
// // FALLBACK HANDLER
// // ============================================================================

// function handleSessionFailure(failedSessionKey) {
//     if (failedSessionKey === 'primary') {
//         // Primary failed — try fallback
//         if (sessions.fallback.status.connected) {
//             activeSessionKey = 'fallback';
//             console.log('🔄 SWITCHED to FALLBACK session for sending');
//         } else {
//             console.log('⚠️ Primary failed but fallback not connected. Auto-starting fallback...');
//             startSession('fallback');
//             activeSessionKey = 'fallback';
//         }
//     }
// }

// // ============================================================================
// // STOP SESSION
// // ============================================================================

// async function stopSession(sessionKey) {
//     const session = sessions[sessionKey];
//     if (!session) return;
    
//     console.log(`\n🛑 [${sessionKey}] Stopping session...`);
    
//     session.status.active = false;
    
//     if (session.sock) {
//         try {
//             await session.sock.logout();
//         } catch (e) {
//             // Ignore logout errors
//         }
//         try {
//             session.sock.end();
//         } catch (e) {}
//         session.sock = null;
//     }
    
//     session.status.connected = false;
//     session.status.phone = '';
//     session.status.state = 'disconnected';
//     session.status.qrDataUrl = null;
    
//     // Delete auth folder
//     const authFolder = path.join(__dirname, `auth_${sessionKey}`);
//     if (fs.existsSync(authFolder)) {
//         fs.rmSync(authFolder, { recursive: true, force: true });
//     }
    
//     console.log(`✅ [${sessionKey}] Session stopped and cleaned.`);
// }

// // ============================================================================
// // HELPERS
// // ============================================================================

// function cleanPhoneNumber(phone) {
//     if (!phone) return '';
//     let cleaned = String(phone)
//         .replace('@c.us', '')
//         .replace('@s.whatsapp.net', '')
//         .replace(/\D/g, '');
//     if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
//     if (cleaned.length === 10) cleaned = '91' + cleaned;
//     return cleaned;
// }

// function getActiveSock() {
//     const activeSession = sessions[activeSessionKey];
//     if (activeSession && activeSession.status.connected && activeSession.sock) {
//         return { sock: activeSession.sock, sessionKey: activeSessionKey };
//     }
//     // Try the other session as backup
//     const otherKey = activeSessionKey === 'primary' ? 'fallback' : 'primary';
//     const otherSession = sessions[otherKey];
//     if (otherSession && otherSession.status.connected && otherSession.sock) {
//         return { sock: otherSession.sock, sessionKey: otherKey };
//     }
//     return null;
// }

// // ============================================================================
// // API ENDPOINTS
// // ============================================================================

// /**
//  * GET /api/status
//  * Overall gateway + all sessions status
//  */
// app.get('/api/status', (req, res) => {
//     res.json({
//         gateway_online: true,
//         active_session: activeSessionKey,
//         primary: sessions.primary.status,
//         fallback: sessions.fallback.status,
//         connected: sessions[activeSessionKey].status.connected,
//         phone: sessions[activeSessionKey].status.phone,
//         timestamp: new Date().toISOString(),
//     });
// });

// /**
//  * GET /api/session/:key/qr
//  * Get QR code for a specific session (primary or fallback)
//  */
// app.get('/api/session/:key/qr', (req, res) => {
//     const { key } = req.params;
//     if (!sessions[key]) {
//         return res.status(400).json({ error: 'Invalid session key' });
//     }
    
//     const session = sessions[key];
//     res.json({
//         session: key,
//         state: session.status.state,
//         connected: session.status.connected,
//         phone: session.status.phone,
//         qr: session.status.qrDataUrl,  // Base64 data URL
//         has_qr: !!session.status.qrDataUrl,
//     });
// });

// /**
//  * POST /api/session/:key/connect
//  * Start a session (primary or fallback)
//  */
// app.post('/api/session/:key/connect', async (req, res) => {
//     const { key } = req.params;
//     if (!sessions[key]) {
//         return res.status(400).json({ error: 'Invalid session key' });
//     }
    
//     const session = sessions[key];
    
//     if (session.status.connected) {
//         return res.json({
//             success: true,
//             message: `Session ${key} already connected to ${session.status.phone}`,
//             status: session.status,
//         });
//     }
    
//     session.status.active = true;
    
//     // Start (or restart)
//     if (session.sock) {
//         try { session.sock.end(); } catch (e) {}
//     }
    
//     startSession(key);
    
//     res.json({
//         success: true,
//         message: `Starting ${key} session. Fetch QR code to scan.`,
//         session: key,
//     });
// });

// /**
//  * POST /api/session/:key/disconnect
//  * Disconnect a session and delete auth
//  */
// app.post('/api/session/:key/disconnect', async (req, res) => {
//     const { key } = req.params;
//     if (!sessions[key]) {
//         return res.status(400).json({ error: 'Invalid session key' });
//     }
    
//     await stopSession(key);
    
//     // If we disconnected primary, try switching to fallback
//     if (key === 'primary' && sessions.fallback.status.connected) {
//         activeSessionKey = 'fallback';
//     }
    
//     res.json({
//         success: true,
//         message: `Session ${key} disconnected`,
//         active_session: activeSessionKey,
//     });
// });

// /**
//  * POST /api/session/switch
//  * Manually switch active session
//  * Body: { "session": "primary" | "fallback" }
//  */
// app.post('/api/session/switch', (req, res) => {
//     const { session: newSession } = req.body;
    
//     if (!sessions[newSession]) {
//         return res.status(400).json({ error: 'Invalid session key' });
//     }
    
//     if (!sessions[newSession].status.connected) {
//         return res.status(400).json({ 
//             error: `Cannot switch — ${newSession} not connected`,
//         });
//     }
    
//     activeSessionKey = newSession;
//     console.log(`🎯 Active session switched to: ${newSession}`);
    
//     res.json({
//         success: true,
//         active_session: activeSessionKey,
//         phone: sessions[activeSessionKey].status.phone,
//     });
// });

// /**
//  * POST /api/sendMessage
//  * Send WhatsApp message (uses active session)
//  */
// app.post(
//     ['/api/sendMessage', '/api/send-message', '/api/message/text', '/send'],
//     async (req, res) => {
//         try {
//             const activeInfo = getActiveSock();
            
//             if (!activeInfo) {
//                 return res.status(503).json({
//                     success: false,
//                     error: 'No connected WhatsApp session. Please connect primary or fallback.',
//                 });
//             }
            
//             const { sock, sessionKey } = activeInfo;
            
//             const phone = req.body.phone || req.body.chatId || req.body.number || req.body.to;
//             const message = req.body.message || req.body.text || req.body.body;
            
//             if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
//             if (!message) return res.status(400).json({ success: false, error: 'Message required' });
            
//             const cleanedPhone = cleanPhoneNumber(phone);
//             if (!cleanedPhone || cleanedPhone.length < 10) {
//                 return res.status(400).json({
//                     success: false,
//                     error: `Invalid phone: ${phone}`,
//                 });
//             }
            
//             const jid = `${cleanedPhone}@s.whatsapp.net`;
            
//             // Verify WhatsApp registration
//             const [result] = await sock.onWhatsApp(jid);
//             if (!result?.exists) {
//                 return res.status(400).json({
//                     success: false,
//                     error: `${cleanedPhone} not on WhatsApp`,
//                 });
//             }
            
//             const sent = await sock.sendMessage(jid, { text: message });
            
//             console.log(`✅ [${sessionKey}] Sent to ${cleanedPhone}`);
            
//             return res.json({
//                 success: true,
//                 messageId: sent.key.id,
//                 id: sent.key.id,
//                 to: cleanedPhone,
//                 sent_via: sessionKey,
//             });
            
//         } catch (error) {
//             console.error('❌ Send error:', error.message);
//             return res.status(500).json({ success: false, error: error.message });
//         }
//     }
// );

// // ============================================================================
// // START SERVER
// // ============================================================================

// const PORT = process.env.PORT || 3005;

// app.listen(PORT, () => {
//     console.log('\n' + '='.repeat(60));
//     console.log('🚀 HRMS WhatsApp Gateway (Multi-Session)');
//     console.log('='.repeat(60));
//     console.log(`📡 Server: http://localhost:${PORT}`);
//     console.log(`🌐 Status: http://localhost:${PORT}/api/status`);
//     console.log('='.repeat(60));
//     console.log('\n📌 Sessions available: primary, fallback');
//     console.log('📌 Use frontend to connect and scan QR\n');
    
//     // Auto-restore sessions if auth folders exist
//     ['primary', 'fallback'].forEach(key => {
//         const authFolder = path.join(__dirname, `auth_${key}`);
//         if (fs.existsSync(authFolder)) {
//             const files = fs.readdirSync(authFolder);
//             if (files.length > 0) {
//                 console.log(`🔄 Auto-restoring saved session: ${key}`);
//                 sessions[key].status.active = true;
//                 startSession(key);
//             }
//         }
//     });
// });

// process.on('SIGINT', async () => {
//     console.log('\n\n👋 Shutting down gateway...');
//     for (const key of ['primary', 'fallback']) {
//         if (sessions[key].sock) {
//             try { sessions[key].sock.end(); } catch (e) {}
//         }
//     }
//     process.exit(0);
// });



/**
 * HRMS WhatsApp Gateway — Single Session with QR API
 * Runs on http://localhost:3005
 */

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const path = require('path');
const QRCode = require('qrcode');
const fs = require('fs');

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ============================================================================
// WHATSAPP STATE
// ============================================================================

let sock = null;
let status = {
    active: false,
    connected: false,
    phone: '',
    state: 'idle',
    qrDataUrl: null,
    lastError: null,
};

// ============================================================================
// START WHATSAPP
// ============================================================================

async function startWhatsApp() {
    try {
        console.log('\n🔄 Starting WhatsApp connection...');
        status.state = 'connecting';
        status.lastError = null;
        
        const authFolder = path.join(__dirname, 'auth_info');
        const { state: authState, saveCreds } = await useMultiFileAuthState(authFolder);
        const { version } = await fetchLatestBaileysVersion();
        
        sock = makeWASocket({
            version,
            auth: authState,
            printQRInTerminal: false,
            logger: pino({ level: 'silent' }),
            browser: ['HRMS Gateway', 'Chrome', '1.0.0'],
        });
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                console.log('\n📱 QR code generated. Waiting for scan...');
                try {
                    status.qrDataUrl = await QRCode.toDataURL(qr, {
                        width: 300,
                        margin: 2,
                    });
                    status.state = 'waiting_for_scan';
                } catch (err) {
                    console.error('QR gen error:', err);
                }
            }
            
            if (connection === 'close') {
                const statusCode = 
                    lastDisconnect?.error instanceof Boom
                        ? lastDisconnect.error.output.statusCode
                        : null;
                
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                console.log(`\n❌ Connection closed. Code: ${statusCode}`);
                status.connected = false;
                status.state = 'disconnected';
                status.qrDataUrl = null;
                
                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('⛔ Logged out. Auth cleared.');
                    status.state = 'logged_out';
                    status.active = false;
                    if (fs.existsSync(authFolder)) {
                        fs.rmSync(authFolder, { recursive: true, force: true });
                    }
                } else if (shouldReconnect && status.active) {
                    console.log('🔄 Reconnecting in 3 seconds...');
                    setTimeout(startWhatsApp, 3000);
                }
            }
            
            if (connection === 'open') {
                console.log('\n✅ WhatsApp CONNECTED!');
                console.log(`📞 Phone: ${sock.user?.id?.split(':')[0]}`);
                
                status.connected = true;
                status.active = true;
                status.phone = sock.user?.id?.split(':')[0] || '';
                status.state = 'ready';
                status.qrDataUrl = null;
                status.lastError = null;
            }
        });
        
        sock.ev.on('creds.update', saveCreds);
        
    } catch (error) {
        console.error('❌ Failed:', error.message);
        status.state = 'error';
        status.lastError = error.message;
    }
}

// ============================================================================
// STOP WHATSAPP
// ============================================================================

async function stopWhatsApp() {
    console.log('\n🛑 Stopping WhatsApp...');
    status.active = false;
    
    if (sock) {
        try { await sock.logout(); } catch (e) {}
        try { sock.end(); } catch (e) {}
        sock = null;
    }
    
    status.connected = false;
    status.phone = '';
    status.state = 'disconnected';
    status.qrDataUrl = null;
    
    const authFolder = path.join(__dirname, 'auth_info');
    if (fs.existsSync(authFolder)) {
        fs.rmSync(authFolder, { recursive: true, force: true });
    }
    
    console.log('✅ Stopped and cleaned.');
}

// ============================================================================
// HELPERS
// ============================================================================

function cleanPhoneNumber(phone) {
    if (!phone) return '';
    let cleaned = String(phone)
        .replace('@c.us', '')
        .replace('@s.whatsapp.net', '')
        .replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (cleaned.length === 10) cleaned = '91' + cleaned;
    return cleaned;
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

app.get('/api/status', (req, res) => {
    res.json({
        gateway_online: true,
        connected: status.connected,
        phone: status.phone,
        state: status.state,
        has_qr: !!status.qrDataUrl,
        last_error: status.lastError,
        timestamp: new Date().toISOString(),
    });
});

app.get('/api/qr', (req, res) => {
    res.json({
        state: status.state,
        connected: status.connected,
        phone: status.phone,
        qr: status.qrDataUrl,
        has_qr: !!status.qrDataUrl,
    });
});

app.post('/api/connect', async (req, res) => {
    if (status.connected) {
        return res.json({
            success: true,
            message: `Already connected to ${status.phone}`,
            status,
        });
    }
    
    status.active = true;
    
    if (sock) {
        try { sock.end(); } catch (e) {}
    }
    
    startWhatsApp();
    
    res.json({
        success: true,
        message: 'Starting connection. Fetch QR to scan.',
    });
});

app.post('/api/disconnect', async (req, res) => {
    await stopWhatsApp();
    res.json({ success: true, message: 'Disconnected' });
});

app.post(
    ['/api/sendMessage', '/api/send-message', '/api/message/text', '/send'],
    async (req, res) => {
        try {
            if (!status.connected || !sock) {
                return res.status(503).json({
                    success: false,
                    error: 'WhatsApp not connected',
                });
            }
            
            const phone = req.body.phone || req.body.chatId || req.body.number || req.body.to;
            const message = req.body.message || req.body.text || req.body.body;
            
            if (!phone) return res.status(400).json({ success: false, error: 'Phone required' });
            if (!message) return res.status(400).json({ success: false, error: 'Message required' });
            
            const cleanedPhone = cleanPhoneNumber(phone);
            if (!cleanedPhone || cleanedPhone.length < 10) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid phone: ${phone}`,
                });
            }
            
            const jid = `${cleanedPhone}@s.whatsapp.net`;
            
            const [result] = await sock.onWhatsApp(jid);
            if (!result?.exists) {
                return res.status(400).json({
                    success: false,
                    error: `${cleanedPhone} not on WhatsApp`,
                });
            }
            
            const sent = await sock.sendMessage(jid, { text: message });
            
            console.log(`✅ Sent to ${cleanedPhone}`);
            
            return res.json({
                success: true,
                messageId: sent.key.id,
                id: sent.key.id,
                to: cleanedPhone,
            });
            
        } catch (error) {
            console.error('❌ Send error:', error.message);
            return res.status(500).json({ success: false, error: error.message });
        }
    }
);

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.PORT || 3005;

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 HRMS WhatsApp Gateway');
    console.log('='.repeat(60));
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`🌐 Status: http://localhost:${PORT}/api/status`);
    console.log('='.repeat(60));
    console.log('\n📌 Use frontend to connect and scan QR\n');
    
    // Auto-restore if session exists
    const authFolder = path.join(__dirname, 'auth_info');
    if (fs.existsSync(authFolder)) {
        const files = fs.readdirSync(authFolder);
        if (files.length > 0) {
            console.log('🔄 Auto-restoring saved session...');
            status.active = true;
            startWhatsApp();
        }
    }
});

process.on('SIGINT', async () => {
    console.log('\n\n👋 Shutting down...');
    if (sock) { try { sock.end(); } catch (e) {} }
    process.exit(0);
});