# FALC — Instrucciones para Copilot

Sistema web de logística de transporte de carga con bot WhatsApp (Meta Cloud API).
Documentación completa y reglas de negocio en [AGENTS.md](../AGENTS.md).

## Tech Stack

| Capa | Tecnologías |
|---|---|
| Backend | Node.js 18+, Express 5, MySQL (mysql2/promise), CommonJS |
| Frontend | React 19, React Router 7, Vite 7, Bootstrap 5, ESM |
| WhatsApp | WhatsApp Cloud API (Meta) — webhook + envío vía Graph API |
| IA | OpenAI `gpt-4o-mini` (extracción NLP de mensajes) |
| Producción | PM2 · Nginx reverse proxy → `127.0.0.1:4000` · MySQL `indielab_pro` |

## Estructura

```
backend/
  server.js               # Entry point: Express, CORS, rate limit, SPA fallback
  controllers/            # authController, clientesController, ticketsController,
                          # asignacionesController, transportesController,
                          # liquidacionesController, tiposVehiculosController,
                          # usuariosController, dashboardController, ...
  routes/api.js           # Todas las rutas REST (Bearer token requerido)
  services/baileysBot.js  # Bot conversacional (~1500 líneas, máquina de estados)
  database/connection.js  # Pool compartido (pool.query)
  database/schema.sql     # DDL con CREATE TABLE IF NOT EXISTS

frontend/src/
  App.jsx                 # BrowserRouter + AuthProvider + ProtectedRoute + rutas
  pages/                  # Dashboard, Clientes, Tickets, Transportes, TiposVehiculos,
                          # Liquidaciones, Usuarios, Configuracion, WhatsApp, Login, ...
  components/             # Layout, DataTable, StatCard, StatusBadge, NotificadorTickets
  api/client.js           # Instancia Axios con interceptores (auth, 401 → /login)
  context/AuthContext.jsx # login/logout/token + sistema de permisos por rol
```

## Convenciones críticas

### Backend — CommonJS
```js
// SIEMPRE: async/await + try/catch, queries parametrizadas, pool compartido
const pool = require('../database/connection');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tabla ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// ✅ Correcto
pool.query('SELECT * FROM clientes WHERE id = ?', [id]);
// ❌ Nunca interpolación directa en SQL
pool.query(`SELECT * FROM clientes WHERE id = ${id}`);
```

### Frontend — ESM + React hooks
```jsx
import api from '../api/client';  // NUNCA axios directamente

export default function MiPagina() {
  const [datos, setDatos] = useState([]);
  useEffect(() => { fetchDatos(); }, []);
  const fetchDatos = async () => {
    try { const res = await api.get('/recurso'); setDatos(res.data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  };
  // Estilos: SIEMPRE inline style={{}} — el proyecto NO usa CSS modules ni Tailwind
}
```

### Al agregar funcionalidad nueva
- **Ruta nueva**: `backend/routes/api.js` siguiendo el patrón existente
- **Controlador nuevo**: `backend/controllers/nombreController.js` con el patrón estándar
- **Página nueva**: crear en `frontend/src/pages/`, registrar en `App.jsx` con `<ProtectedRoute permiso="nombre">`, agregar en `menuItems` de `Layout.jsx`
- **Tabla nueva**: agregar a `backend/database/schema.sql` con `CREATE TABLE IF NOT EXISTS`

## Comandos

```bash
# Desarrollo
cd backend && npm run dev          # node --watch server.js
cd frontend && npm run dev         # Vite HMR con proxy a :4000

# Producción
pm2 restart falc-backend           # Después de cambios en backend
cd frontend && npm run build       # Rebuild estático (sirve desde frontend/dist/)
pm2 logs falc-backend              # Ver logs en tiempo real
```

## Reglas de seguridad

- **Queries parametrizadas obligatorias** — NUNCA interpolar variables en SQL
- **NUNCA commitear** `backend/.env`
- **Validar inputs** en controllers antes de escribir a BD
- Todas las rutas `/api/*` requieren `Authorization: Bearer <token>`
- Rate limiting activo: 600 req/15 min (API general), 30 req/15 min (auth)

## Sistema de permisos

`AuthContext` expone `tienePermiso(permiso)`. Los `ProtectedRoute` validan permisos explícitos por ruta. Los permisos por rol se gestionan desde la tabla `administradores` (ver `usuariosController.js`).

## Bot WhatsApp (baileysBot.js — Meta Cloud API)

- Mensajes llegan vía webhook de Meta (`/webhook`) y se procesan con el bot conversacional
- Solo responde a mensajes individuales; ignora grupos, broadcasts y mensajes propios
- Ignora mensajes con timestamp > 60 segundos (anti-spam)
- Respetar `esAgentePausado(phone)` antes de responder
- Tono: operadora colombiana informal — "parce", "dale" + emojis
- Conversaciones en memoria (timeout 30 min, limpieza cada 15 min)

## Flujo principal del Ticket

```
Pendiente de asignación
  → Asignado - Esperando respuesta   (WhatsApp automático al transporte)
  → Aceptado - Pendiente datos camión
  → En proceso de confirmación / Listo para confirmar al cliente
  → Confirmado al cliente             (WhatsApp automático al cliente)
```
