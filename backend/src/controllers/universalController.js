const universalSqlService = require('../services/universalSqlService');
const fs = require('fs');

/**
 * Obtiene la lista de tablas disponibles en la BD conectada.
 */
async function getTables(req, res) {
  const { dbServer, dbName, dbUser, dbPassword } = req.body;

  if (!dbName) {
    return res.status(400).json({ success: false, message: 'Debe especificar el nombre de la base de datos.' });
  }

  try {
    const tables = await universalSqlService.getTables(dbServer, dbName, dbUser, dbPassword);
    return res.json({ success: true, tables });
  } catch (err) {
    console.error('Error al obtener tablas:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Exporta una tabla con filtro WHERE opcional directamente como streaming de archivo.
 */
async function exportTable(req, res) {
  const { dbServer, dbName, dbUser, dbPassword, tableName, whereClause } = req.body;

  if (!dbName || !tableName) {
    return res.status(400).json({ success: false, message: 'Debe especificar la base de datos y la tabla a exportar.' });
  }

  try {
    const filename = `${tableName}_export_${Date.now()}.sqlpack`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await universalSqlService.exportTableStream(res, tableName, whereClause, dbServer, dbName, dbUser, dbPassword);
    res.end();
  } catch (err) {
    console.error('Error al exportar tabla:', err);
    if (!res.headersSent) {
      return res.status(500).json({ success: false, message: err.message });
    } else {
      res.end();
    }
  }
}

/**
 * Procesa la carga de un archivo de exportación subido (.json o .sqlpack).
 * Retorna la ruta en servidor (filePath) y metadatos ligeros sin sobrecargar la memoria HTTP del cliente.
 */
async function uploadPackage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo de paquete.' });
    }

    const content = fs.readFileSync(req.file.path, 'utf8');
    let packageData;

    try {
      packageData = JSON.parse(content);
    } catch (parseErr) {
      return res.status(400).json({ success: false, message: 'El archivo subido no es un JSON o paquete válido.' });
    }

    if (!packageData.rows || !packageData.schema || !packageData.tableName) {
      return res.status(400).json({ success: false, message: 'El archivo subido no tiene la estructura de exportación requerida.' });
    }

    const totalRecords = packageData.totalRecords || packageData.rows.length;

    return res.json({
      success: true,
      filePath: req.file.path,
      packageMeta: {
        tableName: packageData.tableName,
        totalRecords: totalRecords,
        schema: packageData.schema,
        server: packageData.server,
        database: packageData.database,
        exportedAt: packageData.exportedAt
      }
    });
  } catch (err) {
    console.error('Error al procesar archivo de paquete:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Inspecciona un paquete y compara contra la tabla de destino.
 * Soporta lectura por filePath en disco para evitar sobrecarga HTTP.
 */
async function inspectPackage(req, res) {
  const { dbServer, dbName, dbUser, dbPassword, filePath, packageData: rawPackageData, targetTableName } = req.body;

  if (!dbName) {
    return res.status(400).json({ success: false, message: 'Faltan parámetros requeridos para inspección.' });
  }

  try {
    let packageData = rawPackageData;
    if (!packageData && filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      packageData = JSON.parse(content);
    }

    if (!packageData) {
      return res.status(400).json({ success: false, message: 'No se encontró la información del paquete a inspeccionar.' });
    }

    const report = await universalSqlService.inspectImportPackage(packageData, targetTableName, dbServer, dbName, dbUser, dbPassword);
    return res.json({ success: true, report });
  } catch (err) {
    console.error('Error al inspeccionar paquete:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Inicia un trabajo de importación asíncrono para seguimiento con barra de porcentaje.
 */
async function startImportJob(req, res) {
  const { dbServer, dbName, dbUser, dbPassword, filePath, packageData: rawPackageData, targetTableName, importStrategy } = req.body;

  if (!dbName) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos para ejecutar la importación.' });
  }

  try {
    let packageData = rawPackageData;
    if (!packageData && filePath && fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      packageData = JSON.parse(content);
    }

    if (!packageData) {
      return res.status(400).json({ success: false, message: 'No se encontraron datos para importar.' });
    }

    const job = universalSqlService.createImportJob(packageData.rows ? packageData.rows.length : 0);

    // Ejecución asíncrona en segundo plano
    universalSqlService.importTableData({
      packageData,
      targetTableName,
      importStrategy: importStrategy || 'skip',
      dbServer,
      dbName,
      dbUser,
      dbPassword,
      jobId: job.jobId
    }).catch(err => {
      console.error(`Error en trabajo ${job.jobId}:`, err);
      job.status = 'failed';
      job.message = err.message;
    });

    return res.json({
      success: true,
      jobId: job.jobId,
      totalRows: job.totalRows
    });
  } catch (err) {
    console.error('Error al iniciar trabajo de importación:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Consulta el estado actual de progreso (0% a 100%) de un trabajo de importación.
 */
async function getImportJobStatus(req, res) {
  const { jobId } = req.params;
  const job = universalSqlService.getImportJob(jobId);

  if (!job) {
    return res.status(404).json({ success: false, message: 'Trabajo de importación no encontrado.' });
  }

  return res.json({
    success: true,
    job
  });
}

const path = require('path');

const uploadsDir = process.pkg
  ? path.join(path.dirname(process.execPath), 'uploads')
  : path.join(__dirname, '../../uploads');

/**
 * Inicia un trabajo de exportación asíncrono para seguimiento con barra de porcentaje.
 */
async function startExportJob(req, res) {
  const { dbServer, dbName, dbUser, dbPassword, tableName, whereClause } = req.body;

  if (!dbName || !tableName) {
    return res.status(400).json({ success: false, message: 'Debe especificar la base de datos y la tabla a exportar.' });
  }

  try {
    const job = universalSqlService.createExportJob();

    universalSqlService.exportTableJob({
      tableName,
      whereClause,
      dbServer,
      dbName,
      dbUser,
      dbPassword,
      jobId: job.jobId,
      uploadsDir
    }).catch(err => {
      console.error(`Error en trabajo de exportación ${job.jobId}:`, err);
      job.status = 'failed';
      job.message = err.message;
    });

    return res.json({
      success: true,
      jobId: job.jobId
    });
  } catch (err) {
    console.error('Error al iniciar trabajo de exportación:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Consulta el estado actual de progreso (0% a 100%) de un trabajo de exportación.
 */
async function getExportJobStatus(req, res) {
  const { jobId } = req.params;
  const job = universalSqlService.getExportJob(jobId);

  if (!job) {
    return res.status(404).json({ success: false, message: 'Trabajo de exportación no encontrado.' });
  }

  return res.json({
    success: true,
    job
  });
}

/**
 * Descarga el archivo de exportación generado.
 */
async function downloadExportJob(req, res) {
  const { jobId } = req.params;
  const job = universalSqlService.getExportJob(jobId);

  if (!job || job.status !== 'completed' || !job.filePath || !fs.existsSync(job.filePath)) {
    return res.status(404).json({ success: false, message: 'Archivo de exportación no disponible para descarga.' });
  }

  return res.download(job.filePath, job.fileName);
}

module.exports = {
  getTables,
  exportTable,
  startExportJob,
  getExportJobStatus,
  downloadExportJob,
  uploadPackage,
  inspectPackage,
  startImportJob,
  getImportJobStatus
};
