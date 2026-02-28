// src/pages/Cotizaciones.jsx
import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';

export default function Cotizaciones() {
    const [cotizaciones, setCotizaciones] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCotizaciones();
    }, []);

    async function loadCotizaciones() {
        try {
            const res = await api.get('/cotizaciones');
            setCotizaciones(res.data);
        } catch (err) {
            console.error('Error cargando cotizaciones:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando...</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a2e' }}>💰 Cotizaciones de Choferes</h1>
            </div>

            <DataTable
                columns={[
                    { key: 'id', label: '#' },
                    { key: 'solicitud_id', label: 'Solicitud #' },
                    { key: 'chofer_nombre', label: 'Chofer' },
                    {
                        key: 'ruta',
                        label: 'Ruta',
                        render: (_, row) => `${row.origen} → ${row.destino}`
                    },
                    {
                        key: 'costo_ofrecido',
                        label: 'Costo Ofrecido',
                        render: (v) => `$${v.toLocaleString('es-PE')}`
                    },
                    {
                        key: 'es_ganadora',
                        label: 'Ganadora',
                        render: (v) => v ? '✅ Sí' : '-'
                    },
                    {
                        key: 'fecha_cotizacion',
                        label: 'Fecha',
                        render: (v) => new Date(v).toLocaleString('es-PE')
                    },
                ]}
                data={cotizaciones}
            />
        </div>
    );
}
