# 🚛 FALC - Sistema de Logística de Carga

Sistema web completo para gestión de logística de transporte de carga, con integración de WhatsApp para comunicación automatizada con clientes y choferes.

## Características principales

- **Dashboard** con métricas en tiempo real (solicitudes, cotizaciones, choferes activos)
- **Gestión de Clientes** — CRUD completo con datos de contacto WhatsApp
- **Gestión de Choferes** — registro, estados (Disponible / En Viaje / Inactivo)
- **Gestión de Vehículos** — asociación chofer-vehículo, capacidad en toneladas
- **Tickets de Transporte** — flujo completo desde solicitud hasta entrega
- **Cotizaciones** — sistema de cotización automática a choferes disponibles
- **Comisiones** — cálculo de ganancia sobre las cotizaciones
- **Integración WhatsApp** — soporte dual: API Oficial de Meta y Baileys (WhatsApp Web)
- **IA conversacional** — procesamiento inteligente de mensajes entrantes
- **Panel de administración** — autenticación, configuración y monitoreo

## Tech Stack

### Backend
- **Node.js** + **Express 5**
- **MySQL** (mysql2)
- **WhatsApp**: API Oficial de Meta / Baileys (WhatsApp Web)
- **PM2** para gestión de procesos en producción

### Frontend
- **React 19** + **React Router 7**
- **Vite 7** (build & dev server)
- **Recharts** (gráficos del dashboard)
- **Axios** (HTTP client)

### Base de Datos
- MySQL con tablas: `clientes`, `choferes`, `vehiculos`, `solicitudes`, `cotizaciones`, `mensajes_log`, `administradores`, `configuracion`, `whatsapp_config`

## Estructura del Proyecto

```
├── backend/
│   ├── server.js              # Punto de entrada del servidor
│   ├── ecosystem.config.js    # Configuración PM2
│   ├── controllers/           # Controladores de la API
│   │   ├── authController.js
│   │   ├── clientesController.js
│   │   ├── choferesController.js
│   │   ├── vehiculosController.js
│   │   ├── solicitudesController.js
│   │   ├── cotizacionesController.js
│   │   ├── dashboardController.js
│   │   ├── ticketsController.js
│   │   ├── transportesController.js
│   │   ├── comisionController.js
│   │   ├── configuracionController.js
│   │   ├── webhookController.js
│   │   └── whatsappConfigController.js
│   ├── routes/
│   │   ├── api.js             # Rutas REST del panel
│   │   ├── webhook.js         # Webhook de WhatsApp
│   │   └── comisionesRoutes.js
│   ├── services/
│   │   ├── aiService.js       # Servicio de IA
│   │   ├── baileysBot.js      # Bot WhatsApp Web
│   │   ├── baileysService.js  # Servicio Baileys
│   │   ├── cotizacionService.js
│   │   └── whatsappService.js
│   └── database/
│       ├── connection.js      # Pool de conexiones MySQL
│       ├── initDb.js          # Inicialización automática
│       └── schema.sql         # Esquema de la BD
│
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx            # Router principal
│       ├── api/client.js      # Cliente HTTP Axios
│       ├── context/AuthContext.jsx
│       ├── components/
│       │   ├── Layout.jsx
│       │   ├── DataTable.jsx
│       │   ├── StatCard.jsx
│       │   └── StatusBadge.jsx
│       └── pages/
│           ├── Dashboard.jsx
│           ├── Login.jsx
│           ├── Clientes.jsx
│           ├── Tickets.jsx
│           ├── Transportes.jsx
│           ├── Cotizaciones.jsx
│           ├── Comisiones.jsx
│           ├── Choferes.jsx
│           ├── Vehiculos.jsx
│           ├── Solicitudes.jsx
│           ├── Configuracion.jsx
│           └── WhatsApp.jsx
```

## Instalación

### Requisitos previos
- Node.js >= 18
- MySQL >= 8.0

### 1. Clonar el repositorio

```bash
git clone https://github.com/otakuogeek/transporte.git
cd transporte
```

### 2. Backend

```bash
cd backend
npm install
```

Crear archivo `.env` con las siguientes variables:

```env
# Base de datos
DB_HOST=localhost
DB_USER=tu_usuario
DB_PASSWORD=tu_password
DB_NAME=falc_logistica

# Servidor
PORT=4000
NODE_ENV=production

# WhatsApp API Oficial (opcional)
WA_PHONE_NUMBER_ID=
WA_ACCESS_TOKEN=
WA_VERIFY_TOKEN=

# IA (opcional)
AI_API_KEY=
```

### 3. Frontend

```bash
cd frontend
npm install
npm run build
```

### 4. Base de datos

El esquema se crea automáticamente al iniciar el backend. También puedes ejecutar manualmente:

```bash
mysql -u tu_usuario -p tu_base_de_datos < backend/database/schema.sql
```

## Ejecución

### Desarrollo

```bash
# Backend (con hot reload)
cd backend && npm run dev

# Frontend (dev server en puerto 5173)
cd frontend && npm run dev
```

### Producción (PM2)

```bash
cd backend
pm2 start ecosystem.config.js
```

El backend sirve el frontend compilado (`frontend/dist/`) en producción.

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/login` | Login administrador |
| POST | `/api/auth/register` | Registrar administrador |
| GET | `/api/dashboard/*` | Métricas del dashboard |
| CRUD | `/api/clientes` | Gestión de clientes |
| CRUD | `/api/choferes` | Gestión de choferes |
| CRUD | `/api/vehiculos` | Gestión de vehículos |
| CRUD | `/api/solicitudes` | Solicitudes de transporte |
| GET | `/api/cotizaciones` | Cotizaciones recibidas |
| GET/PUT | `/api/configuracion` | Configuración del sistema |
| GET/POST | `/webhook` | Webhook de WhatsApp |

## Licencia

ISC
