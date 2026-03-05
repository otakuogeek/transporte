// src/pages/Cotizaciones.jsx
import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/DataTable';

export default function Cotizaciones() {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCotizaciones(); }, []);

  async function loadCotizaciones() {
    try { const res = await api.get('/cotizaciones'); setCotizaciones(res.data); }
    catch (err) { console.error('Error cargando cotizaciones:', err); }
    finally { setLoading(false); }
  }

  if (loading) return <div className="text-center text-muted p-5">Cargando...</div>;

  return (
    <div>
      <h1 className="h5 fw-semibold mb-3">Cotizaciones de Choferes</h1>

      <DataTable
        columns={[
          { key: 'id', label: '#' },
          { key: 'solicitud_id', label: 'Solicitud #' },
          { key: 'chofer_nombre', label: 'Chofer' },
          { key: 'ruta', label: 'Ruta', render: (_, row) => `${row.origen} → ${row.destino}` },
          { key: 'costo_ofrecido', label: 'Costo Ofrecido', render: v => `$${v.toLocaleString('es-PE')}` },
          { key: 'es_ganadora', label: 'Ganadora', render: v => v ? '✅ Sí' : '-' },
          { key: 'fecha_cotizacion', label: 'Fecha', render: v => new Date(v).toLocaleString('es-PE') },
        ]}
        data={cotizaciones}
      />
    </div>
  );
}
