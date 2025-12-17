const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

let db;
const DB_PATH = path.join(__dirname, 'mensajes.db');

function formatearFecha(date = new Date()) {
  const d = date;
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const año = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const seg = String(d.getSeconds()).padStart(2, '0');
  return `${dia}/${mes}/${año} ${hora}:${min}:${seg}`;
}

async function iniciar() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    console.log('📂 Cargando base de datos existente: mensajes.db');
    const filebuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(filebuffer);
  } else {
    console.log('🆕 Creando nueva base de datos');
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telefono TEXT,
      mensaje TEXT,
      tipo TEXT,
      archivo TEXT,
      fecha TEXT,
      fecha_iso TEXT
    )
  `);

  const columnasNecesarias = ['name', 'jid'];
  const pragma = db.exec("PRAGMA table_info(mensajes);");
  const columnasExistentes = pragma[0].values.map(row => row[1]);

  if (!columnasExistentes.includes('name')) {
    db.run("ALTER TABLE mensajes ADD COLUMN name TEXT;");
    console.log('✅ Columna "name" agregada');
  }

  if (!columnasExistentes.includes('jid')) {
    db.run("ALTER TABLE mensajes ADD COLUMN jid TEXT;");
    console.log('✅ Columna "jid" agregada');
  }

  if (!columnasExistentes.includes('fecha_iso')) {
    db.run("ALTER TABLE mensajes ADD COLUMN fecha_iso TEXT;");
    console.log('✅ Columna "fecha_iso" agregada');
  }

  console.log('✅ Base de datos lista y actualizada');
}

function guardar(telefono, name, jid, mensaje, tipo, archivo) {
  if (!db) return;

  const fechaVisible = formatearFecha();
  const fechaISO = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO mensajes 
    (telefono, name, jid, mensaje, tipo, archivo, fecha, fecha_iso) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([telefono, name || null, jid, mensaje || null, tipo, archivo || null, fechaVisible, fechaISO]);
  stmt.free();
}

function exportar() {
  if (!db) return;

  try {
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('Error al guardar BD:', err);
  }
}

setInterval(exportar, 10000);

process.on('SIGINT', () => {
  console.log('\n🛑 Guardando base de datos antes de salir...');
  exportar();
  process.exit();
});

module.exports = { iniciar, guardar };