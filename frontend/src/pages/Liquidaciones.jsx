// src/pages/Liquidaciones.jsx — Comisiones y Pagos a Transportistas
import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const fmtMoney = (v) => {
    const n = parseFloat(v) || 0;
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

export default function Liquidaciones() {
    // Data
    const [resumen, setResumen] = useState([]);
    const [totales, setTotales] = useState({});
    const [tiposVehiculos, setTiposVehiculos] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [tipoVehiculoId, setTipoVehiculoId] = useState('');
    const [estadoPago, setEstadoPago] = useState('todo');

    // Detail modal
    const [detalleOpen, setDetalleOpen] = useState(false);
    const [detalleTransporte, setDetalleTransporte] = useState(null);
    const [detalleAsignaciones, setDetalleAsignaciones] = useState([]);
    const [detalleLoading, setDetalleLoading] = useState(false);

    // Report modal
    const [reporteOpen, setReporteOpen] = useState(false);
    const [reporteData, setReporteData] = useState([]);
    const [reporteLoading, setReporteLoading] = useState(false);

    // Pago modal
    const [pagoModalOpen, setPagoModalOpen] = useState(false);
    const [pagoTarget, setPagoTarget] = useState(null); // { type: 'single'|'bulk', id, nombre }
    const [pagoObs, setPagoObs] = useState('');

    const buildParams = useCallback(() => {
        const p = {};
        if (fechaDesde) p.fecha_desde = fechaDesde;
        if (fechaHasta) p.fecha_hasta = fechaHasta;
        if (tipoVehiculoId) p.tipo_vehiculo_id = tipoVehiculoId;
        if (estadoPago !== 'todo') p.estado_pago = estadoPago;
        return p;
    }, [fechaDesde, fechaHasta, tipoVehiculoId, estadoPago]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = buildParams();
            const [resRes, totRes] = await Promise.all([
                api.get('/liquidaciones/resumen', { params }),
                api.get('/liquidaciones/totales', { params })
            ]);
            setResumen(resRes.data);
            setTotales(totRes.data);
        } catch (e) { console.error('Error:', e); }
        finally { setLoading(false); }
    }, [buildParams]);

    const fetchTipos = async () => {
        try { const { data } = await api.get('/tipos-vehiculos'); setTiposVehiculos(data); } catch (e) { console.error(e); }
    };

    useEffect(() => { fetchTipos(); }, []);
    useEffect(() => { fetchData(); }, [fetchData]);

    // Detalle de transporte
    const abrirDetalle = async (transporteId) => {
        setDetalleOpen(true);
        setDetalleLoading(true);
        try {
            const { data } = await api.get(`/liquidaciones/transporte/${transporteId}`, { params: buildParams() });
            setDetalleTransporte(data.transporte);
            setDetalleAsignaciones(data.asignaciones);
        } catch (e) { console.error(e); }
        finally { setDetalleLoading(false); }
    };

    // Marcar pagada individual
    const confirmarPago = async () => {
        if (!pagoTarget) return;
        try {
            if (pagoTarget.type === 'single') {
                await api.put(`/liquidaciones/${pagoTarget.id}/pagar`, { observaciones: pagoObs });
            } else {
                await api.put(`/liquidaciones/transporte/${pagoTarget.id}/pagar-todo`, { observaciones: pagoObs });
            }
            setPagoModalOpen(false);
            setPagoObs('');
            fetchData();
            if (detalleOpen && detalleTransporte) abrirDetalle(detalleTransporte.id);
        } catch (e) { console.error(e); alert('Error al procesar pago'); }
    };

    // Revertir pago
    const revertirPago = async (asignacionId) => {
        if (!window.confirm('¿Revertir este pago a pendiente?')) return;
        try {
            await api.put(`/liquidaciones/${asignacionId}/despagar`);
            fetchData();
            if (detalleOpen && detalleTransporte) abrirDetalle(detalleTransporte.id);
        } catch (e) { console.error(e); alert('Error al revertir'); }
    };

    // Reporte
    const generarReporte = async () => {
        setReporteOpen(true);
        setReporteLoading(true);
        try {
            const { data } = await api.get('/liquidaciones/reporte', { params: buildParams() });
            setReporteData(data);
        } catch (e) { console.error(e); }
        finally { setReporteLoading(false); }
    };

    // Exportar CSV
    const exportarCSV = () => {
        if (!reporteData.length) return;
        const headers = ['#', 'Transporte', 'Ticket', 'Cliente', 'Ruta', 'Tipo Vehículo', 'Camiones', 'Precio Unit.', 'Precio Total', '% Comisión', 'Comisión Total', 'Neto Transporte', 'Estado Pago', 'Fecha Pago', 'Observaciones', 'Fecha Asignación'];
        const rows = reporteData.map(r => [
            r.asignacion_id,
            r.transporte,
            `#${r.ticket_id}`,
            r.cliente || '',
            `${r.origen || ''} → ${r.destino || ''}`,
            r.tipo_vehiculo || '',
            r.cantidad_camiones,
            r.precio_unitario,
            r.precio_total,
            r.comision_porcentaje ? `${r.comision_porcentaje}%` : '',
            r.comision_total,
            r.neto_transporte,
            r.estado_pago,
            r.fecha_pago ? fmtDate(r.fecha_pago) : '',
            r.pago_observaciones || '',
            fmtDate(r.fecha_envio)
        ]);
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `liquidaciones_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const limpiarFiltros = () => {
        setFechaDesde('');
        setFechaHasta('');
        setTipoVehiculoId('');
        setEstadoPago('todo');
    };

    return (
        <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <h1 className="fs-4 fw-semibold mb-0">Liquidaciones</h1>
                <button className="btn btn-falc btn-sm" onClick={generarReporte}>
                    Generar Reporte
                </button>
            </div>

            {/* KPI Cards */}
            <div className="row g-2 mb-3">
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body py-2 px-3 text-center">
                            <div className="text-muted small">Total Facturado</div>
                            <div className="fw-bold fs-6 text-primary">{fmtMoney(totales.total_facturado)}</div>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body py-2 px-3 text-center">
                            <div className="text-muted small">Comisión Total</div>
                            <div className="fw-bold fs-6 text-success">{fmtMoney(totales.total_comision)}</div>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body py-2 px-3 text-center">
                            <div className="text-muted small">Pagado</div>
                            <div className="fw-bold fs-6 text-info">{fmtMoney(totales.total_pagado)}</div>
                        </div>
                    </div>
                </div>
                <div className="col-6 col-md-3">
                    <div className="card shadow-sm border-0 h-100">
                        <div className="card-body py-2 px-3 text-center">
                            <div className="text-muted small">Pendiente</div>
                            <div className="fw-bold fs-6 text-danger">{fmtMoney(totales.total_pendiente)}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="card shadow-sm border-0 mb-3">
                <div className="card-body py-2 px-3">
                    <div className="row g-2 align-items-end">
                        <div className="col-6 col-md-3 col-lg-2">
                            <label className="form-label fw-semibold small mb-1">Desde</label>
                            <input type="date" className="form-control form-control-sm" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                        </div>
                        <div className="col-6 col-md-3 col-lg-2">
                            <label className="form-label fw-semibold small mb-1">Hasta</label>
                            <input type="date" className="form-control form-control-sm" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                        </div>
                        <div className="col-6 col-md-3 col-lg-2">
                            <label className="form-label fw-semibold small mb-1">Tipo Vehículo</label>
                            <select className="form-select form-select-sm" value={tipoVehiculoId} onChange={e => setTipoVehiculoId(e.target.value)}>
                                <option value="">Todos</option>
                                {tiposVehiculos.map(tv => <option key={tv.id} value={tv.id}>{tv.nombre}</option>)}
                            </select>
                        </div>
                        <div className="col-6 col-md-3 col-lg-2">
                            <label className="form-label fw-semibold small mb-1">Estado Pago</label>
                            <select className="form-select form-select-sm" value={estadoPago} onChange={e => setEstadoPago(e.target.value)}>
                                <option value="todo">Todos</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="pagado">Pagado</option>
                            </select>
                        </div>
                        <div className="col-12 col-lg-4 d-flex gap-2 justify-content-end">
                            <button className="btn btn-outline-secondary btn-sm" onClick={limpiarFiltros}>Limpiar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla resumen por transporte */}
            {loading ? <p className="text-center text-muted py-4">Cargando...</p> : resumen.length === 0 ? (
                <div className="card shadow-sm border-0">
                    <div className="card-body text-center text-muted py-5">
                        <div className="fs-1 mb-2">📋</div>
                        <p className="mb-0">No hay liquidaciones con los filtros seleccionados</p>
                    </div>
                </div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="card shadow-sm border-0 d-none d-md-block">
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0 small">
                                <thead className="table-light">
                                    <tr>
                                        <th>Transporte</th>
                                        <th className="text-center">Asign.</th>
                                        <th className="text-end">Facturado</th>
                                        <th className="text-end">Comisión</th>
                                        <th className="text-end">A Pagar</th>
                                        <th className="text-end">Pagado</th>
                                        <th className="text-end">Pendiente</th>
                                        <th className="text-center">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resumen.map((r) => (
                                        <tr key={r.transporte_id}>
                                            <td>
                                                <div className="fw-semibold">{r.transporte_nombre}</div>
                                                {r.telefono_whatsapp && <small className="text-muted">{r.telefono_whatsapp}</small>}
                                            </td>
                                            <td className="text-center">{r.total_asignaciones}</td>
                                            <td className="text-end">{fmtMoney(r.total_precio)}</td>
                                            <td className="text-end text-success fw-semibold">{fmtMoney(r.total_comision)}</td>
                                            <td className="text-end">{fmtMoney(r.total_a_pagar)}</td>
                                            <td className="text-end text-info">{fmtMoney(r.pagado_a_transporte)}</td>
                                            <td className="text-end text-danger fw-semibold">{fmtMoney(r.pendiente_a_transporte)}</td>
                                            <td className="text-center">
                                                <div className="d-flex gap-1 justify-content-center">
                                                    <button className="btn btn-outline-primary btn-sm" title="Ver detalle"
                                                        onClick={() => abrirDetalle(r.transporte_id)}>👁️</button>
                                                    {parseFloat(r.pendiente_a_transporte) > 0 && (
                                                        <button className="btn btn-success btn-sm" title="Pagar todo"
                                                            onClick={() => { setPagoTarget({ type: 'bulk', id: r.transporte_id, nombre: r.transporte_nombre }); setPagoObs(''); setPagoModalOpen(true); }}>
                                                            💲 Pagar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Mobile cards */}
                    <div className="d-md-none">
                        <div className="row g-2">
                            {resumen.map((r) => (
                                <div key={r.transporte_id} className="col-12">
                                    <div className="card shadow-sm border-0">
                                        <div className="card-body py-2 px-3">
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <div>
                                                    <div className="fw-bold">{r.transporte_nombre}</div>
                                                    <small className="text-muted">{r.total_asignaciones} asignaciones</small>
                                                </div>
                                                <button className="btn btn-outline-primary btn-sm" onClick={() => abrirDetalle(r.transporte_id)}>
                                                    Ver detalle
                                                </button>
                                            </div>
                                            <div className="row g-1 small">
                                                <div className="col-6">
                                                    <span className="text-muted">Facturado:</span>
                                                    <span className="ms-1 fw-semibold">{fmtMoney(r.total_precio)}</span>
                                                </div>
                                                <div className="col-6">
                                                    <span className="text-muted">Comisión:</span>
                                                    <span className="ms-1 fw-semibold text-success">{fmtMoney(r.total_comision)}</span>
                                                </div>
                                                <div className="col-6">
                                                    <span className="text-muted">Pagado:</span>
                                                    <span className="ms-1 text-info">{fmtMoney(r.pagado_a_transporte)}</span>
                                                </div>
                                                <div className="col-6">
                                                    <span className="text-muted">Pendiente:</span>
                                                    <span className="ms-1 fw-bold text-danger">{fmtMoney(r.pendiente_a_transporte)}</span>
                                                </div>
                                            </div>
                                            {parseFloat(r.pendiente_a_transporte) > 0 && (
                                                <button className="btn btn-success btn-sm w-100 mt-2"
                                                    onClick={() => { setPagoTarget({ type: 'bulk', id: r.transporte_id, nombre: r.transporte_nombre }); setPagoObs(''); setPagoModalOpen(true); }}>
                                                    💲 Pagar todo pendiente
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* === MODAL Detalle Transporte === */}
            {detalleOpen && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.5)' }} onClick={() => setDetalleOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
                        <div className="modal-content">
                            <div className="modal-header py-2">
                                <h5 className="modal-title fs-6">
                                    📋 Detalle — {detalleTransporte?.nombre || '...'}
                                </h5>
                                <button className="btn-close" onClick={() => setDetalleOpen(false)} />
                            </div>
                            <div className="modal-body p-3">
                                {detalleLoading ? <p className="text-center text-muted py-3">Cargando...</p> : detalleAsignaciones.length === 0 ? (
                                    <p className="text-center text-muted py-3">Sin asignaciones aceptadas</p>
                                ) : (
                                    <>
                                        {/* Summary row */}
                                        <div className="row g-2 mb-3">
                                            <div className="col-4">
                                                <div className="bg-light rounded p-2 text-center">
                                                    <small className="text-muted d-block">Total Facturas</small>
                                                    <strong>{fmtMoney(detalleAsignaciones.reduce((s, a) => s + parseFloat(a.total_precio || 0), 0))}</strong>
                                                </div>
                                            </div>
                                            <div className="col-4">
                                                <div className="bg-success bg-opacity-10 rounded p-2 text-center">
                                                    <small className="text-muted d-block">Total Comisión</small>
                                                    <strong className="text-success">{fmtMoney(detalleAsignaciones.reduce((s, a) => s + parseFloat(a.total_comision || 0), 0))}</strong>
                                                </div>
                                            </div>
                                            <div className="col-4">
                                                <div className="bg-danger bg-opacity-10 rounded p-2 text-center">
                                                    <small className="text-muted d-block">Total Neto</small>
                                                    <strong className="text-danger">{fmtMoney(detalleAsignaciones.reduce((s, a) => s + parseFloat(a.total_neto || 0), 0))}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Assignments table */}
                                        <div className="table-responsive">
                                            <table className="table table-hover align-middle mb-0 small">
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>Ticket</th>
                                                        <th>Ruta</th>
                                                        <th className="d-none d-lg-table-cell">Tipo</th>
                                                        <th className="text-center">Cam.</th>
                                                        <th className="text-end">Precio</th>
                                                        <th className="text-end">Comisión</th>
                                                        <th className="text-end">Neto</th>
                                                        <th className="text-center">Estado</th>
                                                        <th className="text-center">Acción</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {detalleAsignaciones.map((a) => (
                                                        <tr key={a.id}>
                                                            <td>
                                                                <span className="fw-semibold">#{a.ticket_id}</span>
                                                                <br /><small className="text-muted">{fmtDate(a.fecha_envio)}</small>
                                                            </td>
                                                            <td>
                                                                <small>{a.origen || '?'} → {a.destino || '?'}</small>
                                                                {a.cliente_nombre && <><br /><small className="text-muted">{a.cliente_nombre}</small></>}
                                                            </td>
                                                            <td className="d-none d-lg-table-cell"><small>{a.tipo_vehiculo || '—'}</small></td>
                                                            <td className="text-center">{a.cantidad_camiones}</td>
                                                            <td className="text-end">{fmtMoney(a.total_precio)}</td>
                                                            <td className="text-end text-success">{fmtMoney(a.total_comision)}</td>
                                                            <td className="text-end fw-semibold">{fmtMoney(a.total_neto)}</td>
                                                            <td className="text-center">
                                                                {a.comision_pagada ? (
                                                                    <span className="badge rounded-pill bg-success-subtle text-success">Pagado</span>
                                                                ) : (
                                                                    <span className="badge rounded-pill bg-warning-subtle text-warning">Pendiente</span>
                                                                )}
                                                            </td>
                                                            <td className="text-center">
                                                                {a.comision_pagada ? (
                                                                    <button className="btn btn-outline-warning btn-sm" title="Revertir pago"
                                                                        onClick={() => revertirPago(a.id)}>↩️</button>
                                                                ) : (
                                                                    <button className="btn btn-success btn-sm" title="Marcar pagado"
                                                                        onClick={() => { setPagoTarget({ type: 'single', id: a.id, nombre: `Asignación #${a.id}` }); setPagoObs(''); setPagoModalOpen(true); }}>
                                                                        💲
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* === MODAL Confirmar Pago === */}
            {pagoModalOpen && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.5)' }} onClick={() => setPagoModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered modal-sm" onClick={e => e.stopPropagation()}>
                        <div className="modal-content">
                            <div className="modal-header py-2">
                                <h5 className="modal-title fs-6">Confirmar Pago</h5>
                                <button className="btn-close" onClick={() => setPagoModalOpen(false)} />
                            </div>
                            <div className="modal-body">
                                <p className="small mb-2">
                                    {pagoTarget?.type === 'bulk'
                                        ? `Marcar TODAS las asignaciones pendientes de "${pagoTarget.nombre}" como pagadas.`
                                        : `Marcar ${pagoTarget?.nombre} como pagada.`}
                                </p>
                                <label className="form-label fw-semibold small">Observaciones (opcional)</label>
                                <textarea className="form-control form-control-sm" rows={2} value={pagoObs} onChange={e => setPagoObs(e.target.value)}
                                    placeholder="Ej: Transferencia #12345" />
                            </div>
                            <div className="modal-footer py-1">
                                <button className="btn btn-secondary btn-sm" onClick={() => setPagoModalOpen(false)}>Cancelar</button>
                                <button className="btn btn-success btn-sm" onClick={confirmarPago}>✓ Confirmar Pago</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* === MODAL Reporte === */}
            {reporteOpen && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.5)' }} onClick={() => setReporteOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable" onClick={e => e.stopPropagation()}>
                        <div className="modal-content">
                            <div className="modal-header py-2">
                                <h5 className="modal-title fs-6">📄 Reporte de Liquidaciones</h5>
                                <div className="d-flex gap-2">
                                    <button className="btn btn-sm btn-falc" onClick={exportarCSV} disabled={!reporteData.length}>
                                        📥 Exportar CSV
                                    </button>
                                    <button className="btn-close" onClick={() => setReporteOpen(false)} />
                                </div>
                            </div>
                            <div className="modal-body p-2">
                                {reporteLoading ? <p className="text-center text-muted py-3">Generando reporte...</p> : reporteData.length === 0 ? (
                                    <p className="text-center text-muted py-3">Sin datos para los filtros seleccionados</p>
                                ) : (
                                    <>
                                        {/* Reporte summary */}
                                        <div className="row g-2 mb-2 small">
                                            <div className="col-4 col-md-2">
                                                <div className="bg-light rounded p-2 text-center">
                                                    <div className="text-muted">Registros</div>
                                                    <strong>{reporteData.length}</strong>
                                                </div>
                                            </div>
                                            <div className="col-4 col-md-2">
                                                <div className="bg-light rounded p-2 text-center">
                                                    <div className="text-muted">Facturado</div>
                                                    <strong>{fmtMoney(reporteData.reduce((s, r) => s + parseFloat(r.precio_total || 0), 0))}</strong>
                                                </div>
                                            </div>
                                            <div className="col-4 col-md-2">
                                                <div className="bg-success bg-opacity-10 rounded p-2 text-center">
                                                    <div className="text-muted">Comisión</div>
                                                    <strong className="text-success">{fmtMoney(reporteData.reduce((s, r) => s + parseFloat(r.comision_total || 0), 0))}</strong>
                                                </div>
                                            </div>
                                            <div className="col-4 col-md-2">
                                                <div className="bg-light rounded p-2 text-center">
                                                    <div className="text-muted">Neto Trans.</div>
                                                    <strong>{fmtMoney(reporteData.reduce((s, r) => s + parseFloat(r.neto_transporte || 0), 0))}</strong>
                                                </div>
                                            </div>
                                            <div className="col-4 col-md-2">
                                                <div className="bg-info bg-opacity-10 rounded p-2 text-center">
                                                    <div className="text-muted">Pagado</div>
                                                    <strong className="text-info">{fmtMoney(reporteData.filter(r => r.estado_pago === 'Pagado').reduce((s, r) => s + parseFloat(r.neto_transporte || 0), 0))}</strong>
                                                </div>
                                            </div>
                                            <div className="col-4 col-md-2">
                                                <div className="bg-danger bg-opacity-10 rounded p-2 text-center">
                                                    <div className="text-muted">Pendiente</div>
                                                    <strong className="text-danger">{fmtMoney(reporteData.filter(r => r.estado_pago === 'Pendiente').reduce((s, r) => s + parseFloat(r.neto_transporte || 0), 0))}</strong>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="table-responsive">
                                            <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: '0.75rem' }}>
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>#</th>
                                                        <th>Transporte</th>
                                                        <th>Ticket</th>
                                                        <th className="d-none d-lg-table-cell">Cliente</th>
                                                        <th>Ruta</th>
                                                        <th className="d-none d-lg-table-cell">Tipo</th>
                                                        <th className="text-center">Cam.</th>
                                                        <th className="text-end">Precio</th>
                                                        <th className="text-end">Comisión</th>
                                                        <th className="text-end">Neto</th>
                                                        <th className="text-center">Pago</th>
                                                        <th className="d-none d-lg-table-cell">Fecha</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {reporteData.map((r) => (
                                                        <tr key={r.asignacion_id}>
                                                            <td>{r.asignacion_id}</td>
                                                            <td>{r.transporte}</td>
                                                            <td>#{r.ticket_id}</td>
                                                            <td className="d-none d-lg-table-cell">{r.cliente || '—'}</td>
                                                            <td><small>{r.origen} → {r.destino}</small></td>
                                                            <td className="d-none d-lg-table-cell">{r.tipo_vehiculo || '—'}</td>
                                                            <td className="text-center">{r.cantidad_camiones}</td>
                                                            <td className="text-end">{fmtMoney(r.precio_total)}</td>
                                                            <td className="text-end text-success">{fmtMoney(r.comision_total)}</td>
                                                            <td className="text-end fw-semibold">{fmtMoney(r.neto_transporte)}</td>
                                                            <td className="text-center">
                                                                {r.estado_pago === 'Pagado'
                                                                    ? <span className="badge rounded-pill bg-success-subtle text-success">Pagado</span>
                                                                    : <span className="badge rounded-pill bg-warning-subtle text-warning">Pendiente</span>}
                                                            </td>
                                                            <td className="d-none d-lg-table-cell">{fmtDate(r.fecha_envio)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
