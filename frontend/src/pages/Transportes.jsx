import { useState, useEffect } from 'react';
import api from '../api/client';

export default function Transportes() {
    const [transportes, setTransportes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState({ nombre: '', contacto_nombre: '', telefono_whatsapp: '', email: '', estado: 'Activo', cantidad_vehiculos: 0, cbu: '', alias_cbu: '', banco: '', titular_cuenta: '', cuit_cuil: '' });
    const [historial, setHistorial] = useState([]);
    const [tab, setTab] = useState('listado');

    const [tiposVehiculos, setTiposVehiculos] = useState([]);
    const [vehiculosTransporte, setVehiculosTransporte] = useState([]);
    const [nuevoTipoId, setNuevoTipoId] = useState('');
    const [nuevaCantidad, setNuevaCantidad] = useState(1);

    useEffect(() => { fetchTransportes(); fetchHistorial(); fetchTiposVehiculos(); }, []);

    useEffect(() => {
        if (editando) {
            const total = vehiculosTransporte.reduce((s, v) => s + (parseInt(v.cantidad) || 0), 0);
            setForm(f => ({ ...f, cantidad_vehiculos: total }));
        }
    }, [vehiculosTransporte]);

    const fetchTiposVehiculos = async () => {
        try { const { data } = await api.get('/tipos-vehiculos'); setTiposVehiculos(data); } catch (e) { console.error(e); }
    };

    const fetchVehiculosTransporte = async (transporteId) => {
        try { const { data } = await api.get(`/transportes/${transporteId}/vehiculos`); setVehiculosTransporte(data); } catch (e) { console.error(e); }
    };

    const fetchTransportes = async () => {
        try { const { data } = await api.get('/transportes'); setTransportes(data); } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchHistorial = async () => {
        try { const { data } = await api.get('/asignaciones/historial'); setHistorial(data); } catch (e) { console.error(e); }
    };

    const abrirModal = (t = null) => {
        if (t) {
            setEditando(t);
            setForm({ nombre: t.nombre, contacto_nombre: t.contacto_nombre || '', telefono_whatsapp: t.telefono_whatsapp || '', email: t.email || '', estado: t.estado, cantidad_vehiculos: t.cantidad_vehiculos || 0, cbu: t.cbu || '', alias_cbu: t.alias_cbu || '', banco: t.banco || '', titular_cuenta: t.titular_cuenta || '', cuit_cuil: t.cuit_cuil || '' });
            fetchVehiculosTransporte(t.id);
        } else {
            setEditando(null);
            setForm({ nombre: '', contacto_nombre: '', telefono_whatsapp: '', email: '', estado: 'Activo', cantidad_vehiculos: 0, cbu: '', alias_cbu: '', banco: '', titular_cuenta: '', cuit_cuil: '' });
            setVehiculosTransporte([]);
        }
        setNuevoTipoId('');
        setNuevaCantidad(1);
        setModalOpen(true);
    };

    const agregarTipoVehiculo = async () => {
        if (!nuevoTipoId || !editando) return;
        const yaExiste = vehiculosTransporte.find(v => v.tipo_vehiculo_id === parseInt(nuevoTipoId));
        if (yaExiste) return alert('Este tipo de vehículo ya está asignado');
        try {
            await api.post('/transportes-vehiculos', { transporte_id: editando.id, tipo_vehiculo_id: parseInt(nuevoTipoId), cantidad: parseInt(nuevaCantidad) || 1 });
            await fetchVehiculosTransporte(editando.id);
            setNuevoTipoId('');
            setNuevaCantidad(1);
        } catch (e) { alert('Error asignando vehículo: ' + (e.response?.data?.error || e.message)); }
    };

    const actualizarCantidadVehiculo = async (relacionId, tipoVehiculoId, cantidad) => {
        if (!editando) return;
        try {
            await api.post('/transportes-vehiculos', { transporte_id: editando.id, tipo_vehiculo_id: tipoVehiculoId, cantidad: parseInt(cantidad) || 1 });
            await fetchVehiculosTransporte(editando.id);
        } catch (e) { console.error(e); }
    };

    const eliminarTipoVehiculo = async (relacionId) => {
        try {
            await api.delete(`/transportes-vehiculos/${relacionId}`);
            if (editando) await fetchVehiculosTransporte(editando.id);
        } catch (e) { alert('Error eliminando'); }
    };

    const guardar = async () => {
        try {
            if (editando) {
                await api.put(`/transportes/${editando.id}`, form);
            } else {
                await api.post('/transportes', form);
            }
            setModalOpen(false);
            fetchTransportes();
        } catch (e) { alert('Error guardando: ' + (e.response?.data?.error || e.message)); }
    };

    const eliminar = async (id) => {
        if (!confirm('¿Eliminar este transporte?')) return;
        try { await api.delete(`/transportes/${id}`); fetchTransportes(); } catch (e) { alert('Error eliminando'); }
    };

    if (loading) return <p className="p-4">Cargando transportes...</p>;

    return (
        <div>
            {/* Header */}
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                <h1 className="h4 fw-semibold mb-0">Empresas de Transporte</h1>
                <div className="d-flex gap-2">
                    <div className="btn-group btn-group-sm">
                        <button onClick={() => setTab('listado')} className={`btn ${tab === 'listado' ? 'btn-falc' : 'btn-outline-secondary'}`}>Listado</button>
                        <button onClick={() => setTab('historial')} className={`btn ${tab === 'historial' ? 'btn-falc' : 'btn-outline-secondary'}`}>Historial</button>
                    </div>
                    <button onClick={() => abrirModal()} className="btn btn-falc btn-sm">Nuevo</button>
                </div>
            </div>

            {tab === 'historial' ? (
                <div className="card shadow-sm">
                    <div className="table-responsive d-none d-md-block">
                        <table className="table table-hover align-middle mb-0 small">
                            <thead className="table-light">
                                <tr>
                                    <th>Empresa</th>
                                    <th className="text-center">Vehículos</th>
                                    <th className="text-center">Asignaciones</th>
                                    <th className="text-center">Solicitados</th>
                                    <th className="text-center">✅ Acept.</th>
                                    <th className="text-center">❌ Rech.</th>
                                    <th className="text-center">⏳ Pend.</th>
                                    <th>Última</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historial.map(h => (
                                    <tr key={h.id}>
                                        <td className="fw-bold">{h.nombre}</td>
                                        <td className="text-center">{h.cantidad_vehiculos || 0}</td>
                                        <td className="text-center fw-bold">{h.total_asignaciones || 0}</td>
                                        <td className="text-center fw-bold text-primary">{h.total_camiones_solicitados || 0}</td>
                                        <td className="text-center fw-bold text-success">{h.camiones_aceptados || 0}</td>
                                        <td className="text-center fw-bold text-danger">{h.camiones_rechazados || 0}</td>
                                        <td className="text-center fw-bold text-warning">{h.camiones_pendientes || 0}</td>
                                        <td style={{ fontSize: 12 }}>{h.ultima_asignacion ? new Date(h.ultima_asignacion).toLocaleDateString('es-CO') : 'Nunca'}</td>
                                    </tr>
                                ))}
                                {historial.length === 0 && <tr><td colSpan="8" className="text-center text-muted py-4">Sin historial</td></tr>}
                            </tbody>
                        </table>
                    </div>
                    <div className="d-md-none p-2">
                        {historial.length === 0 ? (
                            <div className="text-center text-muted py-4">Sin historial</div>
                        ) : (
                            <div className="row g-2">
                                {historial.map(h => (
                                    <div key={h.id} className="col-12">
                                        <div className="border rounded p-2">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <span className="fw-semibold text-truncate">{h.nombre}</span>
                                                <span className="badge rounded-pill bg-primary-subtle text-primary">{h.cantidad_vehiculos || 0} veh.</span>
                                            </div>
                                            <div className="d-flex justify-content-between small">
                                                <span className="text-muted">Asignaciones</span>
                                                <span className="fw-semibold">{h.total_asignaciones || 0}</span>
                                            </div>
                                            <div className="d-flex justify-content-between small mt-1">
                                                <span className="text-muted">Solicitados</span>
                                                <span>{h.total_camiones_solicitados || 0}</span>
                                            </div>
                                            <div className="d-flex justify-content-between small mt-1">
                                                <span className="text-muted">Aceptados</span>
                                                <span className="text-success fw-semibold">{h.camiones_aceptados || 0}</span>
                                            </div>
                                            <div className="d-flex justify-content-between small mt-1">
                                                <span className="text-muted">Rechazados</span>
                                                <span className="text-danger fw-semibold">{h.camiones_rechazados || 0}</span>
                                            </div>
                                            <div className="d-flex justify-content-between small mt-1">
                                                <span className="text-muted">Pendientes</span>
                                                <span className="text-warning fw-semibold">{h.camiones_pendientes || 0}</span>
                                            </div>
                                            <div className="small text-muted mt-1">
                                                Última: {h.ultima_asignacion ? new Date(h.ultima_asignacion).toLocaleDateString('es-CO') : 'Nunca'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                transportes.length === 0 ? (
                    <div className="card shadow-sm">
                        <div className="card-body text-center text-muted py-5">No hay transportes registrados</div>
                    </div>
                ) : (
                    <div className="row g-2">
                        {transportes.map(t => (
                            <div key={t.id} className="col-12 col-md-6 col-xl-4">
                                <div className="card shadow-sm h-100">
                                    <div className="card-body p-3 d-flex flex-column">
                                        <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
                                            <h6 className="fw-semibold mb-0 text-truncate" title={t.nombre}>{t.nombre}</h6>
                                            <span className={`badge rounded-pill ${t.estado === 'Activo' ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger'}`}>
                                                {t.estado}
                                            </span>
                                        </div>

                                        <div className="small text-muted mb-1">Contacto</div>
                                        <div className="fw-semibold mb-2 text-truncate">{t.contacto_nombre || '-'}</div>

                                        <div className="small text-muted mb-1">WhatsApp</div>
                                        <div className="mb-2 text-break">{t.telefono_whatsapp || '-'}</div>

                                        <div className="small text-muted mb-1">Vehículos disponibles</div>
                                        <div className="fw-semibold mb-3">{t.cantidad_vehiculos || 0}</div>

                                        <div className="d-flex gap-2 mt-auto">
                                            <button onClick={() => abrirModal(t)} className="btn btn-outline-primary btn-sm flex-fill">Editar</button>
                                            <button onClick={() => eliminar(t.id)} className="btn btn-outline-danger btn-sm flex-fill">Eliminar</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {/* ============ Modal Crear/Editar ============ */}
            {modalOpen && (
                <div className="modal show d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,.5)' }}>
                    <div className="modal-dialog modal-dialog-centered modal-lg">
                        <div className="modal-content" style={{ maxHeight: '92dvh', overflowY: 'auto' }}>
                            <div className="modal-header">
                                <h5 className="modal-title">{editando ? 'Editar' : 'Nuevo'} Transporte</h5>
                                <button type="button" className="btn-close" onClick={() => setModalOpen(false)} />
                            </div>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">Nombre de la Empresa *</label>
                                    <input className="form-control" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                                </div>
                                <div className="row g-3 mb-3">
                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold small">Contacto</label>
                                        <input className="form-control" value={form.contacto_nombre} onChange={e => setForm({ ...form, contacto_nombre: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold small">WhatsApp</label>
                                        <input className="form-control" value={form.telefono_whatsapp} onChange={e => setForm({ ...form, telefono_whatsapp: e.target.value })} />
                                    </div>
                                </div>
                                <div className="row g-3 mb-3">
                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold small">Email</label>
                                        <input className="form-control" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                    </div>
                                    <div className="col-md-6">
                                        <label className="form-label fw-semibold small">Estado</label>
                                        <select className="form-select" value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                                            <option>Activo</option>
                                            <option>Inactivo</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">
                                        Cantidad de Vehículos
                                        {editando && <span className="fw-normal text-primary ms-2" style={{ fontSize: 11 }}>(calculado automáticamente)</span>}
                                    </label>
                                    <input type="number" min="0"
                                        className={`form-control ${editando ? 'bg-light fw-bold text-primary' : ''}`}
                                        value={form.cantidad_vehiculos}
                                        readOnly={!!editando}
                                        onChange={editando ? undefined : e => setForm({ ...form, cantidad_vehiculos: parseInt(e.target.value) || 0 })}
                                        title={editando ? 'Se calcula como la suma de los tipos de vehículos asignados' : ''} />
                                    {editando && vehiculosTransporte.length > 0 && (
                                        <div className="d-flex flex-wrap gap-1 mt-1">
                                            {vehiculosTransporte.map(v => (
                                                <span key={v.relacion_id} className="badge bg-primary-subtle text-primary" style={{ fontSize: 11 }}>{v.nombre}: {v.cantidad}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Datos de Cobro */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small d-block">💳 Datos de Cobro</label>
                                    <div className="bg-light border rounded p-3">
                                        <div className="row g-2 mb-2">
                                            <div className="col-md-6">
                                                <label className="form-label text-muted" style={{ fontSize: 12 }}>CBU</label>
                                                <input className="form-control form-control-sm" value={form.cbu} onChange={e => setForm({ ...form, cbu: e.target.value })} placeholder="22 dígitos" maxLength={22} />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label text-muted" style={{ fontSize: 12 }}>Alias CBU</label>
                                                <input className="form-control form-control-sm" value={form.alias_cbu} onChange={e => setForm({ ...form, alias_cbu: e.target.value })} placeholder="alias.banco.ejemplo" />
                                            </div>
                                        </div>
                                        <div className="row g-2 mb-2">
                                            <div className="col-md-6">
                                                <label className="form-label text-muted" style={{ fontSize: 12 }}>Banco</label>
                                                <input className="form-control form-control-sm" value={form.banco} onChange={e => setForm({ ...form, banco: e.target.value })} placeholder="Ej: Banco Nación" />
                                            </div>
                                            <div className="col-md-6">
                                                <label className="form-label text-muted" style={{ fontSize: 12 }}>CUIT / CUIL</label>
                                                <input className="form-control form-control-sm" value={form.cuit_cuil} onChange={e => setForm({ ...form, cuit_cuil: e.target.value })} placeholder="XX-XXXXXXXX-X" maxLength={13} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="form-label text-muted" style={{ fontSize: 12 }}>Titular de la Cuenta</label>
                                            <input className="form-control form-control-sm" value={form.titular_cuenta} onChange={e => setForm({ ...form, titular_cuenta: e.target.value })} placeholder="Nombre completo o razón social" />
                                        </div>
                                    </div>
                                </div>

                                {/* Tipos de Vehículos (solo al editar) */}
                                {editando && (
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small d-block">🚚 Tipos de Vehículos</label>
                                        {vehiculosTransporte.length > 0 && (
                                            <div className="table-responsive border rounded mb-2">
                                                <table className="table table-sm align-middle mb-0 small">
                                                    <thead className="table-light">
                                                        <tr>
                                                            <th>Tipo</th>
                                                            <th className="text-center" style={{ width: 80 }}>Cantidad</th>
                                                            <th className="text-center" style={{ width: 50 }}></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {vehiculosTransporte.map(v => (
                                                            <tr key={v.relacion_id}>
                                                                <td>
                                                                    <strong>{v.nombre}</strong>
                                                                    {v.capacidad_toneladas && <span className="text-muted ms-1" style={{ fontSize: 11 }}>({v.capacidad_toneladas} tn)</span>}
                                                                </td>
                                                                <td className="text-center">
                                                                    <input type="number" min="1" value={v.cantidad}
                                                                        className="form-control form-control-sm text-center p-1"
                                                                        style={{ width: 60 }}
                                                                        onChange={e => actualizarCantidadVehiculo(v.relacion_id, v.tipo_vehiculo_id, e.target.value)} />
                                                                </td>
                                                                <td className="text-center">
                                                                    <button onClick={() => eliminarTipoVehiculo(v.relacion_id)} className="btn btn-link text-danger p-0" title="Eliminar">✕</button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                        {vehiculosTransporte.length === 0 && (
                                            <p className="text-muted small mb-2">No tiene tipos de vehículos asignados</p>
                                        )}
                                        <div className="d-flex gap-2 align-items-end">
                                            <div className="flex-grow-1">
                                                <select className="form-select form-select-sm" value={nuevoTipoId} onChange={e => setNuevoTipoId(e.target.value)}>
                                                    <option value="">Seleccionar tipo...</option>
                                                    {tiposVehiculos
                                                        .filter(tv => !vehiculosTransporte.find(v => v.tipo_vehiculo_id === tv.id))
                                                        .map(tv => (
                                                            <option key={tv.id} value={tv.id}>{tv.nombre} {tv.capacidad_toneladas ? `(${tv.capacidad_toneladas} tn)` : ''}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                            <input type="number" min="1" value={nuevaCantidad} onChange={e => setNuevaCantidad(e.target.value)}
                                                className="form-control form-control-sm text-center" style={{ width: 70 }} placeholder="Cant." />
                                            <button onClick={agregarTipoVehiculo} disabled={!nuevoTipoId}
                                                className={`btn btn-sm ${nuevoTipoId ? 'btn-primary' : 'btn-secondary'}`} style={{ whiteSpace: 'nowrap' }}>
                                                + Agregar
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!editando && (
                                    <p className="text-muted small fst-italic mb-0">
                                        💡 Podrás asignar tipos de vehículos después de crear el transporte.
                                    </p>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button onClick={() => setModalOpen(false)} className="btn btn-secondary btn-sm">Cancelar</button>
                                <button onClick={guardar} className="btn btn-success btn-sm">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
