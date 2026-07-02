<template>
  <div class="app-layout">
    
    <!-- Encabezado premium superior -->
    <header class="app-header">
      <div class="logo-container">
        <i class="pi pi-database logo-icon"></i>
        <div class="logo-text">Importador de Artículos ERP</div>
      </div>
      <div class="user-badge">
        <i class="pi pi-user-edit"></i>
        <span>Técnico Tecnolar</span>
      </div>
    </header>

    <main class="main-container">
      
      <!-- Barra de progreso de pasos del asistente -->
      <div class="premium-card mb-4" style="padding: 1.5rem 2rem;">
        <div class="steps-indicator">
          
          <div 
            class="step-node" 
            :class="{ active: currentStep === 1, completed: currentStep > 1 }"
          >
            <div class="step-circle">
              <span v-if="currentStep <= 1">1</span>
              <i v-else class="pi pi-check"></i>
            </div>
            <span class="step-label">Base de Datos</span>
          </div>

          <div 
            class="step-node" 
            :class="{ active: currentStep === 2, completed: currentStep > 2 }"
          >
            <div class="step-circle">
              <span v-if="currentStep <= 2">2</span>
              <i v-else class="pi pi-check"></i>
            </div>
            <span class="step-label">Mapear Columnas</span>
          </div>

          <div 
            class="step-node" 
            :class="{ active: currentStep === 3, completed: currentStep > 3 }"
          >
            <div class="step-circle">
              <span v-if="currentStep <= 3">3</span>
              <i v-else class="pi pi-check"></i>
            </div>
            <span class="step-label">Vista Previa y Ajustes</span>
          </div>

          <div 
            class="step-node" 
            :class="{ active: currentStep === 4, completed: currentStep > 4 }"
          >
            <div class="step-circle">
              <span>4</span>
            </div>
            <span class="step-label">Importación Exitosa</span>
          </div>

        </div>
      </div>

      <!-- Vista principal del paso -->
      <div class="step-content-container">
        
        <!-- PASO 1: Conectar a la Base de Datos -->
        <DBConnection
          v-if="currentStep === 1"
          @connected="onDbConnected"
        />

        <!-- PASO 2: Subir Excel y Mapear Campos -->
        <FileUpload
          v-else-if="currentStep === 2"
          :connection="connection"
          @processed="onExcelProcessed"
          @back="currentStep = 1"
        />

        <!-- PASO 3: Vista Previa en Grilla -->
        <PreviewGrid
          v-else-if="currentStep === 3"
          :rows="gridRows"
          :connection="connection"
          :db-metadata="dbMetadata"
          :file-path="excelFilePath"
          @back="currentStep = 2"
          @imported="onImportedSuccessfully"
        />

        <!-- PASO 4: Vista de Éxito -->
        <div v-else-if="currentStep === 4" class="premium-card success-screen animate-fade">
          <div class="success-icon-wrapper">
            <i class="pi pi-check-circle success-large-icon"></i>
          </div>
          <h2 class="success-title">¡Importación Completada!</h2>
          <p class="success-desc">{{ importedMessage }}</p>
          
          <div class="imported-details">
            <div class="detail-item">
              <span class="detail-lbl">Base de Datos:</span>
              <span class="detail-val">{{ connection.database }}</span>
            </div>
            <div class="detail-item">
              <span class="detail-lbl">Servidor:</span>
              <span class="detail-val">{{ connection.server }}</span>
            </div>
          </div>

          <div class="success-actions">
            <button class="btn-primary" @click="resetWizard">
              <i class="pi pi-refresh"></i> Importar otro archivo
            </button>
          </div>
        </div>

      </div>

    </main>
  </div>
</template>

<script>
import { ref } from 'vue';
import DBConnection from './components/DBConnection.vue';
import FileUpload from './components/FileUpload.vue';
import PreviewGrid from './components/PreviewGrid.vue';

export default {
  name: 'App',
  components: {
    DBConnection,
    FileUpload,
    PreviewGrid
  },
  setup() {
    const currentStep = ref(1);
    
    // Detalles de la conexión a la base de datos
    const connection = ref({
      server: '',
      database: '',
      user: '',
      password: ''
    });

    // Metadatos de la BD recuperados tras conexión exitosa
    const dbMetadata = ref({
      departamentos: [],
      ivas: []
    });

    // Detalles de los archivos Excel procesados
    const excelFilePath = ref('');
    const gridRows = ref([]);

    // Registro del mensaje final de importación
    const importedMessage = ref('');

    const onDbConnected = (data) => {
      connection.value.server = data.server;
      connection.value.database = data.database;
      connection.value.user = data.user;
      connection.value.password = data.password;
      dbMetadata.value = data.metadata;
      currentStep.value = 2;
    };

    const onExcelProcessed = (data) => {
      excelFilePath.value = data.filePath;
      gridRows.value = data.rows;
      currentStep.value = 3;
    };

    const onImportedSuccessfully = (message) => {
      importedMessage.value = message;
      currentStep.value = 4;
    };

    const resetWizard = () => {
      excelFilePath.value = '';
      gridRows.value = [];
      importedMessage.value = '';
      currentStep.value = 2; // Volver al paso de subir Excel, manteniendo activa la conexión a la BD
    };

    return {
      currentStep,
      connection,
      dbMetadata,
      excelFilePath,
      gridRows,
      importedMessage,
      onDbConnected,
      onExcelProcessed,
      onImportedSuccessfully,
      resetWizard
    };
  }
};
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.step-content-container {
  flex-grow: 1;
}

.success-screen {
  text-align: center;
  padding: 4rem 2rem;
  max-width: 600px;
  margin: 0 auto;
}

.success-icon-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.success-large-icon {
  font-size: 5rem;
  color: var(--color-success);
  filter: drop-shadow(0 0 15px rgba(16, 185, 129, 0.4));
}

.success-title {
  font-family: var(--font-title);
  font-size: 2.25rem;
  font-weight: 700;
  margin-bottom: 1rem;
}

.success-desc {
  color: var(--text-secondary);
  font-size: 1.1rem;
  margin-bottom: 2.5rem;
}

.imported-details {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 1.5rem;
  margin-bottom: 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  text-align: left;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 0.95rem;
}

.detail-lbl {
  color: var(--text-secondary);
  font-weight: 500;
}

.detail-val {
  color: var(--text-primary);
  font-weight: 600;
}

.success-actions {
  display: flex;
  justify-content: center;
}

.mb-4 { margin-bottom: 1rem; }
.animate-fade {
  animation: fadeIn 0.4s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}
</style>
