# Importador de Artículos ERP - Asistente Inteligente

Herramienta web interna de escritorio diseñada para técnicos de soporte. Permite importar artículos desde planillas de Excel (`.xlsx`) provenientes de sistemas anteriores y convertirlos automáticamente al formato estructurado de base de datos SQL Server de nuestro ERP, aplicando reglas de negocio complejas en segundos.


## ✨ Características

- **Conexión Dinámica a SQL Server**: Pantalla de conexión para ingresar servidor, base de datos, usuario y contraseña de forma completamente dinámica para cada cliente.
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
- **Grilla de Previsualización Avanzada**: Permite editar valores directamente haciendo doble clic en la celda para subsanar errores antes de guardar.
- **Transaccional**: Las operaciones de inserción masiva a SQL Server se ejecutan de manera transaccional. En caso de fallar, se realiza un rollback automático para no corromper la base de datos.

---

## 🚀 Uso Directo (Ejecutable Portable)

Para usar la aplicación en la máquina del cliente, **no es necesario instalar Node.js ni configurar entornos de desarrollo**. El proyecto se distribuye como un único archivo binario autocontenido.

### 📋 Requisitos de Sistema
* **Sistema Operativo**: Windows 10, Windows 11 o Windows Server (versiones x64).
* **Base de datos**: Acceso de red o local a la base de datos SQL Server destino, utilizando autenticación SQL Server (usuario y contraseña con permisos de lectura y escritura).

### ⚙️ Instrucciones de Ejecución
1. Descarga o copia el archivo **`ImportadorArticulos.exe`** en cualquier carpeta de la máquina destino.
2. Haz doble clic sobre `ImportadorArticulos.exe` (se puede ejecutar como administrador si es necesario).
3. Se abrirá una ventana de comandos de Windows y automáticamente se lanzará tu navegador web predeterminado en la dirección **`http://localhost:3000`**.
4. ¡Listo! Ingresa las credenciales del servidor SQL Server en la pantalla de inicio para comenzar.

### 📂 Carpetas y Archivos Relacionados
Al ejecutarse, el binario genera y busca los siguientes elementos en su mismo directorio:
* **`/uploads`** *(Autocreado)*: Carpeta donde se almacenan temporalmente las planillas de Excel subidas para su procesamiento.
* **`.env`** *(Opcional)*: Archivo de configuración en texto plano. Si deseas cambiar el puerto por defecto u otros parámetros, puedes crear un archivo `.env` en la misma carpeta del ejecutable con las siguientes variables:
  ```env
  PORT=3000
  DB_SERVER=localhost
  DB_NAME=MiBaseDeDatos
  ```

---

## 🛠️ Desarrollo y Ejecución desde Código Fuente

Si deseas modificar la aplicación o ejecutarla en modo desarrollo:

### Requisitos Previos
1. **Node.js** v18 o superior instalado.
2. **SQL Server** activo y accesible.

### Pasos para iniciar en Desarrollo

1. **Instalar dependencias del Backend**:
   ```bash
   cd backend
   npm install
   ```
2. **Iniciar servidor de desarrollo Backend**:
   ```bash
   npm run dev
   ```
   El backend se iniciará en `http://localhost:3000`.

3. **Instalar dependencias del Frontend**:
   ```bash
   cd ../frontend
   npm install
   ```
4. **Iniciar servidor de desarrollo Frontend**:
   ```bash
   npm run dev
   ```
   La interfaz web se iniciará en la dirección provista por Vite (usualmente `http://localhost:5173`).

### 📦 Proceso de Compilación y Empaquetado (`.exe`)

Si realizas cambios en el código y deseas generar un nuevo ejecutable `.exe` portable:

1. **Compilar el frontend para producción**:
   ```bash
   cd frontend
   npm run build
   ```
2. **Copiar los archivos compilados al backend**:
   Borra el contenido de `backend/public/` y copia la carpeta `frontend/dist/` dentro de `backend/public/`.
3. **Compilar el ejecutable único**:
   ```bash
   cd ../backend
   npx pkg . --output ../ImportadorArticulos.exe
   ```

---

## 🧠 Reglas de Negocio Automatizadas

El importador procesa automáticamente las planillas aplicando las siguientes reglas de ERP:

* **Conexión Dinámica**: El técnico ingresa el servidor, base de datos, usuario y contraseña de SQL Server en la UI. No se almacenan credenciales fijas por seguridad.
* **Mapeo de Columnas**: Identificación automática inteligente de columnas comunes (`Costo`, `Venta`, `EAN`, `Descripcion`, `Rubro`).
* **Detección de Pesables**:
  - Busca palabras clave en la descripción (`KG`, `XKG`, `POR KG`, `PRECIO KG`).
  - Asigna `Tipo = 'P'`, `HabilBalanzas = 1` y conserva el PLU original mapeado en `BalCodigo`.
  - Genera el EAN12 en formato: `20 + CodigoInterno (5 dígitos) + 00000`.
* **Tratamiento de EANs (No Pesables)**:
  - Si tiene 13 dígitos, remueve el último dígito verificador para guardar 12 (el ERP lo calcula automáticamente).
  - Si no tiene EAN, autogenera: `779 + CodigoInterno` (completando 12 dígitos).
* **Fusión de Rubros/Departamentos**: Mapea nombres de rubros de Excel con la tabla `Departamento` de SQL Server mediante aliases o coincidencia exacta (ej. "Carnicería" -> Código `7`). Si no existe correspondencia, asigna código `0`.
* **Cálculo de Margen**: Aplica la fórmula `((PrecioVenta - PrecioCosto) / PrecioVenta) * 100`.
* **Valores por defecto**: Rellena automáticamente los ~50 campos de la base de datos no incluidos en el Excel con valores estándar del sistema (ej. `Proveedor = 1`, `Marca = 1`, `UxB = 1`, `CuentaContable = 100000053`, etc.).

---

## 🔍 Validaciones en Pantalla (Previsualización)

Antes de guardar en SQL Server, la aplicación muestra una grilla avanzada interactiva (AG Grid) donde se validan y colorean los siguientes escenarios:
* ❌ **Errores Críticos**:
  - EAN duplicado (en el Excel o ya existente en la base de datos).
  - Descripción duplicada (en el Excel o ya existente en la base de datos).
  - PLU de balanza duplicado.
  - IVA inválido o campos obligatorios vacíos.
* ⚠️ **Advertencias**:
  - Precio de venta menor o igual al precio de costo.
* El técnico puede editar directamente las celdas con errores en la grilla para subsanarlos antes de confirmar la importación.
* La inserción en la base de datos es 100% transaccional: si un artículo falla al insertarse, se hace un rollback completo para garantizar la integridad.
