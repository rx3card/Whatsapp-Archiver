const { default: makeWASocket, useMultiFileAuthState, downloadMediaMessage, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode-terminal');
const { iniciar, guardar } = require('./db');

function crearCarpetasMultimedia() {
  const carpetas = [
    'media/images',
    'media/videos',
    'media/audios',
    'media/docs',
    'media/stickers'
  ];

  carpetas.forEach(carpeta => {
    const ruta = path.join(__dirname, carpeta);
    
    if (!fs.existsSync(ruta)) {
      fs.mkdirSync(ruta, { recursive: true });
      console.log(`✅ Carpeta creada: ${carpeta}`);
    }
  });

  console.log('📁 Carpetas de multimedia listas');
}

function obtenerTelefonoReal(m) {
  let jid = m.key.participant || m.key.remoteJid || '';
  let numero = jid.split('@')[0];

  if (/^\d{10,15}$/.test(numero)) {
    return numero;
  }

  if (/^\d{16,}$/.test(numero)) {
    console.log(`⚠️ Detectado ID largo (probablemente Estado o contacto no guardado): ${numero}`);
    return 'Desconocido (Estado)';
  }

  if (jid.includes('@g.us')) {
    return numero || 'Grupo desconocido';
  }

  return 'Desconocido';
}

async function descargarConReintentos(m, sock, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    try {
      return await downloadMediaMessage(
        m,
        'buffer',
        {},
        {
          logger: P({ level: 'error' }),
          reuploadRequest: sock.updateMediaMessage,
          options: { timeoutMs: 30000 },
        }
      );
    } catch (err) {
      if (i === intentos - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
}

async function start() {
  crearCarpetasMultimedia();

  await iniciar();

  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: 'silent' }),
    getMessage: async () => ({}),
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('📱 Escanea este QR con tu WhatsApp:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      console.log('✅ Conectado exitosamente a WhatsApp');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Conexión cerrada', shouldReconnect ? '→ Reconectando...' : '→ Sesión cerrada');
      if (shouldReconnect) start();
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;

      const telefono = obtenerTelefonoReal(m);
      const nombre = m.pushName || m.verifiedBizName || 'Sin nombre';
      const jid = m.key.participant || m.key.remoteJid;
      const messageType = Object.keys(m.message)[0];

      let texto = null;
      let archivo = null;

      if (m.message.conversation) texto = m.message.conversation;
      else if (m.message.extendedTextMessage?.text) texto = m.message.extendedTextMessage.text;

      if (['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].includes(messageType)) {
        const msg = m.message[messageType];

        if (!msg.mediaKey || !msg.directPath) {
          console.log(`⚠️ ${messageType} no descargable (sin mediaKey) de ${nombre} (${telefono})`);
        } else {
          try {
            const buffer = await descargarConReintentos(m, sock, 3);

            let carpeta = 'docs';
            if (messageType === 'imageMessage') carpeta = 'images';
            else if (messageType === 'videoMessage') carpeta = 'videos';
            else if (messageType === 'audioMessage') carpeta = 'audios';
            else if (messageType === 'stickerMessage') carpeta = 'stickers';

            let ext = '.bin';
            if (msg.mimetype) {
              const match = msg.mimetype.match(/\/([a-zA-Z0-9]+)/);
              if (match) ext = '.' + match[1].toLowerCase();
            }
            if (messageType === 'audioMessage') ext = msg.ptt ? '.ogg' : '.mp3';
            if (messageType === 'stickerMessage') ext = '.webp';

            const safeName = (msg.fileName || 'archivo').replace(/[/\\?%*:|"<>]/g, '_');
            const filename = `${Date.now()}_${telefono.replace(/[^0-9]/g, '') || 'unknown'}_${safeName}${ext}`;
            const rutaArchivo = path.join('media', carpeta, filename);

            fs.writeFileSync(rutaArchivo, buffer);

            archivo = path.join('media', carpeta, filename).replace(/\\/g, '/');
          } catch (err) {
            console.log(`❌ Error descargando ${messageType} de ${nombre} (${telefono}): ${err.message}`);
          }
        }
      }

      guardar(telefono, nombre, jid, texto, messageType, archivo);

      let log = `Nuevo registro → ${telefono} (${nombre}) - Tipo: ${messageType}`;
      if (texto) log += ` → "${texto.substring(0, 50)}${texto.length > 50 ? '...' : ''}"`;
      if (archivo) log += ' [Archivo guardado]';
      console.log(log);
    }
  });
}

start().catch(err => console.error('Error crítico al iniciar:', err));