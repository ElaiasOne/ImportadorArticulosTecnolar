/**
 * Servicio frontend para comunicación con endpoints universales de SQL Server.
 */
export async function getTables(connection) {
  const response = await fetch('/api/universal/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dbServer: connection.server,
      dbName: connection.database,
      dbUser: connection.user,
      dbPassword: connection.password
    })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Error al obtener la lista de tablas');
  }
  return data.tables;
}

export async function exportTable({ connection, tableName, whereClause }) {
  const response = await fetch('/api/universal/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dbServer: connection.server,
      dbName: connection.database,
      dbUser: connection.user,
      dbPassword: connection.password,
      tableName,
      whereClause
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || 'Error al exportar la tabla');
  }

  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = downloadUrl;
  downloadAnchor.download = `${tableName}_export_${Date.now()}.sqlpack`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  window.URL.revokeObjectURL(downloadUrl);

  return { success: true, tableName, blobSize: blob.size };
}

export async function startExportJob({ connection, tableName, whereClause }) {
  const response = await fetch('/api/universal/export-job', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dbServer: connection.server,
      dbName: connection.database,
      dbUser: connection.user,
      dbPassword: connection.password,
      tableName,
      whereClause
    })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Error al iniciar la exportación');
  }
  return data;
}

export async function getExportJobStatus(jobId) {
  const response = await fetch(`/api/universal/export-job/${jobId}`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Error al consultar el progreso de la exportación');
  }
  return data.job;
}

export function downloadExportFile(jobId) {
  const downloadAnchor = document.createElement('a');
  downloadAnchor.href = `/api/universal/export-download/${jobId}`;
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export async function uploadPackage(file, onProgress = null) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded * 100) / e.total);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          if (data.success) resolve(data);
          else reject(new Error(data.message || 'Error al cargar paquete'));
        } catch (e) {
          reject(new Error('Respuesta inválida del servidor'));
        }
      } else {
        try {
          const data = JSON.parse(xhr.responseText);
          reject(new Error(data.message || 'Error en el servidor al cargar paquete'));
        } catch (e) {
          reject(new Error(`Error ${xhr.status} al cargar paquete`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Error de red al cargar paquete'));
    xhr.open('POST', '/api/universal/upload', true);
    xhr.send(formData);
  });
}

export async function inspectPackage({ connection, filePath, packageData, targetTableName }) {
  const response = await fetch('/api/universal/inspect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dbServer: connection.server,
      dbName: connection.database,
      dbUser: connection.user,
      dbPassword: connection.password,
      filePath,
      packageData,
      targetTableName
    })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Error al inspeccionar la tabla en la base de datos destino');
  }
  return data.report;
}

export async function importPackage({ connection, filePath, packageData, targetTableName, importStrategy }) {
  const response = await fetch('/api/universal/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dbServer: connection.server,
      dbName: connection.database,
      dbUser: connection.user,
      dbPassword: connection.password,
      filePath,
      packageData,
      targetTableName,
      importStrategy
    })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Error al ejecutar la importación');
  }
  return data;
}

export async function getImportJobStatus(jobId) {
  const response = await fetch(`/api/universal/import-job/${jobId}`);
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Error al consultar el progreso de la importación');
  }
  return data.job;
}
