# Importador de Artículos ERP - Asistente Inteligente

Herramienta web interna diseñada para técnicos que permite importar artículos desde planillas de Excel (.xlsx) provenientes de sistemas anteriores y convertirlos automáticamente al formato estructurado de base de datos SQL Server ERP, validando reglas de negocio específicas.

## Características

- **Conexión Dinámica a SQL Server**: Entrada para ingresar el servidor y nombre de la base de datos de manera dinámica, utilizando credenciales preestablecidas (`sa` / `LaCrujia_3261`).
- **Mapeo Inteligente de Columnas**: Auto-detección automática de nombres comunes de columnas ("costo", "pvp", "descripcion", etc.) con interfaz manual para corregir.
- **Detección Automática de Pesables**:
  - Busca palabras clave en la descripción (`KG`, `XKG`, `POR KG`, `PRECIO KG`).
  - Si es pesable, configura `Tipo = 'P'`, `HabilBalanzas = 1`, asigna el PLU original a `BalCodigo` y genera el EAN12 en formato `20 + CodigoInterno (5 dígitos) + 00000`.
- **Limpieza de EANs**: Limpia códigos de 13 dígitos eliminando el último dígito verificador. Genera automáticamente códigos `779 + CodigoInterno` para no pesables si no tienen EAN.
- **Fusión (Merge) de Departamentos (Rubros)**: Mapea rubros textuales o numéricos a códigos de departamento válidos en SQL Server mediante alias comunes o búsqueda case-insensitive.
- **Cálculo de Márgenes**: Calcula automáticamente el margen del producto mediante `((Venta - Costo) / Venta) * 100`.
- **Validaciones en Tiempo Real**:
  - EANs y descripciones duplicadas (tanto en el archivo como en la base de datos existente).
  - Precios de venta menores al costo (Advertencia).
  - Códigos duplicados y PLUs de balanza en conflicto.
- **Grilla de Previsualización Avanzada**: Permite editar valores directamente haciendo doble clic en la celda para subsanar errores antes de insertar en la base de datos.
- **Transaccional**: Las operaciones de inserción masiva a SQL Server se ejecutan de manera transaccional. En caso de fallar, se realiza un rollback automático para no corromper la base de datos.

---

## Estructura del Proyecto

El proyecto está organizado en:
- `backend/`: API REST escrita en Node.js + Express que procesa el Excel y se comunica con SQL Server.
- `frontend/`: Aplicación Single Page (SPA) escrita en Vue 3 + PrimeVue.

---

## Requisitos Previos

1. **Node.js** v18 o superior.
2. **Microsoft SQL Server** con el usuario `sa` y la contraseña `LaCrujia_3261` habilitada y con permisos de escritura/lectura.

---

## Configuración y Ejecución

### 1. Servidor Backend
Abra una terminal en la carpeta `backend/` y ejecute:
```bash
npm install
npm run start
```
El servidor backend se iniciará en `http://localhost:3000`.

### 2. Aplicación Frontend
Abra otra terminal en la carpeta `frontend/` y ejecute:
```bash
npm install
npm run dev
```
La aplicación web se ejecutará y estará disponible en el puerto indicado por Vite (por ejemplo: `http://localhost:5173`).

---

## Reglas de Negocio Implementadas

- **Pesables**:
  - `Tipo = 'P'`
  - `HabilBalanzas = 1`
  - `BalCodigo = Codigo`
  - EAN: `20 + Codigo (5 dígitos) + 00000`
- **No Pesables**:
  - `Tipo = 'N'`
  - `HabilBalanzas = 0`
  - EAN de 13 dígitos: se quita el último número (dígito verificador) guardando 12.
  - Sin EAN: se genera `779 + Codigo` rellenando con ceros a la izquierda para completar 12 dígitos.
- **Departamento**: Mapeo dinámico y aliases inteligentes.
- **IVA**: Asociación a los códigos de la tabla `TablaIVA` de la base de datos de manera inteligente.
- **Valores por defecto**: Completa automáticamente los 50 campos de la base de datos con los defaults establecidos.
