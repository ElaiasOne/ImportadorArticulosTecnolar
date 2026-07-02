<template>
  <div class="premium-card">
    <div class="card-title">
      <i class="pi pi-file-excel"></i>
      Carga de Excel y Mapeo de Columnas
    </div>

    <!-- Paso A: Selección de Archivo -->
    <div v-if="!fileUploaded" class="upload-zone-wrapper">
      <p class="description">
        Suba la planilla Excel (.xlsx) que contiene los artículos del cliente. El sistema leerá automáticamente la primera hoja.
      </p>

      <div 
        class="drag-drop-zone"
        :class="{ dragging: isDragging }"
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        @click="triggerFileSelect"
      >
        <input 
          ref="fileInput"
          type="file"
          accept=".xlsx"
          class="hidden-file-input"
          @change="handleFileSelected"
        />
        <i class="pi pi-cloud-upload upload-icon animate-bounce"></i>
        <h3>Arrastra y suelta tu archivo Excel aquí</h3>
        <p>o haz clic para explorar en tu equipo</p>
        <span class="file-limits">Soporta archivos .xlsx de hasta 20MB</span>
      </div>

      <div v-if="uploadError" class="alert-message error animate-fade">
        <i class="pi pi-times-circle"></i>
        <span>{{ uploadError }}</span>
      </div>

      <div v-if="uploading" class="upload-loading-overlay">
        <i class="pi pi-spin pi-spinner spinner-lg"></i>
        <p>Subiendo y leyendo columnas del Excel...</p>
      </div>
    </div>

    <!-- Paso B: Mapeo de Columnas -->
    <div v-else class="mapping-zone animate-fade">
      <div class="file-info-bar">
        <div class="file-name">
          <i class="pi pi-file"></i>
          <span>{{ uploadedFileName }}</span>
        </div>
        <button class="btn-secondary btn-sm" @click="resetFile">
          <i class="pi pi-refresh"></i> Cambiar Archivo
        </button>
      </div>

      <p class="description mt-4">
        Asocie las columnas detectadas en su archivo Excel con los campos requeridos por nuestro sistema ERP. El asistente ha intentado auto-detectar las coincidencias.
      </p>

      <div class="mapping-grid">
        <div 
          v-for="field in erpFields" 
          :key="field.key" 
          class="mapping-card"
          :class="{ required: field.required, mapped: mapping[field.key] }"
        >
          <div class="mapping-info">
            <span class="field-label">
              {{ field.label }}
              <span v-if="field.required" class="required-badge">* Obligatorio</span>
            </span>
            <span class="field-desc">{{ field.desc }}</span>
          </div>

          <div class="mapping-selector">
            <select v-model="mapping[field.key]" class="select-input">
              <option :value="null">-- No Asignado --</option>
              <option 
                v-for="col in excelColumns" 
                :key="col" 
                :value="col"
              >
                {{ col }}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div v-if="processingError" class="alert-message error mt-4">
        <i class="pi pi-times-circle"></i>
        <span>{{ processingError }}</span>
      </div>

      <div class="action-footer mt-6">
        <button class="btn-secondary" @click="resetFile">
          <i class="pi pi-arrow-left"></i> Atrás
        </button>
        <button 
          class="btn-primary" 
          :disabled="processing || !isMappingValid" 
          @click="processExcelData"
        >
          <i v-if="processing" class="pi pi-spin pi-spinner"></i>
          <i v-else class="pi pi-eye"></i>
          Procesar y Ver Vista Previa
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import api from '../services/api';

export default {
  name: 'FileUpload',
  props: {
    connection: {
      type: Object,
      required: true
    }
  },
  emits: ['processed', 'back'],
  setup(props, { emit }) {
    const fileInput = ref(null);
    const isDragging = ref(false);
    const uploading = ref(false);
    const uploadError = ref('');
    
    const fileUploaded = ref(false);
    const uploadedFilePath = ref('');
    const uploadedFileName = ref('');
    const excelColumns = ref([]);

    const processing = ref(false);
    const processingError = ref('');

    // Definición de asociaciones / mapeos
    const mapping = ref({
      CodigoInterno: null,
      EAN: null,
      Descripcion: null,
      PrecioCosto: null,
      PrecioVenta: null,
      IVA: null,
      Rubro: null,
      Familia: null,
      SubFamilia: null
    });

    const erpFields = [
      { key: 'CodigoInterno', label: 'Código Interno', required: false, desc: 'Identificador único del artículo (se autogenera si no se asigna)' },
      { key: 'Descripcion', label: 'Descripción', required: true, desc: 'Nombre detallado del artículo' },
      { key: 'PrecioCosto', label: 'Precio Costo', required: true, desc: 'Precio de compra neto' },
      { key: 'PrecioVenta', label: 'Precio Venta', required: true, desc: 'Precio de venta al público sin dígito verificador en pesables' },
      { key: 'EAN', label: 'EAN / Código de Barras', required: false, desc: 'Código EAN13, EAN8 o similar (se limpia a 12 dígitos)' },
      { key: 'IVA', label: 'IVA', required: false, desc: 'Porcentaje de IVA (ej: 21, 10.5, %21)' },
      { key: 'Rubro', label: 'Rubro / Departamento', required: false, desc: 'Nombre o código del rubro (se mapeará a Departamentos)' },
      { key: 'Familia', label: 'Familia', required: false, desc: 'Código numérico de la familia' },
      { key: 'SubFamilia', label: 'Sub-Familia', required: false, desc: 'Código numérico de la subfamilia' }
    ];

    // Reglas auxiliares para auto-detección de mapeos
    const autoMapRules = {
      CodigoInterno: ['codigo', 'cod', 'intern', 'id', 'articulo', 'art', 'clie', 'plu'],
      EAN: ['ean', 'barras', 'codigobarras', 'cod_barra', 'barra', 'upc'],
      Descripcion: ['descripcion', 'desc', 'nombre', 'detalle', 'producto', 'art'],
      PrecioCosto: ['costo', 'compra', 'cost', 'cost_price', 'precio_costo', 'p_costo'],
      PrecioVenta: ['venta', 'precio', 'pvp', 'p.v.p', 'publico', 'venta_price', 'precio_venta', 'p_venta'],
      IVA: ['iva', 'tasa', 'alicuota', 'impuesto', 'porc_iva'],
      Rubro: ['rubro', 'departamento', 'depto', 'categoria', 'grupo', 'seccion', 'clase'],
      Familia: ['familia', 'fam', 'linea'],
      SubFamilia: ['subfamilia', 'subfam', 'sublinea', 'sub_familia']
    };

    const triggerFileSelect = () => {
      fileInput.value.click();
    };

    const handleFileSelected = (e) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        uploadFile(files[0]);
      }
    };

    const handleDrop = (e) => {
      isDragging.value = false;
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        // Validar extensión xlsx
        const file = files[0];
        if (file.name.endsWith('.xlsx')) {
          uploadFile(file);
        } else {
          uploadError.value = 'Solo se permiten archivos Excel con extensión .xlsx';
        }
      }
    };

    const uploadFile = async (file) => {
      uploading.value = true;
      uploadError.value = '';
      
      try {
        const response = await api.uploadExcel(file);
        if (response.success) {
          uploadedFilePath.value = response.data.filePath;
          uploadedFileName.value = response.data.fileName;
          excelColumns.value = response.data.columns;
          fileUploaded.value = true;
          
          // Disparar auto-mapeo
          autoMapColumns();
        }
      } catch (err) {
        if (err.response && err.response.data && err.response.data.message) {
          uploadError.value = err.response.data.message;
        } else {
          uploadError.value = `Error al subir el archivo: ${err.message}`;
        }
      } finally {
        uploading.value = false;
      }
    };

    const autoMapColumns = () => {
      // Limpiar el mapeo actual
      for (const key in mapping.value) {
        mapping.value[key] = null;
      }

      // Hacer coincidir cada campo del ERP
      for (const [erpKey, keywords] of Object.entries(autoMapRules)) {
        let matchedCol = null;
        
        // 1. Probar coincidencia exacta en minúsculas
        matchedCol = excelColumns.value.find(col => 
          keywords.some(kw => col.toLowerCase() === kw)
        );

        // 2. Probar si contiene el prefijo si no se encuentra la coincidencia exacta
        if (!matchedCol) {
          matchedCol = excelColumns.value.find(col => 
            keywords.some(kw => col.toLowerCase().includes(kw))
          );
        }

        if (matchedCol) {
          mapping.value[erpKey] = matchedCol;
        }
      }
    };

    const resetFile = () => {
      fileUploaded.value = false;
      uploadedFilePath.value = '';
      uploadedFileName.value = '';
      excelColumns.value = [];
      uploadError.value = '';
      processingError.value = '';
      // Restablecer el mapeo
      for (const key in mapping.value) {
        mapping.value[key] = null;
      }
    };

    // Validación: Descripción, Precio Costo y Precio Venta son obligatorios
    const isMappingValid = computed(() => {
      return (
        mapping.value.Descripcion &&
        mapping.value.PrecioCosto &&
        mapping.value.PrecioVenta
      );
    });

    const processExcelData = async () => {
      if (!isMappingValid.value) return;

      processing.value = true;
      processingError.value = '';

      try {
        const response = await api.processExcel(
          uploadedFilePath.value,
          mapping.value,
          props.connection.server,
          props.connection.database,
          props.connection.user,
          props.connection.password
        );

        if (response.success) {
          emit('processed', {
            rows: response.data.rows,
            filePath: uploadedFilePath.value,
            mapping: mapping.value
          });
        }
      } catch (err) {
        if (err.response && err.response.data && err.response.data.message) {
          processingError.value = err.response.data.message;
        } else {
          processingError.value = `Error al procesar reglas de negocio: ${err.message}`;
        }
      } finally {
        processing.value = false;
      }
    };

    return {
      fileInput,
      isDragging,
      uploading,
      uploadError,
      fileUploaded,
      uploadedFileName,
      excelColumns,
      mapping,
      erpFields,
      isMappingValid,
      processing,
      processingError,
      triggerFileSelect,
      handleFileSelected,
      handleDrop,
      resetFile,
      processExcelData
    };
  }
};
</script>

<style scoped>
.description {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
}

.upload-zone-wrapper {
  position: relative;
}

.drag-drop-zone {
  border: 2px dashed var(--border-color);
  background: var(--bg-tertiary);
  border-radius: var(--radius-lg);
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.drag-drop-zone:hover, .drag-drop-zone.dragging {
  border-color: var(--color-primary);
  background: rgba(124, 58, 237, 0.05);
}

.upload-icon {
  font-size: 3rem;
  color: var(--color-primary);
  margin-bottom: 1rem;
}

.hidden-file-input {
  display: none;
}

.file-limits {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 0.5rem;
}

.upload-loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(10, 12, 16, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  border-radius: var(--radius-lg);
  z-index: 10;
}

.spinner-lg {
  font-size: 2.5rem;
  color: var(--color-primary);
}

.file-info-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1.25rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: var(--color-accent);
}

.mapping-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2rem;
  text-align: left;
}

.mapping-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
  transition: all 0.2s ease;
}

.mapping-card.required {
  border-left: 3px solid var(--color-error);
}

.mapping-card.mapped {
  border-color: var(--color-primary);
  background: rgba(124, 58, 237, 0.02);
}

.mapping-card.required.mapped {
  border-left-color: var(--color-success);
}

.mapping-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-label {
  font-weight: 600;
  font-size: 0.95rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.field-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.required-badge {
  font-size: 0.65rem;
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-error);
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-sm);
  font-weight: 600;
}

.mapping-selector {
  width: 100%;
}

.select-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  outline: none;
  cursor: pointer;
  transition: border-color 0.2s;
}

.select-input:focus {
  border-color: var(--color-primary);
}

.action-footer {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid var(--border-color);
  padding-top: 1.5rem;
}

.alert-message {
  padding: 0.75rem 1rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.9rem;
  text-align: left;
}

.alert-message.error {
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error);
}

.btn-sm {
  padding: 0.4rem 0.8rem;
  font-size: 0.8rem;
}

.mt-4 { margin-top: 1rem; }
.mt-6 { margin-top: 1.5rem; }
</style>
