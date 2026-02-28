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
    } catch (err) {
      console.error('Error cargando solicitudes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function verDetalle(row) {
    try {
      const res = await api.get(`/solicitudes/${row.id}`);
      setDetalle(res.data);
    } catch (err) {
      console.error('Error cargando detalle:', err);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a2e' }}>📋 Solicitudes de Transporte</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {['', 'Pendiente', 'Cotizando', 'Adjudicada', 'Completada', 'Rechazada'].map((estado) => (
            <button key={estado} onClick={() => setFiltro(estado)}
              style={{
                padding: '6px 14px', borderRadius: 20, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12,
                background: filtro === estado ? '#e94560' : '#fff', color: filtro === estado ? '#fff' : '#333',
              }}>
              {estado || 'Todos'}
            </button>
          ))}
        </div>
      </div>

      {/* Modal de detalle */}
      {detalle && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
        }} onClick={() => setDetalle(null)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 12, padding: 30, maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0 }}>Solicitud #{detalle.id}</h2>
              <StatusBadge status={detalle.estado} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div><strong>Cliente:</strong> {detalle.cliente_nombre} {detalle.cliente_apellidos || ''}</div>
              <div><strong>Teléfono:</strong> {detalle.cliente_telefono || '-'}</div>
              <div><strong>Origen:</strong> {detalle.origen}</div>
              <div><strong>Destino:</strong> {detalle.destino}</div>
              <div><strong>Fecha Carga:</strong> {new Date(detalle.fecha_carga).toLocaleDateString('es-PE')}</div>
              <div><strong>Tipo Vehículo:</strong> {detalle.tipo_vehiculo_requerido}</div>
              <div><strong>Chofer Asignado:</strong> {detalle.chofer_nombre || '-'}</div>
              <div><strong>Precio Final:</strong> {detalle.precio_final_cliente ? `$${detalle.precio_final_cliente}` : '-'}</div>
            </div>

            {detalle.cotizaciones?.length > 0 && (
              <>
                <h3 style={{ margin: '0 0 10px' }}>Cotizaciones Recibidas</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f7f8fa' }}>
                      <th style={{ padding: 8, textAlign: 'left' }}>Chofer</th>
                      <th style={{ padding: 8, textAlign: 'left' }}>Costo</th>
                      <th style={{ padding: 8, textAlign: 'left' }}>Ganadora</th>
                      <th style={{ padding: 8, textAlign: 'left' }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalle.cotizaciones.map((cot) => (
                      <tr key={cot.id} style={{ borderBottom: '1px solid #f0f0f0', background: cot.es_ganadora ? '#e8f5e9' : 'transparent' }}>
                        <td style={{ padding: 8 }}>{cot.chofer_nombre}</td>
                        <td style={{ padding: 8, fontWeight: 600 }}>${cot.costo_ofrecido}</td>
                        <td style={{ padding: 8 }}>{cot.es_ganadora ? '✅ Sí' : '-'}</td>
                        <td style={{ padding: 8 }}>{new Date(cot.fecha_cotizacion).toLocaleString('es-PE')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <button onClick={() => setDetalle(null)} style={{
              marginTop: 20, background: '#999', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 4, cursor: 'pointer',
            }}>Cerrar</button>
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
          { key: 'estado', label: 'Estado', render: (v) => <StatusBadge status={v} /> },
          { key: 'total_cotizaciones', label: 'Cotizaciones' },
          { key: 'precio_final_cliente', label: 'Precio', render: (v) => v ? `$${v}` : '-' },
          { key: 'chofer_nombre', label: 'Chofer', render: (v) => v || '-' },
          { key: 'fecha_creacion', label: 'Fecha', render: (v) => new Date(v).toLocaleDateString('es-PE') },
        ]}
        data={solicitudes}
        onRowClick={verDetalle}
      />
    </div>
  );
}
