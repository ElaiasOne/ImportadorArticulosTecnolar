<template>
  <div class="premium-card">
    <div class="card-title">
      <i class="pi pi-database"></i>
      Conexión a Base de Datos
    </div>
    <p class="description">
      Ingrese los parámetros de conexión de su servidor SQL Server. Se utilizará el usuario predeterminado <code>sa</code>.
    </p>

    <div class="form-container">
      <div class="form-group">
        <label for="server">Servidor (SQL Server)</label>
        <div class="input-with-icon">
          <i class="pi pi-server"></i>
          <input
            id="server"
            v-model="server"
            type="text"
            class="text-input"
            placeholder="ej. localhost o .\SQLEXPRESS"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="database">Nombre de la Base de Datos</label>
        <div class="input-with-icon">
          <i class="pi pi-table"></i>
          <input
            id="database"
            v-model="database"
            type="text"
            class="text-input"
            placeholder="ej. TecnolarDb"
            @keyup.enter="handleConnect"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="dbUser">Usuario de Base de Datos</label>
        <div class="input-with-icon">
          <i class="pi pi-user"></i>
          <input
            id="dbUser"
            v-model="dbUser"
            type="text"
            class="text-input"
            placeholder="ej. sa"
          />
        </div>
      </div>

      <div class="form-group">
        <label for="dbPassword">Contraseña de Base de Datos</label>
        <div class="input-with-icon">
          <i class="pi pi-key"></i>
          <input
            id="dbPassword"
            v-model="dbPassword"
            type="password"
            class="text-input"
            placeholder="Ingrese la contraseña"
            @keyup.enter="handleConnect"
          />
        </div>
      </div>

      <div class="button-row">
        <button 
          class="btn-primary" 
          :disabled="loading || !database || !dbUser || !dbPassword" 
          @click="handleConnect"
        >
          <i v-if="loading" class="pi pi-spin pi-spinner"></i>
          <i v-else class="pi pi-check-circle"></i>
          Conectar y Continuar
        </button>
      </div>

      <div v-if="errorMsg" class="alert-message error animate-fade">
        <i class="pi pi-times-circle"></i>
        <div>
          <strong>Error de Conexión:</strong>
          <pre class="error-pre">{{ errorMsg }}</pre>
        </div>
      </div>

      <div v-if="successMsg" class="alert-message success animate-fade">
        <i class="pi pi-check-circle"></i>
        <div>
          {{ successMsg }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import api from '../services/api';

export default {
  name: 'DBConnection',
  emits: ['connected'],
  setup(props, { emit }) {
    const server = ref('localhost');
    const database = ref('');
    const dbUser = ref('');
    const dbPassword = ref('');
    const loading = ref(false);
    const errorMsg = ref('');
    const successMsg = ref('');

    const handleConnect = async () => {
      if (!database.value) return;

      loading.value = true;
      errorMsg.value = '';
      successMsg.value = '';

      try {
        // 1. Probar la conexión a la base de datos
        const connResponse = await api.testConnection(server.value, database.value, dbUser.value, dbPassword.value);
        
        if (connResponse.success) {
          successMsg.value = connResponse.message;
          
          // 2. Obtener departamentos e IVAs de la BD para usar en el mapeo y la grilla
          const metaResponse = await api.getDbMetadata(server.value, database.value, dbUser.value, dbPassword.value);
          
          setTimeout(() => {
            emit('connected', {
              server: server.value,
              database: database.value,
              user: dbUser.value,
              password: dbPassword.value,
              metadata: metaResponse.data
            });
          }, 1000);
        }
      } catch (err) {
        successMsg.value = '';
        if (err.response && err.response.data && err.response.data.message) {
          errorMsg.value = err.response.data.message;
        } else {
          errorMsg.value = `No se pudo establecer conexión con el servidor. Detalle: ${err.message}`;
        }
      } finally {
        loading.value = false;
      }
    };

    return {
      server,
      database,
      dbUser,
      dbPassword,
      loading,
      errorMsg,
      successMsg,
      handleConnect
    };
  }
};
</script>

<style scoped>
.description {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 2rem;
}

.form-container {
  max-width: 500px;
  margin: 0 auto;
  text-align: left;
}

.input-with-icon {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-icon i {
  position: absolute;
  left: 1rem;
  color: var(--text-muted);
}

.input-with-icon input {
  width: 100%;
  padding-left: 2.75rem;
}

.button-row {
  margin-top: 2rem;
  display: flex;
  justify-content: flex-end;
}

.alert-message {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  display: flex;
  gap: 0.75rem;
  font-size: 0.9rem;
}

.alert-message.error {
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error);
}

.alert-message.success {
  background: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
}

.error-pre {
  margin-top: 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.8rem;
  white-space: pre-wrap;
  word-break: break-all;
  background: rgba(0, 0, 0, 0.2);
  padding: 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  max-height: 150px;
  overflow-y: auto;
}

.animate-fade {
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
