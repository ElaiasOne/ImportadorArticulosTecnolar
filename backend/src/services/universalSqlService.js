const fs = require('fs');
const path = require('path');
const { getPool, sql } = require('../config/database');


/**
 * Mapea el tipo de dato SQL Server (cadena) al tipo mssql correspondiente.
 */
function getMssqlType(dataType) {
  const type = (dataType || '').toLowerCase();
  switch (type) {
    case 'int': return sql.Int;
    case 'bigint': return sql.BigInt;
    case 'smallint': return sql.SmallInt;
    case 'tinyint': return sql.TinyInt;
    case 'bit': return sql.Bit;
    case 'money': return sql.Money;
    case 'smallmoney': return sql.SmallMoney;
    case 'decimal': case 'numeric': return sql.Decimal(18, 4);
    case 'float': return sql.Float;
    case 'real': return sql.Real;
    case 'datetime': case 'datetime2': return sql.DateTime;
    case 'smalldatetime': return sql.SmallDateTime;
    case 'date': return sql.Date;
    case 'time': return sql.Time;
    case 'char': case 'nchar': case 'varchar': case 'nvarchar': case 'text': case 'ntext': return sql.NVarChar;
    case 'uniqueidentifier': return sql.UniqueIdentifier;
    case 'varbinary': case 'binary': case 'image': return sql.VarBinary;
    default: return sql.NVarChar;
  }
}

/**
 * Sanitiza y convierte un valor según el tipo de dato y restricciones SQL para evitar fallos de validación en mssql (Out of range, NULL en NOT NULL, String truncation).
 */
function sanitizeValue(val, colMeta) {
  const dataType = (typeof colMeta === 'object' ? colMeta?.dataType : colMeta) || '';
  const isNullable = typeof colMeta === 'object' ? Boolean(colMeta?.isNullable) : true;
  const maxLength = typeof colMeta === 'object' ? colMeta?.maxLength : null;

  const type = dataType.toLowerCase().trim();
  let cleanVal = val;

  if (cleanVal === undefined || cleanVal === null) {
    cleanVal = null;
  }

  // Tratamiento de tipos Fecha y Hora
  if (type.includes('date') || type.includes('time')) {
    if (typeof cleanVal === 'string') {
      const s = cleanVal.trim();
      if (s === '' || s === '0000-00-00' || s === '0000-00-00 00:00:00' || s === '00000000' || s === '0' || s === 'null') {
        cleanVal = null;
      }
    } else if (cleanVal === 0) {
      cleanVal = null;
    }

    if (cleanVal !== null) {
      const parsedDate = new Date(cleanVal);
      if (isNaN(parsedDate.getTime())) {
        cleanVal = null; // Fecha inválida
      } else {
        const year = parsedDate.getFullYear();
        const utcYear = parsedDate.getUTCFullYear();
        if (type === 'smalldatetime') {
          if (year < 1900 || year > 2079 || utcYear < 1900 || utcYear > 2079) {
            cleanVal = null;
          } else {
            cleanVal = parsedDate;
          }
        } else if (type === 'date' || type === 'datetime' || type === 'datetime2') {
          if (year < 1753 || year > 9999 || utcYear < 1753 || utcYear > 9999) {
            cleanVal = null;
          } else {
            cleanVal = parsedDate;
          }
        } else {
          cleanVal = parsedDate;
        }
      }
    }
  }

  // Tratamiento de tipos Numéricos
  else if (['int', 'bigint', 'smallint', 'tinyint', 'money', 'smallmoney', 'decimal', 'numeric', 'float', 'real'].includes(type)) {
    if (cleanVal === '' || cleanVal === null) {
      cleanVal = null;
    } else if (typeof cleanVal === 'string') {
      const num = Number(cleanVal.trim());
      cleanVal = isNaN(num) ? null : num;
    }
  }

  // Tratamiento de tipo Bit (Booleano)
  else if (type === 'bit') {
    if (typeof cleanVal === 'boolean') {
      cleanVal = cleanVal ? 1 : 0;
    } else if (cleanVal === 1 || cleanVal === '1' || cleanVal === 'true') {
      cleanVal = 1;
    } else if (cleanVal === 0 || cleanVal === '0' || cleanVal === 'false') {
      cleanVal = 0;
    } else {
      cleanVal = null;
    }
  }

  // Tratamiento de Cadenas de Texto (Truncado de seguridad)
  else if (['char', 'nchar', 'varchar', 'nvarchar', 'text', 'ntext'].includes(type)) {
    if (cleanVal !== null && cleanVal !== undefined) {
      cleanVal = String(cleanVal);
      if (maxLength && maxLength > 0 && cleanVal.length > maxLength) {
        cleanVal = cleanVal.substring(0, maxLength);
      }
    }
  }

  // SI LA COLUMNA NO ADMITE NULOS (NOT NULL) Y EL VALOR RESULTANTE ES NULL, ASIGNAR VALOR POR DEFECTO SEGURO
  if (cleanVal === null && !isNullable) {
    if (type.includes('date') || type.includes('time')) {
      cleanVal = new Date('1900-01-01T00:00:00');
    } else if (['int', 'bigint', 'smallint', 'tinyint', 'money', 'smallmoney', 'decimal', 'numeric', 'float', 'real', 'bit'].includes(type)) {
      cleanVal = 0;
    } else if (['char', 'nchar', 'varchar', 'nvarchar', 'text', 'ntext'].includes(type)) {
      cleanVal = '';
    } else if (type === 'uniqueidentifier') {
      cleanVal = '00000000-0000-0000-0000-000000000000';
    } else {
      cleanVal = '';
    }
  }

  return cleanVal;
}

/**
 * Sanitiza nombres de tablas y columnas para prevenir inyección SQL en consultas de metadatos.
 */
function sanitizeIdentifier(name) {
  if (!name || typeof name !== 'string') return '';
  return name.replace(/[^a-zA-Z0-9_]/g, '');
}

/**
 * Normaliza un valor de clave primaria para comparación canónica en memoria.
 * Evita falsos negativos producidos por diferencias de formato entre objetos Date, strings ISO y números.
 */
function normalizePkValue(val, colMeta) {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const dataType = (colMeta ? (colMeta.dataType || '') : '').toLowerCase();
  if (['int', 'bigint', 'smallint', 'tinyint', 'money', 'smallmoney', 'decimal', 'numeric', 'float', 'real'].includes(dataType)) {
    const num = Number(str);
    return isNaN(num) ? str : String(num);
  }
  return str.toLowerCase();
}


/**
 * Obtiene la lista de tablas de la base de datos.
 */
async function getTables(dbServer, dbName, dbUser, dbPassword) {
  const pool = await getPool(dbServer, dbName, dbUser, dbPassword);
  const result = await pool.request().query(`
    SELECT TABLE_NAME 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT IN ('sysdiagrams')
    ORDER BY TABLE_NAME
  `);
  return result.recordset.map(row => row.TABLE_NAME);
}

/**
 * Obtiene la estructura completa de una tabla (columnas, tipos, nulos, PKs, identities).
 */
async function getTableSchema(tableName, dbServer, dbName, dbUser, dbPassword) {
  const cleanTable = sanitizeIdentifier(tableName);
  if (!cleanTable) throw new Error('Nombre de tabla inválido');

  const pool = await getPool(dbServer, dbName, dbUser, dbPassword);

  // Obtener columnas y sus propiedades
  const colsResult = await pool.request().query(`
    SELECT 
      c.COLUMN_NAME,
      c.DATA_TYPE,
      c.CHARACTER_MAXIMUM_LENGTH,
      c.IS_NULLABLE,
      COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY
    FROM INFORMATION_SCHEMA.COLUMNS c
    WHERE c.TABLE_NAME = '${cleanTable}'
    ORDER BY c.ORDINAL_POSITION
  `);

  // Obtener Claves Primarias
  const pkResult = await pool.request().query(`
    SELECT kcu.COLUMN_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
      ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      AND tc.TABLE_NAME = '${cleanTable}'
    ORDER BY kcu.ORDINAL_POSITION
  `);

  const primaryKeys = pkResult.recordset.map(r => r.COLUMN_NAME);

  const columns = colsResult.recordset.map(col => ({
    name: col.COLUMN_NAME,
    dataType: col.DATA_TYPE,
    maxLength: col.CHARACTER_MAXIMUM_LENGTH,
    isNullable: col.IS_NULLABLE === 'YES',
    isIdentity: col.IS_IDENTITY === 1,
    isPk: primaryKeys.includes(col.COLUMN_NAME)
  }));

  return {
    tableName: cleanTable,
    columns,
    primaryKeys,
    hasIdentity: columns.some(c => c.isIdentity)
  };
}

/**
 * Exporta los datos de una tabla con sus metadatos y filtro WHERE opcional.
 */
async function exportTableData(tableName, whereClause, dbServer, dbName, dbUser, dbPassword) {
  const cleanTable = sanitizeIdentifier(tableName);
  if (!cleanTable) throw new Error('Nombre de tabla inválido');

  const schema = await getTableSchema(cleanTable, dbServer, dbName, dbUser, dbPassword);
  const pool = await getPool(dbServer, dbName, dbUser, dbPassword);

  let query = `SELECT * FROM [${cleanTable}]`;
  if (whereClause && whereClause.trim().length > 0) {
    const cleanWhere = whereClause.trim().replace(/;/g, '');
    query += ` WHERE ${cleanWhere}`;
  }

  const dataResult = await pool.request().query(query);

  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    server: dbServer,
    database: dbName,
    tableName: cleanTable,
    whereClause: whereClause || null,
    schema: schema,
    totalRecords: dataResult.recordset.length,
    rows: dataResult.recordset
  };
}

const exportJobs = new Map();

function createExportJob() {
  const jobId = Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const job = {
    jobId,
    status: 'running',
    totalRows: 0,
    processedRows: 0,
    percent: 0,
    filePath: null,
    fileName: null,
    fileSize: 0,
    message: '',
    startTime: Date.now(),
    endTime: null
  };
  exportJobs.set(jobId, job);
  return job;
}

function getExportJob(jobId) {
  return exportJobs.get(jobId) || null;
}

/**
 * Exporta de forma escalable (streaming) escribiendo directamente al stream de salida con seguimiento de progreso.
 */
async function exportTableStream(outputStream, tableName, whereClause, dbServer, dbName, dbUser, dbPassword, job = null) {
  const cleanTable = sanitizeIdentifier(tableName);
  if (!cleanTable) throw new Error('Nombre de tabla inválido');

  const schema = await getTableSchema(cleanTable, dbServer, dbName, dbUser, dbPassword);
  const pool = await getPool(dbServer, dbName, dbUser, dbPassword);

  let query = `SELECT * FROM [${cleanTable}]`;
  if (whereClause && whereClause.trim().length > 0) {
    const cleanWhere = whereClause.trim().replace(/;/g, '');
    query += ` WHERE ${cleanWhere}`;
  }

  // Escribir metadatos de cabecera
  const headerMeta = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    server: dbServer,
    database: dbName,
    tableName: cleanTable,
    whereClause: whereClause || null,
    schema: schema
  };

  const metaStr = JSON.stringify(headerMeta);
  outputStream.write(metaStr.substring(0, metaStr.length - 1) + ',"rows":[');

  let rowCount = 0;
  const request = pool.request();
  request.stream = true;

  return new Promise((resolve, reject) => {
    let firstRow = true;

    request.on('row', row => {
      rowCount++;
      if (job) {
        job.processedRows = rowCount;
        if (job.totalRows > 0) {
          job.percent = Math.min(99, Math.round((rowCount / job.totalRows) * 100));
        }
      }

      const rowJson = JSON.stringify(row);
      if (!firstRow) {
        outputStream.write(',' + rowJson);
      } else {
        outputStream.write(rowJson);
        firstRow = false;
      }
    });

    request.on('error', err => {
      if (job) {
        job.status = 'failed';
        job.message = err.message;
      }
      reject(err);
    });

    request.on('done', result => {
      outputStream.write(`],"totalRecords":${rowCount}}`);
      if (job) {
        job.processedRows = rowCount;
        job.percent = 100;
        job.status = 'completed';
      }
      resolve({ totalRecords: rowCount });
    });

    request.query(query);
  });
}

async function exportTableJob({ tableName, whereClause, dbServer, dbName, dbUser, dbPassword, jobId, uploadsDir }) {
  const job = exportJobs.get(jobId);
  if (!job) throw new Error('Trabajo de exportación no encontrado.');

  const cleanTable = sanitizeIdentifier(tableName);
  if (!cleanTable) throw new Error('Nombre de tabla inválido');

  const pool = await getPool(dbServer, dbName, dbUser, dbPassword);

  let countQuery = `SELECT COUNT(*) as total FROM [${cleanTable}]`;
  if (whereClause && whereClause.trim().length > 0) {
    const cleanWhere = whereClause.trim().replace(/;/g, '');
    countQuery += ` WHERE ${cleanWhere}`;
  }
  const countRes = await pool.request().query(countQuery);
  job.totalRows = countRes.recordset[0].total || 0;

  const fileName = `${cleanTable}_export_${Date.now()}.sqlpack`;
  const filePath = path.join(uploadsDir, fileName);
  job.fileName = fileName;
  job.filePath = filePath;

  const fileStream = fs.createWriteStream(filePath, { encoding: 'utf8' });

  try {
    await exportTableStream(fileStream, tableName, whereClause, dbServer, dbName, dbUser, dbPassword, job);
    fileStream.end();
    job.fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;
    job.status = 'completed';
    job.percent = 100;
    job.endTime = Date.now();
  } catch (err) {
    job.status = 'failed';
    job.message = err.message;
    throw err;
  }

  return job;
}

/**
 * Inspecciona un paquete cargado y lo compara con la tabla destino en la BD objetivo.
 */
async function inspectImportPackage(packageData, targetTableName, dbServer, dbName, dbUser, dbPassword) {
  if (!packageData || !packageData.rows || !packageData.schema) {
    throw new Error('El archivo seleccionado no posee un formato de paquete exportado válido.');
  }

  const cleanTable = sanitizeIdentifier(targetTableName || packageData.tableName);
  if (!cleanTable) throw new Error('Nombre de tabla destino inválido.');

  const targetSchema = await getTableSchema(cleanTable, dbServer, dbName, dbUser, dbPassword);
  const pool = await getPool(dbServer, dbName, dbUser, dbPassword);

  // Verificar columnas faltantes
  const targetColNames = targetSchema.columns.map(c => c.name.toLowerCase());
  const packageColNames = packageData.schema.columns.map(c => c.name);

  const missingInTarget = packageColNames.filter(c => !targetColNames.includes(c.toLowerCase()));

  // Si hay PKs, contar cuántos registros ya existen en la base destino
  let existingCount = 0;
  let newCount = packageData.rows.length;

  if (targetSchema.primaryKeys.length > 0 && packageData.rows.length > 0) {
    if (targetSchema.primaryKeys.length === 1) {
      const pk = targetSchema.primaryKeys[0];
      const pkMeta = targetColMap.get(pk.toLowerCase());
      const pkValues = packageData.rows.map(r => getRowValue(r, pk)).filter(v => v !== undefined && v !== null);

      if (pkValues.length > 0) {
        const batchSize = 1000;
        for (let i = 0; i < pkValues.length; i += batchSize) {
          const batch = pkValues.slice(i, i + batchSize);
          const request = pool.request();
          
          const inParams = [];
          batch.forEach((val, idx) => {
            const paramName = `pk_${idx}`;
            const cleanVal = sanitizeValue(val, pkMeta);
            request.input(paramName, getMssqlType(pkMeta ? pkMeta.dataType : 'nvarchar'), cleanVal);
            inParams.push(`@${paramName}`);
          });

          const checkQuery = `SELECT COUNT(*) as existing FROM [${cleanTable}] WHERE [${pk}] IN (${inParams.join(',')})`;
          const res = await request.query(checkQuery);
          existingCount += res.recordset[0].existing || 0;
        }
        newCount = Math.max(0, packageData.rows.length - existingCount);
      }
    } else {
      // Clave Primaria Compuesta (ej: Comprobantes)
      const primaryKeys = targetSchema.primaryKeys;
      const subChunkSize = Math.max(10, Math.floor(1800 / primaryKeys.length));

      for (let i = 0; i < packageData.rows.length; i += subChunkSize) {
        const batch = packageData.rows.slice(i, i + subChunkSize);
        const request = pool.request();
        const whereOrClauses = [];

        batch.forEach((row, rowIdx) => {
          const andConditions = [];
          primaryKeys.forEach((pkName, colIdx) => {
            const colMeta = targetColMap.get(pkName.toLowerCase());
            const paramName = `cp_${rowIdx}_${colIdx}`;
            const rawVal = getRowValue(row, pkName);
            const cleanVal = sanitizeValue(rawVal, colMeta);
            request.input(paramName, getMssqlType(colMeta ? colMeta.dataType : 'nvarchar'), cleanVal);
            andConditions.push(`[${pkName}] = @${paramName}`);
          });
          whereOrClauses.push(`(${andConditions.join(' AND ')})`);
        });

        if (whereOrClauses.length > 0) {
          const checkQuery = `SELECT COUNT(*) as existing FROM [${cleanTable}] WHERE ${whereOrClauses.join(' OR ')}`;
          const res = await request.query(checkQuery);
          existingCount += res.recordset[0].existing || 0;
        }
      }
      newCount = Math.max(0, packageData.rows.length - existingCount);
    }
  }

  return {
    targetTableName: cleanTable,
    totalInFile: packageData.rows.length,
    existingInTarget: existingCount,
    newInTarget: newCount,
    primaryKeys: targetSchema.primaryKeys,
    hasIdentity: targetSchema.hasIdentity,
    missingColumnsInTarget: missingInTarget,
    sourceServer: packageData.server,
    sourceDatabase: packageData.database,
    exportedAt: packageData.exportedAt
  };
}

/**
 * Obtiene el valor de una fila buscando el nombre de columna con insensibilidad a mayúsculas/minúsculas.
 */
function getRowValue(row, colName) {
  if (!row || typeof row !== 'object') return undefined;
  if (row[colName] !== undefined) return row[colName];
  const lower = colName.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === lower) return row[k];
  }
  return undefined;
}

/**
 * Procesa un registro individual de forma segura dentro de una transacción.
 */
async function processSingleRow(tx, cleanTable, targetSchema, targetColMap, primaryKeys, hasIdentity, row, importStrategy) {
  let rowExists = false;
  if (primaryKeys.length > 0) {
    const checkReq = new sql.Request(tx);
    const whereConditions = [];

    primaryKeys.forEach(pkName => {
      const colMeta = targetColMap.get(pkName.toLowerCase());
      const paramName = `pk_${sanitizeIdentifier(pkName)}`;
      const rawVal = getRowValue(row, pkName);
      const cleanVal = sanitizeValue(rawVal, colMeta);
      checkReq.input(paramName, getMssqlType(colMeta ? colMeta.dataType : 'nvarchar'), cleanVal);
      whereConditions.push(`[${pkName}] = @${paramName}`);
    });

    const checkQuery = `SELECT 1 FROM [${cleanTable}] WHERE ${whereConditions.join(' AND ')}`;
    const checkRes = await checkReq.query(checkQuery);
    rowExists = checkRes.recordset.length > 0;
  }

  if (rowExists) {
    if (importStrategy === 'skip') {
      return { action: 'skipped' };
    } else if (importStrategy === 'upsert') {
      const nonPkCols = targetSchema.columns.filter(c => !c.isPk && !c.isIdentity);
      if (nonPkCols.length === 0) {
        return { action: 'skipped' };
      }

      const updateReq = new sql.Request(tx);
      const setStatements = [];
      const whereConditions = [];

      nonPkCols.forEach(colMeta => {
        const paramName = `u_${sanitizeIdentifier(colMeta.name)}`;
        const rawVal = getRowValue(row, colMeta.name);
        const cleanVal = sanitizeValue(rawVal, colMeta);
        updateReq.input(paramName, getMssqlType(colMeta.dataType), cleanVal);
        setStatements.push(`[${colMeta.name}] = @${paramName}`);
      });

      primaryKeys.forEach(pkName => {
        const colMeta = targetColMap.get(pkName.toLowerCase());
        const paramName = `pk_${sanitizeIdentifier(pkName)}`;
        const rawVal = getRowValue(row, pkName);
        const cleanVal = sanitizeValue(rawVal, colMeta);
        updateReq.input(paramName, getMssqlType(colMeta ? colMeta.dataType : 'nvarchar'), cleanVal);
        whereConditions.push(`[${pkName}] = @${paramName}`);
      });

      const updateQuery = `UPDATE [${cleanTable}] SET ${setStatements.join(', ')} WHERE ${whereConditions.join(' AND ')}`;
      await updateReq.query(updateQuery);
      return { action: 'updated' };
    }
    return { action: 'skipped' };
  } else {
    const insertReq = new sql.Request(tx);
    const colNames = [];
    const paramNames = [];

    targetSchema.columns.forEach(colMeta => {
      if (colMeta.isIdentity && !hasIdentity) return;
      const rawVal = getRowValue(row, colMeta.name);
      if (rawVal === undefined && colMeta.isNullable) return; // Omitir opcionales no presentes

      const paramName = `in_${sanitizeIdentifier(colMeta.name)}`;
      const cleanVal = sanitizeValue(rawVal, colMeta);
      insertReq.input(paramName, getMssqlType(colMeta.dataType), cleanVal);
      colNames.push(`[${colMeta.name}]`);
      paramNames.push(`@${paramName}`);
    });

    if (colNames.length > 0) {
      const insertQuery = `INSERT INTO [${cleanTable}] (${colNames.join(', ')}) VALUES (${paramNames.join(', ')})`;
      await insertReq.query(insertQuery);
      return { action: 'inserted' };
    }
    return { action: 'skipped' };
  }
}

// Almacén de progreso de trabajos de importación
const importJobs = new Map();

function createImportJob(totalRows) {
  const jobId = Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const job = {
    jobId,
    status: 'running', // 'running' | 'completed' | 'failed'
    totalRows: totalRows || 0,
    processedRows: 0,
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    warningsCount: 0,
    percent: 0,
    warnings: [],
    message: '',
    startTime: Date.now(),
    endTime: null
  };
  importJobs.set(jobId, job);
  return job;
}

function getImportJob(jobId) {
  return importJobs.get(jobId) || null;
}

/**
 * Importa datos con garantía de preservación de datos (Cero DELETE/TRUNCATE),
 * acelerado mediante verificación de claves primarias por lote en memoria y multi-row INSERT.
 */
async function importTableData({ packageData, targetTableName, importStrategy = 'skip', dbServer, dbName, dbUser, dbPassword, jobId = null }) {
  if (!packageData || !packageData.rows || packageData.rows.length === 0) {
    if (jobId && importJobs.has(jobId)) {
      const job = importJobs.get(jobId);
      job.status = 'completed';
      job.percent = 100;
    }
    return { success: true, insertedCount: 0, updatedCount: 0, skippedCount: 0, totalProcessed: 0, warnings: [] };
  }

  const cleanTable = sanitizeIdentifier(targetTableName || packageData.tableName);
  if (!cleanTable) throw new Error('Nombre de tabla destino inválido.');

  const targetSchema = await getTableSchema(cleanTable, dbServer, dbName, dbUser, dbPassword);
  const pool = await getPool(dbServer, dbName, dbUser, dbPassword);

  const targetColMap = new Map();
  targetSchema.columns.forEach(c => targetColMap.set(c.name.toLowerCase(), c));

  const primaryKeys = targetSchema.primaryKeys;
  const hasIdentity = targetSchema.hasIdentity;
  const pkName = primaryKeys.length > 0 ? primaryKeys[0] : null;
  const pkMeta = pkName ? targetColMap.get(pkName.toLowerCase()) : null;

  // Columnas destino que participarán en el INSERT
  const insertCols = targetSchema.columns.filter(col => {
    if (col.isIdentity && !hasIdentity) return false;
    return true;
  });

  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  const warnings = [];

  const batchSize = 1000;
  const totalRows = packageData.rows.length;
  const job = jobId ? importJobs.get(jobId) : null;

  for (let i = 0; i < totalRows; i += batchSize) {
    const batchRows = packageData.rows.slice(i, i + batchSize);

    // 1. Verificación veloz de existencia de PK por lote (Soporta PKs Simples y Compuestas como en Comprobantes)
    const existingPkSet = new Set();
    if (primaryKeys.length > 0) {
      const pkValues = batchRows
        .map(row => {
          const keys = primaryKeys.map(pk => getRowValue(row, pk));
          if (keys.some(v => v === undefined || v === null)) return null;
          return keys;
        })
        .filter(v => v !== null);

      if (pkValues.length > 0) {
        if (primaryKeys.length === 1) {
          const pkName = primaryKeys[0];
          const pkMeta = targetColMap.get(pkName.toLowerCase());
          const subChunkSize = 1000;

          for (let k = 0; k < pkValues.length; k += subChunkSize) {
            const subPkList = pkValues.slice(k, k + subChunkSize);
            const req = pool.request();
            const inParams = [];

            subPkList.forEach((keys, idx) => {
              const pName = `pk_${idx}`;
              const cleanPk = sanitizeValue(keys[0], pkMeta);
              req.input(pName, getMssqlType(pkMeta ? pkMeta.dataType : 'nvarchar'), cleanPk);
              inParams.push(`@${pName}`);
            });

            const q = `SELECT [${pkName}] as pkVal FROM [${cleanTable}] WHERE [${pkName}] IN (${inParams.join(',')})`;
            const res = await req.query(q);
            res.recordset.forEach(r => {
              if (r.pkVal !== undefined && r.pkVal !== null) {
                existingPkSet.add(normalizePkValue(r.pkVal, pkMeta));
              }
            });
          }
        } else {
          // Clave Primaria Compuesta (ej: Comprobantes con Sucursal, PuntoVenta, Numero, Tipo, Fecha, Zeta, Empresa)
          const subChunkSize = Math.max(10, Math.floor(1800 / primaryKeys.length));

          for (let k = 0; k < pkValues.length; k += subChunkSize) {
            const subPkList = pkValues.slice(k, k + subChunkSize);
            const req = pool.request();
            const whereOrClauses = [];

            subPkList.forEach((keys, rowIdx) => {
              const andConditions = [];
              primaryKeys.forEach((pkName, colIdx) => {
                const colMeta = targetColMap.get(pkName.toLowerCase());
                const paramName = `cp_${rowIdx}_${colIdx}`;
                const cleanVal = sanitizeValue(keys[colIdx], colMeta);
                req.input(paramName, getMssqlType(colMeta ? colMeta.dataType : 'nvarchar'), cleanVal);
                andConditions.push(`[${pkName}] = @${paramName}`);
              });
              whereOrClauses.push(`(${andConditions.join(' AND ')})`);
            });

            const pkColsSelect = primaryKeys.map(pk => `[${pk}]`).join(', ');
            const q = `SELECT ${pkColsSelect} FROM [${cleanTable}] WHERE ${whereOrClauses.join(' OR ')}`;
            const res = await req.query(q);
            res.recordset.forEach(r => {
              const tupleKey = primaryKeys.map(pk => {
                const colMeta = targetColMap.get(pk.toLowerCase());
                return normalizePkValue(r[pk], colMeta);
              }).join('|');
              existingPkSet.add(tupleKey);
            });
          }
        }
      }
    }

    // 2. Clasificación de filas en Nuevas y Existentes
    const newRows = [];
    const existingRows = [];

    for (const row of batchRows) {
      let isExisting = false;
      if (primaryKeys.length > 0) {
        if (primaryKeys.length === 1) {
          const pkVal = getRowValue(row, primaryKeys[0]);
          if (pkVal !== undefined && pkVal !== null) {
            const pkMetaSingle = targetColMap.get(primaryKeys[0].toLowerCase());
            isExisting = existingPkSet.has(normalizePkValue(pkVal, pkMetaSingle));
          }
        } else {
          const rowTupleKey = primaryKeys.map(pk => {
            const colMeta = targetColMap.get(pk.toLowerCase());
            return normalizePkValue(getRowValue(row, pk), colMeta);
          }).join('|');
          isExisting = existingPkSet.has(rowTupleKey);
        }
      }

      if (isExisting) {
        existingRows.push(row);
      } else {
        newRows.push(row);
      }
    }


    // 3. Procesamiento de registros existentes
    if (importStrategy === 'skip') {
      skippedCount += existingRows.length;
    } else if (importStrategy === 'upsert') {
      for (const row of existingRows) {
        const tx = new sql.Transaction(pool);
        try {
          await tx.begin();
          await processSingleRow(tx, cleanTable, targetSchema, targetColMap, primaryKeys, hasIdentity, row, 'upsert');
          await tx.commit();
          updatedCount++;
        } catch (err) {
          try { await tx.rollback(); } catch (e) {}
          skippedCount++;
        }
      }
    }

    // 4. Inserción masiva multi-row para registros nuevos (Ultra veloz)
    if (newRows.length > 0) {
      const maxParamsPerStatement = 2000;
      const subInsertChunkSize = Math.max(10, Math.min(200, Math.floor(maxParamsPerStatement / Math.max(1, insertCols.length))));

      for (let m = 0; m < newRows.length; m += subInsertChunkSize) {
        const chunk = newRows.slice(m, m + subInsertChunkSize);
        const transaction = new sql.Transaction(pool);

        try {
          await transaction.begin();
          if (hasIdentity) {
            await new sql.Request(transaction).query(`SET IDENTITY_INSERT [${cleanTable}] ON`);
          }

          const insertReq = new sql.Request(transaction);
          const valueTuples = [];
          const colNames = insertCols.map(c => `[${c.name}]`);

          chunk.forEach((row, rowIdx) => {
            const paramNamesForRow = [];
            insertCols.forEach(colMeta => {
              const paramName = `r${rowIdx}_${sanitizeIdentifier(colMeta.name)}`;
              const rawVal = getRowValue(row, colMeta.name);
              const cleanVal = sanitizeValue(rawVal, colMeta);
              insertReq.input(paramName, getMssqlType(colMeta.dataType), cleanVal);
              paramNamesForRow.push(`@${paramName}`);
            });
            valueTuples.push(`(${paramNamesForRow.join(', ')})`);
          });

          const multiInsertSql = `INSERT INTO [${cleanTable}] (${colNames.join(', ')}) VALUES ${valueTuples.join(', ')}`;
          await insertReq.query(multiInsertSql);

          if (hasIdentity) {
            await new sql.Request(transaction).query(`SET IDENTITY_INSERT [${cleanTable}] OFF`);
          }

          await transaction.commit();
          insertedCount += chunk.length;
        } catch (batchErr) {
          try {
            if (hasIdentity) {
              await new sql.Request(pool).query(`SET IDENTITY_INSERT [${cleanTable}] OFF`).catch(() => {});
            }
            await transaction.rollback();
          } catch (rErr) {}

          // Fallback fila por fila si falla una inserción múltiple
          for (let j = 0; j < chunk.length; j++) {
            const singleRow = chunk[j];
            const rowNum = i + m + j + 1;
            const singleTx = new sql.Transaction(pool);
            try {
              await singleTx.begin();
              if (hasIdentity) {
                await new sql.Request(singleTx).query(`SET IDENTITY_INSERT [${cleanTable}] ON`);
              }

              const res = await processSingleRow(singleTx, cleanTable, targetSchema, targetColMap, primaryKeys, hasIdentity, singleRow, importStrategy);

              if (hasIdentity) {
                await new sql.Request(singleTx).query(`SET IDENTITY_INSERT [${cleanTable}] OFF`);
              }
              await singleTx.commit();

              if (res.action === 'inserted') insertedCount++;
              else if (res.action === 'updated') updatedCount++;
              else skippedCount++;
            } catch (singleErr) {
              try { await singleTx.rollback(); } catch (e) {}
              skippedCount++;
              if (warnings.length < 100) {
                warnings.push(`Fila ${rowNum}: ${singleErr.message}`);
              }
            }
          }
        }
      }
    }

    // Actualizar progreso del trabajo
    if (job) {
      job.processedRows = Math.min(i + batchRows.length, totalRows);
      job.insertedCount = insertedCount;
      job.updatedCount = updatedCount;
      job.skippedCount = skippedCount;
      job.warningsCount = warnings.length;
      job.warnings = warnings;
      job.percent = Math.round((job.processedRows / totalRows) * 100);
    }
  }

  if (job) {
    job.status = 'completed';
    job.percent = 100;
    job.endTime = Date.now();
  }

  return {
    success: true,
    insertedCount,
    updatedCount,
    skippedCount,
    warningsCount: warnings.length,
    totalProcessed: totalRows,
    warnings
  };
}

module.exports = {
  getTables,
  getTableSchema,
  exportTableData,
  exportTableStream,
  exportTableJob,
  inspectImportPackage,
  importTableData,
  createImportJob,
  getImportJob,
  createExportJob,
  getExportJob
};
