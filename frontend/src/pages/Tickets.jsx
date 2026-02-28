import React, { useState, useEffect } from 'react';
import api from '../api/client';

const ESTADOS = [
    { value: '', label: 'Todos', color: '#999' },
    { value: 'Pendiente de asignación', label: '🟡 Pendiente', color: '#f57f17' },
    { value: 'Asignado - Esperando respuesta', label: '🟠 Esperando respuesta', color: '#e65100' },
    { value: 'Aceptado - Pendiente datos camión', label: '🟢 Aceptado', color: '#2e7d32' },
    { value: 'En proceso de confirmación', label: '🟢 En proceso', color: '#1b5e20' },
    { value: 'Listo para confirmar al cliente', label: '🔵 Listo', color: '#1565c0' },
    { value: 'Confirmado al cliente', label: '✅ Confirmado', color: '#00695c' },
    { value: 'Rechazado', label: '❌ Rechazado', color: '#c62828' },
    { value: 'Cancelado', label: '⛔ Cancelado', color: '#424242' },
];

const estadoColor = (estado) => {
    const e = ESTADOS.find(s => s.value === estado);
    return e ? e.color : '#999';
};

export default function Tickets() {
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroEstado, setFiltroEstado] = useState('');
    const [clientes, setClientes] = useState([]);
    const [transportes, setTransportes] = useState([]);

    // Modal de detalle
    const [ticketDetalle, setTicketDetalle] = useState(null);
    const [asignaciones, setAsignaciones] = useState([]);
    const [modalDetalle, setModalDetalle] = useState(false);
    const [loadingDetalle, setLoadingDetalle] = useState(false);

    // Destino único desde config
    const [destinoUnico, setDestinoUnico] = useState('');

    // Modal de crear ticket
    const [modalCrear, setModalCrear] = useState(false);
    const [formTicket, setFormTicket] = useState({ cliente_id: '', origen: '', destino: '', cantidad_camiones: 1, fecha_requerida: '', observaciones: '' });

    // Modal de asignar transporte
    const [modalAsignar, setModalAsignar] = useState(false);
    const [asignacionesForm, setAsignacionesForm] = useState({}); // { transporte_id: cantidad }

    useEffect(() => {
        fetchTickets();
        fetchClientes();
        fetchTransportes();
        fetchConfig();
    }, [filtroEstado]);

    const fetchConfig = async () => {
        try {
            const { data } = await api.get('/configuracion');
            const dc = data.find(p => p.nombre_parametro === 'destino_unico');
            if (dc && dc.valor) setDestinoUnico(dc.valor);
        } catch (e) { console.error(e); }
    };

    const fetchTickets = async () => {
        try {
            const params = filtroEstado ? `?estado=${encodeURIComponent(filtroEstado)}` : '';
            const { data } = await api.get(`/tickets${params}`);
            setTickets(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchClientes = async () => {
        try { const { data } = await api.get('/clientes'); setClientes(data); } catch (e) { console.error(e); }
    };

    const fetchTransportes = async () => {
        try { const { data } = await api.get('/transportes'); setTransportes(data.filter(t => t.estado === 'Activo')); } catch (e) { console.error(e); }
    };

    const verDetalle = async (ticketId) => {
        setModalDetalle(true);
        setLoadingDetalle(true);
        try {
            const { data } = await api.get(`/tickets/${ticketId}`);
            setTicketDetalle(data);
            setAsignaciones(data.asignaciones || []);
        } catch (e) { alert('Error cargando detalle'); }
        finally { setLoadingDetalle(false); }
    };

    const crearTicket = async () => {
        try {
            const clienteSel = clientes.find(c => c.id == formTicket.cliente_id);
            const origen = formTicket.origen || clienteSel?.origen_default || '';
            const destino = destinoUnico || formTicket.destino;
            await api.post('/tickets', { ...formTicket, origen, destino });
            setModalCrear(false);
            setFormTicket({ cliente_id: '', origen: '', destino: '', cantidad_camiones: 1, fecha_requerida: '', observaciones: '' });
            fetchTickets();
        } catch (e) { alert('Error creando ticket: ' + (e.response?.data?.error || e.message)); }
    };

    const abrirAsignar = async () => {
        setAsignacionesForm({});
        // Recargar transportes con disponibilidad para la fecha del ticket
        if (ticketDetalle?.fecha_requerida) {
            try {
                const fecha = ticketDetalle.fecha_requerida.split('T')[0];
                const { data } = await api.get(`/transportes?fecha=${fecha}`);
                setTransportes(data.filter(t => t.estado === 'Activo'));
            } catch (e) { console.error(e); }
        }
        setModalAsignar(true);
    };

    const camionesYaAsignados = ticketDetalle?.camiones_asignados || 0;
    const camionesPorAsignar = (ticketDetalle?.cantidad_camiones || 0) - camionesYaAsignados;
    const totalNuevosAsignados = Object.values(asignacionesForm).reduce((s, v) => s + (v || 0), 0);

    const asignarTransportes = async () => {
        const items = Object.entries(asignacionesForm).filter(([, cant]) => cant > 0).map(([tid, cant]) => ({ transporte_id: parseInt(tid), cantidad_camiones: cant }));
        if (items.length === 0) { alert('Asigna al menos 1 camión a un transporte'); return; }
        if (totalNuevosAsignados > camionesPorAsignar) { alert(`Solo quedan ${camionesPorAsignar} camiones por asignar`); return; }
        try {
            await api.post('/asignaciones', { ticket_id: ticketDetalle.id, asignaciones: items });
            alert('Pedido enviado exitosamente');
            setModalAsignar(false);
            verDetalle(ticketDetalle.id);
            fetchTickets();
        } catch (e) { alert('Error asignando: ' + (e.response?.data?.error || e.message)); }
    };

    const responderAsignacion = async (asigId, estado) => {
        try {
            await api.put(`/asignaciones/${asigId}/responder`, { estado });
            verDetalle(ticketDetalle.id);
            fetchTickets();
        } catch (e) { alert('Error: ' + e.message); }
    };

    const registrarDatos = async (asigId) => {
        const placa = prompt('Placa del camión:');
        if (!placa) return;
        const conductor = prompt('Nombre del conductor:');
        if (!conductor) return;

        try {
            const { data } = await api.put(`/asignaciones/${asigId}/datos-camion`, { placa_camion: placa, conductor_nombre: conductor });
            alert(`Vehículo registrado (${data.vehiculos_registrados}/${data.vehiculos_requeridos}).`);
            verDetalle(ticketDetalle.id);
            fetchTickets();
        } catch (e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    };

    const notificarClienteVehiculo = async (vehiculoId) => {
        if (!confirm('¿Enviar datos de este vehículo al cliente por WhatsApp?')) return;
        try {
            await api.post(`/asignaciones/vehiculo/${vehiculoId}/notificar`);
            alert('Cliente notificado exitosamente');
            verDetalle(ticketDetalle.id);
        } catch (e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    };

    const confirmarAlCliente = async () => {
        if (!confirm('¿Confirmar envío al cliente?')) return;
        try {
            await api.post(`/tickets/${ticketDetalle.id}/confirmar`);
            alert('Ticket confirmado al cliente');
            verDetalle(ticketDetalle.id);
            fetchTickets();
        } catch (e) { alert('Error: ' + (e.response?.data?.error || e.message)); }
    };

    const onClienteChange = (clienteId) => {
        const c = clientes.find(cl => cl.id == clienteId);
        setFormTicket({ ...formTicket, cliente_id: clienteId, origen: c?.origen_default || '' });
    };

    if (loading) return <p style={{ padding: 20 }}>Cargando tickets...</p>;

    const inputStyle = { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' };
    const btnStyle = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13 });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1>Tickets de Transporte 📋</h1>
                <button onClick={() => setModalCrear(true)} style={btnStyle('#388e3c')}>+ Nuevo Ticket</button>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 15, flexWrap: 'wrap' }}>
                {ESTADOS.map(e => (
                    <button key={e.value} onClick={() => setFiltroEstado(e.value)}
                        style={{ padding: '6px 14px', borderRadius: 20, border: filtroEstado === e.value ? '2px solid #333' : '1px solid #ddd', background: filtroEstado === e.value ? '#eee' : '#fff', cursor: 'pointer', fontSize: 12, fontWeight: filtroEstado === e.value ? 'bold' : 'normal' }}>
                        {e.label}
                    </button>
                ))}
            </div>

            {/* Tabla */}
            <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                            <th style={{ padding: 12, textAlign: 'left' }}>#</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Cliente</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Origen</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Destino</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Camiones</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Fecha Requerida</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Estado</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickets.map(t => (
                            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: 12 }}>#{t.id}</td>
                                <td style={{ padding: 12 }}>{t.cliente_nombre}</td>
                                <td style={{ padding: 12 }}>{t.origen}</td>
                                <td style={{ padding: 12 }}>{t.destino || '-'}</td>
                                <td style={{ padding: 12 }}>
                                    <strong>{t.camiones_confirmados}/{t.cantidad_camiones}</strong>
                                </td>
                                <td style={{ padding: 12 }}>{t.fecha_requerida ? new Date(t.fecha_requerida).toLocaleDateString('es-CO') : '-'}</td>
                                <td style={{ padding: 12 }}>
                                    <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 'bold', color: '#fff', background: estadoColor(t.estado) }}>
                                        {t.estado}
                                    </span>
                                </td>
                                <td style={{ padding: 12 }}>
                                    <button onClick={() => verDetalle(t.id)} style={btnStyle('#1976d2')}>Ver Detalle</button>
                                </td>
                            </tr>
                        ))}
                        {tickets.length === 0 && <tr><td colSpan="8" style={{ padding: 20, textAlign: 'center', color: '#999' }}>No hay tickets</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Modal Crear Ticket */}
            {modalCrear && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: 30, borderRadius: 8, width: '90%', maxWidth: 500 }}>
                        <h2>Nuevo Ticket</h2>
                        <div style={{ display: 'grid', gap: 12, marginTop: 15 }}>
                            <div>
                                <label style={{ fontWeight: 'bold', fontSize: 13 }}>Cliente *</label>
                                <select style={inputStyle} value={formTicket.cliente_id} onChange={e => onClienteChange(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontWeight: 'bold', fontSize: 13 }}>Origen (Finca)</label>
                                    <input style={inputStyle} value={formTicket.origen} onChange={e => setFormTicket({ ...formTicket, origen: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 'bold', fontSize: 13 }}>Destino {destinoUnico && <span style={{ fontSize: 11, color: '#666' }}>(desde config)</span>}</label>
                                    <input style={{ ...inputStyle, background: destinoUnico ? '#f0f0f0' : '#fff' }} value={destinoUnico || formTicket.destino} disabled={!!destinoUnico} onChange={e => setFormTicket({ ...formTicket, destino: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontWeight: 'bold', fontSize: 13 }}>Cantidad Camiones *</label>
                                    <input type="number" min="1" style={inputStyle} value={formTicket.cantidad_camiones} onChange={e => setFormTicket({ ...formTicket, cantidad_camiones: parseInt(e.target.value) || 1 })} />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 'bold', fontSize: 13 }}>Fecha Requerida *</label>
                                    <input type="datetime-local" style={inputStyle} value={formTicket.fecha_requerida} onChange={e => setFormTicket({ ...formTicket, fecha_requerida: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label style={{ fontWeight: 'bold', fontSize: 13 }}>Observaciones</label>
                                <textarea style={{ ...inputStyle, minHeight: 60 }} value={formTicket.observaciones} onChange={e => setFormTicket({ ...formTicket, observaciones: e.target.value })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button onClick={() => setModalCrear(false)} style={btnStyle('#999')}>Cancelar</button>
                            <button onClick={crearTicket} style={btnStyle('#388e3c')}>Crear Ticket</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Detalle Ticket */}
            {modalDetalle && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: 30, borderRadius: 8, width: '95%', maxWidth: 950, maxHeight: '90vh', overflowY: 'auto' }}>
                        {loadingDetalle ? <p>Cargando...</p> : ticketDetalle && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                                    <h2>Ticket #{ticketDetalle.id}</h2>
                                    <button onClick={() => setModalDetalle(false)} style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
                                </div>

                                {/* Info del ticket */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20, padding: 15, background: '#f8f9fa', borderRadius: 8 }}>
                                    <div><strong>Cliente:</strong> {ticketDetalle.cliente_nombre}</div>
                                    <div><strong>Origen:</strong> {ticketDetalle.origen}</div>
                                    <div><strong>Destino:</strong> {ticketDetalle.destino || '-'}</div>
                                    <div><strong>Camiones:</strong> <span style={{ fontSize: 18, fontWeight: 'bold' }}>{ticketDetalle.camiones_confirmados}/{ticketDetalle.cantidad_camiones}</span></div>
                                    <div><strong>Fecha:</strong> {new Date(ticketDetalle.fecha_requerida).toLocaleString('es-CO')}</div>
                                    <div><strong>Estado:</strong> <span style={{ color: estadoColor(ticketDetalle.estado), fontWeight: 'bold' }}>{ticketDetalle.estado}</span></div>
                                    {ticketDetalle.observaciones && <div style={{ gridColumn: '1/-1' }}><strong>Obs:</strong> {ticketDetalle.observaciones}</div>}
                                    {ticketDetalle.operador_nombre && <div><strong>Creado por:</strong> {ticketDetalle.operador_nombre}</div>}
                                </div>

                                {/* Barra de progreso */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ background: '#e0e0e0', borderRadius: 10, height: 20, overflow: 'hidden' }}>
                                        <div style={{ background: ticketDetalle.camiones_confirmados >= ticketDetalle.cantidad_camiones ? '#388e3c' : '#1976d2', height: '100%', width: `${Math.min((ticketDetalle.camiones_confirmados / ticketDetalle.cantidad_camiones) * 100, 100)}%`, borderRadius: 10, transition: 'width 0.3s' }} />
                                    </div>
                                    <p style={{ textAlign: 'center', fontSize: 13, margin: '4px 0' }}>{ticketDetalle.camiones_confirmados} de {ticketDetalle.cantidad_camiones} camiones confirmados</p>
                                </div>

                                {/* Botones de acción */}
                                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                                    {['Pendiente de asignación', 'Asignado - Esperando respuesta', 'Aceptado - Pendiente datos camión', 'En proceso de confirmación'].includes(ticketDetalle.estado) && (
                                        <button onClick={abrirAsignar} style={btnStyle('#e65100')}>Reenviar Pedido a Transporte</button>
                                    )}
                                    {ticketDetalle.estado === 'Listo para confirmar al cliente' && (
                                        <button onClick={confirmarAlCliente} style={btnStyle('#1565c0')}>✅ Confirmar Envío al Cliente</button>
                                    )}
                                </div>

                                {/* Tabla de asignaciones */}
                                <h3>Asignaciones</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                                            <th style={{ padding: 8, textAlign: 'left' }}>Transporte</th>
                                            <th style={{ padding: 8, textAlign: 'center' }}>Camiones</th>
                                            <th style={{ padding: 8, textAlign: 'left' }}>Estado</th>
                                            <th style={{ padding: 8, textAlign: 'left' }}>Fecha Envío</th>
                                            <th style={{ padding: 8, textAlign: 'left' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {asignaciones.map(a => {
                                            const vehiculos = a.vehiculos || [];
                                            const vehiculosFaltan = (a.cantidad_camiones || 1) - vehiculos.length;
                                            return (
                                            <React.Fragment key={a.id}>
                                                <tr style={{ borderBottom: '1px solid #eee', background: '#fafafa' }}>
                                                    <td style={{ padding: 8 }}><strong>{a.transporte_nombre}</strong></td>
                                                    <td style={{ padding: 8, textAlign: 'center', fontWeight: 'bold' }}>
                                                        {vehiculos.length}/{a.cantidad_camiones || 1}
                                                    </td>
                                                    <td style={{ padding: 8 }}>
                                                        <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 'bold', color: '#fff', background: a.estado === 'Aceptado' ? '#388e3c' : a.estado === 'Rechazado' ? '#c62828' : '#f57f17' }}>
                                                            {a.estado}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: 8, fontSize: 11 }}>{a.fecha_envio ? new Date(a.fecha_envio).toLocaleString('es-CO') : '-'}</td>
                                                    <td style={{ padding: 8, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                        {a.estado === 'Enviado' && (
                                                            <>
                                                                <button onClick={() => responderAsignacion(a.id, 'Aceptado')} style={btnStyle('#388e3c')}>✅</button>
                                                                <button onClick={() => responderAsignacion(a.id, 'Rechazado')} style={btnStyle('#c62828')}>❌</button>
                                                            </>
                                                        )}
                                                        {a.estado === 'Aceptado' && vehiculosFaltan > 0 && (
                                                            <button onClick={() => registrarDatos(a.id)} style={btnStyle('#1976d2')}>+ Registrar Vehículo ({vehiculosFaltan} pendiente{vehiculosFaltan > 1 ? 's' : ''})</button>
                                                        )}
                                                    </td>
                                                </tr>
                                                {/* Sub-filas de vehículos */}
                                                {vehiculos.map(v => (
                                                    <tr key={`v-${v.id}`} style={{ borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
                                                        <td style={{ padding: '4px 8px 4px 24px', fontSize: 12, color: '#555' }}>
                                                            🚛 <strong>{v.placa}</strong>
                                                        </td>
                                                        <td style={{ padding: '4px 8px', fontSize: 12, color: '#555', textAlign: 'center' }}>
                                                            👤 {v.conductor_nombre}
                                                        </td>
                                                        <td colSpan="2" style={{ padding: '4px 8px', fontSize: 11, color: '#888' }}>
                                                            {v.fecha_registro ? new Date(v.fecha_registro).toLocaleString('es-CO') : ''}
                                                        </td>
                                                        <td style={{ padding: '4px 8px' }}>
                                                            {v.notificado_cliente ? (
                                                                <span style={{ fontSize: 11, color: '#388e3c', fontWeight: 'bold' }}>✅ Notificado</span>
                                                            ) : (
                                                                <button onClick={() => notificarClienteVehiculo(v.id)} style={{ ...btnStyle('#1565c0'), fontSize: 11, padding: '3px 8px' }}>
                                                                    📲 Notificar Cliente
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                            );
                                        })}
                                        {asignaciones.length === 0 && <tr><td colSpan="5" style={{ padding: 15, textAlign: 'center', color: '#999' }}>Sin asignaciones aún</td></tr>}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Modal Asignar Transporte */}
            {modalAsignar && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
                    <div style={{ background: '#fff', padding: 30, borderRadius: 8, width: '90%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto' }}>
                        <h2>Asignar Camiones a Transportes</h2>
                        <p style={{ fontSize: 13, color: '#666', margin: '4px 0 12px' }}>
                            Ticket #{ticketDetalle?.id} — <strong>{ticketDetalle?.cantidad_camiones}</strong> camiones totales,
                            <strong> {camionesYaAsignados}</strong> ya asignados,
                            <span style={{ color: '#e65100', fontWeight: 'bold' }}> {camionesPorAsignar}</span> por asignar
                        </p>

                        {camionesPorAsignar <= 0 ? (
                            <p style={{ color: '#c62828', fontWeight: 'bold' }}>Todos los camiones ya fueron asignados.</p>
                        ) : (
                            <>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                                            <th style={{ padding: 8, textAlign: 'left' }}>Empresa</th>
                                            <th style={{ padding: 8, textAlign: 'center' }}>Disponibles</th>
                                            <th style={{ padding: 8, textAlign: 'center' }}>WhatsApp</th>
                                            <th style={{ padding: 8, textAlign: 'center', width: 100 }}>Asignar</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {transportes.map(t => {
                                            const disponibles = (t.cantidad_vehiculos || 0) - (t.camiones_en_uso || 0);
                                            return (
                                            <tr key={t.id} style={{ borderBottom: '1px solid #eee', opacity: disponibles <= 0 ? 0.5 : 1 }}>
                                                <td style={{ padding: 8 }}><strong>{t.nombre}</strong></td>
                                                <td style={{ padding: 8, textAlign: 'center' }}>
                                                    <span title={`Total: ${t.cantidad_vehiculos || 0} | En uso: ${t.camiones_en_uso || 0}`}>
                                                        <strong style={{ color: disponibles <= 0 ? '#c62828' : '#388e3c' }}>{disponibles}</strong>
                                                        <span style={{ fontSize: 11, color: '#999' }}> / {t.cantidad_vehiculos || 0}</span>
                                                    </span>
                                                </td>
                                                <td style={{ padding: 8, textAlign: 'center', fontSize: 12 }}>{t.telefono_whatsapp ? '✅' : '❌'}</td>
                                                <td style={{ padding: 8, textAlign: 'center' }}>
                                                    <input type="number" min="0" max={Math.min(camionesPorAsignar, Math.max(disponibles, 0))}
                                                        style={{ width: 60, padding: 4, textAlign: 'center', border: '1px solid #ddd', borderRadius: 4, fontSize: 14 }}
                                                        value={asignacionesForm[t.id] || ''}
                                                        onChange={e => setAsignacionesForm({ ...asignacionesForm, [t.id]: parseInt(e.target.value) || 0 })}
                                                        placeholder="0"
                                                        disabled={disponibles <= 0} />
                                                </td>
                                            </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                <div style={{ marginTop: 12, padding: 10, background: totalNuevosAsignados > camionesPorAsignar ? '#fbe9e7' : '#e8f5e9', borderRadius: 6, textAlign: 'center', fontSize: 14 }}>
                                    Asignando: <strong>{totalNuevosAsignados}</strong> / {camionesPorAsignar} disponibles
                                    {totalNuevosAsignados > camionesPorAsignar && <span style={{ color: '#c62828', marginLeft: 8 }}>⚠️ Excede el límite</span>}
                                </div>
                            </>
                        )}

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button onClick={() => setModalAsignar(false)} style={btnStyle('#999')}>Cancelar</button>
                            {camionesPorAsignar > 0 && (
                                <button onClick={asignarTransportes}
                                    disabled={totalNuevosAsignados === 0 || totalNuevosAsignados > camionesPorAsignar}
                                    style={{ ...btnStyle('#e65100'), opacity: (totalNuevosAsignados === 0 || totalNuevosAsignados > camionesPorAsignar) ? 0.5 : 1 }}>
                                    🚛 Enviar Pedido ({totalNuevosAsignados} camiones)
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
