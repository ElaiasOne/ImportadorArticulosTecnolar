// Polyfill para compatibilidad de mssql con Node.js < 18.16.0 (empaquetado por pkg)
try {
  const dc = require('node:diagnostics_channel');
  if (typeof dc.tracingChannel !== 'function') {
    dc.tracingChannel = function(name) {
      const dummyChannel = { hasSubscribers: false };
      return {
        name,
        start: dummyChannel,
        end: dummyChannel,
        asyncStart: dummyChannel,
        asyncEnd: dummyChannel,
        error: dummyChannel,
        hasSubscribers: false,
        subscribe: () => {},
        unsubscribe: () => {},
        tracePromise: (fn) => fn(),
        traceCallback: (fn, position, context, thisArg, ...args) => fn.apply(thisArg, args)
      };
    };
  }
} catch (e) {
  console.warn('No se pudo inicializar el polyfill de tracingChannel:', e.message);
}

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const apiRoutes = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// Habilitar CORS para peticiones del frontend
app.use(cors());

// Configurar límites de tamaño para JSON y urlencoded debido a envíos grandes de datos de la grilla
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Servir rutas de la API
app.use('/api', apiRoutes);

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../public')));

// Endpoint de estado simple
app.get('/status', (req, res) => {
  res.json({ status: 'running', service: 'ImportadorArticulos API' });
});

// Redirigir cualquier otra ruta GET no encontrada a la aplicación frontend
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/status')) {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  }
  next();
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Ocurrió un error inesperado en el servidor.'
  });
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
  
  // Si se está ejecutando desde el binario empaquetado (.exe), abrir el navegador automáticamente
  if (process.pkg) {
    const { exec } = require('child_process');
    exec(`start http://localhost:${PORT}`);
  }
});

module.exports = app;
