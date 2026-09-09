<template>
  <header class="app-header">
    <div class="logo-container">
      <i class="pi pi-database logo-icon"></i>
      <div class="logo-text">Tecnolar ERP Tools</div>
    </div>

    <!-- Navegación de módulos principal (solo visible si está conectado) -->
    <nav v-if="isConnected" class="nav-tabs">
      <button 
        class="nav-tab-btn" 
        :class="{ active: activeModule === 'articulos' }"
        @click="$emit('update:activeModule', 'articulos')"
      >
        <i class="pi pi-box"></i>
        <span>Importador de Artículos</span>
      </button>

      <button 
        class="nav-tab-btn" 
        :class="{ active: activeModule === 'universal' }"
        @click="$emit('update:activeModule', 'universal')"
      >
        <i class="pi pi-sync"></i>
        <span>Exportador / Importador Universal SQL</span>
      </button>
    </nav>

    <!-- Insignia de estado de conexión y usuario -->
    <div class="header-right">
      <div v-if="isConnected" class="status-chip success">
        <i class="pi pi-check-circle"></i>
        <span>{{ connection.database }} ({{ connection.server }})</span>
        <button class="btn-disconnect" title="Cambiar Base de Datos / Desconectar" @click="$emit('disconnect')">
          <i class="pi pi-power-off"></i>
        </button>
      </div>

      <div class="user-badge">
        <i class="pi pi-user-edit"></i>
        <span>Técnico Tecnolar</span>
      </div>
    </div>
  </header>
</template>

<script>
export default {
  name: 'NavHeader',
  props: {
    activeModule: {
      type: String,
      default: 'articulos'
    },
    isConnected: {
      type: Boolean,
      default: false
    },
    connection: {
      type: Object,
      default: () => ({ server: '', database: '' })
    }
  },
  emits: ['update:activeModule', 'disconnect']
};
</script>

<style scoped>
.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-tabs {
  display: flex;
  gap: 0.5rem;
  background: var(--bg-tertiary);
  padding: 0.35rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-color);
}

.nav-tab-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  padding: 0.5rem 1.25rem;
  border-radius: var(--radius-full);
  font-family: var(--font-sans);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.nav-tab-btn:hover {
  color: var(--text-primary);
}

.nav-tab-btn.active {
  background: var(--color-primary);
  color: var(--text-primary);
  box-shadow: var(--shadow-glow);
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.85rem;
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 600;
}

.status-chip.success {
  background: var(--color-success-bg);
  border: 1px solid var(--color-success-border);
  color: var(--color-success);
}

.btn-disconnect {
  background: transparent;
  border: none;
  color: var(--color-error);
  cursor: pointer;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  margin-left: 0.25rem;
  padding: 0.2rem;
  border-radius: var(--radius-full);
  transition: transform 0.2s ease;
}

.btn-disconnect:hover {
  transform: scale(1.15);
}
</style>
