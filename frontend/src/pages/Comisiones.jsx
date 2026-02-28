import { useState, useEffect } from 'react';
import api from '../api/client';

export default function Comisiones() {
    const [resumen, setResumen] = useState([]);
    const [loading, setLoading] = useState(true);

    // Estados del Modal
    const [detalles, setDetalles] = useState([]);
    const [choferSeleccionado, setChoferSeleccionado] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [loadingDetalles, setLoadingDetalles] = useState(false);

    useEffect(() => {
        fetchResumen();
    }, []);

    const fetchResumen = async () => {
        try {
            const { data } = await api.get('/comisiones');
            setResumen(data);
        } catch (error) {
            console.error('Error cargando resumen de comisiones:', error);
            alert('Error cargando los datos de comisiones.');
        } finally {
            setLoading(false);
        }
    };

    const verDetalles = async (chofer) => {
        setChoferSeleccionado(chofer);
        setModalOpen(true);
        setLoadingDetalles(true);
        try {
            const { data } = await api.get(`/comisiones/${chofer.chofer_id}/detalles`);
            setDetalles(data);
        } catch (error) {
            console.error('Error cargando detalles:', error);
            alert('No se pudieron cargar los detalles del chofer.');
        } finally {
            setLoadingDetalles(false);
        }
    };

    const cobrarViaje = async (solicitudId) => {
        if (!confirm('¿Marcar este viaje específico como cobrado?')) return;
        try {
            await api.put(`/comisiones/solicitudes/${solicitudId}/toggle`, { cobrada: true });
            // Recargar datos
            const { data } = await api.get(`/comisiones/${choferSeleccionado.chofer_id}/detalles`);
            setDetalles(data);
            fetchResumen(); // Refrescar el contador principal al fondo
        } catch (error) {
            alert('Error marcando viaje como cobrado');
        }
    };

    const cobrarTodas = async () => {
        const confirmacion = confirm(`¿Seguro que deseas marcar TODAS las comisiones pendientes de ${choferSeleccionado.chofer_nombre} como cobradas?`);
        if (!confirmacion) return;

        try {
            await api.put(`/comisiones/chofer/${choferSeleccionado.chofer_id}/cobrar-todas`);
            alert('Pago masivo registrado con éxito.');
            // Recargar
            const { data } = await api.get(`/comisiones/${choferSeleccionado.chofer_id}/detalles`);
            setDetalles(data);
            fetchResumen();
        } catch (error) {
            alert('Error al registrar pago masivo');
        }
    };

    if (loading) return <p>Cargando comisiones...</p>;

    return (
        <div style={{ padding: 20 }}>
            <h1 style={{ marginBottom: 20 }}>Comisiones por Chofer 💲</h1>
            <p>Monitorea las comisiones pendientes y el histórico de pagos de los choferes.</p>

            <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 8, marginTop: 20, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                            <th style={{ padding: 12 }}>Chofer</th>
                            <th style={{ padding: 12 }}>Teléfono</th>
                            <th style={{ padding: 12 }}>Comisión Pendiente</th>
                            <th style={{ padding: 12 }}>Viajes Pend.</th>
                            <th style={{ padding: 12 }}>Comisión Histórica</th>
                            <th style={{ padding: 12 }}>Viajes Totales</th>
                            <th style={{ padding: 12 }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resumen.length === 0 ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: 20 }}>No hay choferes con registros de comisiones aún.</td></tr>
                        ) : (
                            resumen.map(r => (
                                <tr key={r.chofer_id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: 12 }}><strong>{r.chofer_nombre}</strong></td>
                                    <td style={{ padding: 12 }}>{r.telefono_whatsapp || 'N/A'}</td>
                                    <td style={{ padding: 12, color: r.comision_pendiente > 0 ? '#d32f2f' : '#388e3c', fontWeight: 'bold' }}>
                                        ${Number(r.comision_pendiente).toLocaleString('es-CO')}
                                    </td>
                                    <td style={{ padding: 12 }}>{r.viajes_pendientes}</td>
                                    <td style={{ padding: 12 }}>${Number(r.comision_historial).toLocaleString('es-CO')}</td>
                                    <td style={{ padding: 12 }}>{r.viajes_cobrados}</td>
                                    <td style={{ padding: 12 }}>
                                        <button
                                            onClick={() => verDetalles(r)}
                                            style={{
                                                background: '#1976d2', color: 'white', border: 'none',
                                                padding: '6px 12px', borderRadius: 4, cursor: 'pointer'
                                            }}>
                                            Ver Detalles / Cobrar
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal de Detalles */}
            {modalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div style={{ background: '#fff', padding: 30, borderRadius: 8, width: '90%', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2>Detalles de {choferSeleccionado?.chofer_nombre}</h2>
                            <button onClick={() => setModalOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 24, cursor: 'pointer' }}>×</button>
                        </div>

                        {loadingDetalles ? <p>Cargando detalles...</p> : (
                            <>
                                <div style={{ marginBottom: 20, textAlign: 'right' }}>
                                    <button
                                        onClick={cobrarTodas}
                                        style={{
                                            background: '#388e3c', color: 'white', border: 'none',
                                            padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 'bold'
                                        }}>
                                        Saldar todas las Pendientes
                                    </button>
                                </div>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 14 }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                                            <th style={{ padding: 10 }}># Solicitud</th>
                                            <th style={{ padding: 10 }}>Fecha</th>
                                            <th style={{ padding: 10 }}>Ruta</th>
                                            <th style={{ padding: 10 }}>Cliente (Pago)</th>
                                            <th style={{ padding: 10 }}>Chofer (Oferta)</th>
                                            <th style={{ padding: 10 }}>Ganancia FALC</th>
                                            <th style={{ padding: 10 }}>Estado</th>
                                            <th style={{ padding: 10 }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detalles.length === 0 ? (
                                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: 20 }}>No hay viajes adjudicados para este chofer.</td></tr>
                                        ) : (
                                            detalles.map(d => (
                                                <tr key={d.solicitud_id} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: 10 }}>#{d.solicitud_id}</td>
                                                    <td style={{ padding: 10 }}>{new Date(d.fecha_carga).toLocaleDateString('es-CO')}</td>
                                                    <td style={{ padding: 10 }}>{d.origen} &rarr; {d.destino}</td>
                                                    <td style={{ padding: 10 }}>${Number(d.precio_final_cliente).toLocaleString('es-CO')}</td>
                                                    <td style={{ padding: 10 }}>${Number(d.costo_chofer).toLocaleString('es-CO')}</td>
                                                    <td style={{ padding: 10, fontWeight: 'bold' }}>${Number(d.ganancia).toLocaleString('es-CO')}</td>
                                                    <td style={{ padding: 10 }}>
                                                        {d.comision_cobrada ?
                                                            <span style={{ color: '#388e3c', fontWeight: 'bold' }}>Cobrada</span> :
                                                            <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>Pendiente</span>
                                                        }
                                                    </td>
                                                    <td style={{ padding: 10 }}>
                                                        {!d.comision_cobrada && (
                                                            <button
                                                                onClick={() => cobrarViaje(d.solicitud_id)}
                                                                style={{
                                                                    background: '#e94560', color: 'white', border: 'none',
                                                                    padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12
                                                                }}>
                                                                Cobrar
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
