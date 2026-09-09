require('dotenv').config();
const sql = require('mssql');

// Caché de pools por servidor y nombre de base de datos
const pools = {};

async function getPool(server, database, dbUser, dbPassword) {
  let host = server || 'localhost';
  let instanceName = undefined;
  let port = undefined;

  // Reemplazar '.' con 'localhost' para mayor compatibilidad en Node.js
  if (host === '.') {
    host = 'localhost';
  } else if (host.startsWith('.\\')) {
    host = 'localhost' + host.substring(1);
  }

  // Detectar puerto especificado con coma (estilo SQL Server) o dos puntos
  if (host.includes(',')) {
    const parts = host.split(',');
    host = parts[0].trim();
    const parsedPort = parseInt(parts[1].trim(), 10);
    if (!isNaN(parsedPort)) {
      port = parsedPort;
    }
  } else if (host.includes(':')) {
    const parts = host.split(':');
    host = parts[0].trim();
    const parsedPort = parseInt(parts[1].trim(), 10);
    if (!isNaN(parsedPort)) {
      port = parsedPort;
    }
  }

  // Detectar instancia nombrada (ej. localhost\SQLEXPRESS o servidor\instancia)
  if (host.includes('\\')) {
    const parts = host.split('\\');
    host = parts[0].trim();
    instanceName = parts[1].trim();
  }

  // Clave de caché basada en los componentes reales de conexión
  const key = `${host}:${instanceName || ''}:${port || ''}:${database}:${dbUser || ''}`;
  
  if (pools[key]) {
    // Si el pool está conectado, lo retorna
    if (pools[key].connected) {
      return pools[key];
    }
    // Si no está conectado, lo limpia
    try {
      await pools[key].close();
    } catch (err) {
      // Ignorar errores al cerrar
    }
    delete pools[key];
  }

  const config = {
    user: dbUser || process.env.DB_USER || 'sa',
    password: dbPassword || process.env.DB_PASSWORD || 'LaCrujia_3261',
    server: host,
    database: database,
    options: {
      encrypt: false, // Establecer en false para evitar errores de certificado en desarrollo local
      trustServerCertificate: true,
      enableArithAbort: true
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };

  // Asignar puerto e instancia si fueron detectados
  if (instanceName) {
    config.options.instanceName = instanceName;
  }
  if (port) {
    config.port = port;
  }

  const pool = new sql.ConnectionPool(config);
  pools[key] = await pool.connect();
  return pools[key];
}

async function closeAllPools() {
  for (const key in pools) {
    try {
      await pools[key].close();
    } catch (err) {
      console.error(`Error closing pool ${key}:`, err);
    }
    delete pools[key];
  }
}

module.exports = {
  getPool,
  closeAllPools,
  sql
};
