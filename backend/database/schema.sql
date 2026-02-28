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
    telefono VARCHAR(20) NOT NULL,
    direccion ENUM('entrante', 'saliente') NOT NULL,
    contenido TEXT,
    tipo_mensaje VARCHAR(20) DEFAULT 'text',
    contexto VARCHAR(50) NULL COMMENT 'solicitud_nueva, cotizacion_chofer, confirmacion, etc.',
    solicitud_id INT NULL,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (solicitud_id) REFERENCES solicitudes(id) ON DELETE SET NULL
);

-- Tabla de Administradores (para login del panel)
CREATE TABLE IF NOT EXISTS administradores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
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
