const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db;
const DB_PATH = path.join(__dirname, 'mensajes.db');

async function iniciar() {
  const SQL = await initSqlJs();

  // Si el archivo de BD existe, cargarlo; si no, crear uno nuevo en memoria
  if (fs.existsSync(DB_PATH)) {
    console.log('📂 Cargando base de datos existente: mensajes.db');
    const filebuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(filebuffer);
  } else {
    console.log('🆕 Creando nueva base de datos en memoria');
    db = new SQL.Database();
  }

  // Crear tabla si no existe
  db.run(`
    CREATE TABLE IF NOT EXISTS mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefono TEXT,
      mensaje TEXT,
      tipo TEXT,
      archivo TEXT,
      fecha TEXT
    )
  `);

  console.log('✅ Base de datos lista');
}

function guardar(telefono, mensaje, tipo, archivo) {
  if (!db) return;

  const stmt = db.prepare(
    'INSERT INTO mensajes (telefono, mensaje, tipo, archivo, fecha) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run([telefono, mensaje || null, tipo, archivo || null, new Date().toISOString()]);
  stmt.free();
}

function exportar() {
  if (!db) return;

  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
    // console.log('💾 Base de datos guardada en disco'); // Comentado para no saturar la consola
  } catch (err) {
    console.error('Error al exportar BD:', err);
  }
}

// Guardar cada 10 segundos
setInterval(exportar, 10000);

// Guardar también al cerrar el proceso
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando... guardando base de datos');
  exportar();
  process.exit();
});

module.exports = { iniciar, guardar };