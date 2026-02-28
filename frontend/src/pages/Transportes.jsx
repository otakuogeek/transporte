import { useState, useEffect } from 'react';
import api from '../api/client';

export default function Transportes() {
    const [transportes, setTransportes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState({ nombre: '', contacto_nombre: '', telefono_whatsapp: '', email: '', estado: 'Activo', cantidad_vehiculos: 0 });
    const [historial, setHistorial] = useState([]);
    const [tab, setTab] = useState('listado'); // 'listado' | 'historial'

    useEffect(() => { fetchTransportes(); fetchHistorial(); }, []);

    const fetchTransportes = async () => {
        try {
            const { data } = await api.get('/transportes');
            setTransportes(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchHistorial = async () => {
        try {
            const { data } = await api.get('/asignaciones/historial');
            setHistorial(data);
        } catch (e) { console.error(e); }
    };

    const abrirModal = (t = null) => {
        if (t) {
            setEditando(t);
            setForm({ nombre: t.nombre, contacto_nombre: t.contacto_nombre || '', telefono_whatsapp: t.telefono_whatsapp || '', email: t.email || '', estado: t.estado, cantidad_vehiculos: t.cantidad_vehiculos || 0 });
        } else {
            setEditando(null);
            setForm({ nombre: '', contacto_nombre: '', telefono_whatsapp: '', email: '', estado: 'Activo', cantidad_vehiculos: 0 });
        }
        setModalOpen(true);
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
        try {
            await api.delete(`/transportes/${id}`);
            fetchTransportes();
        } catch (e) { alert('Error eliminando'); }
    };

    if (loading) return <p style={{ padding: 20 }}>Cargando transportes...</p>;

    const inputStyle = { width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' };
    const btnStyle = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 13 });

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h1>Empresas de Transporte 🚛</h1>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setTab('listado')} style={{ ...btnStyle(tab === 'listado' ? '#1976d2' : '#999'), padding: '8px 16px' }}>Listado</button>
                    <button onClick={() => setTab('historial')} style={{ ...btnStyle(tab === 'historial' ? '#1976d2' : '#999'), padding: '8px 16px' }}>📊 Historial</button>
                    <button onClick={() => abrirModal()} style={btnStyle('#388e3c')}>+ Nuevo Transporte</button>
                </div>
            </div>

            {tab === 'historial' ? (
                <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                                <th style={{ padding: 12, textAlign: 'left' }}>Empresa</th>
                                <th style={{ padding: 12, textAlign: 'center' }}>Vehículos</th>
                                <th style={{ padding: 12, textAlign: 'center' }}>Asignaciones</th>
                                <th style={{ padding: 12, textAlign: 'center' }}>Camiones Solicitados</th>
                                <th style={{ padding: 12, textAlign: 'center' }}>✅ Aceptados</th>
                                <th style={{ padding: 12, textAlign: 'center' }}>❌ Rechazados</th>
                                <th style={{ padding: 12, textAlign: 'center' }}>⏳ Pendientes</th>
                                <th style={{ padding: 12, textAlign: 'left' }}>Última Asignación</th>
                            </tr>
                        </thead>
                        <tbody>
                            {historial.map(h => (
                                <tr key={h.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: 12 }}><strong>{h.nombre}</strong></td>
                                    <td style={{ padding: 12, textAlign: 'center' }}>{h.cantidad_vehiculos || 0}</td>
                                    <td style={{ padding: 12, textAlign: 'center', fontWeight: 'bold' }}>{h.total_asignaciones || 0}</td>
                                    <td style={{ padding: 12, textAlign: 'center', fontWeight: 'bold', color: '#1976d2' }}>{h.total_camiones_solicitados || 0}</td>
                                    <td style={{ padding: 12, textAlign: 'center', color: '#2e7d32', fontWeight: 'bold' }}>{h.camiones_aceptados || 0}</td>
                                    <td style={{ padding: 12, textAlign: 'center', color: '#c62828', fontWeight: 'bold' }}>{h.camiones_rechazados || 0}</td>
                                    <td style={{ padding: 12, textAlign: 'center', color: '#f57f17', fontWeight: 'bold' }}>{h.camiones_pendientes || 0}</td>
                                    <td style={{ padding: 12, fontSize: 12 }}>{h.ultima_asignacion ? new Date(h.ultima_asignacion).toLocaleDateString('es-CO') : 'Nunca'}</td>
                                </tr>
                            ))}
                            {historial.length === 0 && <tr><td colSpan="8" style={{ padding: 20, textAlign: 'center', color: '#999' }}>Sin historial</td></tr>}
                        </tbody>
                    </table>
                </div>
            ) : (
            <div style={{ background: '#fff', borderRadius: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #ddd' }}>
                            <th style={{ padding: 12, textAlign: 'left' }}>Nombre</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Contacto</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>WhatsApp</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Vehículos</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Estado</th>
                            <th style={{ padding: 12, textAlign: 'left' }}>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transportes.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: 12 }}><strong>{t.nombre}</strong></td>
                                    <td style={{ padding: 12 }}>{t.contacto_nombre || '-'}</td>
                                    <td style={{ padding: 12 }}>{t.telefono_whatsapp || '-'}</td>
                                    <td style={{ padding: 12 }}>
                                        <strong>{t.cantidad_vehiculos || 0}</strong>
                                    </td>
                                    <td style={{ padding: 12 }}>
                                        <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 12, fontWeight: 'bold', background: t.estado === 'Activo' ? '#e8f5e9' : '#fbe9e7', color: t.estado === 'Activo' ? '#2e7d32' : '#c62828' }}>
                                            {t.estado}
                                        </span>
                                    </td>
                                    <td style={{ padding: 12, display: 'flex', gap: 6 }}>
                                        <button onClick={() => abrirModal(t)} style={btnStyle('#1976d2')}>Editar</button>
                                        <button onClick={() => eliminar(t.id)} style={btnStyle('#c62828')}>Eliminar</button>
                                    </td>
                                </tr>
                        ))}
                        {transportes.length === 0 && <tr><td colSpan="6" style={{ padding: 20, textAlign: 'center', color: '#999' }}>No hay transportes registrados</td></tr>}
                    </tbody>
                </table>
            </div>
            )}

            {/* Modal */}
            {modalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: 30, borderRadius: 8, width: '90%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2>{editando ? 'Editar' : 'Nuevo'} Transporte</h2>

                        <div style={{ display: 'grid', gap: 12, marginTop: 15 }}>
                            <div>
                                <label style={{ fontWeight: 'bold', fontSize: 13 }}>Nombre de la Empresa *</label>
                                <input style={inputStyle} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontWeight: 'bold', fontSize: 13 }}>Contacto</label>
                                    <input style={inputStyle} value={form.contacto_nombre} onChange={e => setForm({ ...form, contacto_nombre: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 'bold', fontSize: 13 }}>WhatsApp</label>
                                    <input style={inputStyle} value={form.telefono_whatsapp} onChange={e => setForm({ ...form, telefono_whatsapp: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ fontWeight: 'bold', fontSize: 13 }}>Email</label>
                                    <input style={inputStyle} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                </div>
                                <div>
                                    <label style={{ fontWeight: 'bold', fontSize: 13 }}>Estado</label>
                                    <select style={inputStyle} value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })}>
                                        <option>Activo</option>
                                        <option>Inactivo</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontWeight: 'bold', fontSize: 13 }}>Cantidad de Vehículos</label>
                                <input type="number" min="0" style={inputStyle} value={form.cantidad_vehiculos} onChange={e => setForm({ ...form, cantidad_vehiculos: parseInt(e.target.value) || 0 })} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button onClick={() => setModalOpen(false)} style={{ ...btnStyle('#999'), padding: '8px 20px' }}>Cancelar</button>
                            <button onClick={guardar} style={{ ...btnStyle('#388e3c'), padding: '8px 20px' }}>Guardar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
