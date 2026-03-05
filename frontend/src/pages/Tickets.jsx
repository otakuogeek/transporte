import React, { useState, useEffect } from 'react';
import api from '../api/client';

const ESTADOS = [
    { value: '', label: 'Todos', color: '#999' },
    { value: 'Pendiente de asignación', label: 'Pendiente', color: '#f57f17' },
    { value: 'Asignado - Esperando respuesta', label: 'Esperando respuesta', color: '#e65100' },
    { value: 'Aceptado - Pendiente datos camión', label: 'Aceptado', color: '#2e7d32' },
    { value: 'En proceso de confirmación', label: 'En proceso', color: '#1b5e20' },
    { value: 'Listo para confirmar al cliente', label: 'Listo', color: '#1565c0' },
    { value: 'Confirmado al cliente', label: 'Confirmado', color: '#00695c' },
    { value: 'Rechazado', label: 'Rechazado', color: '#c62828' },
    { value: 'Cancelado', label: 'Cancelado', color: '#424242' },
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

    const [ticketDetalle, setTicketDetalle] = useState(null);
    const [asignaciones, setAsignaciones] = useState([]);
    const [modalDetalle, setModalDetalle] = useState(false);
    const [loadingDetalle, setLoadingDetalle] = useState(false);

    const [destinoUnico, setDestinoUnico] = useState('');

    const [tiposDisponibles, setTiposDisponibles] = useState([]);
    const [tipoBusqueda, setTipoBusqueda] = useState('');
    const [tipoSeleccionado, setTipoSeleccionado] = useState(null);
    const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

    const [modalCrear, setModalCrear] = useState(false);
    const [formTicket, setFormTicket] = useState({ cliente_id: '', origen: '', destino: '', cantidad_camiones: 1, tipo_vehiculo_id: null, fecha_requerida: '', observaciones: '' });

    const [modalAsignar, setModalAsignar] = useState(false);
    const [asignacionesForm, setAsignacionesForm] = useState({});
    const [comisionModo, setComisionModo] = useState({});
    const [filtroTipoAsignar, setFiltroTipoAsignar] = useState(null);

    useEffect(() => {
        fetchTickets();
        fetchClientes();
        fetchTransportes();
        fetchConfig();
        fetchTiposDisponibles();
    }, [filtroEstado]);

    useEffect(() => {
        const handler = () => fetchTickets();
        window.addEventListener('nuevo-ticket', handler);
        return () => window.removeEventListener('nuevo-ticket', handler);
    }, []);

    const fetchTiposDisponibles = async () => {
        try {
            const { data } = await api.get('/tipos-vehiculos/con-transportes');
            setTiposDisponibles(data);
        } catch (e) { console.error('Error cargando tipos disponibles:', e); }
    };

    const sugerenciasFiltradas = tipoBusqueda.trim().length > 0
        ? tiposDisponibles.filter(t => t.nombre.toLowerCase().includes(tipoBusqueda.toLowerCase()))
        : tiposDisponibles;

    const seleccionarTipo = (tipo) => {
        setTipoSeleccionado(tipo);
        setFormTicket(f => ({ ...f, tipo_vehiculo_id: tipo.id }));
        setTipoBusqueda('');
        setMostrarSugerencias(false);
    };

    const renderItemTipo = (t) => (
        <button type="button" key={t.id} className="list-group-item list-group-item-action px-3 py-2"
            onClick={() => seleccionarTipo(t)}>
            <div className="d-flex justify-content-between align-items-center">
                <span className="fw-bold small">🚛 {t.nombre}</span>
                <span className="text-muted small ms-2" style={{ whiteSpace: 'nowrap' }}>{t.capacidad_toneladas}tn · {t.total_vehiculos} veh.</span>
            </div>
            {t.transportes && t.transportes.length > 0 && (
                <div className="d-flex flex-wrap gap-1 mt-1">
                    {t.transportes.map(tr => (
                        <span key={tr.id} className="badge bg-success-subtle text-success" style={{ fontSize: 10 }}>
                            {tr.nombre} ({tr.cantidad})
                        </span>
                    ))}
                </div>
            )}
        </button>
    );

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
            setFormTicket({ cliente_id: '', origen: '', destino: '', cantidad_camiones: 1, tipo_vehiculo_id: null, fecha_requerida: '', observaciones: '' });
            setTipoSeleccionado(null);
            setTipoBusqueda('');
            fetchTickets();
        } catch (e) { alert('Error creando ticket: ' + (e.response?.data?.error || e.message)); }
    };

    const abrirAsignar = async () => {
        setAsignacionesForm({});
        if (ticketDetalle?.tipo_vehiculo_id) {
            const tipoDelTicket = tiposDisponibles.find(t => t.id === ticketDetalle.tipo_vehiculo_id);
            setFiltroTipoAsignar(tipoDelTicket || null);
        } else {
            setFiltroTipoAsignar(null);
        }
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
    const totalNuevosAsignados = Object.values(asignacionesForm).reduce((s, v) => s + (parseInt(v?.cantidad) || 0), 0);

    const asignarTransportes = async () => {
        const items = Object.entries(asignacionesForm)
            .filter(([, v]) => (parseInt(v?.cantidad) || 0) > 0)
            .map(([tid, v]) => ({
                transporte_id: parseInt(tid),
                cantidad_camiones: parseInt(v.cantidad) || 1,
                precio: v.precio ? parseFloat(v.precio) : null,
                comision: v.comision ? parseFloat(v.comision) : null,
                comision_porcentaje: v.comision_porcentaje ? parseFloat(v.comision_porcentaje) : null
            }));
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

    if (loading) return <p className="p-4">Cargando tickets...</p>;

    return (
        <div>
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 className="h4 fw-semibold mb-0">Tickets de Transporte</h1>
                <button className="btn btn-falc btn-sm" onClick={() => setModalCrear(true)}>Nuevo Ticket</button>
            </div>

            {/* Filtros */}
            <div className="d-flex flex-wrap gap-1 mb-3">
                {ESTADOS.map(e => (
                    <button key={e.value} onClick={() => setFiltroEstado(e.value)}
                        className={`btn btn-sm rounded-pill ${filtroEstado === e.value ? 'btn-dark' : 'btn-outline-secondary'}`}
                        style={{ fontSize: 12 }}>
                        {e.label}
                    </button>
                ))}
            </div>

            {/* Lista de tickets como cards */}
            {tickets.length === 0 ? (
                <div className="card shadow-sm">
                    <div className="card-body text-center text-muted py-5">No hay tickets</div>
                </div>
            ) : (
                <div className="row g-2">
                    {tickets.map(t => {
                        const progreso = t.cantidad_camiones > 0 ? Math.round((t.camiones_confirmados / t.cantidad_camiones) * 100) : 0;
                        return (
                        <div className="col-12 col-md-6 col-xl-4" key={t.id}>
                            <div className="card shadow-sm h-100 border-start border-4" style={{ borderColor: `${estadoColor(t.estado)} !important`, cursor: 'pointer' }} onClick={() => verDetalle(t.id)}>
                                <div className="card-body p-3">
                                    {/* Top row: ID + Estado */}
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <span className="fw-bold text-dark">#{t.id}</span>
                                        <span className="badge rounded-pill text-white" style={{ background: estadoColor(t.estado), fontSize: 10 }}>
                                            {t.estado}
                                        </span>
                                    </div>

                                    {/* Cliente */}
                                    <div className="fw-semibold mb-2" style={{ fontSize: 15 }}>{t.cliente_nombre}</div>

                                    {/* Ruta */}
                                    <div className="d-flex align-items-center gap-1 mb-2 small text-muted">
                                        <span className="text-truncate">{t.origen}</span>
                                        <span className="mx-1">→</span>
                                        <span className="text-truncate">{t.destino || '-'}</span>
                                    </div>

                                    {/* Row: Tipo + Fecha */}
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        {t.tipo_vehiculo_nombre
                                            ? <span className="badge bg-primary-subtle text-primary" style={{ fontSize: 10 }}>{t.tipo_vehiculo_nombre}</span>
                                            : <span className="text-muted small">—</span>}
                                        <small className="text-muted">
                                            {t.fecha_requerida ? new Date(t.fecha_requerida).toLocaleDateString('es-CO') : '-'}
                                        </small>
                                    </div>

                                    {/* Progreso camiones */}
                                    <div>
                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                            <small className="text-muted">Camiones</small>
                                            <small className="fw-bold">{t.camiones_confirmados}/{t.cantidad_camiones}</small>
                                        </div>
                                        <div className="progress" style={{ height: 6 }}>
                                            <div className="progress-bar" style={{ width: `${progreso}%`, background: progreso >= 100 ? '#198754' : '#0d6efd' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            )}

            {/* ============ Modal Crear Ticket ============ */}
            {modalCrear && (
                <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Nuevo Ticket</h5>
                                <button type="button" className="btn-close" onClick={() => { setModalCrear(false); setTipoSeleccionado(null); setTipoBusqueda(''); }} />
                            </div>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">Cliente *</label>
                                    <select className="form-select" value={formTicket.cliente_id} onChange={e => onClienteChange(e.target.value)}>
                                        <option value="">Seleccionar...</option>
                                        {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                    </select>
                                </div>
                                <div className="row g-3 mb-3">
                                    <div className="col-6">
                                        <label className="form-label fw-semibold small">Origen (Finca)</label>
                                        <input className="form-control" value={formTicket.origen} onChange={e => setFormTicket({ ...formTicket, origen: e.target.value })} />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label fw-semibold small">Destino {destinoUnico && <span className="text-muted" style={{ fontSize: 11 }}>(config)</span>}</label>
                                        <input className={`form-control ${destinoUnico ? 'bg-light' : ''}`} value={destinoUnico || formTicket.destino} disabled={!!destinoUnico} onChange={e => setFormTicket({ ...formTicket, destino: e.target.value })} />
                                    </div>
                                </div>
                                <div className="row g-3 mb-3">
                                    <div className="col-6">
                                        <label className="form-label fw-semibold small">Cantidad Camiones *</label>
                                        <input type="number" min="1" className="form-control" value={formTicket.cantidad_camiones} onChange={e => setFormTicket({ ...formTicket, cantidad_camiones: parseInt(e.target.value) || 1 })} />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label fw-semibold small">Fecha Requerida *</label>
                                        <input type="datetime-local" className="form-control" value={formTicket.fecha_requerida} onChange={e => setFormTicket({ ...formTicket, fecha_requerida: e.target.value })} />
                                    </div>
                                </div>
                                {/* Tipo de vehículo autocomplete */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">Tipo de Vehículo <span className="fw-normal text-muted" style={{ fontSize: 11 }}>(opcional)</span></label>
                                    {tipoSeleccionado ? (
                                        <div className="d-flex align-items-center gap-2 p-2 rounded border" style={{ background: '#e3f2fd', borderColor: '#90caf9' }}>
                                            <span className="flex-grow-1 small">🚛 <strong>{tipoSeleccionado.nombre}</strong>{tipoSeleccionado.capacidad_toneladas ? ` · ${tipoSeleccionado.capacidad_toneladas}tn` : ''}</span>
                                            {tipoSeleccionado.cantidad_empresas > 0 && <span className="text-muted" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>{tipoSeleccionado.cantidad_empresas} emp.</span>}
                                            <button type="button" className="btn-close" style={{ fontSize: 10 }} onClick={() => { setTipoSeleccionado(null); setTipoBusqueda(''); setFormTicket(f => ({ ...f, tipo_vehiculo_id: null })); }} />
                                        </div>
                                    ) : (
                                        <div className="position-relative" onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setMostrarSugerencias(false); }}>
                                            <input className="form-control" value={tipoBusqueda}
                                                onChange={e => { setTipoBusqueda(e.target.value); setMostrarSugerencias(true); }}
                                                onFocus={() => setMostrarSugerencias(true)}
                                                placeholder="Escribí el tipo (ej: semi, acoplado...)"
                                                autoComplete="off" />
                                            {mostrarSugerencias && (
                                                <div className="list-group position-absolute w-100 shadow-sm" style={{ zIndex: 20, maxHeight: 260, overflowY: 'auto', top: '100%' }}>
                                                    {tiposDisponibles.length === 0 ? (
                                                        <div className="list-group-item text-center text-muted small py-3">
                                                            Ningún transporte activo tiene vehículos registrados aún
                                                        </div>
                                                    ) : sugerenciasFiltradas.length === 0 ? (
                                                        <>
                                                            <div className="list-group-item text-warning small py-2" style={{ background: '#fff8f5' }}>
                                                                ⚠️ No se encontró "{tipoBusqueda}". Seleccioná de la lista:
                                                            </div>
                                                            {tiposDisponibles.map(t => renderItemTipo(t))}
                                                        </>
                                                    ) : (
                                                        sugerenciasFiltradas.map(t => renderItemTipo(t))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">Observaciones</label>
                                    <textarea className="form-control" rows="2" value={formTicket.observaciones} onChange={e => setFormTicket({ ...formTicket, observaciones: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => { setModalCrear(false); setTipoSeleccionado(null); setTipoBusqueda(''); }}>Cancelar</button>
                                <button className="btn btn-success btn-sm" onClick={crearTicket}>Crear Ticket</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Modal Detalle Ticket ============ */}
            {modalDetalle && (
                <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-xl">
                        <div className="modal-content" style={{ maxHeight: '92dvh', overflowY: 'auto' }}>
                            {loadingDetalle ? <div className="modal-body"><p>Cargando...</p></div> : ticketDetalle && (
                                <>
                                    <div className="modal-header">
                                        <h5 className="modal-title">Ticket #{ticketDetalle.id}</h5>
                                        <button type="button" className="btn-close" onClick={() => setModalDetalle(false)} />
                                    </div>
                                    <div className="modal-body">
                                        {/* Info del ticket */}
                                        <div className="row g-2 mb-3 p-3 bg-light rounded small">
                                            <div className="col-6 col-md-4"><strong>Cliente:</strong> {ticketDetalle.cliente_nombre}</div>
                                            <div className="col-6 col-md-4"><strong>Origen:</strong> {ticketDetalle.origen}</div>
                                            <div className="col-6 col-md-4"><strong>Destino:</strong> {ticketDetalle.destino || '-'}</div>
                                            <div className="col-6 col-md-4"><strong>Camiones:</strong> <span className="fs-5 fw-bold">{ticketDetalle.camiones_confirmados}/{ticketDetalle.cantidad_camiones}</span></div>
                                            <div className="col-6 col-md-4"><strong>Fecha:</strong> {new Date(ticketDetalle.fecha_requerida).toLocaleString('es-CO')}</div>
                                            <div className="col-6 col-md-4"><strong>Estado:</strong> <span className="fw-bold" style={{ color: estadoColor(ticketDetalle.estado) }}>{ticketDetalle.estado}</span></div>
                                            <div className="col-12 col-md-4">
                                                <strong>Tipo:</strong>{' '}
                                                {ticketDetalle.tipo_vehiculo_nombre
                                                    ? <span className="badge bg-primary-subtle text-primary" style={{ fontSize: 12 }}>🚛 {ticketDetalle.tipo_vehiculo_nombre}{ticketDetalle.tipo_vehiculo_capacidad ? ` · ${ticketDetalle.tipo_vehiculo_capacidad}tn` : ''}</span>
                                                    : <span className="text-muted" style={{ fontSize: 12 }}>No especificado</span>}
                                            </div>
                                            {ticketDetalle.observaciones && <div className="col-12"><strong>Obs:</strong> {ticketDetalle.observaciones}</div>}
                                            {ticketDetalle.operador_nombre && <div className="col-12 col-md-4"><strong>Creado por:</strong> {ticketDetalle.operador_nombre}</div>}
                                        </div>

                                        {/* Barra progreso */}
                                        <div className="mb-3">
                                            <div className="progress" style={{ height: 20 }}>
                                                <div className="progress-bar" role="progressbar"
                                                    style={{ width: `${Math.min((ticketDetalle.camiones_confirmados / ticketDetalle.cantidad_camiones) * 100, 100)}%`, background: ticketDetalle.camiones_confirmados >= ticketDetalle.cantidad_camiones ? '#388e3c' : '#1976d2' }}>
                                                </div>
                                            </div>
                                            <p className="text-center small text-muted mt-1 mb-0">{ticketDetalle.camiones_confirmados} de {ticketDetalle.cantidad_camiones} camiones confirmados</p>
                                        </div>

                                        {/* Acciones */}
                                        <div className="d-flex flex-wrap gap-2 mb-3">
                                            {['Pendiente de asignación', 'Asignado - Esperando respuesta', 'Aceptado - Pendiente datos camión', 'En proceso de confirmación'].includes(ticketDetalle.estado) && (
                                                <button className="btn btn-warning btn-sm text-white" onClick={abrirAsignar}>Reenviar Pedido a Transporte</button>
                                            )}
                                            {ticketDetalle.estado === 'Listo para confirmar al cliente' && (
                                                <button className="btn btn-primary btn-sm" onClick={confirmarAlCliente}>✅ Confirmar Envío al Cliente</button>
                                            )}
                                        </div>

                                        {/* Tabla de asignaciones */}
                                        <h6 className="fw-bold">Asignaciones</h6>
                                        <div className="table-responsive">
                                            <table className="table table-sm table-hover align-middle small mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Transporte</th>
                                                        <th className="text-center">Camiones</th>
                                                        <th className="text-end">Precio</th>
                                                        <th className="text-end">Comisión</th>
                                                        <th className="text-end">Cobro neto</th>
                                                        <th>Estado</th>
                                                        <th>Fecha</th>
                                                        <th>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {asignaciones.map(a => {
                                                        const vehiculos = a.vehiculos || [];
                                                        const vehiculosFaltan = (a.cantidad_camiones || 1) - vehiculos.length;
                                                        return (
                                                        <React.Fragment key={a.id}>
                                                            <tr className="table-light">
                                                                <td className="fw-bold">{a.transporte_nombre}</td>
                                                                <td className="text-center fw-bold">{vehiculos.length}/{a.cantidad_camiones || 1}</td>
                                                                <td className="text-end fw-bold" style={{ color: a.precio ? '#1976d2' : '#bbb' }}>
                                                                    {a.precio ? `$${parseFloat(a.precio).toLocaleString('es-AR')}` : '—'}
                                                                </td>
                                                                <td className="text-end" style={{ fontSize: 12, color: a.comision ? '#e65100' : '#bbb' }}>
                                                                    {a.comision
                                                                        ? <span>${parseFloat(a.comision).toLocaleString('es-AR')}{a.comision_porcentaje ? <span className="text-muted ms-1" style={{ fontSize: 10 }}>({parseFloat(a.comision_porcentaje).toFixed(1)}%)</span> : ''}</span>
                                                                        : '—'}
                                                                </td>
                                                                <td className="text-end fw-bold">
                                                                    {a.precio
                                                                        ? <span style={{ color: '#388e3c' }}>${(parseFloat(a.precio) - (parseFloat(a.comision) || 0)).toLocaleString('es-AR')}</span>
                                                                        : <span className="text-muted">—</span>}
                                                                </td>
                                                                <td>
                                                                    <span className="badge rounded-pill text-white" style={{ background: a.estado === 'Aceptado' ? '#388e3c' : a.estado === 'Rechazado' ? '#c62828' : '#f57f17', fontSize: 11 }}>
                                                                        {a.estado}
                                                                    </span>
                                                                </td>
                                                                <td style={{ fontSize: 11 }}>{a.fecha_envio ? new Date(a.fecha_envio).toLocaleString('es-CO') : '-'}</td>
                                                                <td>
                                                                    <div className="d-flex flex-wrap gap-1">
                                                                        {a.estado === 'Enviado' && (
                                                                            <>
                                                                                <button className="btn btn-success btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => responderAsignacion(a.id, 'Aceptado')}>✅</button>
                                                                                <button className="btn btn-danger btn-sm" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => responderAsignacion(a.id, 'Rechazado')}>❌</button>
                                                                            </>
                                                                        )}
                                                                        {a.estado === 'Aceptado' && vehiculosFaltan > 0 && (
                                                                            <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => registrarDatos(a.id)}>+ Vehículo ({vehiculosFaltan})</button>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {vehiculos.map(v => (
                                                                <tr key={`v-${v.id}`}>
                                                                    <td className="ps-4 text-muted small">🚛 <strong>{v.placa}</strong></td>
                                                                    <td className="text-center text-muted small">👤 {v.conductor_nombre}</td>
                                                                    <td colSpan="5" className="text-muted" style={{ fontSize: 11 }}>
                                                                        {v.fecha_registro ? new Date(v.fecha_registro).toLocaleString('es-CO') : ''}
                                                                    </td>
                                                                    <td>
                                                                        {v.notificado_cliente ? (
                                                                            <span className="text-success fw-bold" style={{ fontSize: 11 }}>✅ Notificado</span>
                                                                        ) : (
                                                                            <button className="btn btn-outline-primary btn-sm" style={{ fontSize: 11 }} onClick={() => notificarClienteVehiculo(v.id)}>📲 Notificar</button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </React.Fragment>
                                                        );
                                                    })}
                                                    {asignaciones.length === 0 && <tr><td colSpan="8" className="text-center text-muted py-3">Sin asignaciones aún</td></tr>}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ============ Modal Asignar Transporte ============ */}
            {modalAsignar && (() => {
                const idsConTipo = filtroTipoAsignar
                    ? new Set(filtroTipoAsignar.transportes.map(tr => tr.id))
                    : null;
                const transportesFiltrados = filtroTipoAsignar
                    ? transportes.filter(t => idsConTipo.has(t.id))
                    : transportes;

                return (
                <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,.5)', zIndex: 1100 }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content" style={{ maxHeight: '90dvh', overflowY: 'auto' }}>
                            <div className="modal-header">
                                <div>
                                    <h5 className="modal-title mb-1">Asignar Camiones a Transportes</h5>
                                    <p className="mb-0 text-muted small">
                                        Ticket #{ticketDetalle?.id} — <strong>{ticketDetalle?.cantidad_camiones}</strong> totales,
                                        <strong> {camionesYaAsignados}</strong> asignados,
                                        <span className="text-warning fw-bold"> {camionesPorAsignar}</span> por asignar
                                    </p>
                                </div>
                                <button type="button" className="btn-close" onClick={() => setModalAsignar(false)} />
                            </div>
                            <div className="modal-body">
                                {/* Filtro tipo vehículo */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">🚛 Filtrar por tipo de vehículo</label>
                                    <div className="d-flex flex-wrap gap-1">
                                        <button onClick={() => setFiltroTipoAsignar(null)}
                                            className={`btn btn-sm rounded-pill ${!filtroTipoAsignar ? 'btn-dark' : 'btn-outline-secondary'}`}
                                            style={{ fontSize: 12 }}>
                                            Todos
                                        </button>
                                        {tiposDisponibles.map(tipo => (
                                            <button key={tipo.id}
                                                onClick={() => { setFiltroTipoAsignar(tipo); setAsignacionesForm({}); }}
                                                className={`btn btn-sm rounded-pill ${filtroTipoAsignar?.id === tipo.id ? 'text-white' : 'btn-outline-secondary'}`}
                                                style={{ fontSize: 12, ...(filtroTipoAsignar?.id === tipo.id ? { background: '#e65100', borderColor: '#e65100' } : {}) }}
                                                title={`${tipo.capacidad_toneladas}tn · ${tipo.cantidad_empresas} empresa${tipo.cantidad_empresas !== 1 ? 's' : ''}`}>
                                                {tipo.nombre} <span className="opacity-75" style={{ fontSize: 10 }}>({tipo.total_vehiculos})</span>
                                            </button>
                                        ))}
                                    </div>
                                    {filtroTipoAsignar && (
                                        <div className="alert alert-warning py-1 px-2 mt-2 mb-0 small">
                                            Mostrando empresas con <strong>{filtroTipoAsignar.nombre}</strong> ({filtroTipoAsignar.capacidad_toneladas}tn) —
                                            {filtroTipoAsignar.cantidad_empresas} empresa{filtroTipoAsignar.cantidad_empresas !== 1 ? 's' : ''}, {filtroTipoAsignar.total_vehiculos} unidades
                                        </div>
                                    )}
                                </div>

                                {camionesPorAsignar <= 0 ? (
                                    <p className="text-danger fw-bold">Todos los camiones ya fueron asignados.</p>
                                ) : (
                                    <>
                                        {transportesFiltrados.length === 0 ? (
                                            <p className="text-center text-muted p-4 bg-light rounded small">
                                                Ninguna empresa tiene vehículos del tipo <strong>{filtroTipoAsignar?.nombre}</strong> registrados.
                                            </p>
                                        ) : (
                                        <div className="table-responsive">
                                            <table className="table table-sm table-hover align-middle small mb-0">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Empresa</th>
                                                        {filtroTipoAsignar && <th className="text-center">Tipo</th>}
                                                        <th className="text-center">Veh.</th>
                                                        <th className="text-center">WA</th>
                                                        <th className="text-center" style={{ width: 65 }}>Cant.</th>
                                                        <th className="text-center" style={{ width: 100 }}>Precio $</th>
                                                        <th className="text-center" style={{ width: 135 }}>Comisión</th>
                                                        <th className="text-center" style={{ width: 95 }}>Neto</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {transportesFiltrados.map(t => {
                                                        const cantTipo = filtroTipoAsignar
                                                            ? (filtroTipoAsignar.transportes.find(tr => tr.id === t.id)?.cantidad || 0)
                                                            : null;
                                                        const disponibles = (t.cantidad_vehiculos || 0) - (t.camiones_en_uso || 0);
                                                        const maxAsignar = filtroTipoAsignar
                                                            ? Math.min(camionesPorAsignar, cantTipo)
                                                            : Math.min(camionesPorAsignar, Math.max(disponibles, 0));
                                                        const sinDisp = filtroTipoAsignar ? cantTipo <= 0 : disponibles <= 0;
                                                        return (
                                                        <tr key={t.id} style={{ opacity: sinDisp ? 0.5 : 1 }}>
                                                            <td className="fw-bold">{t.nombre}</td>
                                                            {filtroTipoAsignar && (
                                                                <td className="text-center">
                                                                    <strong style={{ color: cantTipo > 0 ? '#388e3c' : '#c62828' }}>{cantTipo}</strong>
                                                                    <span className="text-muted" style={{ fontSize: 10 }}> ud.</span>
                                                                </td>
                                                            )}
                                                            <td className="text-center">
                                                                <span title={`Total: ${t.cantidad_vehiculos || 0} | En uso: ${t.camiones_en_uso || 0}`}>
                                                                    <strong style={{ color: disponibles <= 0 ? '#c62828' : '#388e3c' }}>{disponibles}</strong>
                                                                    <span className="text-muted" style={{ fontSize: 11 }}> / {t.cantidad_vehiculos || 0}</span>
                                                                </span>
                                                            </td>
                                                            <td className="text-center">{t.telefono_whatsapp ? '✅' : '❌'}</td>
                                                            <td className="text-center">
                                                                <input type="number" min="0" max={maxAsignar}
                                                                    className="form-control form-control-sm text-center p-1"
                                                                    style={{ width: 55 }}
                                                                    value={asignacionesForm[t.id]?.cantidad || ''}
                                                                    onChange={e => setAsignacionesForm({ ...asignacionesForm, [t.id]: { ...(asignacionesForm[t.id] || {}), cantidad: parseInt(e.target.value) || 0 } })}
                                                                    placeholder="0"
                                                                    disabled={sinDisp} />
                                                            </td>
                                                            <td className="text-center">
                                                                <input type="number" min="0" step="0.01"
                                                                    className="form-control form-control-sm text-end p-1"
                                                                    style={{ width: 90 }}
                                                                    value={asignacionesForm[t.id]?.precio || ''}
                                                                    onChange={e => {
                                                                        const precio = e.target.value;
                                                                        const f = asignacionesForm[t.id] || {};
                                                                        const modo = comisionModo[t.id] || 'pct';
                                                                        let comision = f.comision || '';
                                                                        let comision_porcentaje = f.comision_porcentaje || '';
                                                                        if (modo === 'pct' && comision_porcentaje !== '') {
                                                                            comision = ((parseFloat(precio) || 0) * parseFloat(comision_porcentaje) / 100).toFixed(2);
                                                                        } else if (modo === 'monto' && comision !== '' && parseFloat(precio) > 0) {
                                                                            comision_porcentaje = ((parseFloat(comision) / parseFloat(precio)) * 100).toFixed(2);
                                                                        }
                                                                        setAsignacionesForm({ ...asignacionesForm, [t.id]: { ...f, precio, comision, comision_porcentaje } });
                                                                    }}
                                                                    placeholder="0.00"
                                                                    disabled={sinDisp} />
                                                            </td>
                                                            <td className="text-center">
                                                                <div className="d-flex align-items-center gap-1 justify-content-center">
                                                                    <button
                                                                        onClick={() => setComisionModo({ ...comisionModo, [t.id]: (comisionModo[t.id] || 'pct') === 'pct' ? 'monto' : 'pct' })}
                                                                        className="btn btn-sm fw-bold text-white"
                                                                        style={{ padding: '1px 6px', fontSize: 11, background: (comisionModo[t.id] || 'pct') === 'pct' ? '#1976d2' : '#7b1fa2', minWidth: 28 }}
                                                                        title="Cambiar modo: % o monto fijo">
                                                                        {(comisionModo[t.id] || 'pct') === 'pct' ? '%' : '$'}
                                                                    </button>
                                                                    <input type="number" min="0" step="0.01"
                                                                        className="form-control form-control-sm text-end p-1"
                                                                        style={{ width: 72 }}
                                                                        value={(comisionModo[t.id] || 'pct') === 'pct' ? (asignacionesForm[t.id]?.comision_porcentaje || '') : (asignacionesForm[t.id]?.comision || '')}
                                                                        onChange={e => {
                                                                            const val = e.target.value;
                                                                            const f = asignacionesForm[t.id] || {};
                                                                            const precio = parseFloat(f.precio) || 0;
                                                                            const modo = comisionModo[t.id] || 'pct';
                                                                            let comision, comision_porcentaje;
                                                                            if (modo === 'pct') {
                                                                                comision_porcentaje = val;
                                                                                comision = precio > 0 ? (precio * parseFloat(val || 0) / 100).toFixed(2) : '';
                                                                            } else {
                                                                                comision = val;
                                                                                comision_porcentaje = precio > 0 ? ((parseFloat(val || 0) / precio) * 100).toFixed(2) : '';
                                                                            }
                                                                            setAsignacionesForm({ ...asignacionesForm, [t.id]: { ...f, comision, comision_porcentaje } });
                                                                        }}
                                                                        placeholder={(comisionModo[t.id] || 'pct') === 'pct' ? '0%' : '0.00'}
                                                                        disabled={sinDisp} />
                                                                </div>
                                                                {asignacionesForm[t.id]?.comision_porcentaje && asignacionesForm[t.id]?.comision && (
                                                                    <div className="text-muted mt-1" style={{ fontSize: 10 }}>
                                                                        {(comisionModo[t.id] || 'pct') === 'pct'
                                                                            ? `= $${parseFloat(asignacionesForm[t.id].comision).toLocaleString('es-AR')}`
                                                                            : `= ${parseFloat(asignacionesForm[t.id].comision_porcentaje).toFixed(1)}%`}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="text-center fw-bold">
                                                                {(() => {
                                                                    const p = parseFloat(asignacionesForm[t.id]?.precio) || 0;
                                                                    const c = parseFloat(asignacionesForm[t.id]?.comision) || 0;
                                                                    if (!p) return <span className="text-muted" style={{ fontSize: 12 }}>—</span>;
                                                                    const neto = p - c;
                                                                    return <span style={{ color: neto >= 0 ? '#388e3c' : '#c62828', fontSize: 13 }}>${neto.toLocaleString('es-AR')}</span>;
                                                                })()}
                                                            </td>
                                                        </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        )}

                                        <div className={`text-center p-2 rounded mt-3 small ${totalNuevosAsignados > camionesPorAsignar ? 'bg-danger-subtle' : 'bg-success-subtle'}`}>
                                            Asignando: <strong>{totalNuevosAsignados}</strong> / {camionesPorAsignar} disponibles
                                            {totalNuevosAsignados > camionesPorAsignar && <span className="text-danger ms-2">⚠️ Excede el límite</span>}
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button className="btn btn-secondary btn-sm" onClick={() => setModalAsignar(false)}>Cancelar</button>
                                {camionesPorAsignar > 0 && (
                                    <button className="btn btn-warning btn-sm text-white" onClick={asignarTransportes}
                                        disabled={totalNuevosAsignados === 0 || totalNuevosAsignados > camionesPorAsignar}>
                                        🚛 Enviar Pedido ({totalNuevosAsignados} camiones)
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
}
