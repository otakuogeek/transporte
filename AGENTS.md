# AGENTS.md — FALC Logística de Carga

> Documento maestro del proyecto. Contiene la descripción completa del sistema, arquitectura, reglas de funcionamiento, mejores prácticas de codificación y convenciones para agentes IA y desarrolladores.

---

## 1. Descripción del Proyecto

**FALC** es un sistema web de logística de transporte de carga con integración de WhatsApp para comunicación automatizada con clientes, choferes y empresas de transporte.

**URL producción:** `https://falc.indielab.pro`
**Repositorio:** `otakuogeek/transporte` (rama `main`)
**Entorno servidor:** Linux, desplegado en `/var/www/falc.indielab.pro`

### Funcionalidades principales

- **Dashboard analítico** con KPIs, filtros por fecha y rankings de transportes/clientes
- **Gestión de Clientes** — CRUD con múltiples números de teléfono, origen por defecto (finca)
- **Gestión de Empresas de Transporte** — registro, estado, cantidad de vehículos disponibles
- **Gestión de Choferes (legacy)** — registro, estados (Disponible/En Viaje/Inactivo)
- **Tickets de Transporte** — flujo completo desde creación hasta confirmación al cliente
- **Sistema de Asignaciones** — asignar transportes a tickets con cantidad de camiones, aceptar/rechazar parcialmente
- **Cotizaciones (legacy)** — sistema de cotización automática vía WhatsApp
- **Comisiones** — cálculo de ganancia sobre las cotizaciones (sistema legacy)
- **Bot conversacional WhatsApp (Baileys)** — operadora virtual estilo colombiano
- **Chat con operador** — posibilidad de pausar el bot y conversar manualmente
- **Panel de administración** — autenticación, configuración y monitoreo

---

## 2. Tech Stack

### Backend
| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | >= 18 | Runtime del servidor |
| Express | 5.x | Framework HTTP |
| MySQL | — | Base de datos relacional |
| mysql2/promise | 3.x | Driver MySQL con pool de conexiones |
| @whiskeysockets/baileys | 7.x | Conexión WhatsApp Web (bot) |
| axios | 1.x | Llamadas HTTP (OpenAI, WhatsApp API) |
| qrcode | 1.x | Generación de QR para Baileys |
| dotenv | 17.x | Variables de entorno |
| PM2 | — | Gestión de procesos en producción |

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| React | 19.x | Framework UI |
| React Router | 7.x | Enrutamiento SPA |
| Vite | 7.x | Build tool y dev server |
| Axios | 1.x | Cliente HTTP |
| Recharts | 3.x (disponible) | Gráficos dashboard |

### Infraestructura
- **Servidor:** Linux, Nginx como reverse proxy hacia `127.0.0.1:4000`
- **Proceso:** PM2 con config en `backend/ecosystem.config.js`
- **Base de datos:** MySQL en localhost, base `indielab_pro`
- **Frontend:** Build estático en `frontend/dist/`, servido por Express (SPA fallback)

---

## 3. Estructura del Proyecto

```
/var/www/falc.indielab.pro/
├── AGENTS.md                    # Este archivo
├── README.md                    # Documentación general
├── backend/
│   ├── .env                     # Variables de entorno (NUNCA commitear)
│   ├── server.js                # Punto de entrada del servidor Express
│   ├── package.json             # Dependencias backend
│   ├── ecosystem.config.js      # Config PM2 (producción)
│   ├── controllers/
│   │   ├── authController.js           # Autenticación (login, register, middleware)
│   │   ├── clientesController.js       # CRUD Clientes
│   │   ├── choferesController.js       # CRUD Choferes (legacy)
│   │   ├── vehiculosController.js      # CRUD Vehículos (legacy)
│   │   ├── transportesController.js    # CRUD Empresas de Transporte
│   │   ├── ticketsController.js        # Tickets de transporte
│   │   ├── asignacionesController.js   # Asignaciones transporte↔ticket
│   │   ├── solicitudesController.js    # Solicitudes (legacy)
│   │   ├── cotizacionesController.js   # Cotizaciones (legacy)
│   │   ├── comisionController.js       # Comisiones sobre viajes
│   │   ├── dashboardController.js      # Dashboard analítico
│   │   ├── configuracionController.js  # Parámetros del sistema
│   │   ├── webhookController.js        # Webhook WhatsApp Cloud API
│   │   └── whatsappConfigController.js # Config WhatsApp + Chat
│   ├── routes/
│   │   ├── api.js                # Rutas API REST (protegidas por auth)
│   │   ├── webhook.js            # Webhook Meta (GET verificación, POST mensajes)
│   │   └── comisionesRoutes.js   # Rutas de comisiones
│   ├── services/
│   │   ├── aiService.js          # Integración OpenAI (extracción NLP)
│   │   ├── baileysBot.js         # Bot conversacional WhatsApp (~1500 líneas)
│   │   ├── baileysService.js     # Conexión Baileys (QR, envío, reconexión)
│   │   ├── cotizacionService.js  # Lógica de cotización automática
│   │   └── whatsappService.js    # Envío vía WhatsApp Cloud API (Meta)
│   ├── database/
│   │   ├── connection.js         # Pool de conexiones MySQL
│   │   ├── initDb.js             # Inicialización automática de tablas
│   │   └── schema.sql            # Esquema DDL de la base de datos
│   └── baileys_auth/             # Datos de sesión WhatsApp (IGNORAR en git)
│
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js            # Proxy /api y /webhook a backend
    ├── eslint.config.js
    └── src/
        ├── main.jsx              # Entry point React
        ├── App.jsx               # Router principal con rutas protegidas
        ├── App.css / index.css   # Estilos globales
        ├── api/
        │   └── client.js         # Instancia Axios con interceptores (auth, 401)
        ├── context/
        │   └── AuthContext.jsx   # Contexto de autenticación (login, logout, token)
        ├── components/
        │   ├── Layout.jsx        # Sidebar + contenido principal
        │   ├── DataTable.jsx     # Tabla genérica reutilizable
        │   ├── StatCard.jsx      # Tarjeta de estadística
        │   └── StatusBadge.jsx   # Badge de estado con colores
        └── pages/
            ├── Dashboard.jsx     # Dashboard con KPIs, filtros, tablas ranking
            ├── Login.jsx         # Pantalla de login
            ├── Clientes.jsx      # Gestión de clientes
            ├── Tickets.jsx       # Gestión de tickets de transporte
            ├── Transportes.jsx   # Gestión de empresas de transporte
            ├── Configuracion.jsx # Parámetros del sistema
            ├── WhatsApp.jsx      # Config WhatsApp + Chat en vivo
            ├── Cotizaciones.jsx  # (legacy)
            ├── Comisiones.jsx    # (legacy)
            ├── Choferes.jsx      # (legacy)
            ├── Vehiculos.jsx     # (legacy)
            └── Solicitudes.jsx   # (legacy)
```

---

## 4. Arquitectura y Flujo de Datos

### 4.1 Diagrama de flujo principal

```
Cliente WhatsApp ──→ Baileys/Meta ──→ baileysService ──→ baileysBot
                                                           │
                                                ┌──────────┴──────────┐
                                                │                     │
                                         aiService                pool (MySQL)
                                       (OpenAI NLP)          (lecturas/escrituras)
                                                │                     │
                                                └──────────┬──────────┘
                                                           │
                                                  cotizacionService
                                                   (lógica negocio)

Panel Admin (React) ──→ Axios ──→ /api/* ──→ controllers ──→ pool (MySQL)
                                                     │
                                              baileysService
                                        (envío WA desde panel)
```

### 4.2 Sistema de conexión WhatsApp (dual)

El sistema soporta dos modos de conexión a WhatsApp:

1. **Baileys (WhatsApp Web)** — Modo principal actual
   - Conexión mediante escaneo de QR desde el panel
   - Auto-reconexión con backoff (hasta 5 intentos)
   - Auto-conexión al reiniciar PM2 si existe sesión previa
   - Sesión almacenada en `backend/baileys_auth/`
   - Soporte de LID (Linked ID) con autocorrección a número real

2. **API Oficial de Meta (WhatsApp Cloud API)** — Modo alternativo
   - Webhook en `/webhook` (GET: verificación, POST: mensajes)
   - Requiere `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN`, `WA_VERIFY_TOKEN`

### 4.3 Flujo del Ticket (sistema actual)

```
1. Operador crea Ticket desde panel (o cliente por WhatsApp)
   Estado: "Pendiente de asignación"

2. Operador asigna empresa(s) de transporte con cantidad de camiones
   Estado: "Asignado - Esperando respuesta"
   → Se envía WhatsApp al transporte automáticamente

3. Transporte acepta/rechaza por WhatsApp (parcial permitido)
   Estado: "Aceptado - Pendiente datos camión"

4. Transporte envía placa + conductor de cada camión por WhatsApp
   Estado: "En proceso de confirmación" (si faltan) o
           "Listo para confirmar al cliente" (si completo)

5. Operador confirma al cliente desde panel (o manualmente)
   Estado: "Confirmado al cliente"
   → Se envía WhatsApp al cliente con datos del camión
```

### 4.4 Flujo de Cotización (legacy, aún operativo)

```
1. Cliente envía solicitud por WhatsApp → aiService extrae datos
2. Se contacta a choferes disponibles con vehículo del tipo requerido
3. Choferes responden con precio → aiService extrae el monto
4. Al completar cotizaciones (o timeout), se selecciona la menor
5. Se calcula precio_cliente = precio_chofer × (1 + margen_ganancia%)
6. Se notifica al cliente con el precio → espera confirmación Sí/No
```

### 4.5 Bot Conversacional (baileysBot.js)

El bot gestiona conversaciones en memoria con máquina de estados:

**Estados de conversación:**
| Step | Descripción |
|---|---|
| `saludo` | Inicio, identifica usuario automáticamente |
| `no_registrado` | Número no existe en el sistema |
| `cliente_menu` | Menú de opciones para clientes |
| `pedir_origen` | Pidiendo origen de carga |
| `pedir_destino` | Pidiendo destino |
| `pedir_fecha` | Pidiendo fecha de carga |
| `pedir_cantidad_camiones` | Cuántos camiones necesita |
| `confirmar_solicitud` | Confirmar datos antes de crear |
| `confirmar_viaje` | Esperando Sí/No del cliente a cotización |
| `transporte_menu` | Menú para empresas de transporte |
| `transporte_responder` | Aceptar/rechazar asignación |
| `transporte_datos_camion` | Registrar placa + conductor |
| `chofer_menu` | Menú para choferes legacy |
| `chofer_cotizar` | Chofer cotizando |

**Características del bot:**
- Personalidad: operadora colombiana amigable con emojis
- Identificación automática por número de teléfono (busca en clientes, transportes, choferes)
- Limpieza automática de conversaciones inactivas (30 min)
- Ignorar mensajes antiguos (>60 segundos, anti-spam por history sync)
- Pausar/reanudar agente por número (para intervención manual del operador)
- Cotización rápida: si un chofer envía un precio, se detecta automáticamente con IA

---

## 5. Base de Datos

### Tablas principales (sistema actual)
| Tabla | Descripción |
|---|---|
| `clientes` | Clientes con múltiples teléfonos (JSON), origen por defecto |
| `transportes` | Empresas de transporte (nombre, contacto, WhatsApp, cantidad vehículos) |
| `tickets` | Pedidos de transporte con estado, camiones solicitados/confirmados |
| `asignaciones` | Relación ticket↔transporte con estado y datos de camión |
| `vehiculos_asignados` | Vehículos registrados por asignación (placa, conductor) |
| `acciones_log` | Auditoría de acciones del sistema |
| `administradores` | Usuarios del panel admin |
| `configuracion` | Parámetros clave-valor del sistema |
| `whatsapp_config` | Configuración de modo WhatsApp (Baileys/API) |
| `mensajes_log` | Log de todos los mensajes WhatsApp |

### Tablas legacy (aún presentes)
| Tabla | Descripción |
|---|---|
| `choferes` | Choferes individuales |
| `vehiculos` | Vehículos asociados a choferes |
| `solicitudes` | Solicitudes de transporte (flujo de cotización) |
| `cotizaciones` | Ofertas de choferes a solicitudes |
| `solicitudes_contactos` | Registro de choferes contactados por solicitud |

### Estados de Ticket
```
Pendiente de asignación → Asignado - Esperando respuesta → Aceptado - Pendiente datos camión →
En proceso de confirmación → Listo para confirmar al cliente → Confirmado al cliente
```

### Estados de Asignación
```
Enviado → Aceptado / Rechazado
```

---

## 6. API REST — Endpoints

Todas las rutas bajo `/api/*` requieren autenticación Bearer token (excepto login/register).

### Autenticación
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login con username/password |
| POST | `/api/auth/register` | Crear administrador |

### Dashboard
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/dashboard/stats` | KPIs principales (filtros: fecha_desde, fecha_hasta, cliente_id) |
| GET | `/api/dashboard/rendimiento-transportes` | Ranking de transportes |
| GET | `/api/dashboard/rendimiento-clientes` | Stats por cliente/finca |

### Tickets
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/tickets` | Listar (filtros: estado, cliente_id, fecha_desde, fecha_hasta) |
| GET | `/api/tickets/:id` | Detalle con asignaciones y vehículos |
| POST | `/api/tickets` | Crear ticket |
| PUT | `/api/tickets/:id/estado` | Cambiar estado |
| POST | `/api/tickets/:id/confirmar` | Confirmar al cliente (botón final) |

### Asignaciones
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/api/asignaciones` | Asignar transporte(s) a ticket |
| PUT | `/api/asignaciones/:id/responder` | Aceptar/Rechazar |
| PUT | `/api/asignaciones/:id/datos-camion` | Registrar placa + conductor |
| POST | `/api/asignaciones/vehiculo/:vehiculoId/notificar` | Notificar cliente datos camión |
| GET | `/api/asignaciones/ticket/:ticketId` | Asignaciones de un ticket |
| GET | `/api/asignaciones/historial` | Historial por empresa |

### CRUDs
| Recurso | Rutas |
|---|---|
| Clientes | `GET/POST /api/clientes`, `GET/PUT/DELETE /api/clientes/:id` |
| Transportes | `GET/POST /api/transportes`, `GET/PUT/DELETE /api/transportes/:id` |
| Choferes | `GET/POST /api/choferes`, `GET/PUT/DELETE /api/choferes/:id` |
| Vehículos | `GET/POST /api/vehiculos`, `GET/PUT/DELETE /api/vehiculos/:id` |
| Solicitudes | `GET/POST /api/solicitudes`, `GET/PUT/DELETE /api/solicitudes/:id` |
| Cotizaciones | `GET /api/cotizaciones`, `GET /api/cotizaciones/:id` |

### WhatsApp
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/whatsapp-config` | Config actual |
| PUT | `/api/whatsapp-config` | Guardar config (modo, tokens) |
| POST | `/api/whatsapp-config/baileys/connect` | Conectar Baileys (genera QR) |
| POST | `/api/whatsapp-config/baileys/disconnect` | Desconectar Baileys |
| GET | `/api/whatsapp-config/baileys/status` | Estado de conexión |
| GET | `/api/whatsapp-config/chats` | Lista de chats |
| GET | `/api/whatsapp-config/chats/:phone` | Mensajes de un chat |
| POST | `/api/whatsapp-config/chats/:phone/send` | Enviar mensaje manual |
| POST | `/api/whatsapp-config/chats/:phone/toggle-agent` | Pausar/reanudar bot |

### Configuración
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/configuracion` | Todos los parámetros |
| PUT | `/api/configuracion/:nombre_parametro` | Actualizar parámetro |

### Comisiones
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/comisiones` | Resumen por chofer |
| GET | `/api/comisiones/:id/detalles` | Detalle de viajes |
| PUT | `/api/comisiones/solicitudes/:solicitudId/toggle` | Toggle cobrada |
| PUT | `/api/comisiones/chofer/:choferId/cobrar-todas` | Cobrar toda la deuda |

---

## 7. Variables de Entorno

Archivo: `backend/.env` (NUNCA commitear)

```env
# Server
PORT=4000
NODE_ENV=production

# Database
DB_HOST=localhost
DB_USER=<user>
DB_PASSWORD=<password>
DB_NAME=indielab_pro

# WhatsApp Cloud API (Meta)
WA_PHONE_NUMBER_ID=<id>
WA_ACCESS_TOKEN=<token>
WA_VERIFY_TOKEN=<token>

# OpenAI
OPENAI_API_KEY=<key>
OPENAI_MODEL=gpt-4o-mini

# Auth
AUTH_SALT=<salt_secreto>
```

---

## 8. Reglas de Funcionamiento del Sistema

### 8.1 Autenticación
- Tokens almacenados en `global.authTokens` (en memoria) — se pierden al reiniciar
- Hash de contraseña: SHA-256 con salt (`AUTH_SALT`) — **NO bcrypt** (ámbito actual)
- Token expira en 24 horas
- El interceptor del frontend redirige a `/login` si recibe 401

### 8.2 WhatsApp Bot
- **Solo responde a mensajes individuales** (ignora grupos y status@broadcast)
- **Ignora mensajes propios** (`fromMe`)
- **Ignora mensajes antiguos** (>60 segundos después del timestamp)
- **Espera 8 segundos** después de conectar para habilitar el bot (evita reprocessar history sync)
- **Reconexión automática** hasta 5 intentos con backoff exponencial
- **Autocorrección de LID:** si detecta un LID con número real alternativo, actualiza la BD
- **Conversaciones en memoria** con limpieza cada 15 minutos (timeout de 30 min)
- **Pausar agente:** un operador puede desactivar el bot para un teléfono específico

### 8.3 IA (OpenAI)
- Modelo: `gpt-4o-mini` (configurable vía env)
- Temperature: `0.1` (respuestas consistentes)
- Tres funciones:
  1. `extractTransportRequest()` — extrae datos de solicitud de transporte del mensaje del cliente
  2. `extractDriverQuote()` — extrae precio de la respuesta de un chofer
  3. `matchVehicleType()` — mapea texto libre a tipos de vehículo de la BD
- Respuestas siempre en JSON puro (sin markdown)
- Manejo de errores con fallback: `{ es_solicitud: false }`

### 8.4 Cotización automática (legacy pero operativa)
- Timeout configurable para selección automática (por defecto 30 min)
- Menor precio gana; en empate, gana el primero en responder
- Margen de ganancia configurable en tabla `configuracion`
- Precio cliente = precio chofer × (1 + margen%)

### 8.5 Asignaciones (sistema actual)
- Un ticket puede tener **múltiples asignaciones** a diferentes transportes
- Cada asignación especifica **cantidad de camiones**
- Validación: `suma de camiones asignados ≤ camiones del ticket`
- Aceptación **parcial** permitida (transporte acepta menos de los solicitados)
- Cada camión aceptado debe registrar **placa + conductor**
- Se puede notificar al cliente los datos de cada vehículo individual

### 8.6 Logs y Auditoría
- `mensajes_log` — todos los mensajes WhatsApp (entrantes y salientes)
- `acciones_log` — acciones del sistema con operador, entidad y detalle

---

## 9. Mejores Prácticas de Codificación

### 9.1 Backend (Node.js / Express)

#### Patrones seguidos
- **CommonJS** (`require/module.exports`) — todo el backend usa CommonJS
- **Controladores como funciones exportadas** — no clases
- **Pool de conexiones MySQL** compartido (`database/connection.js`)
- **Queries parametrizadas** — siempre usar `?` placeholders contra SQL injection
- **Respuestas JSON consistentes:** éxito `{ data }` o `{ message }`, error `{ error }`
- **Códigos HTTP correctos:** 200, 201, 400, 401, 404, 409, 500

#### Convenciones de código
```javascript
// ✅ CORRECTO: Controlador típico
async function getAll(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM tabla ORDER BY id DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error obteniendo datos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
}

// ✅ CORRECTO: Query parametrizada
const [rows] = await pool.query('SELECT * FROM clientes WHERE id = ?', [id]);

// ❌ INCORRECTO: String interpolation en queries
const [rows] = await pool.query(`SELECT * FROM clientes WHERE id = ${id}`);
```

#### Reglas de codificación
1. **Siempre usar `async/await`** con try/catch — no callbacks ni `.then()`
2. **Siempre usar `pool.query()`** — nunca crear conexiones individuales
3. **Destructurar el resultado de query:** `const [rows] = await pool.query(...)`
4. **Validar datos en el controlador** antes de enviar a la BD
5. **Logs con emoji** para fácil identificación: `✓`, `✗`, `📩`, `🔄`, etc.
6. **Errores específicos:** capturar `error.code === 'ER_DUP_ENTRY'` para duplicados
7. **No exponer errores internos** al cliente en producción

#### Estructura de un controlador nuevo
```javascript
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

exports.create = async (req, res) => {
    try {
        const { campo1, campo2 } = req.body;
        if (!campo1) return res.status(400).json({ error: 'campo1 es requerido' });
        
        const [result] = await pool.query(
            'INSERT INTO tabla (campo1, campo2) VALUES (?, ?)',
            [campo1, campo2 || null]
        );
        res.status(201).json({ id: result.insertId, message: 'Creado exitosamente' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Ya existe un registro duplicado' });
        }
        console.error('Error:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};
```

### 9.2 Frontend (React / Vite)

#### Patrones seguidos
- **ES Modules** (`import/export`) — el frontend usa ESM
- **Componentes funcionales** con hooks (`useState`, `useEffect`)
- **Context API** para estado global (autenticación)
- **Axios con interceptores** para auth automática y manejo de 401
- **Estilos inline** — el proyecto NO usa CSS modules ni Tailwind; usa objetos `style={{}}`
- **Sin TypeScript** — todo en JSX puro

#### Convenciones de código
```jsx
// ✅ CORRECTO: Componente de página típico
import { useState, useEffect } from 'react';
import api from '../api/client';

export default function MiPagina() {
  const [datos, setDatos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDatos(); }, []);

  const fetchDatos = async () => {
    try {
      const res = await api.get('/mi-recurso');
      setDatos(res.data);
    } catch (e) { console.error('Error:', e); }
    finally { setLoading(false); }
  };

  if (loading) return <p>Cargando...</p>;

  return (
    <div>
      <h1>Mi Página</h1>
      {/* Contenido */}
    </div>
  );
}
```

#### Reglas de codificación
1. **Importar `api` de `../api/client`** — nunca usar axios directamente
2. **Manejar estados de carga** con `loading` + `setLoading(false)` en `finally`
3. **Rutas protegidas** envueltas en `<ProtectedRoute>` + `<Layout>`
4. **Estilos inline** con objetos JS (consistente con el resto del proyecto)
5. **Nombre de archivos de página:** PascalCase (ej: `MiPagina.jsx`)
6. **Nombre de componentes:** PascalCase con export default
7. **Usar `localStorage`** con prefijo `falc_` para datos persistentes

### 9.3 Base de Datos

#### Convenciones
- **Nombres de tablas:** snake_case plural (`clientes`, `tickets`, `asignaciones`)
- **Nombres de columnas:** snake_case (`telefono_whatsapp`, `fecha_creacion`)
- **IDs:** `INT AUTO_INCREMENT PRIMARY KEY`
- **Timestamps:** `TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
- **ENUMs** para estados con opciones explícitas
- **Foreign keys** con `ON DELETE SET NULL` o `CASCADE` según el caso
- **JSON:** columna `telefonos` almacena array JSON de números

#### Migraciones
- El esquema se ejecuta automáticamente al iniciar el servidor (`initDb.js`)
- Usa `CREATE TABLE IF NOT EXISTS` e `INSERT IGNORE` para idempotencia
- Para nuevas tablas/columnas: agregar al `schema.sql` y re-desplegar

---

## 10. Comandos de Operación

### Desarrollo
```bash
# Backend (modo watch)
cd backend && npm run dev

# Frontend (dev server con HMR)
cd frontend && npm run dev
```

### Producción
```bash
# Iniciar con PM2
cd backend && pm2 start ecosystem.config.js

# Reiniciar
pm2 restart falc-backend

# Ver logs en tiempo real
pm2 logs falc-backend

# Build del frontend
cd frontend && npm run build
```

### Base de datos
```bash
# Conectar a MySQL
mysql -u admin -p indielab_pro
```

---

## 11. Reglas para Agentes IA

### Al modificar código:
1. **Mantener el estilo existente** — CommonJS en backend, ESM en frontend, estilos inline
2. **No agregar dependencias** sin verificar que sean necesarias
3. **No cambiar la estructura de carpetas** sin justificación
4. **Queries siempre parametrizadas** — NUNCA interpolar variables en SQL
5. **Probar queries complejas** antes de integrar
6. **No modificar `baileys_auth/`** — es estado de sesión, no código
7. **No commitear `.env`** ni API keys
8. **Al agregar una ruta nueva:** agregar en `routes/api.js` respetando el patrón
9. **Al agregar un controlador nuevo:** crear en `controllers/` con el patrón estándar
10. **Al modificar schema.sql:** asegurar idempotencia con `IF NOT EXISTS`
11. **No cambiar el puerto** (4000) ni el bind address (127.0.0.1) sin razón
12. **Reiniciar PM2** después de cambios en backend: `pm2 restart falc-backend`
13. **Rebuild frontend** después de cambios en frontend: `cd frontend && npm run build`

### Al interactuar con WhatsApp bot:
1. Los mensajes del bot usan **formato WhatsApp** (`*bold*`, emojis)
2. El tono es **colombiano informal** — "parce", "dale", "quiubo"
3. Siempre ofrecer opción de reinicio: "escríbeme *menú*"
4. Validar datos antes de guardar en BD
5. No procesar mensajes de grupos ni broadcasts
6. Respetar el flag `esAgentePausado()` antes de responder

### Al agregar nuevas páginas al frontend:
1. Crear archivo en `frontend/src/pages/NombrePagina.jsx`
2. Agregar ruta en `App.jsx` envuelta en `<ProtectedRoute>`
3. Agregar entrada en `menuItems` de `Layout.jsx`
4. Usar `api` de `../api/client` para llamadas HTTP

### Seguridad:
- **NUNCA exponer** API keys, tokens o contraseñas en código o respuestas
- **Siempre sanitizar** inputs del usuario antes de queries
- **Verificar autenticación** en todas las rutas protegidas
- **Validar que el `.env` no sea trackeado** en git

---

## 12. Problemas Conocidos y Deuda Técnica

1. **Autenticación en memoria** — tokens se pierden al reiniciar PM2; considerar JWT o Redis
2. **Hash SHA-256** para passwords — migrar a bcrypt para mayor seguridad
3. **Estilos inline** en todo el frontend — considerar CSS modules o un framework CSS
4. **Sistema legacy activo** — choferes, vehículos, solicitudes, cotizaciones coexisten con el sistema nuevo de tickets/transportes/asignaciones
5. **Sin tests automatizados** — solo `test-ai.js` y `test-webhook.js` manuales
6. **Sin rate limiting** en la API
7. **Sin validación de schemas** (ej: Joi/Zod) en los endpoints
8. **Conversaciones del bot en memoria** — se pierden al reiniciar; considerar Redis
9. **Sin websockets** para actualizaciones en tiempo real del panel
10. **API key de OpenAI** en `.env` sin rotación automática