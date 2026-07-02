const path = require('path');
const fs = require('fs');
const excelService = require('../services/excelService');
const rulesService = require('../services/rulesService');
const sqlService = require('../services/sqlService');

/**
 * Sube una planilla de cálculo y devuelve los nombres de sus columnas.
 */
async function uploadExcel(req, res) {
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: 'No se subió ningún archivo Excel (.xlsx).' 
    });
  }

  const filePath = req.file.path;

  try {
    const columns = await excelService.readExcelHeaders(filePath);
    return res.json({
      success: true,
      data: {
        filePath: filePath,
        fileName: req.file.originalname,
        columns: columns
      }
    });
  } catch (err) {
    // Limpieza del archivo en caso de error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    console.error('Excel upload parsing error:', err);
    return res.status(500).json({
      success: false,
      message: `Error al leer las columnas del archivo Excel. Asegúrese de que no esté dañado.\nDetalle: ${err.message}`
    });
  }
}

/**
 * Procesa las filas de Excel según el mapeo y aplica las reglas de negocio y validación.
 */
async function processExcel(req, res) {
  const { filePath, mapping, dbServer, dbName, dbUser, dbPassword } = req.body;

  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(400).json({
      success: false,
      message: 'Archivo Excel temporal no encontrado o ya procesado. Por favor, suba el archivo nuevamente.'
    });
  }

  if (!mapping || Object.keys(mapping).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Debe proporcionar una asociación/mapeo de columnas válido.'
    });
  }

  if (!dbName) {
    return res.status(400).json({
      success: false,
      message: 'Debe proporcionar la base de datos de destino.'
    });
  }

  try {
    // Lee las filas de Excel y las mapea a los campos de ERP
    const rawRows = await excelService.readExcelRows(filePath, mapping);
    
    // Aplica las reglas de negocio y realiza las validaciones
    const processedRows = await rulesService.processRows(rawRows, dbServer, dbName, dbUser, dbPassword);

    return res.json({
      success: true,
      data: {
        rows: processedRows
      }
    });
  } catch (err) {
    console.error('Excel processing error:', err);
    return res.status(500).json({
      success: false,
      message: `Error al procesar las reglas de negocio en los artículos.\nDetalle: ${err.message}`
    });
  }
}

/**
 * Confirma la importación insertando artículos limpios y validados en SQL Server.
 */
async function confirmImport(req, res) {
  const { articulos, dbServer, dbName, dbUser, dbPassword, filePath } = req.body;

  if (!articulos || articulos.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No hay artículos válidos para importar.'
    });
  }

  if (!dbName) {
    return res.status(400).json({
      success: false,
      message: 'Debe proporcionar la base de datos de destino.'
    });
  }

  try {
    const result = await sqlService.insertArticulos(articulos, dbServer, dbName, dbUser, dbPassword);
    
    // Limpieza del archivo Excel temporal si existe
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {
        console.warn('No se pudo eliminar el archivo temporal:', filePath, e);
      }
    }

    return res.json({
      success: true,
      message: `Se importaron con éxito ${result.count} artículos en la tabla 'Articulos'.`,
      data: result
    });
  } catch (err) {
    console.error('Import confirmation error:', err);
    return res.status(500).json({
      success: false,
      message: `Error de base de datos durante la inserción masiva. La operación fue cancelada y revertida (Rollback).\nDetalle técnico: ${err.message}`
    });
  }
}

module.exports = {
  uploadExcel,
  processExcel,
  confirmImport
};
