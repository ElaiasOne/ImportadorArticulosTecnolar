const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dbController = require('../controllers/dbController');
const importController = require('../controllers/importController');
const universalController = require('../controllers/universalController');

const router = express.Router();

// Asegurar que exista la carpeta de uploads en una ruta de escritura válida
const uploadsDir = process.pkg
  ? path.join(path.dirname(process.execPath), 'uploads')
  : path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de almacenamiento de Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Filtro de archivos Excel (xlsx)
const excelFileFilter = (req, file, cb) => {
  const filetypes = /xlsx|vnd.openxmlformats-officedocument.spreadsheetml.sheet/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Solo se permiten archivos de formato Excel (.xlsx)'));
};

const uploadExcel = multer({ 
  storage: storage, 
  fileFilter: excelFileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // Límite de 50 MB
});

// Filtro de paquetes exportados (.json / .sqlpack)
const packageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.json' || ext === '.sqlpack' || ext === '.txt') {
    return cb(null, true);
  }
  cb(new Error('Solo se permiten archivos de paquete exportado (.json, .sqlpack)'));
};

const uploadPackage = multer({
  storage: storage,
  fileFilter: packageFileFilter,
  limits: { fileSize: 1000 * 1024 * 1024 } // Límite de 1000 MB para paquetes masivos
});

// Rutas de Base de Datos
router.post('/db/test', dbController.testConnection);
router.post('/db/metadata', dbController.getDbMetadata);

// Rutas de Importación de Artículos
router.post('/import/upload', (req, res, next) => {
  uploadExcel.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, importController.uploadExcel);

router.post('/import/process', importController.processExcel);
router.post('/import/confirm', importController.confirmImport);

// Rutas del Módulo Universal SQL Server
router.post('/universal/tables', universalController.getTables);
router.post('/universal/export', universalController.exportTable);
router.post('/universal/export-job', universalController.startExportJob);
router.get('/universal/export-job/:jobId', universalController.getExportJobStatus);
router.get('/universal/export-download/:jobId', universalController.downloadExportJob);
router.post('/universal/upload', (req, res, next) => {
  uploadPackage.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, universalController.uploadPackage);
router.post('/universal/inspect', universalController.inspectPackage);
router.post('/universal/import', universalController.startImportJob);
router.post('/universal/import-job', universalController.startImportJob);
router.get('/universal/import-job/:jobId', universalController.getImportJobStatus);

module.exports = router;
