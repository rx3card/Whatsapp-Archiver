# WhatsApp Archiver

Un bot sencillo hecho con Baileys que guarda **todo** lo que  llega por WhatsApp. Mensajes de texto, fotos, videos, audios (notas de voz), documentos, stickers… todo queda registrado y organizado.

### ¿Qué hace exactamente?
- Se conecta a tu cuenta de WhatsApp personal (escaneas el QR la primera vez).
- Cada mensaje que recibes se guarda en una base de datos SQLite (`mensajes.db`) que se mantiene aunque apagues el ordenador.
- Descarga automáticamente los archivos multimedia y los organiza en carpetas separadas:
  - `media/images/`
  - `media/videos/`
  - `media/audios/`
  - `media/docs/`
  - `media/stickers/`
- Muestra en la consola un log, cada vez que llega algo nuevo: número de teléfono, nombre del contacto, tipo de mensaje y si se guardó el archivo.

### Instalacion
1. Clona el repositorio
   ```bash
   git clone https://github.com/rx3card/Whatsapp-Archiver
   cd Whatsapp-Archiver
   ```

2. Instala las dependencias
   ```bash
   ppm install
   ```

3. Arranca el bot
   ```bash
   node index.js
   ```
   o
   ```bash
   pnpm start
   ```


4. La primera vez aparecerá un QR en la terminal → ábrelo con tu móvil en WhatsApp > Dispositivos vinculados > Vincular dispositivo.

5. ¡Listo! A partir de ahí todo lo que  llegue se guarda automáticamente.

### Estructura del proyecto
```
.
├── auth/                  # Credenciales de sesión (NO subir a GitHub)
├── media/                 # Aquí van todos los archivos descargados
│   ├── images/
│   ├── videos/
│   ├── audios/
│   ├── docs/
│   └── stickers/
├── mensajes.db            # Base de datos SQLite con todos los registros
├── db.js                  # Manejo de la base de datos
├── index.js               # Código principal
├── package.json
└── README.md
```

### Tips útiles
- Si cierras la terminal y lo vuelves a abrir, se reconecta solo sin necesidad de nuevo QR.
- Para empezar de cero (nueva sesión): borra la carpeta `auth/`.
- La base de datos se guarda automáticamente cada 10 segundos y al cerrar el programa.
- Las carpetas de multimedia se crean solas la primera vez.