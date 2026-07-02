const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const dbController = require('../controllers/dbController');
const importController = require('../controllers/importController');

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

// Filtro de archivos (permitir solo xlsx)
const fileFilter = (req, file, cb) => {
  const filetypes = /xlsx|vnd.openxmlformats-officedocument.spreadsheetml.sheet/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error('Solo se permiten archivos de formato Excel (.xlsx)'));
};

const upload = multer({ 
  storage: storage, 
  fileFilter: fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 } // Límite de 20 MB
});

// Rutas de Base de Datos
router.post('/db/test', dbController.testConnection);
router.post('/db/metadata', dbController.getDbMetadata);

// Rutas de Importación
router.post('/import/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  });
}, importController.uploadExcel);

router.post('/import/process', importController.processExcel);
router.post('/import/confirm', importController.confirmImport);

module.exports = router;
