const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');  // <-- Añadido esto
const { iniciar, guardar } = require('./db');

async function start() {
  await iniciar();

  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    // Quitamos printQRInTerminal para eliminar el warning
  });

  // Manejo manual del QR (sin warning y con estilo bonito)
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 Escanea este QR con tu WhatsApp:');
      qrcode.generate(qr, { small: true });  // QR bonito y compacto en la terminal
    }

    if (connection === 'open') {
      console.log('✅ Conectado exitosamente a WhatsApp');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Conexión cerrada', shouldReconnect ? '→ Reconectando...' : '→ Sesión cerrada (escanea de nuevo)');
      if (shouldReconnect) {
        start();
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;

      const telefono = (m.key.participant || m.key.remoteJid).split('@')[0];
      const messageType = Object.keys(m.message)[0];

      let texto = null;
      let archivo = null;

      if (m.message.conversation) texto = m.message.conversation;
      else if (m.message.extendedTextMessage?.text) texto = m.message.extendedTextMessage.text;

      if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'].includes(messageType)) {
        try {
          const buffer = await downloadMediaMessage(m, 'buffer', {}, { sock });

          let carpeta = 'docs';
          let ext = '.bin';

          const msg = m.message[messageType];

          if (messageType === 'imageMessage') carpeta = 'images';
          else if (messageType === 'videoMessage') carpeta = 'videos';
          else if (messageType === 'audioMessage') carpeta = 'audios';

          if (msg.mimetype) {
            const extMatch = msg.mimetype.match(/\/([a-zA-Z0-9]+)$/);
            if (extMatch) ext = '.' + extMatch[1].toLowerCase();
          }

          const filename = `${Date.now()}_${telefono}_${msg.fileName || 'file'}${ext}`;
          const rutaCarpeta = path.join('media', carpeta);
          const rutaArchivo = path.join(rutaCarpeta, filename);

          fs.mkdirSync(rutaCarpeta, { recursive: true });
          fs.writeFileSync(rutaArchivo, buffer);

          archivo = path.join('media', carpeta, filename).replace(/\\/g, '/');
        } catch (err) {
          console.error('Error descargando archivo:', err);
        }
      }

      guardar(telefono, texto, messageType, archivo);
    }
  });
}

start().catch(err => console.error('Error crítico:', err));