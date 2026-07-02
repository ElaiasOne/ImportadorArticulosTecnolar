import axios from 'axios';

const API_BASE = typeof window !== 'undefined' && window.location.port === '5173'
  ? 'http://localhost:3000/api'
  : '/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

export default {
  /**
   * Prueba la conexión a la base de datos.
   */
  async testConnection(dbServer, dbName, dbUser, dbPassword) {
    const response = await apiClient.post('/db/test', { dbServer, dbName, dbUser, dbPassword });
    return response.data;
  },

  /**
   * Obtiene los metadatos (departamentos e IVAs) para la conexión de base de datos dada.
   */
  async getDbMetadata(dbServer, dbName, dbUser, dbPassword) {
    const response = await apiClient.post('/db/metadata', { dbServer, dbName, dbUser, dbPassword });
    return response.data;
  },

  /**
   * Sube un archivo Excel al servidor.
   */
  async uploadExcel(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post('/import/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  /**
   * Procesa los datos de Excel según los mapeos y aplica las reglas de negocio.
   */
  async processExcel(filePath, mapping, dbServer, dbName, dbUser, dbPassword) {
    const response = await apiClient.post('/import/process', {
      filePath,
      mapping,
      dbServer,
      dbName,
      dbUser,
      dbPassword
    });
    return response.data;
  },

  /**
   * Inserta la lista final de artículos editados en la base de datos SQL Server.
   */
  async confirmImport(articulos, dbServer, dbName, dbUser, dbPassword, filePath) {
    const response = await apiClient.post('/import/confirm', {
      articulos,
      dbServer,
      dbName,
      dbUser,
      dbPassword,
      filePath
    });
    return response.data;
  }
};
