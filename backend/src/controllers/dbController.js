const { getPool } = require('../config/database');

/**
 * Formatea un mensaje de error de conexión detallado con notas de soporte en español
 * ante problemas comunes de red y protocolo TCP/IP de SQL Server.
 */
function formatConnectionError(err, dbServer, dbName) {
  let message = `No se pudo conectar a la base de datos. Verifique que:\n1. El servidor '${dbServer || 'localhost'}' esté activo.\n2. La base de datos '${dbName}' exista.\n3. Las credenciales de usuario y contraseña tengan permisos y sean correctas.`;
  
  const isNetworkError = err.code === 'ESOCKET' || 
                         (err.message && err.message.includes('Failed to connect')) ||
                         (err.originalError && err.originalError.message && err.originalError.message.includes('Failed to connect')) ||
                         (err.originalError && err.originalError.cause && err.originalError.cause.message && err.originalError.cause.message.includes('connect'));

  if (isNetworkError) {
    message += `\n\n💡 NOTA DE SOPORTE (Error de red/TCP/IP):\n` +
               `Este error suele ocurrir porque el protocolo TCP/IP está deshabilitado en el SQL Server del cliente (está desactivado por defecto en SQL Server Express) o porque no se especificó la instancia.\n\n` +
               `Pasos para solucionarlo:\n` +
               `1. Abre 'SQL Server Configuration Manager' en el servidor del cliente.\n` +
               `2. Ve a 'Configuración de red de SQL Server' (SQL Server Network Configuration) -> 'Protocolos de [Instancia]' (ej. Protocols for SQLEXPRESS).\n` +
               `3. Haz clic derecho en 'TCP/IP' y selecciona 'Habilitar' (Enable).\n` +
               `4. Ve a 'Servicios de SQL Server' (SQL Server Services), haz clic derecho en el servicio 'SQL Server (Instancia)' y selecciona 'Reiniciar'.\n` +
               `5. Si SQL Server es una instancia nombrada (por ejemplo, SQLEXPRESS), asegúrate de que el servicio 'Explorador de SQL Server' (SQL Server Browser) esté Iniciado en Windows y en ejecución, o intenta conectar especificando la instancia completa en la casilla de servidor (ej: localhost\\SQLEXPRESS o .\\SQLEXPRESS).\n` +
               `6. Asegúrate de que el firewall de Windows no esté bloqueando el puerto TCP 1433.`;
  }

  message += `\n\nDetalle técnico: ${err.message}`;
  return message;
}

/**
 * Endpoint para probar la conexión a la base de datos.
 */
async function testConnection(req, res) {
  const { dbServer, dbName, dbUser, dbPassword } = req.body;

  if (!dbName) {
    return res.status(400).json({ 
      success: false, 
      message: 'Debe ingresar el nombre de la base de datos.' 
    });
  }

  try {
    const pool = await getPool(dbServer, dbName, dbUser, dbPassword);
    // Consulta simple para verificar la conexión
    const result = await pool.request().query('SELECT 1 as test');
    
    return res.json({
      success: true,
      message: `Conexión exitosa a la base de datos '${dbName}' en el servidor '${dbServer || 'localhost'}'.`
    });
  } catch (err) {
    console.error('Connection test error:', err);
    return res.status(500).json({
      success: false,
      message: formatConnectionError(err, dbServer, dbName)
    });
  }
}

/**
 * Obtiene los departamentos y las configuraciones de IVA de SQL Server para ayudar con el mapeo del frontend.
 */
async function getDbMetadata(req, res) {
  const { dbServer, dbName, dbUser, dbPassword } = req.body;

  if (!dbName) {
    return res.status(400).json({ 
      success: false, 
      message: 'Debe ingresar el nombre de la base de datos para obtener los metadatos.' 
    });
  }

  try {
    const pool = await getPool(dbServer, dbName, dbUser, dbPassword);
    
    // Obtener departamentos
    const deptosResult = await pool.request().query('SELECT Codigo, Descripcion FROM Departamentos ORDER BY Codigo');
    // Obtener tasas de IVA
    const ivasResult = await pool.request().query('SELECT Codigo, Porcentaje, Descripcion FROM TablaIVA ORDER BY Porcentaje');
    // Obtener código máximo de artículos
    const maxCodeResult = await pool.request().query('SELECT MAX(Codigo) as maxCode FROM Articulos');
    const maxDbCode = maxCodeResult.recordset[0].maxCode || 0;

    return res.json({
      success: true,
      data: {
        departamentos: deptosResult.recordset,
        ivas: ivasResult.recordset,
        maxDbCode: maxDbCode
      }
    });
  } catch (err) {
    console.error('Metadata retrieval error:', err);
    return res.status(500).json({
      success: false,
      message: formatConnectionError(err, dbServer, dbName)
    });
  }
}

module.exports = {
  testConnection,
  getDbMetadata
};
