const ExcelJS = require('exceljs');

/**
 * Lee las cabeceras (primera fila con valores) de la primera hoja de un archivo Excel.
 */
async function readExcelHeaders(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];
  
  if (!worksheet) {
    throw new Error('El archivo Excel no contiene ninguna hoja.');
  }

  let headers = [];
  let firstRow = null;

  // Buscar la primera fila que contiene valores
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (!firstRow) {
      firstRow = row;
    }
  });

  if (!firstRow) {
    throw new Error('No se encontraron filas con datos en la primera hoja del Excel.');
  }

  firstRow.eachCell({ includeEmpty: false }, (cell) => {
    const value = cell.value;
    if (value !== null && value !== undefined) {
      // En caso de que la celda contenga una fórmula u objeto
      if (typeof value === 'object' && value.text) {
        headers.push(value.text.trim());
      } else {
        headers.push(value.toString().trim());
      }
    }
  });

  return headers;
}

/**
 * Lee todas las filas de la primera hoja y las mapea según el objeto de asociación.
 * Devuelve una lista de objetos con las claves y valores de destino.
 */
async function readExcelRows(filePath, mapping) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error('El archivo Excel no contiene ninguna hoja.');
  }

  let headers = [];
  let firstRowNumber = -1;

  // Identificar la fila de cabecera y las posiciones
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (firstRowNumber === -1) {
      firstRowNumber = rowNumber;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = cell.value;
        let headerText = '';
        if (val !== null && val !== undefined) {
          if (typeof val === 'object' && val.text) {
            headerText = val.text.trim();
          } else {
            headerText = val.toString().trim();
          }
        }
        headers[colNumber] = headerText; // Columnas de celdas basadas en índice 1
      });
    }
  });

  if (firstRowNumber === -1) {
    throw new Error('No se encontraron datos en el archivo.');
  }

  const results = [];

  // Leer las filas de datos comenzando desde la fila posterior a la cabecera
  worksheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (rowNumber <= firstRowNumber) return; // omitir cabecera y filas vacías anteriores

    const rawRow = {};
    let hasData = false;

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const headerName = headers[colNumber];
      if (headerName) {
        let value = cell.value;
        // Resolver fórmulas, textos de enlaces, etc.
        if (value !== null && value !== undefined) {
          if (typeof value === 'object') {
            if (value.formula) {
              value = value.result !== undefined ? value.result : null;
            } else if (value.text) {
              value = value.text;
            } else if (value.richText) {
              value = value.richText.map(t => t.text).join('');
            }
          }
          rawRow[headerName] = value;
          hasData = true;
        } else {
          rawRow[headerName] = null;
        }
      }
    });

    if (hasData) {
      // Mapear los campos de la fila original a los campos del ERP según el mapeo del usuario
      const mappedRow = {};
      
      // Iterar sobre las claves de destino definidas en el mapeo
      for (const [targetKey, sourceHeader] of Object.entries(mapping)) {
        if (sourceHeader && rawRow[sourceHeader] !== undefined) {
          mappedRow[targetKey] = rawRow[sourceHeader];
        } else {
          mappedRow[targetKey] = null;
        }
      }

      // Preservar el índice de la fila en Excel para referencia
      mappedRow._rowNum = rowNumber;
      results.push(mappedRow);
    }
  });

  return results;
}

module.exports = {
  readExcelHeaders,
  readExcelRows
};
