// services/baileysBot.js - Bot conversacional para Baileys (estilo operadora colombiana)
const pool = require('../database/connection');
const cotizacionService = require('./cotizacionService');

// Normalizar número de teléfono para comparación
function normalizarTelefono(tel) {
    if (!tel) return '';
    // Quitar todo excepto dígitos
    let num = tel.replace(/[^0-9]/g, '');
    // Quitar ceros iniciales
    num = num.replace(/^0+/, '');
    return num;
}

// Almacén de estados de conversación en memoria { telefono: { step, data, lastActivity } }
const conversaciones = {};

// Teléfonos con agente pausado (el operador gestiona manualmente)
const agentePausado = new Set();

function convKey(telefono, sessionId = 'default') {
    return `${sessionId}:${telefono}`;
}

function pausarAgente(telefono, sessionId = 'default') {
    agentePausado.add(convKey(telefono, sessionId));
    console.log(`⏸️ Agente PAUSADO para ${telefono} [${sessionId}]`);
}

function reanudarAgente(telefono, sessionId = 'default') {
    agentePausado.delete(convKey(telefono, sessionId));
    console.log(`▶️ Agente REANUDADO para ${telefono} [${sessionId}]`);
}

function esAgentePausado(telefono, sessionId = 'default') {
    return agentePausado.has(convKey(telefono, sessionId));
}

// Obtener destino único desde configuración
async function obtenerDestinoUnico() {
    const [rows] = await pool.query("SELECT valor FROM configuracion WHERE nombre_parametro = 'destino_unico'");
    return (rows.length > 0 && rows[0].valor) ? rows[0].valor : null;
}

// Limpiar conversaciones inactivas cada 30 minutos
setInterval(() => {
    const ahora = Date.now();
    for (const tel in conversaciones) {
        if (ahora - conversaciones[tel].lastActivity > 30 * 60 * 1000) {
            delete conversaciones[tel];
        }
    }
}, 15 * 60 * 1000);

/**
 * Pasos del flujo conversacional:
 *  - 'saludo'              → Saludo inicial, pedir documento
 *  - 'esperar_documento'   → Esperando cédula / documento
 *  - 'cliente_menu'        → Cliente identificado, preguntar qué necesita
 *  - 'pedir_origen'        → Pidiendo ciudad de origen
 *  - 'pedir_destino'       → Pidiendo ciudad de destino
 *  - 'pedir_fecha'         → Pidiendo fecha de carga
 *  - 'pedir_vehiculo'      → Pidiendo tipo de vehículo
 *  - 'confirmar_solicitud' → Confirmar datos antes de crear
 *  - 'chofer_menu'         → Chofer identificado, flujo de chofer
 */

// La lógica de procesarMensaje se movió a procesarMensajeCompleto al final del archivo.
// Se mantiene este bloque por ahora para evitar errores de referencia si algo falló en la exportación.

/**
 * Identifica si el número pertenece a un cliente o chofer registrado.
 * Si lo encuentra, precarga los datos en la conversación.
 */
async function identificarUsuario(telefono, conv) {
    if (conv.data.tipo) return true; // Ya identificado en esta sesión

    // Buscar en transportes (empresas de transporte) por teléfono
    const telNorm = normalizarTelefono(telefono);
    const [transportes] = await pool.query(
        'SELECT id, nombre, estado, telefono_whatsapp FROM transportes WHERE telefono_whatsapp = ? OR telefono_whatsapp = ?',
        [telefono, telNorm]
    );

    if (transportes.length > 0) {
        const tr = transportes[0];
        conv.data.tipo = 'transporte';
        conv.data.transporteId = tr.id;
        conv.data.transporteNombre = tr.nombre;
        // Actualizar número WhatsApp si cambió
        if (tr.telefono_whatsapp !== telefono) {
            await pool.query('UPDATE transportes SET telefono_whatsapp = ? WHERE id = ?', [telefono, tr.id]);
        }
        if (conv.step === 'saludo') {
            conv.step = 'transporte_menu';
        }
        return true;
    }

    // Buscar en choferes legacy por teléfono
    const [choferes] = await pool.query(
        'SELECT id, nombre, estado, telefono_whatsapp FROM choferes WHERE telefono_whatsapp = ? OR telefono_whatsapp = ?',
        [telefono, telNorm]
    );

    if (choferes.length > 0) {
        const ch = choferes[0];
        conv.data.tipo = 'chofer';
        conv.data.choferId = ch.id;
        conv.data.choferNombre = ch.nombre;
        if (ch.telefono_whatsapp !== telefono) {
            await pool.query('UPDATE choferes SET telefono_whatsapp = ? WHERE id = ?', [telefono, ch.id]);
        }
        if (conv.step === 'saludo') {
            conv.step = 'chofer_menu';
        }
        return true;
    }

    // Buscar en clientes por teléfono (campo principal O dentro del array JSON telefonos)
    // Buscar exacto, normalizado y también con/sin código de país
    const [clientes] = await pool.query(
        `SELECT id, nombre, apellidos, origen_default, telefono_whatsapp FROM clientes
         WHERE telefono_whatsapp = ? OR telefono_whatsapp = ?
            OR JSON_SEARCH(telefonos, 'one', ?) IS NOT NULL
            OR JSON_SEARCH(telefonos, 'one', ?) IS NOT NULL
         LIMIT 1`,
        [telefono, telNorm, telefono, telNorm]
    );

    if (clientes.length > 0) {
        const cl = clientes[0];
        conv.data.tipo = 'cliente';
        conv.data.clienteId = cl.id;
        conv.data.clienteNombre = [cl.nombre, cl.apellidos].filter(Boolean).join(' ');
        conv.data.origenDefault = cl.origen_default || null;
        // Guardar/actualizar el número real de WhatsApp del que escribe
        if (cl.telefono_whatsapp !== telefono) {
            await pool.query('UPDATE clientes SET telefono_whatsapp = ? WHERE id = ?', [telefono, cl.id]);
        }
        if (conv.step === 'saludo') {
            conv.step = 'cliente_menu';
        }
        return true;
    }

    return false;
}

/**
 * Intenta interpretar el mensaje como una cotización (chofer -> precio)
 * sin necesidad de que el mensaje tenga un formato estricto.
 */
async function intentarCotizacionRapida(jid, texto, conv, enviar) {
    const aiService = require('./aiService');

    // Usar IA para ver si hay un precio y/o ID
    const info = await aiService.extractDriverQuote(texto);

    if (info.error) {
        await pool.query(
            `INSERT INTO mensajes_log (telefono, direccion, contenido, contexto) VALUES (?, 'sistema', ?, 'error_ai_cotizacion')`,
            [jid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, ''), `Error: ${info.error_detail}\nMensaje original: ${texto}`]
        );
        return false;
    }

    if (!info.tiene_precio) return false;

    let solicitudId = info.solicitud_id;

    // Si no detectó ID en el mensaje, ver si el chofer solo tiene un viaje contactado pendiente
    if (!solicitudId) {
        const [pendientes] = await pool.query(
            `SELECT solicitud_id FROM solicitudes_contactos 
             WHERE chofer_id = ? AND respondido = FALSE 
             ORDER BY fecha_contacto DESC`,
            [conv.data.choferId]
        );

        if (pendientes.length === 1) {
            solicitudId = pendientes[0].solicitud_id;
            console.log(`🤖 Contexto: Chofer ${conv.data.choferNombre} solo tiene 1 solicitud pendiente (#${solicitudId}). Asignando precio.`);
        } else if (pendientes.length > 1) {
            await enviar(jid,
                `¡Hola chofer! Veo que quieres cotizar *$${info.precio.toLocaleString('es-CO')}* 💰\n\n` +
                `Pero tienes *varias solicitudes* pendientes. ¿A cuál de estas te refieres?\n\n` +
                pendientes.map(p => `• #${p.solicitud_id}`).join('\n') + `\n\n` +
                `Porfa, escríbeme el número de solicitud (ej: *#${pendientes[0].solicitud_id}*) y el precio.`
            );
            return true;
        } else {
            // No tiene solicitudes contactadas... tal vez es un mensaje viejo o error
            return false;
        }
    }

    // Si llegamos aquí, tenemos solicitudId y precio
    if (solicitudId) {
        await guardarCotizacionChofer(jid, solicitudId, info.precio, conv, enviar);
        return true;
    }

    return false;
}

/**
 * Guarda la cotización en la base de datos y notifica al chofer.
 */
async function guardarCotizacionChofer(jid, solicitudId, precio, conv, enviar) {
    try {
        // Verificar que la solicitud exista y esté en 'Cotizando'
        const [sol] = await pool.query(
            "SELECT estado FROM solicitudes WHERE id = ? AND estado = 'Cotizando'",
            [solicitudId]
        );

        if (sol.length === 0) {
            await enviar(jid, `Oye, la solicitud *#${solicitudId}* ya no está recibiendo cotizaciones o no existe 🧐`);
            return;
        }

        // Insertar o actualizar cotización
        await pool.query(
            `INSERT INTO cotizaciones (solicitud_id, chofer_id, costo_ofrecido) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE costo_ofrecido = ?`,
            [solicitudId, conv.data.choferId, precio, precio]
        );

        // Marcar como respondido en la tabla de contactos
        await pool.query(
            'UPDATE solicitudes_contactos SET respondido = TRUE WHERE solicitud_id = ? AND chofer_id = ?',
            [solicitudId, conv.data.choferId]
        );

        await enviar(jid, `¡Recibido! ✅ Registré tu oferta de *$${precio.toLocaleString('es-CO')}* para la solicitud *#${solicitudId}*.\n\n` +
            `Ya quedó en el sistema 🚀 Te avisaré si el cliente la acepta. ¡Muchas gracias, *${conv.data.choferNombre}*! 😊`);

        console.log(`✓ Cotización guardada: Solicitud #${solicitudId}, Chofer ${conv.data.choferNombre}, Precio $${precio}`);

        // Verificar si cerramos la subasta
        const cotizacionService = require('./cotizacionService');
        await cotizacionService.verificarCotizacionesCompletas(solicitudId);

    } catch (err) {
        console.error('Error guardando cotización:', err);

        // Log the exact error to the database for debugging
        await pool.query(
            `INSERT INTO mensajes_log (telefono, direccion, contenido, contexto) VALUES (?, 'sistema', ?, 'error_guardado_cotizacion')`,
            [jid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, ''), `Error BD: ${err.message}\nChofer: ${conv.data.choferId}\nPrecio: ${precio}`]
        );

        await enviar(jid, 'Lo siento, tuve un problema guardando tu oferta. ¿Podrías intentar de nuevo? 😔');
    }
}

// ===== PASO 1: SALUDO =====
async function saludar(jid, conv, enviar) {
    // identificarUsuario() ya fue llamado antes en el dispatcher
    if (conv.data.tipo === 'cliente') {
        conv.step = 'cliente_menu';
        await enviar(jid,
            `¡Hola de nuevo, *${conv.data.clienteNombre}*! 👋 Qué alegría verte por aquí 😊\n\n` +
            `¿En qué te puedo ayudar hoy?\n\n` +
            `1️⃣ Necesito un *nuevo viaje* de transporte 🚛\n` +
            `2️⃣ Ver el *estado* de mis solicitudes 📋\n\n` +
            `Escríbeme *1* o *2* 😊`
        );
        return;
    }
    if (conv.data.tipo === 'chofer' || conv.data.tipo === 'transporte') {
        return; // identificarUsuario ya maneja el step correcto
    }

    // No registrado — indicar que debe ser dado de alta por un operador
    await enviar(jid,
        `¡Hola! 👋 Soy el *asistente de Falc AI* 🚛\n\n` +
        `Lamento no poder atenderte aún — tu número no está registrado en nuestro sistema 🤔\n\n` +
        `Para que puedas usar nuestros servicios, un operador debe registrarte primero desde el panel.\n\n` +
        `📞 Comunícate con nosotros para que te den de alta. ¡Te esperamos! 😊`
    );
    conv.step = 'no_registrado';
}

// ===== PASO 2: VERIFICAR DOCUMENTO =====
async function procesarDocumento(jid, texto, conv, enviar, telefono) {
    // Extraer solo números del texto
    const documento = texto.replace(/[^0-9]/g, '');

    if (!documento || documento.length < 5) {
        await enviar(jid, 'Ay, no me cuadra ese número 😅 ¿Me lo puedes escribir otra vez? Solo los números de tu cédula, porfa.\n\nPor ejemplo: *17255900*');
        return;
    }

    conv.data.documento = documento;

    // 1. Buscar en clientes
    const [clientes] = await pool.query(
        'SELECT id, nombre, documento, telefono_whatsapp FROM clientes WHERE documento = ?',
        [documento]
    );

    // 2. Buscar en choferes por documento
    const [choferes] = await pool.query(
        'SELECT id, nombre, estado, telefono_whatsapp FROM choferes WHERE documento = ?',
        [documento]
    );

    if (clientes.length > 0) {
        const cliente = clientes[0];
        // En caso de que se haya validado un documento diferente al que estaba en sesión actual, limpiar la sesión previa
        conv.data = { documento, telefonoRegistro: telefono };

        conv.data.clienteId = cliente.id;
        conv.data.clienteNombre = cliente.nombre;
        conv.data.tipo = 'cliente';
        conv.step = 'cliente_menu';

        // "Aprender" el teléfono si es nuevo
        if (cliente.telefono_whatsapp !== telefono) {
            await pool.query('UPDATE clientes SET telefono_whatsapp = ? WHERE id = ?', [telefono, cliente.id]);
        }

        await enviar(jid,
            `¡Ey, *${cliente.nombre}*! 🎉 Qué alegría verte por aquí, ¿cómo has estado?\n\n` +
            `Cuéntame, ¿en qué te puedo colaborar hoy?\n\n` +
            `1️⃣ Necesito un *nuevo viaje* de transporte 🚛\n` +
            `2️⃣ Quiero saber el *estado* de mis solicitudes 📋\n\n` +
            `Escríbeme *1* o *2* y con gusto te ayudo 😊`
        );
    } else if (choferes.length > 0) {
        const chofer = choferes[0];
        // En caso de que se haya validado un documento diferente, limpiar la sesión
        conv.data = { documento, telefonoRegistro: telefono };

        conv.data.choferId = chofer.id;
        conv.data.choferNombre = chofer.nombre;
        conv.data.tipo = 'chofer';
        conv.step = 'chofer_menu';

        // "Aprender" el identificador (LID o Phone) si es nuevo
        if (chofer.telefono_whatsapp !== telefono) {
            await pool.query('UPDATE choferes SET telefono_whatsapp = ? WHERE id = ?', [telefono, chofer.id]);
            console.log(`📝 Identificador actualizado para chofer ${chofer.nombre}: ${telefono}`);
        }

        await enviar(jid,
            `¡Quiubo, *${chofer.nombre}*! 🚛 ¿Cómo va todo?\n\n` +
            `Tu estado actual es: *${chofer.estado}*\n\n` +
            `¿Qué necesitas, parce?\n\n` +
            `1️⃣ Ver las *cotizaciones pendientes*\n` +
            `2️⃣ Cambiar mi *estado* (disponible/inactivo)\n\n` +
            `Dale, escríbeme *1* o *2* 😊`
        );
    } else {
        // No encontrado — crear desde cero, borrar cualquier dato de sesión previo basado en el teléfono
        conv.data = { documento, telefonoRegistro: telefono };

        await enviar(jid,
            `Mmm, no te tengo registrado/a con ese documento *${documento}* 🤔\n\n` +
            `¡Pero tranqui! Te registro ahora mismo, es súper rápido 😊\n\n` +
            `¿Me dices tu *nombre completo*?`
        );
        conv.step = 'registrar_nombre';
        conv.data.telefonoRegistro = telefono;
    }
}

// ===== REGISTRAR CLIENTE NUEVO =====
async function procesarRegistroNombre(jid, texto, conv, enviar) {
    const nombreCompleto = texto.trim();
    if (nombreCompleto.length < 3) {
        await enviar(jid, 'Oye, ¿me lo puedes escribir completo? Tu nombre y apellido, porfa 😊');
        return;
    }

    // Separar nombre y apellidos (primera palabra = nombre, resto = apellidos)
    const partes = nombreCompleto.split(' ');
    const nombre = partes[0];
    const apellidos = partes.slice(1).join(' ') || null;
    const telefonoRegistro = conv.data.telefonoRegistro;

    try {
        const [result] = await pool.query(
            `INSERT INTO clientes (nombre, apellidos, telefono_whatsapp, telefonos)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE nombre = ?, apellidos = ?`,
            [nombre, apellidos, telefonoRegistro, JSON.stringify([telefonoRegistro]), nombre, apellidos]
        );

        let insertedId = result.insertId;
        if (insertedId === 0) {
            const [existente] = await pool.query('SELECT id FROM clientes WHERE telefono_whatsapp = ?', [telefonoRegistro]);
            if (existente.length > 0) insertedId = existente[0].id;
        }

        conv.data.clienteId = insertedId;
        conv.data.clienteNombre = nombre;
        conv.data.tipo = 'cliente';
        conv.step = 'cliente_menu';

        await enviar(jid,
            `¡Listo, *${nombre}*! Ya te tengo en el sistema 🎉\n\n` +
            `Bienvenido/a a la familia FALC, ¡es un placer tenerte! 💚\n\n` +
            `Cuéntame, ¿qué necesitas?\n\n` +
            `1️⃣ Necesito un *nuevo viaje* de transporte 🚛\n` +
            `2️⃣ Quiero ver el *estado* de mis solicitudes 📋\n\n` +
            `Escríbeme *1* o *2* 😊`
        );
    } catch (error) {
        console.error('Error registrando cliente:', error);
        await enviar(jid, 'Uy, se me enredó algo por acá 😅 ¿Me haces el favor de escribir *menú* para empezar de nuevo?');
        conv.step = 'saludo';
    }
}

// ===== MENÚ CLIENTE =====
async function menuCliente(jid, texto, conv, enviar) {
    const opcion = texto.trim();

    if (opcion === '1' || texto.toLowerCase().includes('viaje') || texto.toLowerCase().includes('solicitar') || texto.toLowerCase().includes('nuevo') || texto.toLowerCase().includes('camion') || texto.toLowerCase().includes('camión')) {
        // Cargar destino único desde configuración
        const destinoUnico = await obtenerDestinoUnico();
        if (destinoUnico) conv.data.destino = destinoUnico;

        // Si tiene un origen_default (finca), autocompletar
        if (conv.data.origenDefault) {
            conv.data.origen = conv.data.origenDefault;
            conv.step = 'pedir_fecha';
            await enviar(jid,
                `¡Dale, vamos a armar tu pedido! 🚛\n\n` +
                `📍 Origen: *${conv.data.origenDefault}*\n` +
                (destinoUnico ? `📍 Destino: *${destinoUnico}*\n\n` : '\n') +
                `¿Para *cuándo* necesitas los camiones? 📅\n\n` +
                `Me puedes escribir:\n` +
                `• Una fecha como *25/03* o *25/03/2026*\n` +
                `• *15 de marzo*\n` +
                `• *Mañana*\n` +
                `• *Lunes*, *viernes*, etc.`
            );
        } else {
            conv.step = 'pedir_origen';
            await enviar(jid,
                `¡Dale, vamos a armar tu pedido! 🚛\n\n` +
                `Cuéntame, ¿de *dónde sale la carga*? 📍 (Tu finca o lugar de origen)`
            );
        }
    } else if (opcion === '2' || texto.toLowerCase().includes('estado') || texto.toLowerCase().includes('consultar')) {
        // Consultar tickets activos
        const [tix] = await pool.query(
            `SELECT id, origen, destino, estado, cantidad_camiones, camiones_confirmados, fecha_creacion
             FROM tickets WHERE cliente_id = ?
             ORDER BY fecha_creacion DESC LIMIT 5`,
            [conv.data.clienteId]
        );

        if (tix.length === 0) {
            await enviar(jid, 'Aún no tienes pedidos registrados 📋\n\n¿Quieres crear uno? Escríbeme *1* y te ayudo 😊');
            return;
        }

        let lista = `Acá están tus últimos pedidos 📋\n\n`;
        for (const t of tix) {
            lista += `• Ticket #${t.id} | ${t.origen} → ${t.destino || '—'}\n  🚛 ${t.camiones_confirmados}/${t.cantidad_camiones} camiones | Estado: *${t.estado}*\n\n`;
        }
        lista += `¿Algo más? Escríbeme *1* para un nuevo pedido o *menú* para volver al inicio 😊`;

        await enviar(jid, lista);
    } else {
        await enviar(jid, 'No te entendí 😅 Escríbeme *1* si necesitas camiones o *2* para ver tus pedidos');
    }
}

// ===== PEDIR ORIGEN =====
async function procesarOrigen(jid, texto, conv, enviar) {
    if (texto.length < 2) {
        await enviar(jid, '¿Me lo puedes escribir bien? El nombre de la ciudad o lugar de origen 📍');
        return;
    }
    conv.data.origen = texto;

    // Si ya hay destino cargado (de configuración), saltar pedir_destino
    if (conv.data.destino) {
        conv.step = 'pedir_fecha';
        await enviar(jid,
            `Listo, sale de *${texto}* 📍\n` +
            `📍 Destino: *${conv.data.destino}*\n\n` +
            `¿Para *cuándo* necesitas los camiones? 📅\n\n` +
            `Me puedes escribir:\n` +
            `• Una fecha como *25/03* o *25/03/2026*\n` +
            `• *15 de marzo*\n` +
            `• *Mañana*\n` +
            `• *Lunes*, *viernes*, etc.`
        );
    } else {
        conv.step = 'pedir_destino';
        await enviar(jid, `Listo, sale de *${texto}* 📍\n\n¿Y para *dónde va* la carga? 🚛`);
    }
}

// ===== PEDIR DESTINO =====
async function procesarDestino(jid, texto, conv, enviar) {
    if (texto.length < 2) {
        await enviar(jid, '¿Me puedes repetir el destino? Escribe la ciudad o lugar al que va la carga');
        return;
    }
    conv.data.destino = texto;
    conv.step = 'pedir_fecha';
    await enviar(jid,
        `Perfecto, destino: *${texto}* 📍\n\n` +
        `¿Y para *cuándo* necesitas los camiones? 📅\n\n` +
        `Me puedes escribir:\n` +
        `• Una fecha como *25/03* o *25/03/2026*\n` +
        `• *15 de marzo*\n` +
        `• *Mañana*\n` +
        `• *Lunes*, *viernes*, etc.`
    );
}

// ===== PEDIR FECHA =====
async function procesarFecha(jid, texto, conv, enviar) {
    if (texto.length < 2) {
        await enviar(jid, '¿Para cuándo sería? Escríbeme la fecha, porfa 📅');
        return;
    }

    // Intentar parsear la fecha
    const fechaParseada = parsearFecha(texto);

    // Validación extra: si parsearFecha devolvió null o algo que no parece fecha DD/MM/YYYY
    if (!fechaParseada || !fechaParseada.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        await enviar(jid,
            `No logré entender esa fecha *"${texto}"* 😅\n\n` +
            `Escríbemela de alguna de estas formas:\n` +
            `• *25/03* o *25/03/2026*\n` +
            `• *15 de marzo*\n` +
            `• *Mañana*, *viernes*, *hoy*`
        );
        return;
    }

    conv.data.fecha = fechaParseada;
    conv.data.fechaTexto = texto;
    conv.step = 'pedir_cantidad_camiones';
    await enviar(jid, `📅 Fecha: *${fechaParseada}*\n\n¿Cuántos *camiones* necesitas? 🚛`);
}

// ===== MENÚ TRANSPORTE =====
async function menuTransporte(jid, texto, conv, enviar) {
    // === PRIMERO: Verificar asignaciones pendientes por responder (estado Enviado) ===
    const [pendientes] = await pool.query(
        `SELECT a.id, a.ticket_id, a.cantidad_camiones, t.origen, t.destino, t.fecha_requerida,
                c.nombre as cliente_nombre
         FROM asignaciones a
         JOIN tickets t ON a.ticket_id = t.id
         JOIN clientes c ON t.cliente_id = c.id
         WHERE a.transporte_id = ? AND a.estado = 'Enviado'
         ORDER BY a.fecha_envio DESC`,
        [conv.data.transporteId]
    );

    // Si tiene pendientes por responder, eso tiene prioridad
    if (pendientes.length > 0) {
        // Si hay 1 solo pendiente y el texto ya parece una respuesta (viene del mensaje de asignar),
        // auto-seleccionar y procesar directamente (evita mensaje doble)
        if (pendientes.length === 1) {
            const textoLower = texto.toLowerCase().trim();
            const tieneNumero = /\d+/.test(texto.trim());
            const esAfirmativo = textoLower === 'sí' || textoLower === 'si' || textoLower === 's' ||
                textoLower === 'aceptar' || textoLower.includes('acepto') ||
                textoLower.startsWith('si ') || textoLower.startsWith('sí ');
            const esNegativo = textoLower === 'no' || textoLower === 'n' || textoLower === 'rechazar' ||
                textoLower.startsWith('no ');

            if (esAfirmativo || esNegativo || tieneNumero) {
                conv.data.asignacionPendiente = pendientes[0].id;
                conv.data.cantidadAsignada = pendientes[0].cantidad_camiones;
                conv.step = 'transporte_responder';
                await procesarRespuestaTransporte(jid, texto, conv, enviar);
                return;
            }
        }

        let lista = `¡Hola, *${conv.data.transporteNombre}*! 🚛\n\nTienes *${pendientes.length}* pedido(s) pendientes:\n\n`;
        for (let i = 0; i < pendientes.length; i++) {
            const p = pendientes[i];
            const fecha = new Date(p.fecha_requerida).toLocaleDateString('es-CO');
            lista += `*${i + 1}.* Ticket #${p.ticket_id}\n`;
            lista += `   📍 ${p.origen} → ${p.destino || '—'}\n`;
            lista += `   📅 ${fecha} | 🚛 ${p.cantidad_camiones} camión(es)\n`;
            lista += `   👤 Cliente: ${p.cliente_nombre}\n\n`;
        }

        if (pendientes.length === 1) {
            conv.data.asignacionPendiente = pendientes[0].id;
            conv.data.cantidadAsignada = pendientes[0].cantidad_camiones;
            conv.step = 'transporte_responder';
            const cant = pendientes[0].cantidad_camiones;
            if (cant > 1) {
                lista += `¿Cuántos de los *${cant}* camiones aceptas?\n`;
                lista += `✅ Escribe *sí* para aceptar los ${cant}\n`;
                lista += `🔢 O un número si aceptas menos (ej: *${cant - 1}*)\n`;
                lista += `❌ Escribe *no* para rechazar`;
            } else {
                lista += `¿Aceptas este pedido?\n✅ Escribe *sí* para aceptar\n❌ Escribe *no* para rechazar`;
            }
        } else {
            conv.data.asignacionesPendientes = pendientes.map(p => ({ id: p.id, ticket_id: p.ticket_id, cantidad_camiones: p.cantidad_camiones }));
            conv.step = 'transporte_responder';
            lista += `Escribe el *número* del pedido que quieres responder (ej: *1*)`;
        }

        await enviar(jid, lista);
        return;
    }

    // === SEGUNDO: Recuperación - asignaciones Aceptadas con vehículos pendientes por registrar ===
    const [aceptadasIncompletas] = await pool.query(
        `SELECT a.id, a.cantidad_camiones,
                (SELECT COUNT(*) FROM vehiculos_asignados va WHERE va.asignacion_id = a.id) as vehiculos_registrados
         FROM asignaciones a
         WHERE a.transporte_id = ? AND a.estado = 'Aceptado'
         HAVING vehiculos_registrados < a.cantidad_camiones
         ORDER BY a.fecha_respuesta DESC LIMIT 1`,
        [conv.data.transporteId]
    );

    if (aceptadasIncompletas.length > 0) {
        const ai = aceptadasIncompletas[0];
        conv.step = 'transporte_datos_camion';
        conv.data.asignacionAceptada = ai.id;
        conv.data.vehiculosTotal = ai.cantidad_camiones;
        conv.data.vehiculosRegistrados = ai.vehiculos_registrados;
        conv.data.conductorNombre = null;
        conv.data.cuilConductor = null;
        conv.data.placaCamion = null;
        conv.data.patente2 = null;
        conv.data.tipoCamion = null;

        const faltantes = ai.cantidad_camiones - ai.vehiculos_registrados;
        const numActual = ai.vehiculos_registrados + 1;

        if (ai.vehiculos_registrados > 0) {
            await enviar(jid,
                `¡Hola, *${conv.data.transporteNombre}*! 🚛\n\n` +
                `Veo que tienes un pedido aceptado con *${faltantes}* camión(es) pendiente(s) de registrar datos.\n\n` +
                `*Camión ${numActual} de ${ai.cantidad_camiones}:*\n` +
                `Envíame el *nombre y apellido* del chofer:`
            );
        } else {
            const msgCamiones = ai.cantidad_camiones > 1
                ? `Necesito los datos de *${ai.cantidad_camiones} camiones* 🚛\n\n*Camión 1 de ${ai.cantidad_camiones}:*\n`
                : `Necesito los datos del camión 🚛\n\n`;
            await enviar(jid,
                `¡Hola, *${conv.data.transporteNombre}*! 🚛\n\n` +
                `Tienes un pedido aceptado pendiente de registrar datos.\n\n` +
                msgCamiones +
                `Envíame el *nombre y apellido* del chofer:`
            );
        }
        return;
    }

    // === Nada pendiente ===
    await enviar(jid,
        `¡Hola, *${conv.data.transporteNombre}*! 🚛\n\n` +
        `No tienes pedidos pendientes en este momento 📋\n` +
        `Te avisaremos cuando haya uno nuevo. ¡Quédate atento! 😊`
    );
}

// ===== TRANSPORTE: RESPONDER (ACEPTAR/RECHAZAR) =====
async function procesarRespuestaTransporte(jid, texto, conv, enviar) {
    const textoLower = texto.toLowerCase().trim();

    // Si hay múltiples, primero seleccionar
    if (conv.data.asignacionesPendientes && !conv.data.asignacionPendiente) {
        const num = parseInt(texto.trim());
        if (isNaN(num) || num < 1 || num > conv.data.asignacionesPendientes.length) {
            await enviar(jid, `Escríbeme el número del pedido (1 a ${conv.data.asignacionesPendientes.length})`);
            return;
        }
        const selected = conv.data.asignacionesPendientes[num - 1];
        conv.data.asignacionPendiente = selected.id;
        conv.data.cantidadAsignada = selected.cantidad_camiones;
        const cant = selected.cantidad_camiones;
        if (cant > 1) {
            await enviar(jid,
                `Pedido seleccionado (🚛 ${cant} camiones).\n\n` +
                `¿Cuántos camiones aceptas?\n` +
                `✅ *sí* para aceptar los ${cant}\n` +
                `🔢 O un número si aceptas menos (ej: *${cant - 1}*)\n` +
                `❌ *no* para rechazar`
            );
        } else {
            await enviar(jid, `Pedido seleccionado (🚛 1 camión).\n\n¿Aceptas?\n✅ *sí* para aceptar\n❌ *no* para rechazar`);
        }
        return;
    }

    const asigId = conv.data.asignacionPendiente;
    const cantidadOriginal = conv.data.cantidadAsignada || 1;

    // Determinar cuántos acepta
    let cantidadAceptada = 0;
    let rechazado = false;

    // Intentar extraer un número del texto
    const match = texto.trim().match(/\d+/);

    if (match) {
        const num = parseInt(match[0]);
        if (num === 0) {
            rechazado = true;
        } else if (num >= 1 && num <= cantidadOriginal) {
            cantidadAceptada = num;
        } else {
            await enviar(jid, `El número debe ser entre 0 y ${cantidadOriginal}. Escribe *sí* para aceptar los ${cantidadOriginal}, un número, o *no* para rechazar.`);
            return;
        }
    } else if (textoLower === 'sí' || textoLower === 'si' || textoLower === 's' || textoLower === 'aceptar' ||
               textoLower.includes('acepto') || textoLower.startsWith('si ') || textoLower.startsWith('sí ')) {
        cantidadAceptada = cantidadOriginal; // Aceptar todos
    } else if (textoLower === 'no' || textoLower === 'n' || textoLower === 'rechazar' || textoLower.startsWith('no ')) {
        rechazado = true;
    } else {
        if (cantidadOriginal > 1) {
            await enviar(jid, `No te entendí 😅 Escribe *sí* para los ${cantidadOriginal}, un número (0 a ${cantidadOriginal}), o *no* para rechazar.`);
        } else {
            await enviar(jid, '¿Aceptas o rechazas? Escríbeme *sí* o *no* 😊');
        }
        return;
    }

    // --- RECHAZAR ---
    if (rechazado) {
        await pool.query("UPDATE asignaciones SET estado = 'Rechazado', fecha_respuesta = NOW() WHERE id = ?", [asigId]);

        const [asig] = await pool.query('SELECT ticket_id FROM asignaciones WHERE id = ?', [asigId]);
        if (asig.length > 0) {
            const [pendientes] = await pool.query(
                "SELECT COUNT(*) as total FROM asignaciones WHERE ticket_id = ? AND estado = 'Enviado'",
                [asig[0].ticket_id]
            );
            if (pendientes[0].total === 0) {
                await pool.query("UPDATE tickets SET estado = 'Pendiente de asignación' WHERE id = ?", [asig[0].ticket_id]);
            }
        }

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [null, 'Transporte rechazó', 'asignacion', asigId, `Transporte ${conv.data.transporteNombre} rechazó`]
        );

        await enviar(jid, 'Entendido, pedido rechazado ❌\n\nTe avisaremos cuando haya nuevos pedidos. ¡Gracias! 😊');
        conv.step = 'transporte_menu';
        conv.data.asignacionPendiente = null;
        conv.data.asignacionesPendientes = null;
        conv.data.cantidadAsignada = null;
        return;
    }

    // --- ACEPTAR (total o parcial) ---
    const esParcial = cantidadAceptada < cantidadOriginal;

    if (esParcial) {
        // Aceptación parcial: actualizar cantidad_camiones de la asignación
        await pool.query(
            "UPDATE asignaciones SET cantidad_camiones = ?, estado = 'Aceptado', fecha_respuesta = NOW() WHERE id = ?",
            [cantidadAceptada, asigId]
        );
    } else {
        await pool.query("UPDATE asignaciones SET estado = 'Aceptado', fecha_respuesta = NOW() WHERE id = ?", [asigId]);
    }

    // Actualizar camiones confirmados del ticket
    const [asig] = await pool.query('SELECT ticket_id FROM asignaciones WHERE id = ?', [asigId]);
    if (asig.length > 0) {
        const tId = asig[0].ticket_id;
        const [aceptados] = await pool.query(
            "SELECT COALESCE(SUM(cantidad_camiones), 0) as total FROM asignaciones WHERE ticket_id = ? AND estado = 'Aceptado'",
            [tId]
        );
        await pool.query(
            "UPDATE tickets SET camiones_confirmados = ?, estado = 'Aceptado - Pendiente datos camión' WHERE id = ?",
            [aceptados[0].total, tId]
        );
    }

    const detalle = esParcial
        ? `Transporte ${conv.data.transporteNombre} aceptó ${cantidadAceptada} de ${cantidadOriginal}`
        : `Transporte ${conv.data.transporteNombre} aceptó los ${cantidadAceptada}`;

    await pool.query(
        'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
        [null, 'Transporte aceptó', 'asignacion', asigId, detalle]
    );

    conv.step = 'transporte_datos_camion';
    conv.data.asignacionAceptada = asigId;
    conv.data.vehiculosTotal = cantidadAceptada;
    conv.data.vehiculosRegistrados = 0;
    conv.data.conductorNombre = null;
    conv.data.cuilConductor = null;
    conv.data.placaCamion = null;
    conv.data.patente2 = null;
    conv.data.tipoCamion = null;

    const msgParcial = esParcial
        ? `Aceptaste *${cantidadAceptada}* de ${cantidadOriginal} camiones (${cantidadOriginal - cantidadAceptada} liberados) 📋\n\n`
        : '';

    const msgCamiones = cantidadAceptada > 1
        ? `Necesito los datos de *${cantidadAceptada} camiones* 🚛\n\n*Camión 1 de ${cantidadAceptada}:*\n`
        : `Ahora necesito los datos del camión 🚛\n\n`;

    await enviar(jid,
        `¡Genial, pedido aceptado! ✅\n\n` +
        msgParcial +
        msgCamiones +
        `Envíame el *nombre y apellido* del chofer:`
    );
}

// ===== TRANSPORTE: DATOS DEL CAMIÓN =====
async function procesarDatosCamionTransporte(jid, texto, conv, enviar) {
    const asigId = conv.data.asignacionAceptada;

    // Obtener cantidad de camiones de la asignación
    if (!conv.data.vehiculosTotal) {
        const [asigRows] = await pool.query('SELECT cantidad_camiones FROM asignaciones WHERE id = ?', [asigId]);
        conv.data.vehiculosTotal = asigRows[0].cantidad_camiones || 1;
        conv.data.vehiculosRegistrados = 0;
        conv.data.conductorNombre = null;
        conv.data.cuilConductor = null;
        conv.data.placaCamion = null;
        conv.data.patente2 = null;
        conv.data.tipoCamion = null;
    }

    const total = conv.data.vehiculosTotal;
    const registrados = conv.data.vehiculosRegistrados;
    const numActual = registrados + 1;
    const textoLower = texto.trim().toLowerCase();

    // Paso 1: Nombre y apellido del chofer
    if (conv.data.conductorNombre == null) {
        conv.data.conductorNombre = texto.trim();
        await enviar(jid, `👤 Chofer: *${conv.data.conductorNombre}* ✅\n\nAhora el *CUIL* del chofer (ej: 20-12345678-9):\n_(Escribe *no* si no tenés el dato)_`);
        return;
    }

    // Paso 2: CUIL del chofer
    if (conv.data.cuilConductor == null) {
        conv.data.cuilConductor = (textoLower === 'no' || textoLower === 'n' || textoLower === '-') ? '-' : texto.trim();
        await enviar(jid, `CUIL: *${conv.data.cuilConductor}* ✅\n\nEnvíame la *Patente 1* del camión (tractor/unidad):`);
        return;
    }

    // Paso 3: Patente 1
    if (conv.data.placaCamion == null) {
        conv.data.placaCamion = texto.trim().toUpperCase();
        await enviar(jid, `Patente 1: *${conv.data.placaCamion}* ✅\n\n¿Tiene acoplado? Envíame la *Patente 2*:\n_(Escribe *no* si no tiene)_`);
        return;
    }

    // Paso 4: Patente 2 (opcional)
    if (conv.data.patente2 == null) {
        conv.data.patente2 = (textoLower === 'no' || textoLower === 'n' || textoLower === '-') ? '' : texto.trim().toUpperCase();
        const p2msg = conv.data.patente2 ? `Patente 2: *${conv.data.patente2}* ✅` : 'Sin acoplado ✅';
        await enviar(jid, `${p2msg}\n\n¿Cuál es el *tipo de camión*?\n_(Ej: Semirremolque, Volcador, Chasis, Plataforma, Cisterna, etc.)_`);
        return;
    }

    // Paso 5: Tipo de camión → guardar en DB
    if (conv.data.tipoCamion == null) {
        conv.data.tipoCamion = texto.trim();

        // Guardar en vehiculos_asignados
        await pool.query(
            'INSERT INTO vehiculos_asignados (asignacion_id, placa, patente2, tipo_camion, conductor_nombre, cuil_conductor) VALUES (?, ?, ?, ?, ?, ?)',
            [asigId, conv.data.placaCamion, conv.data.patente2 || null, conv.data.tipoCamion, conv.data.conductorNombre, conv.data.cuilConductor !== '-' ? conv.data.cuilConductor : null]
        );

        conv.data.vehiculosRegistrados = numActual;

        if (numActual < total) {
            // Faltan más vehículos
            const p2line = conv.data.patente2 ? `🔗 Patente 2: *${conv.data.patente2}*\n` : '';
            await enviar(jid,
                `✅ Camión ${numActual}/${total} registrado:\n` +
                `👤 Chofer: *${conv.data.conductorNombre}*\n` +
                `🪪 CUIL: *${conv.data.cuilConductor}*\n` +
                `🚛 Patente 1: *${conv.data.placaCamion}*\n` +
                p2line +
                `🔧 Tipo: *${conv.data.tipoCamion}*\n\n` +
                `Ahora el camión *${numActual + 1} de ${total}* 🚛\n\n` +
                `Envíame el *nombre y apellido* del chofer:`
            );
            conv.data.conductorNombre = null;
            conv.data.cuilConductor = null;
            conv.data.placaCamion = null;
            conv.data.patente2 = null;
            conv.data.tipoCamion = null;
            return;
        }

        // Todos los vehículos registrados - actualizar ticket
        const [asig] = await pool.query('SELECT ticket_id FROM asignaciones WHERE id = ?', [asigId]);
        const ticketId = asig[0].ticket_id;

        // También guardamos en la asignación el último placa/conductor por compatibilidad
        await pool.query(
            'UPDATE asignaciones SET placa_camion = ?, conductor_nombre = ? WHERE id = ?',
            [conv.data.placaCamion, conv.data.conductorNombre, asigId]
        );

        conv.data.conductorNombre = null;
        conv.data.cuilConductor = null;
        conv.data.placaCamion = null;
        conv.data.patente2 = null;
        conv.data.tipoCamion = null;

        const [confirmados] = await pool.query(
            "SELECT COALESCE(SUM(cantidad_camiones), 0) as total FROM asignaciones WHERE ticket_id = ? AND estado = 'Aceptado'",
            [ticketId]
        );
        const totalConf = confirmados[0].total;
        await pool.query('UPDATE tickets SET camiones_confirmados = ? WHERE id = ?', [totalConf, ticketId]);

        const [ticket] = await pool.query('SELECT cantidad_camiones FROM tickets WHERE id = ?', [ticketId]);
        const requeridos = ticket[0].cantidad_camiones;

        let nuevoEstado;
        if (totalConf >= requeridos) {
            nuevoEstado = 'Listo para confirmar al cliente';
        } else {
            nuevoEstado = 'En proceso de confirmación';
        }
        await pool.query('UPDATE tickets SET estado = ? WHERE id = ?', [nuevoEstado, ticketId]);

        await pool.query(
            'INSERT INTO acciones_log (operador_id, accion, entidad, entidad_id, detalle) VALUES (?, ?, ?, ?, ?)',
            [null, 'Datos camión registrados', 'asignacion', asigId, `${total} vehículo(s) registrados (${totalConf}/${requeridos})`]
        );

        await enviar(jid,
            `✅ ¡Todos los datos registrados! (${total} camión(es))\n\n` +
            `Progreso del ticket: *${totalConf}/${requeridos}* camiones confirmados\n\n` +
            `¡Gracias, ${conv.data.transporteNombre}! 😊`
        );

        // Limpiar y volver al menú
        conv.step = 'transporte_menu';
        conv.data.placaCamion = null;
        conv.data.conductorNombre = null;
        conv.data.asignacionAceptada = null;
        conv.data.vehiculosTotal = null;
        conv.data.vehiculosRegistrados = null;
    }
}


// ===== PEDIR CANTIDAD DE CAMIONES =====
async function procesarCantidadCamiones(jid, texto, conv, enviar) {
    const cantidad = parseInt(texto.trim());
    if (isNaN(cantidad) || cantidad < 1 || cantidad > 50) {
        await enviar(jid, '¿Cuántos camiones necesitas? Escríbeme un número, por ejemplo *3* 🚛');
        return;
    }

    conv.data.cantidadCamiones = cantidad;

    // Cargar tipos de vehículos disponibles desde la BD
    try {
        const [tipos] = await pool.query('SELECT id, nombre FROM tipos_vehiculos ORDER BY nombre ASC');
        if (tipos.length > 0) {
            conv.data.tiposVehiculos = tipos;
            conv.step = 'pedir_tipo_vehiculo';
            const lista = tipos.map((t, i) => `*${i + 1}.* ${t.nombre}`).join('\n');
            await enviar(jid,
                `🚛 *${cantidad}* camión(es). ¡Casi listo!\n\n` +
                `¿Qué tipo de camión necesitas? 🔧\n\n` +
                lista +
                `\n\n_Escribe el número o el nombre. Escribe *0* si no importa el tipo._`
            );
        } else {
            // Sin tipos configurados → ir directo a confirmación
            conv.data.tiposVehiculos = [];
            conv.data.tipoVehiculoId = null;
            conv.data.tipoVehiculoNombre = null;
            conv.step = 'confirmar_solicitud';
            await enviar(jid,
                `¡Listo! Mira cómo quedó tu pedido 📋\n\n` +
                `👤 *${conv.data.clienteNombre}*\n` +
                `📍 De: *${conv.data.origen}*\n` +
                `📍 A: *${conv.data.destino || '(por definir)'}*\n` +
                `📅 Fecha: *${conv.data.fecha}*\n` +
                `🚛 Camiones: *${cantidad}*\n\n` +
                `¿Todo bien? Escríbeme *sí* para enviarlo o *no* si quieres corregir algo 😊`
            );
        }
    } catch (err) {
        console.error('Error cargando tipos de vehículos:', err.message);
        // Fallback sin tipos
        conv.data.tipoVehiculoId = null;
        conv.data.tipoVehiculoNombre = null;
        conv.step = 'confirmar_solicitud';
        await enviar(jid,
            `Camiones: *${cantidad}* ✅\n\n¿Todo bien? Escríbeme *sí* para enviar el pedido 😊`
        );
    }
}

// ===== PEDIR TIPO DE VEHÍCULO =====
async function procesarTipoVehiculo(jid, texto, conv, enviar) {
    const entrada = texto.trim();
    const tipos = conv.data.tiposVehiculos || [];
    const saltar = entrada === '0' || ['no', 'n', 'omitir', 'saltar', 'ninguno', 'skip', 'cualquiera'].includes(entrada.toLowerCase());

    if (saltar) {
        conv.data.tipoVehiculoId = null;
        conv.data.tipoVehiculoNombre = null;
    } else {
        const num = parseInt(entrada);
        if (!isNaN(num) && num >= 1 && num <= tipos.length) {
            const sel = tipos[num - 1];
            conv.data.tipoVehiculoId = sel.id;
            conv.data.tipoVehiculoNombre = sel.nombre;
        } else {
            // Intentar coincidencia por nombre
            const norm = entrada.toLowerCase();
            const coincide = tipos.find(t => t.nombre.toLowerCase().includes(norm));
            if (coincide) {
                conv.data.tipoVehiculoId = coincide.id;
                conv.data.tipoVehiculoNombre = coincide.nombre;
            } else {
                const lista = tipos.map((t, i) => `*${i + 1}.* ${t.nombre}`).join('\n');
                await enviar(jid,
                    `No entendí esa opción 😅\n\n` +
                    `Escríbeme el *número* del tipo:\n${lista}\n\n` +
                    `O escribe *0* si no importa el tipo`
                );
                return;
            }
        }
    }

    conv.step = 'confirmar_solicitud';
    const tipoLinea = conv.data.tipoVehiculoNombre
        ? `🚛 Tipo vehículo: *${conv.data.tipoVehiculoNombre}*\n`
        : `🚛 Tipo vehículo: _cualquiera_\n`;

    await enviar(jid,
        `¡Listo! Mira cómo quedó tu pedido 📋\n\n` +
        `👤 *${conv.data.clienteNombre}*\n` +
        `📍 De: *${conv.data.origen}*\n` +
        `📍 A: *${conv.data.destino || '(por definir)'}*\n` +
        `📅 Fecha: *${conv.data.fecha}*\n` +
        `🔢 Camiones: *${conv.data.cantidadCamiones}*\n` +
        tipoLinea +
        `\n¿Todo bien? Escríbeme *sí* para enviarlo o *no* para corregir algo 😊`
    );
}

/**
 * Calcula similitud entre dos strings (0-1)
 * Basado en bigramas compartidos (Dice coefficient)
 */
function calcularSimilitud(a, b) {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const bigramasA = new Set();
    for (let i = 0; i < a.length - 1; i++) bigramasA.add(a.substring(i, i + 2));
    const bigramasB = new Set();
    for (let i = 0; i < b.length - 1; i++) bigramasB.add(b.substring(i, i + 2));

    let interseccion = 0;
    for (const bg of bigramasA) {
        if (bigramasB.has(bg)) interseccion++;
    }

    return (2 * interseccion) / (bigramasA.size + bigramasB.size);
}

// ===== CONFIRMAR SOLICITUD → CREAR TICKET =====
async function procesarConfirmacion(jid, texto, conv, enviar) {
    const respuesta = texto.toLowerCase().trim();

    if (respuesta === 'sí' || respuesta === 'si' || respuesta === 's') {
        try {
            // Crear el TICKET en la base de datos (NO solicitud)
            const fechaDB = fechaParaDB(conv.data.fecha);
            const fechaRequerida = fechaDB + ' 08:00:00'; // hora por defecto
            const [result] = await pool.query(
                `INSERT INTO tickets (cliente_id, origen, destino, cantidad_camiones, tipo_vehiculo_id, fecha_requerida, observaciones, estado)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'Pendiente de asignación')`,
                [conv.data.clienteId, conv.data.origen, conv.data.destino || null, conv.data.cantidadCamiones || 1, conv.data.tipoVehiculoId || null, fechaRequerida, null]
            );

            const ticketId = result.insertId;
            const tipoLineaConf = conv.data.tipoVehiculoNombre ? `🚛 Vehículo: *${conv.data.tipoVehiculoNombre}*\n` : '';

            await enviar(jid,
                `¡Hecho! Tu pedido *Ticket #${ticketId}* ya quedó registrado 🎉\n\n` +
                `📍 Origen: *${conv.data.origen}*\n` +
                (conv.data.destino ? `📍 Destino: *${conv.data.destino}*\n` : '') +
                `📅 Fecha: *${conv.data.fecha}*\n` +
                `🔢 Camiones: *${conv.data.cantidadCamiones || 1}*\n` +
                tipoLineaConf +
                `\nNuestro equipo ya está buscando transportes para ti 💪\n` +
                `Te avisamos apenas tengamos novedades, ¡quédate tranqui! 😊`
            );

            // Registrar log
            await registrarMensaje(jid.replace(/@s\.whatsapp\.net$/, '').replace(/@lid$/, ''), JSON.stringify(conv.data), 'sistema', 'ticket_creado', ticketId);

            // NO hay cotización automática — el operador asigna manualmente desde el panel

            // Volver al menú del cliente
            conv.step = 'cliente_menu';
            conv.data = { clienteId: conv.data.clienteId, clienteNombre: conv.data.clienteNombre, tipo: 'cliente', documento: conv.data.documento, origenDefault: conv.data.origenDefault };

        } catch (error) {
            console.error('Error creando ticket:', error);
            await enviar(jid, 'Uy, se me enredó algo 😅 ¿Puedes escribir *menú* para intentar de nuevo?');
            conv.step = 'saludo';
        }
    } else if (respuesta === 'no' || respuesta === 'n') {
        conv.step = 'pedir_origen';
        conv.data.origen = null;
        conv.data.destino = null;
        conv.data.fecha = null;
        conv.data.cantidadCamiones = null;
        await enviar(jid, 'Dale, empecemos de nuevo 😊\n\n¿De *dónde sale la carga*? 📍');
    } else {
        await enviar(jid, '¿Sí o no? 😊 Escríbeme *sí* para enviar el pedido o *no* para corregir');
    }
}

// ===== MENÚ CHOFER =====
async function menuChofer(jid, texto, conv, enviar) {
    const opcion = texto.trim();

    if (opcion === '1' || texto.toLowerCase().includes('cotización') || texto.toLowerCase().includes('pendiente')) {
        // Buscar solicitudes pendientes de cotización para este chofer
        const [solicitudes] = await pool.query(
            `SELECT s.id, s.origen, s.destino, s.tipo_vehiculo_requerido, s.fecha_carga
       FROM solicitudes s
       JOIN vehiculos v ON LOWER(v.tipo_vehiculo) LIKE CONCAT('%', LOWER(s.tipo_vehiculo_requerido), '%')
       WHERE v.chofer_id = ?
         AND s.estado = 'Cotizando'
         AND s.id NOT IN (SELECT solicitud_id FROM cotizaciones WHERE chofer_id = ?)
       ORDER BY s.fecha_creacion DESC`,
            [conv.data.choferId, conv.data.choferId]
        );

        if (solicitudes.length === 0) {
            await enviar(jid,
                `No hay cotizaciones pendientes ahorita, *${conv.data.choferNombre}* 📋\n\n` +
                `Te aviso apenas salga algo para ti 🚛`
            );
        } else {
            let lista = `Mira, estas son las rutas disponibles para cotizar 📋\n\n`;
            for (const s of solicitudes) {
                const fecha = new Date(s.fecha_carga).toLocaleDateString('es-CO');
                lista += `• *#${s.id}* | ${s.origen} → ${s.destino}\n  📅 ${fecha} | 🚗 ${s.tipo_vehiculo_requerido}\n\n`;
            }
            lista += `Para cotizar, escríbeme el número de la solicitud y tu tarifa 💰\n` +
                `Ejemplo: *#${solicitudes[0].id} 450000*`;

            conv.step = 'chofer_cotizar';
            await enviar(jid, lista);
        }
    } else if (opcion === '2' || texto.toLowerCase().includes('estado')) {
        const [chofer] = await pool.query('SELECT estado FROM choferes WHERE id = ?', [conv.data.choferId]);
        const estadoActual = chofer[0]?.estado || 'Desconocido';

        await enviar(jid,
            `Tu estado actual: *${estadoActual}*\n\n` +
            `Escribe:\n` +
            `• *disponible* - Para recibir solicitudes\n` +
            `• *inactivo* - Para pausar solicitudes`
        );
        conv.step = 'chofer_cambiar_estado';
    } else if (conv.step === 'chofer_menu') {
        await enviar(jid, 'No te entendí 😅 Escríbeme *1* para cotizaciones o *2* para cambiar tu estado');
    }
}

// ===== CHOFER: COTIZAR =====
async function procesarCotizacionChofer(jid, texto, conv, enviar) {
    // Intentar extraer ID de solicitud y precio
    const match = texto.match(/#?(\d+)\s+(\d[\d.,]*)/);

    if (!match) {
        await enviar(jid, 'No entendí 😅 Escríbeme el número de solicitud y tu tarifa así:\n\nEjemplo: *#1 450000*');
        return;
    }

    const solicitudId = parseInt(match[1]);
    const precio = parseFloat(match[2].replace(/,/g, '.'));

    if (isNaN(precio) || precio <= 0) {
        await enviar(jid, 'Oye, la tarifa tiene que ser un número mayor a 0 🤔');
        return;
    }

    try {
        // Verificar que la solicitud existe y está en cotización
        const [sol] = await pool.query(
            "SELECT id, origen, destino FROM solicitudes WHERE id = ? AND estado = 'Cotizando'",
            [solicitudId]
        );

        if (sol.length === 0) {
            await enviar(jid, `Esa solicitud #${solicitudId} ya no está disponible para cotizar 🤔`);
            conv.step = 'chofer_menu';
            return;
        }

        // Verificar que no haya cotizado ya
        const [yaExiste] = await pool.query(
            'SELECT id FROM cotizaciones WHERE solicitud_id = ? AND chofer_id = ?',
            [solicitudId, conv.data.choferId]
        );

        if (yaExiste.length > 0) {
            await enviar(jid, `Ya me habías enviado precio para la solicitud #${solicitudId} 😊`);
            conv.step = 'chofer_menu';
            return;
        }

        // Registrar cotización
        await pool.query(
            'INSERT INTO cotizaciones (solicitud_id, chofer_id, costo_ofrecido) VALUES (?, ?, ?)',
            [solicitudId, conv.data.choferId, precio]
        );

        await enviar(jid,
            `¡Quedó registrada tu cotización! 🎉\n\n` +
            `📋 Solicitud: #${solicitudId}\n` +
            `📍 ${sol[0].origen} → ${sol[0].destino}\n` +
            `💰 Tu tarifa: *$${precio.toLocaleString()}*\n\n` +
            `Te aviso si quedas seleccionado, ¡mucha suerte, ${conv.data.choferNombre}! 🚛`
        );

        conv.step = 'chofer_menu';

        // Verificar si todos los choferes ya respondieron → selección automática
        try {
            await cotizacionService.verificarCotizacionesCompletas(solicitudId);
        } catch (verErr) {
            console.error('Error verificando cotizaciones completas:', verErr.message);
        }
    } catch (error) {
        console.error('Error registrando cotización:', error);
        await enviar(jid, 'Uy, se me enredó algo registrando tu cotización 😅 ¿Puedes intentar de nuevo?');
        conv.step = 'chofer_menu';
    }
}

// ===== CHOFER: CAMBIAR ESTADO =====
async function procesarCambioEstado(jid, texto, conv, enviar) {
    const t = texto.toLowerCase().trim();
    let nuevoEstado;

    if (t.includes('disponible')) {
        nuevoEstado = 'Disponible';
    } else if (t.includes('inactivo')) {
        nuevoEstado = 'Inactivo';
    } else {
        await enviar(jid, '⚠️ Escribe *disponible* o *inactivo*.');
        return;
    }

    await pool.query('UPDATE choferes SET estado = ? WHERE id = ?', [nuevoEstado, conv.data.choferId]);
    await enviar(jid, `✅ Tu estado se ha actualizado a: *${nuevoEstado}*\n\nEscribe *menú* para volver al inicio.`);
    conv.step = 'chofer_menu';
}

// ===== CONFIRMAR VIAJE (respuesta sí/no a adjudicación) =====
async function procesarConfirmacionViaje(jid, texto, conv, enviar) {
    const respuesta = texto.toLowerCase().trim();

    if (respuesta !== 'sí' && respuesta !== 'si' && respuesta !== 's' && respuesta !== 'no' && respuesta !== 'n') {
        await enviar(jid, '¿Sí o no? 😊 Escríbeme *sí* para contratar o *no* si prefieres dejarlo');
        return;
    }

    const solicitudId = conv.data.solicitudConfirmar;
    if (!solicitudId) {
        conv.step = 'cliente_menu';
        return;
    }

    try {
        if (respuesta === 'sí' || respuesta === 'si' || respuesta === 's') {
            await pool.query("UPDATE solicitudes SET estado = 'Completada' WHERE id = ?", [solicitudId]);

            // Obtener datos completos: solicitud + chofer + cliente
            const [sol] = await pool.query(
                `SELECT s.*, 
                        ch.nombre as chofer_nombre, ch.telefono_whatsapp as chofer_tel,
                        c.nombre as cliente_nombre, c.telefono_whatsapp as cliente_tel
                 FROM solicitudes s
                 LEFT JOIN choferes ch ON s.chofer_asignado_id = ch.id
                 JOIN clientes c ON s.cliente_id = c.id
                 WHERE s.id = ?`,
                [solicitudId]
            );

            if (sol.length > 0 && sol[0].chofer_nombre && sol[0].chofer_tel) {
                const s = sol[0];
                const precioFormateado = s.precio_final_cliente
                    ? Number(s.precio_final_cliente).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    : '';

                // Enviar datos del chofer AL CLIENTE
                await enviar(jid,
                    `¡Perfecto, queda contratado! 🎉\n\n` +
                    `📋 Solicitud *#${solicitudId}*\n` +
                    `💰 Precio: *$${precioFormateado}*\n\n` +
                    `Tu chofer asignado es:\n` +
                    `👤 *${s.chofer_nombre}*\n` +
                    `📱 *+${s.chofer_tel}*\n\n` +
                    `Ya puedes contactarlo para coordinar los detalles del viaje 🚛\n\n` +
                    `¡Gracias por confiar en FALC! 💚 Si necesitas algo más, escríbeme *menú*`
                );

                // Enviar datos del cliente AL CHOFER
                const baileysService = require('./baileysService');
                try {
                    await baileysService.sendMessage(s.chofer_tel,
                        `¡${s.chofer_nombre}! 🎉 Te asignaron la ruta\n\n` +
                        `📋 Solicitud *#${solicitudId}*\n` +
                        `📍 ${s.origen} → ${s.destino}\n` +
                        `📅 ${s.fecha_carga ? new Date(s.fecha_carga).toLocaleDateString('es-CO') : 'Por definir'}\n\n` +
                        `Los datos del cliente para coordinar:\n` +
                        `👤 *${s.cliente_nombre}*\n` +
                        `📱 *+${s.cliente_tel}*\n\n` +
                        `Ponte en contacto con él/ella para los detalles 😊 ¡Buen viaje! 🚛`
                    );
                } catch (choferErr) {
                    console.error('Error notificando al chofer:', choferErr.message);
                }

                // NOTA: A petición del usuario, el estado del chofer no se cambia automáticamente a 'En Viaje'.
                // El chofer decide su estado manualmente ('Disponible' o 'Inactivo').
                // await pool.query("UPDATE choferes SET estado = 'En Viaje' WHERE id = ?", [s.chofer_asignado_id]);
            } else {
                await enviar(jid,
                    `¡Queda confirmado! 🎉\n\n` +
                    `Solicitud #${solicitudId} contratada.\n` +
                    `Te aviso en un ratico con los datos del chofer 🚛\n\n¡Gracias! 💚`
                );
            }
        } else {
            await pool.query("UPDATE solicitudes SET estado = 'Rechazada' WHERE id = ?", [solicitudId]);
            await enviar(jid,
                `Listo, solicitud #${solicitudId} cancelada ❌\n\n` +
                `Cuando necesites algo, aquí estoy 😊`
            );
        }
    } catch (error) {
        console.error('Error procesando confirmación viaje:', error);
        await enviar(jid, 'Uy, se me enredó algo 😅 ¿Puedes intentar de nuevo?');
    }

    conv.step = 'cliente_menu';
    delete conv.data.solicitudConfirmar;
}

// ===== ESPERAR COTIZACIÓN (cliente en espera) =====
async function procesarEsperaCotizacion(jid, texto, conv, enviar) {
    await enviar(jid,
        `Tranqui, aún estoy esperando que los choferes me manden sus precios ⏳\n\n` +
        `Apenas tenga la mejor cotización te aviso, ¿dale? 😊`
    );
}

// ===== UTILIDADES =====

function parsearFecha(texto) {
    const t = texto.toLowerCase().trim();
    const hoy = new Date();
    const anioActual = hoy.getFullYear();

    // "hoy"
    if (t === 'hoy') {
        return formatFecha(hoy);
    }
    // "mañana"
    if (t === 'mañana' || t === 'manana') {
        const d = new Date(hoy);
        d.setDate(d.getDate() + 1);
        return formatFecha(d);
    }
    // "pasado mañana"
    if (t === 'pasado mañana' || t === 'pasado manana') {
        const d = new Date(hoy);
        d.setDate(d.getDate() + 2);
        return formatFecha(d);
    }

    // Días de la semana: "lunes", "el viernes", "este martes"
    const dias = {
        'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
        'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6, 'domingo': 0
    };
    for (const [dia, num] of Object.entries(dias)) {
        if (t.includes(dia)) {
            const d = new Date(hoy);
            const diaActual = d.getDay();
            let diff = num - diaActual;
            if (diff <= 0) diff += 7;
            d.setDate(d.getDate() + diff);
            return formatFecha(d);
        }
    }

    // Meses en español
    const meses = {
        'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3,
        'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7,
        'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11
    };

    // "15 de marzo", "15 de marzo de 2026", "el 15 de marzo", "marzo 15"
    const matchTexto = t.match(/(?:el\s+)?(\d{1,2})\s+de\s+([a-záéíóúñ]+)(?:\s+(?:de\s+|del\s+)?(\d{2,4}))?/);
    if (matchTexto) {
        const dia = parseInt(matchTexto[1]);
        const mesNombre = matchTexto[2];
        let anio = matchTexto[3] ? parseInt(matchTexto[3]) : anioActual;
        if (anio < 100) anio += 2000;
        const mes = meses[mesNombre];
        if (mes !== undefined && dia >= 1 && dia <= 31) {
            return formatFecha(new Date(anio, mes, dia));
        }
    }

    // "marzo 15", "marzo 15 2026"
    const matchMesDia = t.match(/([a-záéíóúñ]+)\s+(\d{1,2})(?:\s+(\d{2,4}))?/);
    if (matchMesDia) {
        const mesNombre = matchMesDia[1];
        const dia = parseInt(matchMesDia[2]);
        let anio = matchMesDia[3] ? parseInt(matchMesDia[3]) : anioActual;
        if (anio < 100) anio += 2000;
        const mes = meses[mesNombre];
        if (mes !== undefined && dia >= 1 && dia <= 31) {
            return formatFecha(new Date(anio, mes, dia));
        }
    }

    // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (con año)
    const matchFull = texto.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (matchFull) {
        const dia = parseInt(matchFull[1]);
        const mes = parseInt(matchFull[2]) - 1;
        let anio = parseInt(matchFull[3]);
        if (anio < 100) anio += 2000;
        if (dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) {
            return formatFecha(new Date(anio, mes, dia));
        }
    }

    // DD/MM o DD-MM (sin año → año actual)
    const matchSinAnio = texto.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
    if (matchSinAnio) {
        const dia = parseInt(matchSinAnio[1]);
        const mes = parseInt(matchSinAnio[2]) - 1;
        if (dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) {
            return formatFecha(new Date(anioActual, mes, dia));
        }
    }

    // Solo un número → interpretar como día del mes actual o siguiente
    const matchSoloDia = texto.match(/^(\d{1,2})$/);
    if (matchSoloDia) {
        const dia = parseInt(matchSoloDia[1]);
        if (dia >= 1 && dia <= 31) {
            const d = new Date(anioActual, hoy.getMonth(), dia);
            // Si ya pasó ese día este mes, pasar al mes siguiente
            if (d < hoy) {
                d.setMonth(d.getMonth() + 1);
            }
            return formatFecha(d);
        }
    }

    // No se pudo parsear → devolver el texto original
    return null;
}

function formatFecha(date) {
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    return `${dia}/${mes}/${anio}`;
}

/** Convierte DD/MM/YYYY → YYYY-MM-DD para almacenar en MySQL DATE */
function fechaParaDB(fechaStr) {
    if (!fechaStr) return null;
    const parts = fechaStr.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (parts) {
        return `${parts[3]}-${parts[2]}-${parts[1]}`;
    }
    return fechaStr; // fallback
}

async function registrarMensaje(telefono, contenido, direccion, contexto = null, solicitudId = null, sessionId = 'default') {
    try {
        // Asegurar que la dirección sea válida para el ENUM
        const dir = (direccion === 'entrante' || direccion === 'saliente') ? direccion : 'saliente';
        await pool.query(
              `INSERT INTO mensajes_log (session_id, telefono, direccion, contenido, tipo_mensaje, contexto, solicitud_id)
          VALUES (?, ?, ?, ?, 'text', ?, ?)`,
              [sessionId, telefono, dir, contenido, contexto, solicitudId]
        );
    } catch (err) {
        console.error('Error registrando mensaje:', err.message);
    }
}

/**
 * Dispatcher principal — enruta al paso correcto
 * @param {string} telefono - Número limpio (sin sufijo)
 * @param {string} texto - Mensaje del usuario
 * @param {string} remoteJid - JID original del remitente (puede ser @s.whatsapp.net o @lid)
 * @param {Function} enviar - Función (jid, text) => Promise
 */
async function procesarMensajeCompleto(telefono, texto, remoteJid, enviar, sessionId = 'default') {
    const textoLimpio = texto.trim();
    // Usar el remoteJid original para responder (soporta @lid y @s.whatsapp.net)
    const jid = remoteJid;

    // Obtener o crear estado
    const key = convKey(telefono, sessionId);

    if (!conversaciones[key]) {
        conversaciones[key] = { step: 'saludo', data: {}, lastActivity: Date.now() };
    }
    const conv = conversaciones[key];
    conv.lastActivity = Date.now();
    // Siempre mantener el teléfono real disponible
    conv.data.telefonoRegistro = telefono;

    // Reparador automático de LID -> Teléfono Real para choferes
    // Si remoteJid es un @lid pero logramos extraer el teléfono real, intentamos buscar si el chofer 
    // estaba guardado con el LID y lo actualizamos de una vez por su número real para futuros envíos correctos.
    if (remoteJid.includes('@lid') && telefono !== remoteJid.replace(/@lid$/, '')) {
        const telefonoLidOriginal = remoteJid.replace(/@lid$/, '');
        try {
            const [chLid] = await pool.query('SELECT id FROM choferes WHERE telefono_whatsapp = ?', [telefonoLidOriginal]);
            if (chLid.length > 0) {
                console.log(`🔧 Autocorrigiendo LID ${telefonoLidOriginal} -> ${telefono} para el chofer ID ${chLid[0].id}`);
                await pool.query('UPDATE choferes SET telefono_whatsapp = ? WHERE id = ?', [telefono, chLid[0].id]);
            }
        } catch (e) {
            console.error('Error en autocorrección de LID:', e.message);
        }
    }

    // Detectar saludos y comandos de reinicio
    const lower = textoLimpio.toLowerCase();
    const esSaludo = /^(hola|hi|hey|buenos?\s*d[ií]as?|buenas?\s*(tardes?|noches?)?|saludos?|qu[eé]\s*tal|qué\s*m[aá]s|quiubo|ey|epa|buenas)\b/i.test(textoLimpio)
        || lower === 'reiniciar' || lower === 'menu' || lower === 'menú'
        || lower === 'inicio' || lower === 'iniciar' || lower === 'empezar';
    if (esSaludo) {
        conversaciones[key] = { step: 'saludo', data: {}, lastActivity: Date.now() };
        const convReset = conversaciones[key];
        // Identificar usuario ANTES de saludar
        await identificarUsuario(telefono, convReset);
        await saludar(jid, convReset, enviar);
        return;
    }

    // --- NUEVA LÓGICA: IDENTIFICACIÓN DIRECTA Y COTIZACIÓN RÁPIDA ---
    await identificarUsuario(telefono, conv);

    // Si es chofer y no estamos en un flujo específico, intentar cotización rápida
    if (conv.data.tipo === 'chofer' && !['chofer_cambiar_estado', 'saludo', 'registrar_nombre'].includes(conv.step)) {
        const cotizacionProcesada = await intentarCotizacionRapida(jid, textoLimpio, conv, enviar);
        if (cotizacionProcesada) return;
    }

    try {
        // Pasos que se manejan aparte
        switch (conv.step) {
            case 'saludo':
                await saludar(jid, conv, enviar);
                break;
            case 'esperar_documento': // legacy → ya no se usa
            case 'registrar_nombre': // legacy → ya no se usa
            case 'no_registrado':
                await enviar(jid,
                    `Hola de nuevo 👋 Tu número aún no está registrado en nuestro sistema.\n\n` +
                    `Pide a un operador de *FALC Logística* que te registre desde el panel y luego escríbenos de nuevo 😊`
                );
                break;
            case 'cliente_menu':
                await menuCliente(jid, textoLimpio, conv, enviar);
                break;
            case 'pedir_origen':
                await procesarOrigen(jid, textoLimpio, conv, enviar);
                break;
            case 'pedir_destino':
                await procesarDestino(jid, textoLimpio, conv, enviar);
                break;
            case 'pedir_fecha':
                await procesarFecha(jid, textoLimpio, conv, enviar);
                break;
            case 'pedir_cantidad_camiones':
                await procesarCantidadCamiones(jid, textoLimpio, conv, enviar);
                break;
            case 'pedir_tipo_vehiculo':
                await procesarTipoVehiculo(jid, textoLimpio, conv, enviar);
                break;
            case 'pedir_vehiculo':
                await procesarCantidadCamiones(jid, textoLimpio, conv, enviar); // redirect legacy
                break;
            case 'confirmar_solicitud':
                await procesarConfirmacion(jid, textoLimpio, conv, enviar);
                break;
            case 'transporte_menu':
                await menuTransporte(jid, textoLimpio, conv, enviar);
                break;
            case 'transporte_responder':
                await procesarRespuestaTransporte(jid, textoLimpio, conv, enviar);
                break;
            case 'transporte_datos_camion':
                await procesarDatosCamionTransporte(jid, textoLimpio, conv, enviar);
                break;
            case 'chofer_menu':
                await menuChofer(jid, textoLimpio, conv, enviar);
                break;
            case 'chofer_cotizar':
                await procesarCotizacionChofer(jid, textoLimpio, conv, enviar);
                break;
            case 'chofer_cambiar_estado':
                await procesarCambioEstado(jid, textoLimpio, conv, enviar);
                break;
            case 'esperar_cotizacion':
                await procesarEsperaCotizacion(jid, textoLimpio, conv, enviar);
                break;
            case 'confirmar_viaje':
                await procesarConfirmacionViaje(jid, textoLimpio, conv, enviar);
                break;
            default:
                conversaciones[key] = { step: 'saludo', data: {}, lastActivity: Date.now() };
                await saludar(jid, conversaciones[key], enviar);
        }
    } catch (error) {
        console.error('✗ Error en bot Baileys:', error.message);
        await enviar(jid, 'Uy, algo se me complicó por acá 😅 ¿Me escribes *menú* para empezar de nuevo?');
    }
}

/**
 * Permite que otros servicios (cotizacionService) cambien el estado de conversación
 * de un usuario, por ejemplo para ponerlo en 'confirmar_viaje' al recibir una cotización.
 */
function setConversacionStep(telefono, step, extraData = {}, sessionId = 'default') {
    const key = convKey(telefono, sessionId);
    if (!conversaciones[key]) {
        conversaciones[key] = { step, data: { ...extraData }, lastActivity: Date.now() };
    } else {
        conversaciones[key].step = step;
        Object.assign(conversaciones[key].data, extraData);
        conversaciones[key].lastActivity = Date.now();
    }
    console.log(`📝 Conversación de ${telefono} [${sessionId}] actualizada a step='${step}'`);
}

module.exports = {
    procesarMensaje: procesarMensajeCompleto,
    setConversacionStep,
    pausarAgente,
    reanudarAgente,
    esAgentePausado,
};
