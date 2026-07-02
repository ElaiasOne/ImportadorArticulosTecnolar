import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Aura from '@primevue/themes/aura';
import App from './App.vue';
import 'primeicons/primeicons.css';
import './style.css';

const app = createApp(App);

app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark-mode', // Habilitar modo oscuro alternando la clase 'dark-mode' en body/html
      cssLayer: {
        name: 'primevue',
        order: 'primevue, custom'
      }
    }
  }
});

app.mount('#app');
