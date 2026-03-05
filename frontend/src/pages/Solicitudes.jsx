// src/pages/Solicitudes.jsx
import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function Solicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState('');
  const [detalle, setDetalle] = useState(null);

  useEffect(() => { loadSolicitudes(); }, [filtro]);

  async function loadSolicitudes() {
    try {
      const params = filtro ? `?estado=${filtro}` : '';
      const res = await api.get(`/solicitudes${params}`);
      setSolicitudes(res.data);
    } catch (err) { console.error('Error cargando solicitudes:', err); }
    finally { setLoading(false); }
  }

  async function verDetalle(row) {
    try { const res = await api.get(`/solicitudes/${row.id}`); setDetalle(res.data); }
    catch (err) { console.error('Error cargando detalle:', err); }
  }

  if (loading) return <div className="text-center text-muted p-5">Cargando...</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <h1 className="h5 fw-semibold mb-0">Solicitudes de Transporte</h1>
        <div className="d-flex gap-1 flex-wrap">
          {['', 'Pendiente', 'Cotizando', 'Adjudicada', 'Completada', 'Rechazada'].map(estado => (
            <button key={estado} onClick={() => setFiltro(estado)}
              className={`btn btn-sm rounded-pill ${filtro === estado ? 'btn-dark' : 'btn-outline-secondary'}`}>
              {estado || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="modal show d-block" style={{ background: 'rgba(0,0,0,.5)' }} onClick={() => setDetalle(null)}>
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Solicitud #{detalle.id}</h5>
                <StatusBadge status={detalle.estado} />
                <button className="btn-close ms-2" onClick={() => setDetalle(null)} />
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-3 small">
                  <div className="col-6"><strong>Cliente:</strong> {detalle.cliente_nombre} {detalle.cliente_apellidos || ''}</div>
                  <div className="col-6"><strong>Teléfono:</strong> {detalle.cliente_telefono || '-'}</div>
                  <div className="col-6"><strong>Origen:</strong> {detalle.origen}</div>
                  <div className="col-6"><strong>Destino:</strong> {detalle.destino}</div>
                  <div className="col-6"><strong>Fecha Carga:</strong> {new Date(detalle.fecha_carga).toLocaleDateString('es-PE')}</div>
                  <div className="col-6"><strong>Tipo Vehículo:</strong> {detalle.tipo_vehiculo_requerido}</div>
                  <div className="col-6"><strong>Chofer:</strong> {detalle.chofer_nombre || '-'}</div>
                  <div className="col-6"><strong>Precio:</strong> {detalle.precio_final_cliente ? `$${detalle.precio_final_cliente}` : '-'}</div>
                </div>

                {detalle.cotizaciones?.length > 0 && (
                  <>
                    <h6 className="fw-bold">Cotizaciones Recibidas</h6>
                    <div className="table-responsive">
                      <table className="table table-sm table-hover align-middle small mb-0">
                        <thead className="table-light">
                          <tr>
                            <th>Chofer</th><th>Costo</th><th>Ganadora</th><th>Fecha</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detalle.cotizaciones.map(cot => (
                            <tr key={cot.id} className={cot.es_ganadora ? 'table-success' : ''}>
                              <td>{cot.chofer_nombre}</td>
                              <td className="fw-semibold">${cot.costo_ofrecido}</td>
                              <td>{cot.es_ganadora ? '✅ Sí' : '-'}</td>
                              <td>{new Date(cot.fecha_cotizacion).toLocaleString('es-PE')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary btn-sm" onClick={() => setDetalle(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'id', label: '#' },
          { key: 'cliente_nombre', label: 'Cliente' },
          { key: 'origen', label: 'Origen' },
          { key: 'destino', label: 'Destino' },
          { key: 'tipo_vehiculo_requerido', label: 'Vehículo' },
          { key: 'estado', label: 'Estado', render: v => <StatusBadge status={v} /> },
          { key: 'total_cotizaciones', label: 'Cotizaciones' },
          { key: 'precio_final_cliente', label: 'Precio', render: v => v ? `$${v}` : '-' },
          { key: 'chofer_nombre', label: 'Chofer', render: v => v || '-' },
          { key: 'fecha_creacion', label: 'Fecha', render: v => new Date(v).toLocaleDateString('es-PE') },
        ]}
        data={solicitudes}
        onRowClick={verDetalle}
      />
    </div>
  );
}
