<template>
  <div class="preview-layout animate-fade">
    
    <!-- Row stats summary -->
    <div class="stats-grid">
      <div class="stat-card total">
        <div class="stat-value">{{ rows.length }}</div>
        <div class="stat-label"><i class="pi pi-list"></i> Total Artículos</div>
      </div>
      <div class="stat-card success-card" :class="{ active: filterStatus === 'success' }" @click="toggleStatusFilter('success')">
        <div class="stat-value">{{ countSuccess }}</div>
        <div class="stat-label"><i class="pi pi-check-circle"></i> Correctos</div>
      </div>
      <div class="stat-card warning-card" :class="{ active: filterStatus === 'warning' }" @click="toggleStatusFilter('warning')">
        <div class="stat-value">{{ countWarning }}</div>
        <div class="stat-label"><i class="pi pi-exclamation-triangle"></i> Advertencias</div>
      </div>
      <div class="stat-card error-card" :class="{ active: filterStatus === 'error' }" @click="toggleStatusFilter('error')">
        <div class="stat-value">{{ countError }}</div>
        <div class="stat-label"><i class="pi pi-times-circle"></i> Errores</div>
      </div>
    </div>

    <!-- Actions and filters bar -->
    <div class="actions-bar">
      <div class="search-box">
        <i class="pi pi-search"></i>
        <input 
          v-model="globalFilter" 
          type="text" 
          class="text-input search-input" 
          placeholder="Buscar por descripción, código o EAN..."
        />
      </div>

      <div class="button-group">
        <button class="btn-secondary" @click="$emit('back')">
          <i class="pi pi-arrow-left"></i> Cambiar Mapeo
        </button>
        <button 
          class="btn-primary" 
          :disabled="countError > 0 || importing" 
          @click="confirmImport"
        >
          <i v-if="importing" class="pi pi-spin pi-spinner"></i>
          <i v-else class="pi pi-database"></i>
          Importar {{ filteredRows.length }} Artículos
        </button>
      </div>
    </div>

    <div v-if="countError > 0" class="alert-message error-banner">
      <i class="pi pi-exclamation-circle"></i>
      <span>No se puede importar. Debe corregir los <strong>{{ countError }} errores</strong> en la grilla haciendo doble clic sobre las celdas marcadas.</span>
    </div>

    <!-- Primary Data Table -->
    <div class="table-container">
      <table class="custom-table">
        <thead>
          <tr>
            <th>Estado</th>
            <th>Fila Excel</th>
            <th @click="changeSort('Codigo')">Código <i class="pi pi-sort"></i></th>
            <th @click="changeSort('Descripcion')">Descripción <i class="pi pi-sort"></i></th>
            <th @click="changeSort('EAN')">EAN / Código Barras <i class="pi pi-sort"></i></th>
            <th @click="changeSort('PrecioCosto')">Precio Costo <i class="pi pi-sort"></i></th>
            <th @click="changeSort('PrecioVenta')">Precio Venta <i class="pi pi-sort"></i></th>
            <th>IVA (Código)</th>
            <th>Rubro (Código)</th>
            <th>Familia</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(row, idx) in paginatedRows" 
            :key="row._rowNum" 
            :class="`row-${row.status}`"
            @click="selectedRow = row"
          >
            <!-- Status Badge -->
            <td class="text-center">
              <span 
                class="status-dot" 
                :class="row.status"
                :title="row.messages.map(m => m.text).join('\n')"
              >
                <i v-if="row.status === 'success'" class="pi pi-check"></i>
                <i v-else-if="row.status === 'warning'" class="pi pi-exclamation-triangle"></i>
                <i v-else class="pi pi-times"></i>
              </span>
            </td>

            <td class="text-center text-muted font-mono">{{ row._rowNum }}</td>

            <!-- Editable Columns -->
            <td class="editable-cell" @dblclick="startEdit(row, 'Codigo')">
              <input 
                v-if="isEditing(row, 'Codigo')" 
                v-model.number="editValue" 
                type="number"
                class="cell-input"
                @blur="saveEdit(row, 'Codigo')"
                @keyup.enter="saveEdit(row, 'Codigo')"
                @keyup.esc="cancelEdit"
                ref="editInput"
              />
              <span v-else>{{ row.Codigo || '---' }}</span>
            </td>

            <td class="editable-cell" @dblclick="startEdit(row, 'Descripcion')">
              <input 
                v-if="isEditing(row, 'Descripcion')" 
                v-model="editValue" 
                type="text"
                class="cell-input text-left"
                @blur="saveEdit(row, 'Descripcion')"
                @keyup.enter="saveEdit(row, 'Descripcion')"
                @keyup.esc="cancelEdit"
                ref="editInput"
              />
              <span v-else class="text-left-align">{{ row.Descripcion }}</span>
            </td>

            <td class="editable-cell" @dblclick="startEdit(row, 'EAN')">
              <input 
                v-if="isEditing(row, 'EAN')" 
                v-model="editValue" 
                type="text"
                class="cell-input"
                @blur="saveEdit(row, 'EAN')"
                @keyup.enter="saveEdit(row, 'EAN')"
                @keyup.esc="cancelEdit"
                ref="editInput"
              />
              <span v-else class="font-mono">{{ row.EAN || '---' }}</span>
            </td>

            <td class="editable-cell" @dblclick="startEdit(row, 'PrecioCosto')">
              <input 
                v-if="isEditing(row, 'PrecioCosto')" 
                v-model.number="editValue" 
                type="number"
                step="0.01"
                class="cell-input"
                @blur="saveEdit(row, 'PrecioCosto')"
                @keyup.enter="saveEdit(row, 'PrecioCosto')"
                @keyup.esc="cancelEdit"
                ref="editInput"
              />
              <span v-else>{{ formatNumber(row.PrecioCosto) }}</span>
            </td>

            <td class="editable-cell" @dblclick="startEdit(row, 'PrecioVenta')">
              <input 
                v-if="isEditing(row, 'PrecioVenta')" 
                v-model.number="editValue" 
                type="number"
                step="0.01"
                class="cell-input"
                @blur="saveEdit(row, 'PrecioVenta')"
                @keyup.enter="saveEdit(row, 'PrecioVenta')"
                @keyup.esc="cancelEdit"
                ref="editInput"
              />
              <span v-else>{{ formatNumber(row.PrecioVenta) }}</span>
            </td>

            <!-- IVA dropdown select -->
            <td class="editable-cell" @dblclick="startEdit(row, 'IVA')">
              <select 
                v-if="isEditing(row, 'IVA')" 
                v-model="editValue"
                class="cell-input select-cell"
                @change="saveEdit(row, 'IVA')"
                @blur="saveEdit(row, 'IVA')"
                ref="editInput"
              >
                <option 
                  v-for="iva in dbMetadata.ivas" 
                  :key="iva.Codigo" 
                  :value="iva.Codigo"
                >
                  Código: {{ iva.Codigo }} ({{ iva.Porcentaje }})
                </option>
              </select>
              <span v-else>{{ row.IVA }}</span>
            </td>

            <!-- Departamento select -->
            <td class="editable-cell" @dblclick="startEdit(row, 'Departamento')">
              <select 
                v-if="isEditing(row, 'Departamento')" 
                v-model="editValue"
                class="cell-input select-cell"
                @change="saveEdit(row, 'Departamento')"
                @blur="saveEdit(row, 'Departamento')"
                ref="editInput"
              >
                <option 
                  v-for="d in dbMetadata.departamentos" 
                  :key="d.Codigo" 
                  :value="d.Codigo"
                >
                  Código: {{ d.Codigo }} ({{ d.Descripcion }})
                </option>
              </select>
              <span v-else>{{ row.Departamento }}</span>
            </td>

            <td class="editable-cell" @dblclick="startEdit(row, 'Familia')">
              <input 
                v-if="isEditing(row, 'Familia')" 
                v-model.number="editValue" 
                type="number"
                class="cell-input"
                @blur="saveEdit(row, 'Familia')"
                @keyup.enter="saveEdit(row, 'Familia')"
                @keyup.esc="cancelEdit"
                ref="editInput"
              />
              <span v-else>{{ row.Familia }}</span>
            </td>

            <!-- Delete action button -->
            <td class="text-center">
              <button 
                class="btn-delete animate-pulse" 
                @click.stop="removeRow(row)" 
                title="Eliminar este artículo"
              >
                <i class="pi pi-trash"></i>
              </button>
            </td>
          </tr>

          <tr v-if="filteredRows.length === 0">
            <td colspan="11" class="no-data">
              <i class="pi pi-info-circle"></i> No se encontraron registros que coincidan con la búsqueda o el filtro.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination controls -->
    <div class="pagination-bar" v-if="filteredRows.length > 0">
      <span class="pagination-info">
        Mostrando registros <strong>{{ (currentPage - 1) * pageSize + 1 }}</strong> al 
        <strong>{{ Math.min(currentPage * pageSize, filteredRows.length) }}</strong> de 
        <strong>{{ filteredRows.length }}</strong>
      </span>

      <div class="pagination-buttons">
        <button 
          class="btn-secondary btn-sm" 
          :disabled="currentPage === 1" 
          @click="currentPage = 1"
        >
          <i class="pi pi-angle-double-left"></i>
        </button>
        <button 
          class="btn-secondary btn-sm" 
          :disabled="currentPage === 1" 
          @click="currentPage--"
        >
          <i class="pi pi-angle-left"></i> Anterior
        </button>
        
        <span class="page-number">Página {{ currentPage }} de {{ totalPages }}</span>

        <button 
          class="btn-secondary btn-sm" 
          :disabled="currentPage === totalPages" 
          @click="currentPage++"
        >
          Siguiente <i class="pi pi-angle-right"></i>
        </button>
        <button 
          class="btn-secondary btn-sm" 
          :disabled="currentPage === totalPages" 
          @click="currentPage = totalPages"
        >
          <i class="pi pi-angle-double-right"></i>
        </button>
      </div>
    </div>

    <!-- Selected Row Error Details Sidebar -->
    <div v-if="selectedRow && selectedRow.messages.length > 0" class="error-sidebar animate-fade">
      <div class="sidebar-header">
        <h4>
          <i class="pi pi-exclamation-triangle"></i> 
          Fila {{ selectedRow._rowNum }}: {{ selectedRow.Descripcion || 'Sin Descripción' }}
        </h4>
        <button class="close-btn" @click="selectedRow = null">
          <i class="pi pi-times"></i>
        </button>
      </div>
      <div class="sidebar-content">
        <ul>
          <li 
            v-for="(msg, i) in selectedRow.messages" 
            :key="i" 
            :class="msg.type"
          >
            <i :class="msg.type === 'error' ? 'pi pi-times-circle' : 'pi pi-info-circle'"></i>
            <span>{{ msg.text }}</span>
          </li>
        </ul>
        <p class="sidebar-instructions">
          Haga <strong>doble clic</strong> sobre la celda correspondiente en la grilla para editar el valor y corregir el error o la advertencia.
        </p>
      </div>
    </div>

    <!-- DB Import confirmation modal -->
    <div v-if="showConfirmModal" class="modal-overlay">
      <div class="premium-card modal-content animate-fade">
        <div class="card-title">
          <i class="pi pi-exclamation-triangle text-warning"></i>
          Confirmar Importación
        </div>
        <p>
          ¿Está seguro de que desea importar los <strong>{{ filteredRows.length }}</strong> artículos en la base de datos <strong>{{ connection.database }}</strong>?
        </p>
        <div class="modal-details">
          <ul>
            <li><strong>Servidor:</strong> {{ connection.server }}</li>
            <li><strong>Base de Datos:</strong> {{ connection.database }}</li>
            <li><strong>Registros correctos a insertar:</strong> {{ filteredRows.length }}</li>
          </ul>
          <p class="warning-alert mt-2">
            <i class="pi pi-info-circle"></i> Esta operación es transaccional. Si ocurre algún error en SQL Server, toda la importación se cancelará (Rollback).
          </p>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" @click="showConfirmModal = false">Cancelar</button>
          <button class="btn-primary" @click="executeImport">
            <i class="pi pi-check"></i> Sí, Importar en Base de Datos
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, nextTick } from 'vue';
import api from '../services/api';

function parseMoney(val) {
  if (val === null || val === undefined || val === '') return 0;
  let str = val.toString().trim().replace(/\$/g, '').replace(/\s+/g, '');
  if (str.includes('.') && str.includes(',')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      str = str.replace(/\./g, '').replace(/,/g, '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    str = str.replace(/,/g, '.');
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) ? 0 : parsed;
}

function cleanDescription(desc) {
  if (!desc) return '';
  return desc.toString().replace(/["'`]/g, ' ').trim();
}

export default {
  name: 'PreviewGrid',
  props: {
    rows: {
      type: Array,
      required: true
    },
    connection: {
      type: Object,
      required: true
    },
    dbMetadata: {
      type: Object,
      required: true
    },
    filePath: {
      type: String,
      required: true
    }
  },
  emits: ['back', 'imported'],
  setup(props, { emit }) {
    const gridRows = ref([...props.rows]);
    const globalFilter = ref('');
    const filterStatus = ref(''); // success, warning, error, o vacío para todos
    
    // Paginación
    const currentPage = ref(1);
    const pageSize = ref(15);
    
    // Estados de ordenamiento
    const sortField = ref('');
    const sortOrder = ref(1); // 1 = asc, -1 = desc

    // Fila seleccionada para mostrar errores detallados
    const selectedRow = ref(null);

    // Estados de edición
    const editingRow = ref(null);
    const editingField = ref('');
    const editValue = ref(null);
    const editInput = ref(null);

    // Modal de importación
    const showConfirmModal = ref(false);
    const importing = ref(false);

    // Estados de conteo
    const countSuccess = computed(() => gridRows.value.filter(r => r.status === 'success').length);
    const countWarning = computed(() => gridRows.value.filter(r => r.status === 'warning').length);
    const countError = computed(() => gridRows.value.filter(r => r.status === 'error').length);

    // Funciones auxiliares para etiquetas
    const getIvaLabel = (code) => {
      const match = props.dbMetadata.ivas.find(iva => iva.Codigo === code);
      return match ? `${match.Porcentaje}%` : `Cod: ${code}`;
    };

    const getDeptoLabel = (code) => {
      const match = props.dbMetadata.departamentos.find(d => d.Codigo === code);
      return match ? match.Descripcion : `Cod: ${code}`;
    };

    // Filtrar filas según el texto de búsqueda y el filtro de estado
    const filteredRows = computed(() => {
      let filtered = gridRows.value;

      // Filtro de estado
      if (filterStatus.value) {
        filtered = filtered.filter(r => r.status === filterStatus.value);
      }

      // Filtro por texto de búsqueda
      if (globalFilter.value.trim()) {
        const query = globalFilter.value.toLowerCase().trim();
        filtered = filtered.filter(r => 
          (r.Codigo && r.Codigo.toString().includes(query)) ||
          (r.Descripcion && r.Descripcion.toLowerCase().includes(query)) ||
          (r.EAN && r.EAN.toString().includes(query))
        );
      }

      // Ordenar
      if (sortField.value) {
        filtered = [...filtered].sort((a, b) => {
          let valA = a[sortField.value];
          let valB = b[sortField.value];

          if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = (valB || '').toLowerCase();
          }

          if (valA < valB) return -1 * sortOrder.value;
          if (valA > valB) return 1 * sortOrder.value;
          return 0;
        });
      }

      return filtered;
    });

    const totalPages = computed(() => {
      return Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value));
    });

    const paginatedRows = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value;
      const end = start + pageSize.value;
      return filteredRows.value.slice(start, end);
    });

    watch(filteredRows, () => {
      // Reiniciar a la página 1 si la lista cambia
      if (currentPage.value > totalPages.value) {
        currentPage.value = 1;
      }
    });

    const toggleStatusFilter = (status) => {
      if (filterStatus.value === status) {
        filterStatus.value = '';
      } else {
        filterStatus.value = status;
      }
      currentPage.value = 1;
    };

    const changeSort = (field) => {
      if (sortField.value === field) {
        sortOrder.value = sortOrder.value === 1 ? -1 : 1;
      } else {
        sortField.value = field;
        sortOrder.value = 1;
      }
    };

    // Lógica de edición
    const isEditing = (row, field) => {
      return editingRow.value === row && editingField.value === field;
    };

    const startEdit = (row, field) => {
      editingRow.value = row;
      editingField.value = field;
      editValue.value = row[field];
      
      nextTick(() => {
        if (editInput.value) {
          if (Array.isArray(editInput.value)) {
            editInput.value[0].focus();
            if (editInput.value[0].select) editInput.value[0].select();
          } else {
            editInput.value.focus();
            if (editInput.value.select) editInput.value.select();
          }
        }
      });
    };

    const cancelEdit = () => {
      editingRow.value = null;
      editingField.value = '';
      editValue.value = null;
    };

    const saveEdit = (row, field) => {
      if (editingRow.value !== row || editingField.value !== field) return;

      row[field] = editValue.value;
      
      // Realizar verificación de validación local para esta fila
      validateRow(row);

      // Forzar reactividad del computed
      gridRows.value = [...gridRows.value];
      
      cancelEdit();
    };

    // Implementación local de la validación de reglas de negocio
    const isPesableDescription = (desc) => {
      if (!desc) return false;
      const upperDesc = desc.toString().toUpperCase();
      const searchTerms = ['XKG', 'KG', 'POR KG', 'PRECIO KG'];
      return searchTerms.some(term => {
        if (term === 'KG') {
          return upperDesc === 'KG' || 
                 upperDesc.includes(' KG') || 
                 upperDesc.includes('KG ') || 
                 upperDesc.endsWith('KG') || 
                 upperDesc.includes('XKG') || 
                 upperDesc.includes('X KG');
        }
        return upperDesc.includes(term);
      });
    };

    const validateRow = (row) => {
      row.messages = [];
      row.status = 'success';

      // 1. Validar / Generar Código
      let codeNum = null;
      let resolvedCode = row.Codigo;

      // Extraer EAN corto como código si no hay código provisto
      if ((resolvedCode === null || resolvedCode === undefined || resolvedCode === '') && row.EAN) {
        const eanClean = row.EAN.toString().trim();
        const parsed = parseInt(eanClean, 10);
        if (!isNaN(parsed) && parsed > 0 && eanClean.length <= 6) {
          resolvedCode = parsed;
        }
      }

      if (resolvedCode !== null && resolvedCode !== undefined && resolvedCode !== '') {
        const cleanCodeStr = resolvedCode.toString().trim().replace(/\s+/g, '');
        const parsedVal = parseInt(cleanCodeStr, 10);

        if (!isNaN(parsedVal) && parsedVal > 0 && parsedVal <= 2147483647 && cleanCodeStr.length <= 9) {
          codeNum = parsedVal;
        } else {
          // EAN o demasiado grande. Autogenerar código
          let maxGridCode = 0;
          gridRows.value.forEach(r => {
            if (r !== row && r.Codigo) {
              const num = parseInt(r.Codigo, 10);
              if (!isNaN(num) && num > maxGridCode) {
                maxGridCode = num;
              }
            }
          });
          codeNum = maxGridCode + 1;
          row.messages.push({ type: 'warning', text: `El valor de código '${resolvedCode}' es un EAN o excede el límite. Se autogeneró el Código ${codeNum}.` });
          if (row.status !== 'error') row.status = 'warning';
        }
      } else {
        // Autogenerar código
        let maxGridCode = 0;
        gridRows.value.forEach(r => {
          if (r !== row && r.Codigo) {
            const num = parseInt(r.Codigo, 10);
            if (!isNaN(num) && num > maxGridCode) {
              maxGridCode = num;
            }
          }
        });
        codeNum = maxGridCode + 1;
        row.messages.push({ type: 'warning', text: `Código Interno no provisto. Se autogeneró el Código ${codeNum}.` });
        if (row.status !== 'error') row.status = 'warning';
      }

      if (codeNum) {
        row.Codigo = codeNum;
        // comprobar duplicados en la grilla
        const isDup = gridRows.value.some(r => r !== row && r.Codigo === codeNum);
        if (isDup) {
          row.messages.push({ type: 'error', text: `El Código Interno ${codeNum} está duplicado en la grilla.` });
          row.status = 'error';
        }
      }

      // 2. Validar Descripción
      if (!row.Descripcion || !row.Descripcion.trim()) {
        row.messages.push({ type: 'error', text: 'La Descripción es obligatoria.' });
        row.status = 'error';
      } else {
        const cleanedDesc = cleanDescription(row.Descripcion);
        row.Descripcion = cleanedDesc.trim().slice(0, 50);
        row.DescripcionCorta = cleanedDesc.slice(0, 20);
      }

      // 3. Precios
      let price = parseMoney(row.PrecioVenta);
      let cost = price * 0.5;

      row.PrecioCosto = cost;
      row.PrecioVenta = price;

      // El margen no se calcula, el cliente lo asignará después. Por defecto 0.
      row.Margen = 0;

      // 4. Comprobación de pesables
      const isPesable = isPesableDescription(row.Descripcion);
      if (isPesable) {
        row.Tipo = 'P';
        row.HabilBalanzas = true;
        
        let plu = 0;
        if (row.EAN) {
          const cleanEanVal = row.EAN.toString().replace(/[^0-9]/g, '');
          const parsed = parseInt(cleanEanVal, 10);
          if (!isNaN(parsed) && parsed > 0 && cleanEanVal.length <= 6) {
            plu = parsed;
          }
        }
        if (!plu && row.Codigo) {
          plu = row.Codigo % 100000;
        }

        row.BalCodigo = plu;
        const codePadded = String(plu).padStart(5, '0');
        row.EAN = `20${codePadded}00000`; // EAN generado
      } else {
        row.Tipo = 'N';
        row.HabilBalanzas = false;
        row.BalCodigo = 0;
        
        // Limpiar EAN
        if (row.EAN) {
          let cleanEanVal = row.EAN.toString().replace(/\s+/g, '');
          if (cleanEanVal.length === 13) {
            cleanEanVal = cleanEanVal.slice(0, 12);
          }
          row.EAN = cleanEanVal;
        } else if (row.Codigo) {
          // Regenerar EAN de fallback
          row.EAN = '779' + String(row.Codigo).padStart(9, '0');
        }
      }

      // Comprobar duplicados de EAN en la grilla
      if (row.EAN) {
        const isDupEan = gridRows.value.some(r => r !== row && r.EAN === row.EAN);
        if (isDupEan) {
          row.messages.push({ type: 'error', text: `El EAN ${row.EAN} está duplicado en la grilla.` });
          row.status = 'error';
        }
      }
    };

    // Ejecuciones de importación
    const confirmImport = () => {
      if (countError.value > 0) return;
      showConfirmModal.value = true;
    };

    const executeImport = async () => {
      showConfirmModal.value = false;
      importing.value = true;

      try {
        const response = await api.confirmImport(
          gridRows.value,
          props.connection.server,
          props.connection.database,
          props.connection.user,
          props.connection.password,
          props.filePath
        );

        if (response.success) {
          emit('imported', response.message);
        }
      } catch (err) {
        let msg = `Ocurrió un error inesperado al guardar.`;
        if (err.response && err.response.data && err.response.data.message) {
          msg = err.response.data.message;
        }
        alert(msg);
      } finally {
        importing.value = false;
      }
    };

    const formatNumber = (num) => {
      if (num === null || num === undefined) return '0.00';
      return parseFloat(num).toFixed(2);
    };

    const removeRow = (row) => {
      gridRows.value = gridRows.value.filter(r => r !== row);
      if (selectedRow.value === row) {
        selectedRow.value = null;
      }
    };

    return {
      gridRows,
      globalFilter,
      filterStatus,
      currentPage,
      pageSize,
      sortField,
      sortOrder,
      selectedRow,
      editingRow,
      editingField,
      editValue,
      editInput,
      showConfirmModal,
      importing,
      countSuccess,
      countWarning,
      countError,
      filteredRows,
      totalPages,
      paginatedRows,
      toggleStatusFilter,
      changeSort,
      isEditing,
      startEdit,
      cancelEdit,
      saveEdit,
      getIvaLabel,
      getDeptoLabel,
      confirmImport,
      executeImport,
      formatNumber,
      removeRow
    };
  }
};
</script>

<style scoped>
.preview-layout {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 1.25rem;
  border-radius: var(--radius-md);
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-2px);
}

.stat-card.total {
  border-left: 4px solid var(--color-primary);
  cursor: default;
}
.stat-card.total:hover {
  transform: none;
}

.stat-card.success-card {
  border-left: 4px solid var(--color-success);
}
.stat-card.success-card.active, .stat-card.success-card:hover {
  background: var(--color-success-bg);
  border-color: var(--color-success-border);
}

.stat-card.warning-card {
  border-left: 4px solid var(--color-warning);
}
.stat-card.warning-card.active, .stat-card.warning-card:hover {
  background: var(--color-warning-bg);
  border-color: var(--color-warning-border);
}

.stat-card.error-card {
  border-left: 4px solid var(--color-error);
}
.stat-card.error-card.active, .stat-card.error-card:hover {
  background: var(--color-error-bg);
  border-color: var(--color-error-border);
}

.stat-value {
  font-family: var(--font-title);
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.8rem;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
}

.actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .actions-bar {
    flex-direction: column;
    align-items: stretch;
  }
}

.search-box {
  position: relative;
  flex-grow: 1;
  max-width: 500px;
  display: flex;
  align-items: center;
}

.search-box i {
  position: absolute;
  left: 1rem;
  color: var(--text-muted);
}

.search-input {
  width: 100%;
  padding-left: 2.75rem;
}

.button-group {
  display: flex;
  gap: 0.75rem;
}

.alert-message.error-banner {
  background: var(--color-error-bg);
  border: 1px solid var(--color-error-border);
  color: var(--color-error);
  padding: 1rem;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.95rem;
  text-align: left;
}

/* Custom CSS Table (Simulating dynamic spreadsheet) */
.table-container {
  overflow-x: auto;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  max-height: 550px;
}

.custom-table {
  width: 100%;
  border-collapse: collapse;
  text-align: center;
}

.custom-table th {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 0.85rem 1rem;
  font-size: 0.85rem;
  font-weight: 600;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  user-select: none;
}

.custom-table th i {
  font-size: 0.7rem;
  margin-left: 0.25rem;
}

.custom-table td {
  padding: 0.65rem 0.85rem;
  font-size: 0.8rem;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

.custom-table tbody tr {
  transition: all 0.2s ease;
}

/* Highlight row colors */
.custom-table tbody tr.row-success {
  background-color: rgba(16, 185, 129, 0.01);
}
.custom-table tbody tr.row-success:hover {
  background-color: rgba(16, 185, 129, 0.04);
}

.custom-table tbody tr.row-warning {
  background-color: rgba(245, 158, 11, 0.03);
}
.custom-table tbody tr.row-warning:hover {
  background-color: rgba(245, 158, 11, 0.06);
}

.custom-table tbody tr.row-error {
  background-color: rgba(239, 68, 68, 0.04);
}
.custom-table tbody tr.row-error:hover {
  background-color: rgba(239, 68, 68, 0.08);
}

.text-left-align {
  text-align: left;
  display: block;
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-error { color: var(--color-error); }
.text-muted { color: var(--text-muted); }
.font-mono { font-family: var(--font-mono); }

.btn-delete {
  background: transparent;
  border: none;
  color: var(--color-error);
  cursor: pointer;
  padding: 0.4rem;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.btn-delete:hover {
  background: var(--color-error-bg);
  transform: scale(1.15);
}

/* Status Dot Indicators */
.status-dot {
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: var(--radius-full);
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  cursor: help;
}

.status-dot.success {
  background: var(--color-success-bg);
  color: var(--color-success);
  border: 1px solid var(--color-success-border);
}

.status-dot.warning {
  background: var(--color-warning-bg);
  color: var(--color-warning);
  border: 1px solid var(--color-warning-border);
}

.status-dot.error {
  background: var(--color-error-bg);
  color: var(--color-error);
  border: 1px solid var(--color-error-border);
}

/* Cell Editing */
.editable-cell {
  position: relative;
  cursor: pointer;
}

.editable-cell:hover::after {
  content: '\e9b5'; /* primeicons pencil icon code */
  font-family: 'primeicons';
  position: absolute;
  right: 0.25rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.65rem;
  color: var(--text-muted);
  pointer-events: none;
}

.cell-input {
  width: 100%;
  padding: 0.35rem 0.5rem;
  background: var(--bg-tertiary);
  border: 1px solid var(--color-primary);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  outline: none;
}

.select-cell {
  padding: 0.25rem 0.35rem;
  cursor: pointer;
}

/* Pagination */
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  padding: 0.75rem 1.25rem;
  border-radius: var(--radius-md);
  margin-top: 1rem;
}

.pagination-info {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.pagination-buttons {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.page-number {
  font-size: 0.8rem;
  color: var(--text-primary);
  padding: 0 0.5rem;
}

.btn-sm {
  padding: 0.35rem 0.75rem;
  font-size: 0.8rem;
}

/* Side Info Panel for Errors */
.error-sidebar {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 380px;
  max-height: 350px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  z-index: 200;
  overflow: hidden;
}

.sidebar-header {
  background: var(--bg-tertiary);
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
}

.sidebar-header h4 {
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.close-btn {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
}

.close-btn:hover {
  color: var(--text-primary);
}

.sidebar-content {
  padding: 1.25rem;
  overflow-y: auto;
  text-align: left;
}

.sidebar-content ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sidebar-content li {
  font-size: 0.8rem;
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  line-height: 1.4;
}

.sidebar-content li.error i { color: var(--color-error); }
.sidebar-content li.error span { color: var(--color-error); }
.sidebar-content li.warning i { color: var(--color-warning); }
.sidebar-content li.warning span { color: var(--color-warning); }

.sidebar-instructions {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 1.25rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border-color);
}

/* Modals */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 16, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 500;
}

.modal-content {
  width: 90%;
  max-width: 500px;
  text-align: left;
  border: 1px solid var(--border-color);
}

.modal-details {
  background: var(--bg-primary);
  padding: 1rem;
  border-radius: var(--radius-md);
  margin: 1.25rem 0;
}

.modal-details ul {
  list-style: none;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.warning-alert {
  font-size: 0.75rem;
  color: var(--color-warning);
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  line-height: 1.3;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.text-warning { color: var(--color-warning); }
.no-data {
  padding: 2rem !important;
  color: var(--text-secondary);
  font-style: italic;
}
.mt-2 { margin-top: 0.5rem; }
</style>
