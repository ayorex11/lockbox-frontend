import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import { installSessionGuard, router } from './router'
import './styles/main.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
installSessionGuard()
app.mount('#app')
