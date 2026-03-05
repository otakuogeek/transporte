import { useState, useEffect } from 'react';
import api from '../api/client';

export default function Comisiones() {
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detalles, setDetalles] = useState([]);
  const [choferSeleccionado, setChoferSeleccionado] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDetalles, setLoadingDetalles] = useState(false);

  useEffect(() => { fetchResumen(); }, []);

  const fetchResumen = async () => {
    try { const { data } = await api.get('/comisiones'); setResumen(data); }
    catch (error) { console.error('Error cargando resumen:', error); alert('Error cargando los datos de comisiones.'); }
    finally { setLoading(false); }
  };

  const verDetalles = async (chofer) => {
    setChoferSeleccionado(chofer); setModalOpen(true); setLoadingDetalles(true);
    try { const { data } = await api.get(`/comisiones/${chofer.chofer_id}/detalles`); setDetalles(data); }
    catch (error) { console.error('Error cargando detalles:', error); alert('No se pudieron cargar los detalles del chofer.'); }
    finally { setLoadingDetalles(false); }
  };

  const cobrarViaje = async (solicitudId) => {
    if (!confirm('¿Marcar este viaje específico como cobrado?')) return;
    try {
      await api.put(`/comisiones/solicitudes/${solicitudId}/toggle`, { cobrada: true });
      const { data } = await api.get(`/comisiones/${choferSeleccionado.chofer_id}/detalles`);
      setDetalles(data); fetchResumen();
    } catch (error) { alert('Error marcando viaje como cobrado'); }
  };

  const cobrarTodas = async () => {
    if (!confirm(`¿Seguro que deseas marcar TODAS las comisiones pendientes de ${choferSeleccionado.chofer_nombre} como cobradas?`)) return;
    try {
      await api.put(`/comisiones/chofer/${choferSeleccionado.chofer_id}/cobrar-todas`);
      alert('Pago masivo registrado con éxito.');
      const { data } = await api.get(`/comisiones/${choferSeleccionado.chofer_id}/detalles`);
      setDetalles(data); fetchResumen();
    } catch (error) { alert('Error al registrar pago masivo'); }
  };

  if (loading) return <div className="text-center text-muted p-5">Cargando comisiones...</div>;

  return (
    <div>
      <h1 className="h5 fw-semibold mb-1">Comisiones por Chofer</h1>
      <p className="text-muted small mb-3">Monitorea las comisiones pendientes y el histórico de pagos de los choferes.</p>

      <div className="card shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0 small">
            <thead className="table-light">
              <tr>
                <th className="small fw-semibold text-muted">Chofer</th>
                <th className="small fw-semibold text-muted">Teléfono</th>
                <th className="small fw-semibold text-muted">Comisión Pendiente</th>
                <th className="small fw-semibold text-muted">Viajes Pend.</th>
                <th className="small fw-semibold text-muted">Comisión Histórica</th>
                <th className="small fw-semibold text-muted">Viajes Totales</th>
                <th className="small fw-semibold text-muted">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resumen.length === 0 ? (
                <tr><td colSpan="7" className="text-center text-muted py-4">No hay choferes con registros de comisiones aún.</td></tr>
              ) : resumen.map(r => (
                <tr key={r.chofer_id}>
                  <td className="fw-semibold">{r.chofer_nombre}</td>
                  <td>{r.telefono_whatsapp || 'N/A'}</td>
                  <td className={`fw-bold ${r.comision_pendiente > 0 ? 'text-danger' : 'text-success'}`}>
                    ${Number(r.comision_pendiente).toLocaleString('es-CO')}
                  </td>
                  <td>{r.viajes_pendientes}</td>
                  <td>${Number(r.comision_historial).toLocaleString('es-CO')}</td>
                  <td>{r.viajes_cobrados}</td>
                  <td>
                    <button className="btn btn-falc btn-sm" onClick={() => verDetalles(r)}>Ver / Cobrar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal detalles */}
      {modalOpen && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,.5)' }} onClick={() => setModalOpen(false)}>
          <div className="modal-dialog modal-dialog-centered modal-xl" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Detalles de {choferSeleccionado?.chofer_nombre}</h5>
                <button className="btn-close" onClick={() => setModalOpen(false)} />
              </div>
              <div className="modal-body">
                {loadingDetalles ? <p className="text-muted">Cargando detalles...</p> : (
                  <>
                    <div className="text-end mb-3">
                      <button className="btn btn-falc btn-sm" onClick={cobrarTodas}>Saldar todas las Pendientes</button>
                    </div>
                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0 small">
                        <thead className="table-light">
                          <tr>
                            <th className="small fw-semibold text-muted"># Solicitud</th>
                            <th className="small fw-semibold text-muted">Fecha</th>
                            <th className="small fw-semibold text-muted">Ruta</th>
                            <th className="small fw-semibold text-muted">Cliente (Pago)</th>
                            <th className="small fw-semibold text-muted">Chofer (Oferta)</th>
                            <th className="small fw-semibold text-muted">Ganancia FALC</th>
                            <th className="small fw-semibold text-muted">Estado</th>
                            <th className="small fw-semibold text-muted">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalles.length === 0 ? (
                            <tr><td colSpan="8" className="text-center text-muted py-4">No hay viajes adjudicados para este chofer.</td></tr>
                          ) : detalles.map(d => (
                            <tr key={d.solicitud_id}>
                              <td>#{d.solicitud_id}</td>
                              <td>{new Date(d.fecha_carga).toLocaleDateString('es-CO')}</td>
                              <td>{d.origen} → {d.destino}</td>
                              <td>${Number(d.precio_final_cliente).toLocaleString('es-CO')}</td>
                              <td>${Number(d.costo_chofer).toLocaleString('es-CO')}</td>
                              <td className="fw-bold">${Number(d.ganancia).toLocaleString('es-CO')}</td>
                              <td>
                                {d.comision_cobrada
                                  ? <span className="badge bg-success-subtle text-success">Cobrada</span>
                                  : <span className="badge bg-danger-subtle text-danger">Pendiente</span>}
                              </td>
                              <td>
                                {!d.comision_cobrada && (
                                  <button className="btn btn-outline-danger btn-sm" onClick={() => cobrarViaje(d.solicitud_id)}>Cobrar</button>
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
    </div>
  );
}
