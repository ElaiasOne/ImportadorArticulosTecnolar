<template>
  <div class="universal-manager animate-fade">
    
    <!-- Pestañas del Módulo Universal -->
    <div class="tab-subnav mb-4">
      <button 
        class="subnav-btn" 
        :class="{ active: mode === 'export' }"
        @click="mode = 'export'"
      >
        <i class="pi pi-download"></i> Exportar Tabla (Origen)
      </button>

      <button 
        class="subnav-btn" 
        :class="{ active: mode === 'import' }"
        @click="mode = 'import'"
      >
        <i class="pi pi-upload"></i> Importar Tabla (Destino)
      </button>
    </div>

    <!-- MÓDULO EXPORTADOR -->
    <div v-if="mode === 'export'" class="premium-card animate-fade">
      <div class="card-title">
        <i class="pi pi-download"></i>
        <span>Exportador Universal de Tablas SQL Server</span>
      </div>

      <p class="section-desc mb-4">
        Selecciona cualquier tabla de la base de datos conectada (<strong>{{ connection.database }}</strong>) para generar un archivo autónomo de datos y estructura. Puedes aplicar filtros opcionales.
      </p>

      <div class="grid-2 gap-4">
        <div class="form-group">
          <label>Seleccionar Tabla a Exportar</label>
          <div class="input-with-refresh">
            <select v-model="exportForm.tableName" class="text-input select-input">
              <option value="" disabled>-- Selecciona una tabla --</option>
              <option v-for="table in tablesList" :key="table" :value="table">{{ table }}</option>
            </select>
            <button class="btn-secondary btn-icon-only" title="Recargar Lista de Tablas" :disabled="loading" @click="fetchTables">
              <i class="pi" :class="loading ? 'pi-spin pi-spinner' : 'pi-refresh'"></i>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>Filtro WHERE Opcional (ej: Fecha >= '2026-01-01' o Rubro = 5)</label>
          <input 
            v-model="exportForm.whereClause" 
            type="text" 
            class="text-input" 
            placeholder="Dejar vacío para exportar la tabla completa"
          />
        </div>
      </div>

      <div class="mt-4">
        <button 
          class="btn-primary" 
          :disabled="!exportForm.tableName || loading"
          @click="handleExport"
        >
          <i class="pi" :class="loading ? 'pi-spin pi-spinner' : 'pi-file-export'"></i>
          <span>Generar y Descargar Archivo (.sqlpack)</span>
        </button>
      </div>

      <!-- Resumen de Exportación realizada -->
      <div v-if="lastExportSummary" class="alert-banner success mt-4 animate-fade">
        <i class="pi pi-check-circle large-icon"></i>
        <div class="alert-content">
          <h4>¡Exportación Generada con Éxito!</h4>
          <p>Tabla <code>{{ lastExportSummary.tableName }}</code> exportada correctamente.</p>
          <p class="subtext">El archivo portable <code>.sqlpack</code> ha sido generado e iniciado su descarga en tu navegador.</p>
        </div>
      </div>
    </div>

    <!-- MÓDULO IMPORTADOR -->
    <div v-if="mode === 'import'" class="premium-card animate-fade">
      <div class="card-title">
        <i class="pi pi-upload"></i>
        <span>Importador Universal de Tablas (Para Bases en Producción)</span>
      </div>

      <p class="section-desc mb-4">
        Carga un archivo <code>.sqlpack</code> previamente exportado para insertarlo o actualizarlo en la base destino (<strong>{{ connection.database }}</strong>). 
        <strong style="color: var(--color-success)">Garantía de Cero Borrado:</strong> No elimina registros existentes.
      </p>

      <!-- Zona de Carga de Archivo -->
      <div class="file-drop-zone mb-4" :class="{ 'has-file': loadedPackageMeta }">
        <input type="file" accept=".sqlpack,.json" @change="onFileSelected" class="file-input-hidden" id="packageFileInput" />
        <label for="packageFileInput" class="file-drop-label">
          <i class="pi pi-cloud-upload upload-icon"></i>
          <span v-if="!loadedPackageMeta">Haz clic o arrastra aquí tu archivo <strong>.sqlpack</strong></span>
          <span v-else>Archivo Cargado: <strong>{{ loadedFileName }}</strong> ({{ loadedPackageMeta.totalRecords }} filas)</span>
        </label>
      </div>

      <!-- Opciones y Validación de Importación -->
      <div v-if="loadedPackageMeta" class="import-options-card animate-fade mb-4">
        <h3><i class="pi pi-sliders-h"></i> Configuración de Importación en Producción</h3>

        <div class="grid-2 gap-4 mt-3">
          <div class="form-group">
            <label>Tabla Destino en SQL Server (Desplegable de Tablas Existentes)</label>
            <div class="input-with-refresh">
              <select v-model="importForm.targetTableName" class="text-input select-input">
                <option value="" disabled>-- Selecciona la tabla de destino --</option>
                <option v-for="table in tablesList" :key="table" :value="table">{{ table }}</option>
              </select>
              <button class="btn-secondary btn-icon-only" title="Recargar Lista de Tablas" :disabled="loading" @click="fetchTables">
                <i class="pi" :class="loading ? 'pi-spin pi-spinner' : 'pi-refresh'"></i>
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>Estrategia ante Registros Duplicados</label>
            <select v-model="importForm.strategy" class="text-input select-input">
              <option value="skip">🛡️ Solo Insertar Registros Nuevos (Omitir Existentes)</option>
              <option value="upsert">🔄 Insertar Nuevos y Actualizar Existentes (UPSERT)</option>
            </select>
          </div>
        </div>

        <div class="mt-3">
          <button class="btn-secondary" :disabled="loading || !importForm.targetTableName" @click="handleInspect">
            <i class="pi" :class="loading ? 'pi-spin pi-spinner' : 'pi-search'"></i>
            <span>Inspeccionar y Validar en BD Destino</span>
          </button>
        </div>
      </div>

      <!-- Reporte de Inspección -->
      <div v-if="inspectionReport" class="inspection-report-card animate-fade mb-4">
        <h3><i class="pi pi-chart-bar"></i> Resultado de Inspección Previa</h3>

        <div class="report-grid mt-3">
          <div class="report-stat">
            <span class="stat-num">{{ inspectionReport.totalInFile }}</span>
            <span class="stat-lbl">Filas en Archivo</span>
          </div>

          <div class="report-stat success">
            <span class="stat-num">+{{ inspectionReport.newInTarget }}</span>
            <span class="stat-lbl">Nuevas a Insertar</span>
          </div>

          <div class="report-stat warning">
            <span class="stat-num">{{ inspectionReport.existingInTarget }}</span>
            <span class="stat-lbl">Existentes en Destino</span>
          </div>

          <div class="report-stat info">
            <span class="stat-num">{{ inspectionReport.hasIdentity ? 'SÍ' : 'NO' }}</span>
            <span class="stat-lbl">IDENTITY Auto-ID</span>
          </div>
        </div>

        <div v-if="inspectionReport.missingColumnsInTarget && inspectionReport.missingColumnsInTarget.length > 0" class="alert-banner warning mt-3">
          <i class="pi pi-exclamation-triangle"></i>
          <div>
            <strong>Advertencia:</strong> Las siguientes columnas del archivo no existen en la tabla destino y serán ignoradas:
            <code>{{ inspectionReport.missingColumnsInTarget.join(', ') }}</code>
          </div>
        </div>

        <div class="mt-4 flex-actions">
          <button class="btn-primary" :disabled="loading" @click="handleImport">
            <i class="pi" :class="loading ? 'pi-spin pi-spinner' : 'pi-check-circle'"></i>
            <span>Ejecutar Importación a Producción</span>
          </button>
        </div>
      </div>

      <!-- Indicador Circular de Progreso Unificado (0% a 100%) para Exportación, Carga, Inspección e Importación -->
      <div v-if="activeOperation.active" class="progress-card animate-fade mt-4">
        <div class="progress-card-header">
          <i class="pi" :class="activeOperation.status === 'completed' ? 'pi-check-circle icon-success' : activeOperation.status === 'failed' ? 'pi-times-circle text-red-500' : 'pi-sync pi-spin icon-running'"></i>
          <h3>{{ activeOperation.title }}</h3>
        </div>

        <div class="progress-card-body">
          <div class="circular-progress-container">
            <svg class="progress-ring" width="170" height="170">
              <circle
                class="progress-ring-bg"
                stroke="rgba(255, 255, 255, 0.08)"
                stroke-width="12"
                fill="transparent"
                r="72"
                cx="85"
                cy="85"
              />
              <circle
                class="progress-ring-circle"
                :stroke="activeOperation.status === 'completed' ? '#10b981' : activeOperation.status === 'failed' ? '#ef4444' : '#8b5cf6'"
                stroke-width="12"
                stroke-dasharray="452.38"
                :stroke-dashoffset="452.38 - (452.38 * activeOperation.percent) / 100"
                stroke-linecap="round"
                fill="transparent"
                r="72"
                cx="85"
                cy="85"
              />
            </svg>
            <div class="ring-content">
              <span class="ring-percent">{{ activeOperation.percent }}%</span>
              <span class="ring-status">{{ activeOperation.status === 'completed' ? 'COMPLETADO' : activeOperation.status === 'failed' ? 'ERROR' : 'PROCESANDO' }}</span>
            </div>
          </div>

          <div class="progress-details mt-3">
            <div v-if="activeOperation.totalCount > 0" class="progress-counts">
              <span class="count-main">{{ activeOperation.processedCount.toLocaleString() }} / {{ activeOperation.totalCount.toLocaleString() }}</span>
              <span class="count-label">{{ activeOperation.countLabel }}</span>
            </div>
            <div v-else-if="activeOperation.countLabel" class="progress-counts">
              <span class="count-label">{{ activeOperation.countLabel }}</span>
            </div>

            <div v-if="activeOperation.insertedCount > 0 || activeOperation.updatedCount > 0 || activeOperation.skippedCount > 0" class="result-chips mt-3">
              <span class="chip success">+{{ activeOperation.insertedCount.toLocaleString() }} Insertados</span>
              <span class="chip warning">{{ activeOperation.updatedCount.toLocaleString() }} Actualizados</span>
              <span class="chip neutral">{{ activeOperation.skippedCount.toLocaleString() }} Omitidos</span>
              <span v-if="activeOperation.warningsCount > 0" class="chip error">⚠ {{ activeOperation.warningsCount }} Advertencias</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Resumen Final de Importación realizada -->
      <div v-if="lastImportResult" class="alert-banner success mt-4 animate-fade">
        <i class="pi pi-check-circle large-icon"></i>
        <div class="alert-content">
          <h4>¡Importación Completada Exitosamente!</h4>
          <p>{{ lastImportResult.message }}</p>
          <div class="result-chips mt-2">
            <span class="chip success">Insertados: {{ lastImportResult.result.insertedCount }}</span>
            <span class="chip warning">Actualizados: {{ lastImportResult.result.updatedCount }}</span>
            <span class="chip neutral">Omitidos: {{ lastImportResult.result.skippedCount }}</span>
          </div>
        </div>
      </div>

    </div>

    <!-- Banner Error Operacional -->
    <div v-if="operationError" class="alert-banner error mt-4 animate-fade">
      <i class="pi pi-times-circle"></i>
      <div class="alert-content">
        <strong>Error en la operación:</strong>
        <p>{{ operationError }}</p>
      </div>
    </div>

  </div>
</template>

<script>
import { ref, reactive, onMounted, watch } from 'vue';
import { 
  getTables, 
  exportTable, 
  startExportJob, 
  getExportJobStatus, 
  downloadExportFile, 
  uploadPackage, 
  inspectPackage, 
  importPackage, 
  getImportJobStatus 
} from '../services/universalService';

export default {
  name: 'UniversalSqlManager',
  props: {
    connection: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const loading = ref(false);
    const operationError = ref('');
    const mode = ref('export');
    const tablesList = ref([]);

    // Export Form
    const exportForm = reactive({
      tableName: '',
      whereClause: ''
    });
    const lastExportSummary = ref(null);

    // Import Form
    const loadedFileName = ref('');
    const loadedFilePath = ref('');
    const loadedPackageMeta = ref(null);
    const importForm = reactive({
      targetTableName: '',
      strategy: 'skip'
    });
    const inspectionReport = ref(null);
    const lastImportResult = ref(null);

    // Estado Unificado de Progreso (0% a 100%) para Exportación, Carga, Inspección e Importación
    const activeOperation = reactive({
      active: false,
      title: '',
      percent: 0,
      processedCount: 0,
      totalCount: 0,
      countLabel: '',
      insertedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      warningsCount: 0,
      status: 'idle' // 'idle' | 'running' | 'completed' | 'failed'
    });

    // Obtener lista de tablas usando la conexión global
    const fetchTables = async () => {
      if (!props.connection.database) return;
      loading.value = true;
      operationError.value = '';
      try {
        const tables = await getTables(props.connection);
        tablesList.value = tables;
      } catch (err) {
        operationError.value = err.message;
      } finally {
        loading.value = false;
      }
    };

    onMounted(() => {
      fetchTables();
    });

    watch(() => props.connection.database, () => {
      fetchTables();
    });

    // Exportar tabla a archivo .sqlpack con indicador de porcentaje circular (0% a 100%)
    const handleExport = async () => {
      if (!exportForm.tableName) return;
      loading.value = true;
      operationError.value = '';
      lastExportSummary.value = null;

      activeOperation.active = true;
      activeOperation.title = `Exportando Tabla: ${exportForm.tableName}`;
      activeOperation.percent = 0;
      activeOperation.processedCount = 0;
      activeOperation.totalCount = 0;
      activeOperation.countLabel = 'Filas exportadas al archivo';
      activeOperation.insertedCount = 0;
      activeOperation.updatedCount = 0;
      activeOperation.skippedCount = 0;
      activeOperation.warningsCount = 0;
      activeOperation.status = 'running';

      try {
        const jobRes = await startExportJob({
          connection: props.connection,
          tableName: exportForm.tableName,
          whereClause: exportForm.whereClause
        });

        const jobId = jobRes.jobId;

        await new Promise((resolve, reject) => {
          const timer = setInterval(async () => {
            try {
              const job = await getExportJobStatus(jobId);
              if (job) {
                activeOperation.percent = job.percent || 0;
                activeOperation.processedCount = job.processedRows || 0;
                activeOperation.totalCount = job.totalRows || 0;

                if (job.status === 'completed') {
                  clearInterval(timer);
                  activeOperation.status = 'completed';
                  downloadExportFile(jobId);
                  lastExportSummary.value = {
                    tableName: exportForm.tableName,
                    blobSize: job.fileSize
                  };
                  resolve();
                } else if (job.status === 'failed') {
                  clearInterval(timer);
                  activeOperation.status = 'failed';
                  reject(new Error(job.message || 'Error durante la exportación.'));
                }
              }
            } catch (err) {
              clearInterval(timer);
              reject(err);
            }
          }, 300);
        });
      } catch (err) {
        operationError.value = err.message || 'Error al exportar la tabla.';
        activeOperation.status = 'failed';
      } finally {
        loading.value = false;
      }
    };

    // Cargar archivo .sqlpack con barra de carga por porcentaje en vivo (0% a 100%)
    const onFileSelected = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      loading.value = true;
      operationError.value = '';
      inspectionReport.value = null;
      lastImportResult.value = null;
      loadedFileName.value = file.name;

      activeOperation.active = true;
      activeOperation.title = `Subiendo Paquete al Servidor: ${file.name}`;
      activeOperation.percent = 0;
      activeOperation.processedCount = 0;
      activeOperation.totalCount = file.size;
      activeOperation.countLabel = 'Bytes transferidos';
      activeOperation.insertedCount = 0;
      activeOperation.updatedCount = 0;
      activeOperation.skippedCount = 0;
      activeOperation.warningsCount = 0;
      activeOperation.status = 'running';

      try {
        const res = await uploadPackage(file, (percent) => {
          activeOperation.percent = percent;
          activeOperation.processedCount = Math.round((file.size * percent) / 100);
        });

        activeOperation.percent = 100;
        activeOperation.status = 'completed';

        loadedFilePath.value = res.filePath;
        loadedPackageMeta.value = res.packageMeta;
        importForm.targetTableName = res.packageMeta.tableName;
      } catch (err) {
        operationError.value = err.message;
        activeOperation.status = 'failed';
        loadedFilePath.value = '';
        loadedPackageMeta.value = null;
      } finally {
        loading.value = false;
      }
    };

    // Inspeccionar paquete en BD destino
    const handleInspect = async () => {
      if (!loadedFilePath.value && !loadedPackageMeta.value) return;
      loading.value = true;
      operationError.value = '';

      activeOperation.active = true;
      activeOperation.title = `Inspeccionando Metadatos de Tabla Destino`;
      activeOperation.percent = 50;
      activeOperation.processedCount = 0;
      activeOperation.totalCount = 0;
      activeOperation.countLabel = 'Validando estructura y claves primarias...';
      activeOperation.insertedCount = 0;
      activeOperation.updatedCount = 0;
      activeOperation.skippedCount = 0;
      activeOperation.warningsCount = 0;
      activeOperation.status = 'running';

      try {
        const report = await inspectPackage({
          connection: props.connection,
          filePath: loadedFilePath.value,
          targetTableName: importForm.targetTableName
        });
        activeOperation.percent = 100;
        activeOperation.status = 'completed';
        inspectionReport.value = report;
      } catch (err) {
        operationError.value = err.message;
        activeOperation.status = 'failed';
      } finally {
        loading.value = false;
      }
    };

    // Importar a BD destino con animación de porcentaje (0% a 100%)
    const handleImport = async () => {
      if (!loadedFilePath.value && !loadedPackageMeta.value) return;
      loading.value = true;
      operationError.value = '';
      lastImportResult.value = null;

      activeOperation.active = true;
      activeOperation.title = `Importando Registros a Producción`;
      activeOperation.percent = 0;
      activeOperation.processedCount = 0;
      activeOperation.totalCount = inspectionReport.value ? inspectionReport.value.totalInFile : 0;
      activeOperation.countLabel = 'Filas procesadas';
      activeOperation.insertedCount = 0;
      activeOperation.updatedCount = 0;
      activeOperation.skippedCount = 0;
      activeOperation.warningsCount = 0;
      activeOperation.status = 'running';

      try {
        const jobRes = await importPackage({
          connection: props.connection,
          filePath: loadedFilePath.value,
          packageData: loadedFilePath.value ? null : loadedPackageMeta.value,
          targetTableName: importForm.targetTableName,
          importStrategy: importForm.strategy
        });

        const jobId = jobRes.jobId;

        // Polling de progreso en vivo
        await new Promise((resolve, reject) => {
          const timer = setInterval(async () => {
            try {
              const job = await getImportJobStatus(jobId);
              if (job) {
                activeOperation.percent = job.percent || 0;
                activeOperation.processedCount = job.processedRows || 0;
                activeOperation.totalCount = job.totalRows || 0;
                activeOperation.insertedCount = job.insertedCount || 0;
                activeOperation.updatedCount = job.updatedCount || 0;
                activeOperation.skippedCount = job.skippedCount || 0;
                activeOperation.warningsCount = job.warningsCount || 0;

                if (job.status === 'completed') {
                  clearInterval(timer);
                  activeOperation.status = 'completed';
                  lastImportResult.value = {
                    message: `Importación ejecutada exitosamente en alto rendimiento. Insertados: ${job.insertedCount.toLocaleString()}, Actualizados: ${job.updatedCount.toLocaleString()}, Omitidos: ${job.skippedCount.toLocaleString()}.`,
                    result: job
                  };
                  resolve();
                } else if (job.status === 'failed') {
                  clearInterval(timer);
                  activeOperation.status = 'failed';
                  reject(new Error(job.message || 'Error durante la importación en el servidor.'));
                }
              }
            } catch (err) {
              clearInterval(timer);
              reject(err);
            }
          }, 300);
        });
      } catch (err) {
        operationError.value = err.message || 'Error al ejecutar la importación.';
        activeOperation.status = 'failed';
      } finally {
        loading.value = false;
      }
    };

    return {
      loading,
      operationError,
      mode,
      tablesList,
      exportForm,
      lastExportSummary,
      loadedFileName,
      loadedFilePath,
      loadedPackageMeta,
      importForm,
      inspectionReport,
      lastImportResult,
      activeOperation,
      fetchTables,
      handleExport,
      onFileSelected,
      handleInspect,
      handleImport
    };
  }
};
</script>

<style scoped>
.input-with-refresh {
  display: flex;
  gap: 0.5rem;
}

.btn-icon-only {
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mt-3 { margin-top: 0.75rem; }
.mt-4 { margin-top: 1rem; }
.mb-4 { margin-bottom: 1.5rem; }
.gap-4 { gap: 1rem; }

.section-desc {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

.select-input {
  cursor: pointer;
  width: 100%;
}

.tab-subnav {
  display: flex;
  gap: 1rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 0.5rem;
}

.subnav-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}

.subnav-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.file-drop-zone {
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 2.5rem 1rem;
  text-align: center;
  background: var(--bg-tertiary);
  transition: all 0.2s ease;
}

.file-drop-zone.has-file {
  border-color: var(--color-success);
  background: var(--color-success-bg);
}

.file-input-hidden {
  display: none;
}

.file-drop-label {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-secondary);
}

.upload-icon {
  font-size: 2.5rem;
  color: var(--color-primary);
}

.import-options-card, .inspection-report-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
}

.report-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.report-stat {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.report-stat.success { border-color: var(--color-success); }
.report-stat.warning { border-color: var(--color-warning); }
.report-stat.info { border-color: var(--color-accent); }

.stat-num {
  font-size: 1.75rem;
  font-weight: 700;
  font-family: var(--font-title);
}

.stat-lbl {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.alert-banner {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
}

.alert-banner.error {
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error);
}

.alert-banner.success {
  background: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
}

.alert-banner.warning {
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning-border);
  color: var(--color-warning);
}

.large-icon { font-size: 2rem; }

.result-chips {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
}

.chip {
  padding: 0.25rem 0.75rem;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 600;
}

.chip.success { background: rgba(16, 185, 129, 0.2); color: var(--color-success); }
.chip.warning { background: rgba(245, 158, 11, 0.2); color: var(--color-warning); }
.chip.neutral { background: rgba(156, 163, 175, 0.2); color: var(--text-secondary); }
.chip.error { background: rgba(239, 68, 68, 0.2); color: var(--color-error); }

.flex-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

/* Estilos de la tarjeta e indicador de porcentaje circular */
.progress-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
}

.progress-card-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.progress-card-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.icon-running { color: var(--color-primary); font-size: 1.25rem; }
.icon-success { color: var(--color-success); font-size: 1.25rem; }

.circular-progress-container {
  position: relative;
  width: 170px;
  height: 170px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-ring {
  transform: rotate(-90deg);
}

.progress-ring-circle {
  transition: stroke-dashoffset 0.3s ease;
}

.ring-content {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.ring-percent {
  font-size: 2.25rem;
  font-weight: 800;
  font-family: var(--font-title);
  background: linear-gradient(135deg, #a78bfa 0%, #3b82f6 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.ring-status {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.progress-details {
  text-align: center;
}

.count-main {
  font-size: 1.35rem;
  font-weight: 700;
  display: block;
}

.count-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}
</style>
