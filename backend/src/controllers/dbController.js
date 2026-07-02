const { getPool } = require('../config/database');

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
      message: `No se pudo conectar a la base de datos. Verifique que:\n1. El servidor '${dbServer || 'localhost'}' esté activo.\n2. La base de datos '${dbName}' exista.\n3. Las credenciales de usuario y contraseña tengan permisos.\n\nDetalle técnico: ${err.message}`
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

    return res.json({
      success: true,
      data: {
        departamentos: deptosResult.recordset,
        ivas: ivasResult.recordset
      }
    });
  } catch (err) {
    console.error('Metadata retrieval error:', err);
    return res.status(500).json({
      success: false,
      message: `Error al consultar datos de configuración de la base de datos.\nDetalle técnico: ${err.message}`
    });
  }
}

module.exports = {
  testConnection,
  getDbMetadata
};
