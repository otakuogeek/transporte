-- ============================================
-- FALC - Sistema de Logística de Carga
-- Script de creación de Base de Datos
-- ============================================

-- Tabla de Configuración (Para el % de ganancia y otros parámetros)
CREATE TABLE IF NOT EXISTS configuracion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre_parametro VARCHAR(50) NOT NULL UNIQUE,
    valor VARCHAR(255) NOT NULL,
    descripcion VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insertar configuración por defecto
INSERT IGNORE INTO configuracion (nombre_parametro, valor, descripcion) VALUES
('destino_unico', '', 'Dirección de destino único para todos los tickets');

-- Tabla de Clientes
CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    documento VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    telefono_whatsapp VARCHAR(20) UNIQUE NOT NULL,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Choferes
CREATE TABLE IF NOT EXISTS choferes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono_whatsapp VARCHAR(20) UNIQUE NOT NULL,
    estado ENUM('Disponible', 'En Viaje', 'Inactivo') DEFAULT 'Disponible',
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Vehículos
CREATE TABLE IF NOT EXISTS vehiculos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    chofer_id INT,
    placa VARCHAR(15) UNIQUE NOT NULL,
    tipo_vehiculo VARCHAR(50) NOT NULL,
    capacidad_toneladas DECIMAL(5,2),
    FOREIGN KEY (chofer_id) REFERENCES choferes(id) ON DELETE SET NULL
);

-- Tabla de Solicitudes de Transporte
CREATE TABLE IF NOT EXISTS solicitudes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) NOT NULL,
    fecha_carga DATE NOT NULL,
    tipo_vehiculo_requerido VARCHAR(50) NOT NULL,
    estado ENUM('Pendiente', 'Cotizando', 'Adjudicada', 'Rechazada', 'Completada') DEFAULT 'Pendiente',
    precio_final_cliente DECIMAL(10,2) NULL,
    chofer_asignado_id INT NULL,
    choferes_contactados INT DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (chofer_asignado_id) REFERENCES choferes(id) ON DELETE SET NULL
);

-- Tabla de Cotizaciones (Respuestas de los Choferes)
CREATE TABLE IF NOT EXISTS cotizaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    solicitud_id INT,
    chofer_id INT,
    costo_ofrecido DECIMAL(10,2) NOT NULL,
    es_ganadora BOOLEAN DEFAULT FALSE,
    fecha_cotizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id),
    FOREIGN KEY (chofer_id) REFERENCES choferes(id)
);

-- Tabla de Mensajes (Log de conversaciones WhatsApp)
CREATE TABLE IF NOT EXISTS mensajes_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    wa_message_id VARCHAR(100),
    session_id VARCHAR(50) DEFAULT 'default',
    telefono VARCHAR(20) NOT NULL,
    direccion ENUM('entrante', 'saliente') NOT NULL,
    contenido TEXT,
    tipo_mensaje VARCHAR(20) DEFAULT 'text',
    contexto VARCHAR(50) NULL COMMENT 'solicitud_nueva, cotizacion_chofer, confirmacion, etc.',
    solicitud_id INT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mensajes_session_fecha (session_id, fecha),
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE SET NULL
);

-- Tabla de Administradores (para login del panel)
CREATE TABLE IF NOT EXISTS administradores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    rol ENUM('superadmin','admin','operador','visor') DEFAULT 'operador',
    activo TINYINT(1) DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Configuración WhatsApp (modo de conexión y credenciales)
CREATE TABLE IF NOT EXISTS whatsapp_config (
    id INT PRIMARY KEY DEFAULT 1,
    modo_conexion ENUM('baileys', 'api_oficial') DEFAULT 'api_oficial',
    wa_phone_number_id VARCHAR(100) NULL,
    wa_access_token VARCHAR(500) NULL,
    wa_verify_token VARCHAR(100) NULL,
    baileys_status ENUM('disconnected', 'connecting', 'connected') DEFAULT 'disconnected',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO whatsapp_config (id, modo_conexion) VALUES (1, 'api_oficial');

-- Sesiones Baileys (multi-línea WhatsApp)
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    activo TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO whatsapp_sessions (session_id, nombre, activo)
VALUES ('default', 'Línea Principal', 1);

-- Tabla de Tipos de Vehículos (catálogo)
CREATE TABLE IF NOT EXISTS tipos_vehiculos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255) NULL,
    capacidad_toneladas DECIMAL(5,2) NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar tipos de vehículos comunes en Argentina
INSERT IGNORE INTO tipos_vehiculos (nombre, descripcion, capacidad_toneladas) VALUES
('Semi Remolque', 'Camión con semi-remolque para cargas pesadas de gran volumen', 30.00),
('Acoplado', 'Camión con acoplado, ideal para transporte de cereales y granos', 45.00),
('Chasis', 'Camión chasis para contenedores marítimos y cargas especiales', 28.00),
('Balancín', 'Camión balancín para cargas medianas y distribución regional', 15.00),
('Mosquito (Bitren)', 'Configuración bitren/mosquito para máxima capacidad en rutas', 52.00),
('Camión Volcador', 'Vuelca la carga, usado en minería, áridos y construcción', 20.00),
('Camión Frigorífico', 'Caja refrigerada para transporte de alimentos perecederos', 18.00),
('Camión Cisterna', 'Transporte de líquidos: combustible, agua, productos químicos', 25.00),
('Camión Porta Autos', 'Transporte de vehículos livianos y pesados en plataforma', 22.00),
('Camión Plataforma', 'Plataforma abierta para maquinaria agrícola e industrial', 35.00);

-- Tabla de Vehículos por Transporte (relación transporte ↔ tipo de vehículo con cantidad)
CREATE TABLE IF NOT EXISTS transportes_tipos_vehiculos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transporte_id INT NOT NULL,
    tipo_vehiculo_id INT NOT NULL,
    cantidad INT DEFAULT 1,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_transporte_tipo (transporte_id, tipo_vehiculo_id),
    FOREIGN KEY (transporte_id) REFERENCES transportes(id) ON DELETE CASCADE,
    FOREIGN KEY (tipo_vehiculo_id) REFERENCES tipos_vehiculos(id) ON DELETE CASCADE
);

-- Tabla de Transportes (empresas de transporte)
CREATE TABLE IF NOT EXISTS transportes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    contacto_nombre VARCHAR(100) NULL,
    telefono_whatsapp VARCHAR(20) UNIQUE NOT NULL,
    estado ENUM('Activo', 'Inactivo') DEFAULT 'Activo',
    cantidad_vehiculos INT DEFAULT 0,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Tickets de Transporte
CREATE TABLE IF NOT EXISTS tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    cliente_id INT NOT NULL,
    origen VARCHAR(100) NOT NULL,
    destino VARCHAR(100) DEFAULT NULL,
    cantidad_camiones INT NOT NULL DEFAULT 1,
    tipo_vehiculo_id INT NULL,
    camiones_confirmados INT DEFAULT 0,
    fecha_requerida DATETIME NOT NULL,
    observaciones TEXT,
    estado ENUM('Pendiente de asignación','Asignado - Esperando respuesta','Aceptado - Pendiente datos camión','En proceso de confirmación','Listo para confirmar al cliente','Confirmado al cliente','Rechazado','Cancelado') DEFAULT 'Pendiente de asignación',
    operador_creador_id INT DEFAULT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_confirmacion_cliente TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (cliente_id) REFERENCES clientes(id),
    FOREIGN KEY (operador_creador_id) REFERENCES administradores(id),
    FOREIGN KEY (tipo_vehiculo_id) REFERENCES tipos_vehiculos(id) ON DELETE SET NULL
);

-- Tabla de Asignaciones (transporte ↔ ticket)
CREATE TABLE IF NOT EXISTS asignaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ticket_id INT NOT NULL,
    transporte_id INT NOT NULL,
    cantidad_camiones INT DEFAULT 1,
    precio DECIMAL(12,2) NULL,
    comision DECIMAL(12,2) NULL,
    comision_porcentaje DECIMAL(5,2) NULL,
    comision_pagada TINYINT(1) DEFAULT 0,
    fecha_pago TIMESTAMP NULL DEFAULT NULL,
    pago_observaciones TEXT NULL,
    estado ENUM('Enviado','Aceptado','Rechazado') DEFAULT 'Enviado',
    operador_asignador_id INT NULL,
    fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta TIMESTAMP NULL,
    placa_camion VARCHAR(20) NULL,
    conductor_nombre VARCHAR(100) NULL,
    tipo_camion VARCHAR(50) NULL,
    pagador_flete VARCHAR(100) NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (transporte_id) REFERENCES transportes(id),
    FOREIGN KEY (operador_asignador_id) REFERENCES administradores(id)
);
ALTER TABLE asignaciones ADD COLUMN pagador_flete VARCHAR(100) NULL AFTER tipo_camion;

-- Tabla de Vehículos Asignados (placa + conductor por asignación)
CREATE TABLE IF NOT EXISTS vehiculos_asignados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    asignacion_id INT NOT NULL,
    placa_camion VARCHAR(20) NOT NULL,
    conductor_nombre VARCHAR(100) NOT NULL,
    pagador_flete VARCHAR(100) NULL,
    notificado_cliente TINYINT(1) DEFAULT 0,
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (asignacion_id) REFERENCES asignaciones(id) ON DELETE CASCADE
);

-- Tabla de Log de Acciones del sistema
CREATE TABLE IF NOT EXISTS acciones_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operador_id INT NULL,
    accion VARCHAR(100) NOT NULL,
    entidad VARCHAR(50) NULL,
    entidad_id INT NULL,
    detalle TEXT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (operador_id) REFERENCES administradores(id) ON DELETE SET NULL
);

-- Migraciones incrementales (idempotentes vía manejo de error en initDb.js)
ALTER TABLE vehiculos_asignados ADD COLUMN pagador_flete VARCHAR(100) NULL AFTER conductor_nombre;
