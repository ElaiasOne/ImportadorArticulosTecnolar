---
trigger: always_on
---

Cliente
   │
   ├── Excel de su sistema anterior
   │
   ▼
Importador
   │
   ├── Lee Excel
   ├── Mapea columnas
   ├── Detecta pesables
   ├── Genera EAN internos
   ├── Conserva PLU
   ├── Calcula márgenes
   ├── Asigna Departamento
   ├── Asigna Familia
   ├── Completa defaults
   ├── Valida duplicados
   │
   ▼
Vista previa
   │
   ▼
INSERT a SQL Server

--------------------------------

Proyecto

Quiero desarrollar una herramienta web interna para mi empresa de software de gestión comercial. El objetivo es importar artículos provenientes de cualquier sistema anterior de un cliente y convertirlos automáticamente al formato de nuestra base de datos SQL Server.

Esta herramienta será utilizada únicamente por los técnicos de la empresa, no por los clientes finales.

No quiero un importador genérico de Excel. Quiero un asistente inteligente que conozca las reglas de negocio de nuestro sistema.

Tecnologías

Backend

Node.js
Express
SQL Server (mssql)

Frontend

Vue 3
PrimeVue
AG Grid (o Tabulator)

Lectura de Excel

ExcelJS
Flujo esperado
Conexion a la base de datos.
INPUT para que usuario ponga nombre base de datos (usa usuario SA contraseña LaCrujia_3261)
Seleccionar un archivo Excel (.xlsx)
Leer automáticamente la primera hoja.
Detectar las columnas existentes.
Permitir mapear columnas del Excel contra los campos de nuestro sistema.
Mostrar una vista previa.
Validar errores.
Aplicar automáticamente reglas de negocio.
Importar directamente a SQL Server.
Campos mínimos que debe poder importar

CodigoInterno

EAN

Descripcion

PrecioCosto

PrecioVenta

IVA

Rubro

Familia

SubFamilia

Todo lo demás será generado automáticamente por el sistema.

Estructura SQL Server destino

Tabla:

Articulos

Campos importantes

Codigo

EAN

Descripcion

DescripcionCorta

PrecioCosto

PrecioVenta

Margen

IVA

Proveedor

Departamento

Marca

Familia

UxB

HabilBalanzas

BalCodigo

Tipo

CuentaContable

SubFamilia

etc.

La tabla tiene aproximadamente 50 columnas.

La mayoría poseen valores por defecto definidos por reglas de negocio.

En la base de datos a importar pueden ya existir registros de artículos, respetar los códigos, ean para no generar duplicados.

Reglas de negocio

Si el producto es pesable:

Detectarlo por la descripción.

Ejemplos

XKG

xKG

KG

POR KG

PRECIO KG

Entonces

Tipo = P

HabilBalanzas = 1

BalCodigo = PLU original

El PLU debe conservarse.

Nunca debe perderse.

El EAN generado para pesables debe ser

20 + CodigoInterno(5 dígitos) + 00000

Ejemplo

Codigo 1458

EAN

20145800000

(12 dígitos)

Nuestro sistema calcula automáticamente el dígito verificador.

Si NO es pesable

Si tiene EAN válido

Conservarlo.

Si no tiene EAN

Generar

779 + CodigoInterno

hasta completar 12 dígitos.

Nunca generar el dígito verificador.

Nuestro sistema lo calcula.

Si el EAN viene con 13 dígitos

Debe almacenarse con 12.

Eliminar el último dígito (check digit).

Ejemplo

7791120031557

↓

779112003155

Si el EAN viene con 8

10

11

12

Se conserva.

Sólo eliminar el dígito cuando tenga exactamente 13.

Departamento

Debe asignarse automáticamente, seria en excel RUBRO y en nuestro sql Articulos.Departamento y va el código de tabla Departamento.Codigo. 
Si en el excel ponen los nombres y no los código que exista un MERGE automatico, es decir, EXCEL RUBRO: Carniceria SQL SERVER Departamento: Codigo: 1 Descripción: CARNICERIA. Cada cliente tiene disintos rubros/departamentos y distintos ordenes.

Ejemplo

ALMACEN → 1

BEBIDAS SIN ALC → 2

BAZAR → 3

PERFUMERIA → 4

LIMPIEZA → 5

VERDULERIA → 6

CARNICERIA → 7

LACTEOS → 8


Márgenes

Margen =

((PrecioVenta - PrecioCosto) / PrecioVenta) * 100

IVA Se mira en SQL Server TablaIVA de la siguiente manera:
1 = 21.00
2 = 10.50

Porque posiblemente en el excel los carguen asi %10.5, %21 y para nosotros es tabla IVA por código 1 o 2.

Valores por defecto

Todos los campos restantes deberán completarse automáticamente.

Ejemplos

Proveedor = 1

Marca = 1

Familia = 0

UxB = 1

CuentaContable = 100000053

ModeloEtiqueta = ET_GONDOLA

CantidadEtiquetas = 1

PresentacionUnidad = UN

CxP = 1

CxPP = 1

etc.

No quiero que el usuario tenga que conocer estos datos.

Validaciones

Detectar

EAN duplicados

Descripción duplicada

PrecioVenta menor al costo

IVA inválido

Campos obligatorios vacíos

EAN inválidos

PLU duplicados

Mostrar advertencias antes de importar.

Vista previa

Antes del INSERT quiero una grilla tipo Excel.

Con filtros.

Ordenamiento.

Edición.

Resaltado de errores.

Indicadores visuales.

Ejemplo

✓ Correcto

⚠ Advertencia

❌ Error

Arquitectura

Quiero un proyecto profesional.

Separación frontend/backend.

API REST.

Código limpio.

Componentes reutilizables.

Sin lógica de negocio mezclada con la interfaz.

Quiero que las reglas de importación estén encapsuladas en servicios.

Deben existir manejos de errores, siempre con ventana emergente e indicando que hacer para guiar al usuario, ejemplo un campo no es valido, debes cambiarlo a tal, etc.

Objetivo final

La herramienta debe permitir importar miles de artículos provenientes de cualquier sistema anterior en pocos minutos, aplicando automáticamente todas las reglas de negocio de nuestro ERP, minimizando la intervención manual del técnico.

Antes de escribir código, proponé la arquitectura completa del proyecto (estructura de carpetas, módulos, flujo de datos y diseño de la base si fuera necesario). Luego implementá el proyecto por etapas, priorizando un MVP funcional y fácilmente extensible.



ESTRUCTURAS

TABLA ARTICULOS


CREATE TABLE [dbo].[Articulos](
	[Codigo] [int] NOT NULL,
	[EAN] [money] NOT NULL,
	[Descripcion] [nvarchar](50) NOT NULL,
	[DescripcionCorta] [nvarchar](20) NOT NULL,
	[PrecioCosto] [money] NOT NULL,
	[PrecioVenta] [money] NOT NULL,
	[Margen] [money] NOT NULL,
	[IVA] [int] NOT NULL,
	[EsCombo] [bit] NOT NULL,
	[Proveedor] [int] NOT NULL,
	[Departamento] [int] NOT NULL,
	[Marca] [int] NOT NULL,
	[Familia] [int] NOT NULL,
	[UxB] [money] NOT NULL,
	[HabilCajas] [bit] NOT NULL,
	[HabilEstad] [bit] NOT NULL,
	[HabilStock] [bit] NOT NULL,
	[HabilOC] [bit] NOT NULL,
	[HabilBalanzas] [bit] NOT NULL,
	[BalDiasVto] [int] NOT NULL,
	[BalCodigo] [int] NOT NULL,
	[Tipo] [nvarchar](1) NOT NULL,
	[CodigoEnvase] [int] NOT NULL,
	[FechaModificacion] [smalldatetime] NOT NULL,
	[FechaAlta] [smalldatetime] NOT NULL,
	[HoraModificacion] [nvarchar](8) NOT NULL,
	[Transmitido] [bit] NOT NULL,
	[Deposito] [int] NOT NULL,
	[PresentacionCantidad] [money] NOT NULL,
	[PresentacionUnidad] [nvarchar](2) NOT NULL,
	[Ruteo] [nvarchar](200) NOT NULL,
	[Alfa] [nvarchar](20) NOT NULL,
	[Peso] [money] NOT NULL,
	[StockMinimo] [money] NOT NULL,
	[CxB] [money] NOT NULL,
	[DescuentoXCaja] [money] NOT NULL,
	[ImpInterno] [money] NOT NULL,
	[ArMargenTeorico] [money] NOT NULL,
	[CuentaContable] [money] NOT NULL,
	[SubFamilia] [int] NOT NULL,
	[DiasAlVto] [int] NOT NULL,
	[MargenIIBB] [money] NOT NULL,
	[MargenOtrosImp] [money] NOT NULL,
	[ModeloEtiqueta] [nvarchar](50) NOT NULL,
	[CantidadEtiquetas] [int] NOT NULL,
	[CxP] [int] NOT NULL,
	[CxPP] [int] NOT NULL,
	[GeneraRemitoComponentes] [bit] NOT NULL,
	[Serializado] [bit] NOT NULL,
	[Sector] [int] NOT NULL,
 CONSTRAINT [PK_Articulos] PRIMARY KEY CLUSTERED 
(
	[Codigo] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Codigo]  DEFAULT ((0)) FOR [Codigo]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_EAN]  DEFAULT ((0)) FOR [EAN]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Descripcion]  DEFAULT ('') FOR [Descripcion]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_DescripcionCorta]  DEFAULT ('') FOR [DescripcionCorta]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_PrecioCosto]  DEFAULT ((1)) FOR [PrecioCosto]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_PrecioVenta]  DEFAULT ((0)) FOR [PrecioVenta]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Margen]  DEFAULT ((0)) FOR [Margen]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_IVA]  DEFAULT ((1)) FOR [IVA]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_EsCombo]  DEFAULT ((0)) FOR [EsCombo]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Proveedor]  DEFAULT ((1)) FOR [Proveedor]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Departamento]  DEFAULT ((1)) FOR [Departamento]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Marca]  DEFAULT ((1)) FOR [Marca]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Familia]  DEFAULT ((1)) FOR [Familia]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_UxB]  DEFAULT ((0)) FOR [UxB]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_HabilCajas]  DEFAULT ((1)) FOR [HabilCajas]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_HabilEstad]  DEFAULT ((1)) FOR [HabilEstad]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_HabilStock]  DEFAULT ((1)) FOR [HabilStock]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_HabilOC]  DEFAULT ((1)) FOR [HabilOC]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_HabilBalanzas]  DEFAULT ((0)) FOR [HabilBalanzas]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_BalDiasVto]  DEFAULT ((0)) FOR [BalDiasVto]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_BalCodigo]  DEFAULT ((0)) FOR [BalCodigo]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Tipo]  DEFAULT ('N') FOR [Tipo]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_CodigoEnvase]  DEFAULT ((0)) FOR [CodigoEnvase]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_FechaModificacion]  DEFAULT (getdate()) FOR [FechaModificacion]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_FechaAlta]  DEFAULT (getdate()) FOR [FechaAlta]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_HoraModificacion]  DEFAULT ('09:00:00') FOR [HoraModificacion]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Transmitido]  DEFAULT ((0)) FOR [Transmitido]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Deposito]  DEFAULT ((0)) FOR [Deposito]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_PresentacionCantidad]  DEFAULT ((1)) FOR [PresentacionCantidad]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_PresentacionUnidad]  DEFAULT ('N') FOR [PresentacionUnidad]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Ruteo]  DEFAULT ('') FOR [Ruteo]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Alfa]  DEFAULT ('') FOR [Alfa]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_Peso]  DEFAULT ((0)) FOR [Peso]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_StockMinimo]  DEFAULT ((0)) FOR [StockMinimo]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_CxB]  DEFAULT ((1)) FOR [CxB]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_DescuentoXCaja]  DEFAULT ((0)) FOR [DescuentoXCaja]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_ImpInterno]  DEFAULT ((0)) FOR [ImpInterno]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_ArMargenTeorico]  DEFAULT ((0)) FOR [ArMargenTeorico]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_CuentaContable]  DEFAULT ((0)) FOR [CuentaContable]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_SubFamilia]  DEFAULT ((0)) FOR [SubFamilia]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_DiasAlVto]  DEFAULT ((0)) FOR [DiasAlVto]
GO

ALTER TABLE [dbo].[Articulos] ADD  CONSTRAINT [DF_Articulos_MargenIIBB]  DEFAULT ((0)) FOR [MargenIIBB]
GO

ALTER TABLE [dbo].[Articulos] AD