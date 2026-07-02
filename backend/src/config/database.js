require('dotenv').config();
const sql = require('mssql');

// Caché de pools por servidor y nombre de base de datos
const pools = {};

async function getPool(server, database, dbUser, dbPassword) {
  const key = `${server || 'localhost'}:${database}:${dbUser || ''}`;
  
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
    server: server || 'localhost',
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
