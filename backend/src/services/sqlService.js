const { getPool, sql } = require('../config/database');

/**
 * Inserta la lista de artículos en SQL Server de manera transaccional.
 */
async function insertArticulos(articulos, dbServer, dbName, dbUser, dbPassword) {
  if (!articulos || articulos.length === 0) {
    return { success: true, count: 0 };
  }

  const pool = await getPool(dbServer, dbName, dbUser, dbPassword);
  const transaction = new sql.Transaction(pool);
  
  await transaction.begin();
  
  try {
    for (const art of articulos) {
      const request = new sql.Request(transaction);
      
      // Establece los 50 parámetros
      request.input('Codigo', sql.Int, art.Codigo);
      request.input('EAN', sql.Money, parseFloat(art.EAN) || 0);
      request.input('Descripcion', sql.NVarChar(50), art.Descripcion || '');
      request.input('DescripcionCorta', sql.NVarChar(20), art.DescripcionCorta || '');
      request.input('PrecioCosto', sql.Money, art.PrecioCosto || 0);
      request.input('PrecioVenta', sql.Money, art.PrecioVenta || 0);
      request.input('Margen', sql.Money, art.Margen || 0);
      request.input('IVA', sql.Int, art.IVA || 1);
      request.input('EsCombo', sql.Bit, art.EsCombo ? 1 : 0);
      request.input('Proveedor', sql.Int, art.Proveedor || 1);
      request.input('Departamento', sql.Int, art.Departamento || 1);
      request.input('Marca', sql.Int, art.Marca || 1);
      request.input('Familia', sql.Int, art.Familia || 0);
      request.input('UxB', sql.Money, art.UxB || 1);
      request.input('HabilCajas', sql.Bit, art.HabilCajas ? 1 : 0);
      request.input('HabilEstad', sql.Bit, art.HabilEstad ? 1 : 0);
      request.input('HabilStock', sql.Bit, art.HabilStock ? 1 : 0);
      request.input('HabilOC', sql.Bit, art.HabilOC ? 1 : 0);
      request.input('HabilBalanzas', sql.Bit, art.HabilBalanzas ? 1 : 0);
      request.input('BalDiasVto', sql.Int, art.BalDiasVto || 0);
      request.input('BalCodigo', sql.Int, art.BalCodigo || 0);
      request.input('Tipo', sql.NVarChar(1), art.Tipo || 'N');
      request.input('CodigoEnvase', sql.Int, art.CodigoEnvase || 0);
      
      const now = new Date();
      request.input('FechaModificacion', sql.SmallDateTime, now);
      request.input('FechaAlta', sql.SmallDateTime, now);
      
      const timeStr = now.toTimeString().split(' ')[0]; // HH:mm:ss
      request.input('HoraModificacion', sql.NVarChar(8), timeStr);
      
      request.input('Transmitido', sql.Bit, art.Transmitido ? 1 : 0);
      request.input('Deposito', sql.Int, art.Deposito || 0);
      request.input('PresentacionCantidad', sql.Money, art.PresentacionCantidad || 1);
      request.input('PresentacionUnidad', sql.NVarChar(2), art.PresentacionUnidad || 'UN');
      request.input('Ruteo', sql.NVarChar(200), art.Ruteo || '');
      request.input('Alfa', sql.NVarChar(20), art.Alfa || '');
      request.input('Peso', sql.Money, art.Peso || 0);
      request.input('StockMinimo', sql.Money, art.StockMinimo || 0);
      request.input('CxB', sql.Money, art.CxB || 1);
      request.input('DescuentoXCaja', sql.Money, art.DescuentoXCaja || 0);
      request.input('ImpInterno', sql.Money, art.ImpInterno || 0);
      request.input('ArMargenTeorico', sql.Money, art.ArMargenTeorico || 0);
      request.input('CuentaContable', sql.Money, art.CuentaContable || 100000053);
      request.input('SubFamilia', sql.Int, art.SubFamilia || 0);
      request.input('DiasAlVto', sql.Int, art.DiasAlVto || 0);
      request.input('MargenIIBB', sql.Money, art.MargenIIBB || 0);
      request.input('MargenOtrosImp', sql.Money, art.MargenOtrosImp || 0);
      request.input('ModeloEtiqueta', sql.NVarChar(50), art.ModeloEtiqueta || 'ET_GONDOLA');
      request.input('CantidadEtiquetas', sql.Int, art.CantidadEtiquetas || 1);
      request.input('CxP', sql.Int, art.CxP || 1);
      request.input('CxPP', sql.Int, art.CxPP || 1);
      request.input('GeneraRemitoComponentes', sql.Bit, art.GeneraRemitoComponentes ? 1 : 0);
      request.input('Serializado', sql.Bit, art.Serializado ? 1 : 0);
      request.input('Sector', sql.Int, art.Sector || 1);

      await request.query(`
        INSERT INTO Articulos (
          Codigo, EAN, Descripcion, DescripcionCorta, PrecioCosto, PrecioVenta, Margen, IVA, EsCombo, Proveedor,
          Departamento, Marca, Familia, UxB, HabilCajas, HabilEstad, HabilStock, HabilOC, HabilBalanzas, BalDiasVto,
          BalCodigo, Tipo, CodigoEnvase, FechaModificacion, FechaAlta, HoraModificacion, Transmitido, Deposito,
          PresentacionCantidad, PresentacionUnidad, Ruteo, Alfa, Peso, StockMinimo, CxB, DescuentoXCaja, ImpInterno,
          ArMargenTeorico, CuentaContable, SubFamilia, DiasAlVto, MargenIIBB, MargenOtrosImp, ModeloEtiqueta,
          CantidadEtiquetas, CxP, CxPP, GeneraRemitoComponentes, Serializado, Sector
        ) VALUES (
          @Codigo, @EAN, @Descripcion, @DescripcionCorta, @PrecioCosto, @PrecioVenta, @Margen, @IVA, @EsCombo, @Proveedor,
          @Departamento, @Marca, @Familia, @UxB, @HabilCajas, @HabilEstad, @HabilStock, @HabilOC, @HabilBalanzas, @BalDiasVto,
          @BalCodigo, @Tipo, @CodigoEnvase, @FechaModificacion, @FechaAlta, @HoraModificacion, @Transmitido, @Deposito,
          @PresentacionCantidad, @PresentacionUnidad, @Ruteo, @Alfa, @Peso, @StockMinimo, @CxB, @DescuentoXCaja, @ImpInterno,
          @ArMargenTeorico, @CuentaContable, @SubFamilia, @DiasAlVto, @MargenIIBB, @MargenOtrosImp, @ModeloEtiqueta,
          @CantidadEtiquetas, @CxP, @CxPP, @GeneraRemitoComponentes, @Serializado, @Sector
        )
      `);
    }

    await transaction.commit();
    return { success: true, count: articulos.length };
  } catch (err) {
    await transaction.rollback();
    console.error('Error durante la transacción de inserción:', err);
    throw err;
  }
}

module.exports = {
  insertArticulos
};
