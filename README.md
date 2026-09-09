# Importador de Artículos ERP - Asistente Inteligente

Herramienta web interna de escritorio diseñada para técnicos de soporte. Permite importar artículos desde planillas de Excel (`.xlsx`) provenientes de sistemas anteriores y convertirlos automáticamente al formato estructurado de base de datos SQL Server de nuestro ERP, aplicando reglas de negocio complejas en segundos.

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

## 📖 Guía Operativa para el Técnico

Esta guía detalla los requisitos del archivo de datos y el flujo de uso del importador para garantizar una migración exitosa.

### 📋 1. Cómo Solicitar el Excel al Cliente
Para que el sistema procese la información correctamente, pídele al cliente un archivo Excel con las siguientes características:
* **Formato**: Obligatoriamente libro de Excel estándar con extensión **`.xlsx`** (no se admiten `.xls` antiguos ni `.csv`).
* **Estructura limpia**: 
  * Los datos deben estar en la **primera pestaña** (hoja) del archivo.
  * La **primera fila** debe contener los nombres de las columnas (cabeceras). No dejes renglones vacíos arriba ni celdas combinadas en los títulos.
* **Columnas mínimas sugeridas** (para mapear contra el ERP):
  * **Código Interno**: Código numérico único identificador del artículo en el sistema anterior.
  * **EAN / Código de Barras**: Código de barras de los artículos (opcional, si no posee, el sistema generará uno automáticamente).
  * **Descripción**: Nombre o descripción del artículo.
  * **Precio de Costo**: Costo de compra neto del producto.
  * **Precio de Venta**: Precio final al público (IVA incluido).
  * **IVA**: Porcentaje de IVA correspondiente (ej. `21`, `10.5` o el formato numérico/porcentaje que traiga).
  * **Rubro / Departamento**: Nombre del rubro (ej. Carnicería, Almacén, Lacteos).

---

### ⚙️ 2. Flujo de Trabajo y Carga de Datos

El proceso de importación consta de 5 sencillos pasos dentro de la interfaz web:

#### 🔌 Paso A: Conexión a SQL Server
1. Ejecuta `ImportadorArticulos.exe` en la máquina destino y abre la interfaz (`http://localhost:3000`).
2. Completa los datos: **Servidor** (ej: `localhost`, `localhost\SQLEXPRESS` o `.\SQLEXPRESS`), **Base de datos**, **Usuario (sa)** y **Contraseña**.
3. Presiona **Conectar y Continuar**.
   * *Soporte Técnico:* Si ocurre un error de conexión TCP/IP, el sistema te mostrará una guía en pantalla detallando cómo activar TCP/IP en la configuración de SQL Server del cliente y reiniciar el servicio.

#### 📁 Paso B: Selección del Archivo
1. Arrastra o selecciona el archivo `.xlsx` del cliente.
2. El sistema leerá automáticamente la estructura del archivo y habilitará el siguiente paso.

#### 🗺️ Paso C: Mapeo de Columnas
1. Asocia las columnas que detectó el Excel con los campos requeridos por el ERP:
   * *Obligatorios:* Código Interno, Descripción, Costo, Venta, IVA y Rubro.
   * *Opcionales:* EAN (Código de Barras), Familia y SubFamilia.
2. El sistema autodetecta coincidencias lógicas (ej: si en el Excel dice "Costo Neto", lo sugerirá para "PrecioCosto").
3. Presiona **Procesar y Validar**.

#### 🔍 Paso D: Previsualización y Corrección de Errores (Grilla Interactiva)
Se presentará una grilla dinámica con todos los artículos procesados y listos para importar. El sistema analiza automáticamente las reglas de negocio y muestra los siguientes indicadores visuales:
* ❌ **Errores Críticos**:
  * EANs duplicados en la planilla o que ya existan en la base de datos de destino.
  * Descripciones duplicadas (en la planilla o en la base de datos).
  * PLU de balanza duplicado o faltante para pesables.
  * IVA inválido o campos obligatorios vacíos.
  * *Nota:* Los artículos con error crítico no se pueden importar. Para corregirlos, **haz doble clic directamente sobre la celda en la grilla**, edita el valor erróneo y presiona `Enter`. La celda se revalidará al instante.
* ⚠️ **Advertencias**:
  * Precio de venta menor o igual al precio de costo. *(Te permite importar, pero te alerta del margen negativo)*.
* **Filtros y Búsqueda**: Puedes usar las cajas de búsqueda en la parte superior de cada columna para filtrar o buscar productos específicos (ej: buscar solo productos con `❌` para corregirlos rápido).

#### 💾 Paso E: Confirmación e Inserción
1. Una vez que hayas resuelto todos los errores críticos (`❌`), el botón **Confirmar e Importar** se habilitará.
2. Presiona el botón para procesar la importación masiva.
3. El proceso es **100% transaccional**: si un solo artículo falla al insertarse, se aplica un *rollback* completo y la base de datos no se altera, informándote exactamente qué artículo causó la falla para que lo soluciones.

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
