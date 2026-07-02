const { getPool } = require('../config/database');

// Mapeo de alias basados en descripción hacia el nombre del departamento destino en la base de datos
const RUBRO_NAME_ALIASES = {
  'VERDULERIA': 'FRUTAS Y VERDURAS',
  'VERDURAS': 'FRUTAS Y VERDURAS',
  'FRUTERIA': 'FRUTAS Y VERDURAS',
  'FIAMBRERIA': 'FIAMBRES Y QUESOS',
  'QUESERIA': 'FIAMBRES Y QUESOS',
  'QUESOS': 'FIAMBRES Y QUESOS',
  'FIAMBRES': 'FIAMBRES Y QUESOS',
  'BEBIDAS SIN ALC': 'BEBIDAS',
  'BEBIDAS CON ALC': 'BEBIDAS',
  'GASEOSAS': 'BEBIDAS',
  'LACTEOS Y FRESCOS': 'LACTEOS'
};

/**
 * Analiza la descripción para verificar si el artículo es pesable.
 */
function isPesableDescription(desc) {
  if (!desc) return false;
  const upperDesc = desc.toString().toUpperCase();
  const searchTerms = ['XKG', 'KG', 'POR KG', 'PRECIO KG'];
  
  // Verifica si contiene límites de palabra o sufijos específicos para prevenir coincidencias incorrectas como "KILOGRAMS"
  // pero manteniéndolo simple según los ejemplos de las instrucciones: "XKG", "xKG", "KG", "POR KG", "PRECIO KG"
  return searchTerms.some(term => {
    if (term === 'KG') {
      // Evita coincidir con palabras como "PACKING" o "BACKGROUND" solo porque contienen "KG"
      // Verifica si tiene " KG" o "KG " o "KG" al final, o exactamente "KG"
      return upperDesc === 'KG' || 
             upperDesc.includes(' KG') || 
             upperDesc.includes('KG ') || 
             upperDesc.endsWith('KG') || 
             upperDesc.includes('XKG') || 
             upperDesc.includes('X KG');
    }
    return upperDesc.includes(term);
  });
}

/**
 * Normaliza y limpia el código EAN, eliminando el 13.º dígito verificador si tiene 13 dígitos.
 */
function cleanEan(ean) {
  if (ean === null || ean === undefined || ean === '') return '';
  // Convierte a cadena de texto y elimina espacios
  let eanStr = ean.toString().replace(/\s+/g, '');
  
  // Si está almacenado en notación científica (ej. 7.79e12), lo parsea
  if (eanStr.toLowerCase().includes('e')) {
    const num = Number(eanStr);
    if (!isNaN(num)) {
      eanStr = num.toFixed(0);
    }
  }

  // Remueve decimales sobrantes si los hay (ej., "779123456789.0")
  if (eanStr.includes('.')) {
    eanStr = eanStr.split('.')[0];
  }

  if (eanStr.length === 13) {
    return eanStr.slice(0, 12); // Remueve el último dígito
  }
  return eanStr;
}

/**
 * Elimina el símbolo $, espacios, y parsea correctamente el formato de moneda.
 */
function parseMoney(val) {
  if (val === null || val === undefined || val === '') return 0;
  
  let str = val.toString().trim().replace(/\$/g, '').replace(/\s+/g, '');
  
  // Si contiene tanto puntos como comas, ej. "1.234,56"
  if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(/,/g, '.');
  }
  
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Reemplaza comillas dobles, comillas simples y acentos graves en las descripciones con espacios.
 */
function cleanDescription(desc) {
  if (!desc) return '';
  return desc.toString().replace(/["'`]/g, ' ').trim();
}

/**
 * Normaliza el texto eliminando acentos/diacríticos y convirtiéndolo a mayúsculas.
 */
function normalizeText(text) {
  if (text === null || text === undefined) return '';
  return text.toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remueve acentos/diacríticos
    .toUpperCase()
    .trim();
}

/**
 * Valida y convierte el valor de IVA de Excel para coincidir con TablaIVA.
 */
function matchIvaCode(excelIva, dbIvas) {
  if (excelIva === null || excelIva === undefined || excelIva === '') {
    return { code: 1, percentage: 21.0, error: false }; // por defecto 21% -> código 1
  }

  // Remueve %, espacios, etc.
  let valueStr = excelIva.toString().replace(/%/g, '').replace(/,/g, '.').trim();
  let val = parseFloat(valueStr);

  if (isNaN(val)) {
    return { code: 0, percentage: 0.0, error: false }; // No numérico -> código 0
  }

  // Excel podría guardar 21% como 0.21 o 10.5% como 0.105
  if (val > 0 && val < 1) {
    val = val * 100;
  }

  val = Math.round(val * 100) / 100;

  if (Math.abs(val - 21.0) < 0.1) {
    return { code: 1, percentage: 21.0, error: false };
  } else if (Math.abs(val - 10.5) < 0.1) {
    return { code: 2, percentage: 10.5, error: false };
  }

  // Cualquier otra cosa -> código 0
  return { code: 0, percentage: val, error: false };
}

/**
 * Mapea el Rubro de Excel al código de Departamento de la base de datos.
 */
function matchDepartmentCode(excelRubro, dbDeptos) {
  if (excelRubro === null || excelRubro === undefined || excelRubro === '') {
    return { code: 0, name: 'NO ASIGNADO', warning: false };
  }

  const rubroStr = excelRubro.toString().trim();
  const rubroNorm = normalizeText(rubroStr);

  // 1. Primero mapea al alias de descripción destino si existe
  let searchNameNorm = rubroNorm;
  if (RUBRO_NAME_ALIASES[rubroNorm]) {
    searchNameNorm = normalizeText(RUBRO_NAME_ALIASES[rubroNorm]);
  }

  // 2. Intenta coincidencia exacta de descripción usando texto normalizado
  const matchDesc = dbDeptos.find(d => normalizeText(d.Descripcion) === searchNameNorm);
  if (matchDesc) {
    return { code: matchDesc.Codigo, name: matchDesc.Descripcion, warning: false };
  }

  // 3. Intenta coincidencia exacta por código si el Rubro de Excel es un número
  const rubroNum = parseInt(rubroStr, 10);
  if (!isNaN(rubroNum)) {
    const match = dbDeptos.find(d => d.Codigo === rubroNum);
    if (match) {
      return { code: match.Codigo, name: match.Descripcion, warning: false };
    }
  }

  // 4. Intenta coincidencia parcial/fuzzy en descripciones normalizadas
  const matchFuzzy = dbDeptos.find(d => {
    const dbNameNorm = normalizeText(d.Descripcion);
    return searchNameNorm.includes(dbNameNorm) || dbNameNorm.includes(searchNameNorm);
  });
  if (matchFuzzy) {
    return { code: matchFuzzy.Codigo, name: matchFuzzy.Descripcion, warning: false };
  }

  // Si no se encuentra, por defecto asigna 0
  return { 
    code: 0, 
    name: 'NO ASIGNADO', 
    warning: true, 
    message: `Rubro '${rubroStr}' no encontrado. Se asignó Código 0 por defecto.` 
  };
}

/**
 * Valida y procesa un lote de filas.
 */
async function processRows(rows, dbServer, dbName, dbUser, dbPassword) {
  let pool;
  let dbIvas = [];
  let dbDeptos = [];
  let maxDbCode = 0;
  
  // Diccionarios para verificaciones rápidas de existencia en la base de datos
  const existingCodigos = new Set();
  const existingEans = new Set();
  const existingPLUs = new Set();
  const existingDescripciones = new Map(); // Descripcion -> Codigo

  try {
    pool = await getPool(dbServer, dbName, dbUser, dbPassword);
    
    // Obtiene los departamentos
    const deptosResult = await pool.request().query('SELECT Codigo, Descripcion FROM Departamentos');
    dbDeptos = deptosResult.recordset;

    // Obtiene las tasas de IVA
    const ivasResult = await pool.request().query('SELECT Codigo, Porcentaje FROM TablaIVA');
    dbIvas = ivasResult.recordset;

    // Obtiene los artículos existentes para prevenir duplicados
    const articlesResult = await pool.request().query('SELECT Codigo, EAN, Descripcion, BalCodigo FROM Articulos');
    articlesResult.recordset.forEach(row => {
      if (row.Codigo) {
        existingCodigos.add(row.Codigo);
        if (row.Codigo > maxDbCode) {
          maxDbCode = row.Codigo;
        }
      }
      if (row.EAN) {
        // El EAN en SQL es de tipo money, lo convierte a formato de texto estándar (12 u 8 dígitos)
        const eanVal = Math.round(row.EAN).toString();
        if (eanVal !== '0') {
          existingEans.add(eanVal);
        }
      }
      if (row.BalCodigo) existingPLUs.add(row.BalCodigo);
      if (row.Descripcion) {
        existingDescripciones.set(row.Descripcion.toUpperCase().trim(), row.Codigo);
      }
    });

  } catch (err) {
    console.error('Error fetching database constraints/references:', err);
    throw new Error(`Error de conexión o consulta de base de datos: ${err.message}`);
  }

  // Sets de seguimiento para duplicados dentro del propio archivo subido
  const fileCodigos = new Set();
  const fileEans = new Set();
  const filePLUs = new Set();
  const fileDescripciones = new Set();

  // Encuentra el código máximo tanto en la BD como en el Excel para evitar colisiones
  let currentMaxCode = maxDbCode;
  for (const row of rows) {
    if (row.CodigoInterno !== null && row.CodigoInterno !== undefined && row.CodigoInterno !== '') {
      const codeNum = parseInt(row.CodigoInterno, 10);
      if (!isNaN(codeNum) && codeNum > currentMaxCode) {
        currentMaxCode = codeNum;
      }
    }
  }

  const processedRows = [];

  for (const row of rows) {
    const rawCode = row.CodigoInterno;
    const rawDesc = row.Descripcion ? row.Descripcion.toString().trim() : '';
    const rawEan = row.EAN;
    const rawCosto = row.PrecioCosto;
    const rawVenta = row.PrecioVenta;
    const rawIva = row.IVA;
    const rawRubro = row.Rubro;
    const rawFamilia = row.Familia;
    const rawSubFamilia = row.SubFamilia;

    const rowNum = row._rowNum;

    // Estructura de salida para este registro
    const record = {
      _rowNum: rowNum,
      
      // Campos mapeados
      Codigo: null,
      EAN: '',
      Descripcion: rawDesc,
      DescripcionCorta: '',
      PrecioCosto: 0,
      PrecioVenta: 0,
      Margen: 0,
      IVA: 1, // Código por defecto
      Proveedor: 1,
      Departamento: 1,
      Marca: 1,
      Familia: 0,
      SubFamilia: 0,
      UxB: 1,
      HabilBalanzas: false,
      BalCodigo: 0,
      Tipo: 'N',
      
      // Valores por defecto
      EsCombo: false,
      HabilCajas: true,
      HabilEstad: true,
      HabilStock: true,
      HabilOC: true,
      BalDiasVto: 0,
      CodigoEnvase: 0,
      Transmitido: false,
      Deposito: 0,
      PresentacionCantidad: 1,
      PresentacionUnidad: 'UN',
      Ruteo: '',
      Alfa: '',
      Peso: 0,
      StockMinimo: 0,
      CxB: 1,
      DescuentoXCaja: 0,
      ImpInterno: 0,
      ArMargenTeorico: 0,
      CuentaContable: 100000053,
      DiasAlVto: 0,
      MargenIIBB: 0,
      MargenOtrosImp: 0,
      ModeloEtiqueta: 'ET_GONDOLA',
      CantidadEtiquetas: 1,
      CxP: 1,
      CxPP: 1,
      GeneraRemitoComponentes: false,
      Serializado: false,
      Sector: 1,
      
      // Estado
      status: 'success', // success, warning, error
      messages: [] // Matriz de { type: 'error'|'warning', text: '...' }
    };

    // 1. Validar / Generar Código
    let codeNum = null;
    let resolvedCode = rawCode;

    // Si no hay un Código Interno explícito mapeado pero tenemos un EAN corto, lo usa como Código Interno
    if ((resolvedCode === null || resolvedCode === undefined || resolvedCode === '') && rawEan) {
      const eanClean = rawEan.toString().trim();
      const parsed = parseInt(eanClean, 10);
      if (!isNaN(parsed) && parsed > 0 && eanClean.length <= 6) {
        resolvedCode = parsed;
      }
    }

    const isFromEanFallback = (rawCode === null || rawCode === undefined || rawCode === '') && (resolvedCode !== null && resolvedCode !== undefined && resolvedCode !== '');

    if (resolvedCode !== null && resolvedCode !== undefined && resolvedCode !== '') {
      const cleanCodeStr = resolvedCode.toString().trim().replace(/\s+/g, '');
      const parsedVal = parseInt(cleanCodeStr, 10);
      
      if (!isNaN(parsedVal) && parsedVal > 0 && parsedVal <= 2147483647 && cleanCodeStr.length <= 9) {
        // Si se resolvió a partir del EAN, verifica si ya existe en la base de datos.
        // Si existe, no debe usarse como código para evitar colisiones. Hace fallback a autogenerar.
        if (isFromEanFallback && existingCodigos.has(parsedVal)) {
          currentMaxCode++;
          codeNum = currentMaxCode;
        } else {
          codeNum = parsedVal;
        }
      } else {
        // Es un EAN estándar o demasiado grande. Se autogenera el Código Interno.
        currentMaxCode++;
        codeNum = currentMaxCode;
        record.messages.push({ type: 'warning', text: `El valor de código '${resolvedCode}' es un EAN o excede el límite. Se autogeneró el Código ${codeNum}.` });
        if (record.status !== 'error') record.status = 'warning';
      }
    } else {
      // Autogenerar código
      currentMaxCode++;
      codeNum = currentMaxCode;
      record.messages.push({ type: 'warning', text: `Código Interno no provisto. Se autogeneró el Código ${codeNum}.` });
      if (record.status !== 'error') record.status = 'warning';
    }

    if (codeNum && record.status !== 'error') {
      record.Codigo = codeNum;
      
      // Verificar duplicados en la base de datos
      if (existingCodigos.has(codeNum)) {
        record.messages.push({ type: 'error', text: `El Código Interno ${codeNum} ya existe en la base de datos.` });
        record.status = 'error';
      }
      
      // Verificar duplicados en el archivo
      if (fileCodigos.has(codeNum)) {
        record.messages.push({ type: 'error', text: `El Código Interno ${codeNum} está duplicado en el archivo Excel.` });
        record.status = 'error';
      }
      fileCodigos.add(codeNum);
    }

    // 2. Validar Descripción
    if (!rawDesc) {
      record.messages.push({ type: 'error', text: 'La Descripción es obligatoria.' });
      record.status = 'error';
    } else {
      const cleanedDesc = cleanDescription(rawDesc);
      record.Descripcion = cleanedDesc.slice(0, 50); // limita a 50 caracteres según el campo nvarchar(50) de la base de datos
      record.DescripcionCorta = cleanedDesc.slice(0, 20); // limita a 20 caracteres para DescripcionCorta

      const descUpper = cleanedDesc.toUpperCase().trim();
      
      // Verificar duplicados en la base de datos
      if (existingDescripciones.has(descUpper)) {
        const existingCode = existingDescripciones.get(descUpper);
        if (record.Codigo !== existingCode) {
          record.messages.push({ type: 'warning', text: `La descripción ya existe en la base de datos (Código ${existingCode}).` });
          if (record.status !== 'error') record.status = 'warning';
        }
      }
      
      // Verificar duplicados en el archivo
      if (fileDescripciones.has(descUpper)) {
        record.messages.push({ type: 'warning', text: `La descripción está duplicada en el archivo Excel.` });
        if (record.status !== 'error') record.status = 'warning';
      }
      fileDescripciones.add(descUpper);
    }

    // 3. Procesar costo y precio
    let price = 0;

    if (rawVenta !== null && rawVenta !== undefined && rawVenta !== '') {
      price = parseMoney(rawVenta);
    } else {
      record.messages.push({ type: 'warning', text: 'Precio Venta no provisto. Se asignó 0 por defecto.' });
      if (record.status !== 'error') record.status = 'warning';
      price = 0;
    }
    record.PrecioVenta = price;

    // El costo siempre es un 50% menor al de venta
    let cost = price * 0.5;
    record.PrecioCosto = cost;

    // Advertencia si Venta < Costo
    if (price > 0 && cost > 0 && price < cost) {
      record.messages.push({ type: 'warning', text: `El precio de venta ($${price}) es menor al precio de costo ($${cost}).` });
      if (record.status !== 'error') record.status = 'warning';
    }

    // 4. Procesar Pesables vs No Pesables y EAN
    const isPesable = isPesableDescription(record.Descripcion);

    if (isPesable) {
      record.Tipo = 'P';
      record.HabilBalanzas = true;
      
      // Determina el código PLU a partir del EAN o Código
      let plu = 0;
      if (rawEan !== null && rawEan !== undefined && rawEan !== '') {
        const parsedEanPlu = parseInt(rawEan.toString().replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsedEanPlu) && parsedEanPlu > 0 && parsedEanPlu <= 99999) {
          plu = parsedEanPlu;
        }
      }
      if (!plu && rawCode !== null && rawCode !== undefined && rawCode !== '') {
        const parsedCodePlu = parseInt(rawCode.toString().replace(/[^0-9]/g, ''), 10);
        if (!isNaN(parsedCodePlu) && parsedCodePlu > 0 && parsedCodePlu <= 99999) {
          plu = parsedCodePlu;
        }
      }
      if (!plu && record.Codigo) {
        plu = record.Codigo % 100000;
      }

      record.BalCodigo = plu;

      // EAN generado: 20 + BalCodigo (con padding de 5 dígitos) + 00000
      const pluPadded = String(plu).padStart(5, '0');
      record.EAN = `20${pluPadded}00000`; // 12 dígitos

      // Verificar duplicados de PLU
      if (record.BalCodigo > 0) {
        if (existingPLUs.has(record.BalCodigo)) {
          record.messages.push({ type: 'error', text: `El PLU de balanza ${record.BalCodigo} ya existe en la base de datos.` });
          record.status = 'error';
        }
        if (filePLUs.has(record.BalCodigo)) {
          record.messages.push({ type: 'error', text: `El PLU de balanza ${record.BalCodigo} está duplicado en el archivo Excel.` });
          record.status = 'error';
        }
        filePLUs.add(record.BalCodigo);
      }

    } else {
      // No pesable
      record.Tipo = 'N';
      record.HabilBalanzas = false;
      record.BalCodigo = 0;

      let cleanedEanVal = cleanEan(rawEan);

      if (cleanedEanVal) {
        // Asegura que sea numérico
        if (/^\d+$/.test(cleanedEanVal)) {
          record.EAN = cleanedEanVal;
        } else {
          record.messages.push({ type: 'warning', text: `El EAN '${cleanedEanVal}' contiene caracteres no numéricos. Se conservará pero verifique.` });
          if (record.status !== 'error') record.status = 'warning';
          record.EAN = cleanedEanVal;
        }
      } else {
        // Generar EAN: 779 + Código Interno completado con ceros hasta 12 dígitos en total
        if (record.Codigo) {
          record.EAN = '779' + String(record.Codigo).padStart(9, '0');
        } else {
          record.EAN = '';
        }
      }
    }

    // Validar duplicados de EAN
    if (record.EAN) {
      if (existingEans.has(record.EAN)) {
        record.messages.push({ type: 'error', text: `El EAN ${record.EAN} ya existe en la base de datos.` });
        record.status = 'error';
      }
      if (fileEans.has(record.EAN)) {
        record.messages.push({ type: 'error', text: `El EAN ${record.EAN} está duplicado en el archivo Excel.` });
        record.status = 'error';
      }
      fileEans.add(record.EAN);
    }

    // 5. Procesar Departamento / Rubro
    const deptoResult = matchDepartmentCode(rawRubro, dbDeptos);
    record.Departamento = deptoResult.code;
    if (deptoResult.warning) {
      record.messages.push({ type: 'warning', text: deptoResult.message });
      if (record.status !== 'error') record.status = 'warning';
    }

    // 6. Procesar IVA
    const ivaResult = matchIvaCode(rawIva, dbIvas);
    if (ivaResult.error) {
      record.messages.push({ type: 'error', text: ivaResult.message });
      record.status = 'error';
      record.IVA = 1; // Fallback
    } else {
      record.IVA = ivaResult.code;
    }

    // El margen no se calcula, el cliente lo asignará después. Por defecto 0.
    record.Margen = 0;

    // 7. Procesar Familia y SubFamilia
    if (rawFamilia !== null && rawFamilia !== undefined && rawFamilia !== '') {
      const famNum = parseInt(rawFamilia, 10);
      record.Familia = isNaN(famNum) ? 0 : famNum;
    } else {
      record.Familia = 0;
    }

    if (rawSubFamilia !== null && rawSubFamilia !== undefined && rawSubFamilia !== '') {
      const subFamNum = parseInt(rawSubFamilia, 10);
      record.SubFamilia = isNaN(subFamNum) ? 0 : subFamNum;
    } else {
      record.SubFamilia = 0;
    }

    processedRows.push(record);
  }

  return processedRows;
}

module.exports = {
  isPesableDescription,
  cleanEan,
  matchIvaCode,
  matchDepartmentCode,
  processRows
};
