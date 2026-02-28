import { useState, useEffect } from 'react';
import api from '../api/client';

const KPICard = ({ title, value, subtitle, color, icon }) => (
  <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderLeft: `4px solid ${color}`, minWidth: 180, flex: 1 }}>
    <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{icon} {title}</div>
    <div style={{ fontSize: 28, fontWeight: 'bold', color }}>{value}</div>
    {subtitle && <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>{subtitle}</div>}
  </div>
);

const BarChart = ({ data, label, valueKey, nameKey, color }) => {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div>
      <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>{label}</h3>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 120, textAlign: 'right', fontSize: 13, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d[nameKey]}</div>
          <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 22, overflow: 'hidden' }}>
            <div style={{ width: `${(d[valueKey] / max) * 100}%`, background: color || '#1976d2', height: '100%', borderRadius: 4, transition: 'width 0.4s', minWidth: d[valueKey] > 0 ? 20 : 0, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6, fontSize: 11, color: '#fff', fontWeight: 'bold' }}>
              {d[valueKey]}
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Sin datos</p>}
    </div>
  );
};

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [transportes, setTransportes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ fecha_desde: '', fecha_hasta: '' });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtros.fecha_desde) params.set('fecha_desde', filtros.fecha_desde);
      if (filtros.fecha_hasta) params.set('fecha_hasta', filtros.fecha_hasta);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const [statsRes, transpRes, clientRes] = await Promise.all([
        api.get(`/dashboard/stats${qs}`),
        api.get('/dashboard/rendimiento-transportes'),
        api.get('/dashboard/rendimiento-clientes'),
      ]);
      setStats(statsRes.data);
      setTransportes(transpRes.data);
      setClientes(clientRes.data);
    } catch (e) { console.error('Error cargando dashboard:', e); }
    finally { setLoading(false); }
  };

  const aplicarFiltros = () => { fetchAll(); };

  if (loading) return <p style={{ padding: 20 }}>Cargando dashboard...</p>;
  if (!stats) return <p style={{ padding: 20 }}>Error cargando datos</p>;

  const inputStyle = { padding: 6, borderRadius: 4, border: '1px solid #ddd', fontSize: 13 };
  const btnStyle = (bg) => ({ background: bg, color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13 });

  return (
    <div>
      <h1 style={{ marginBottom: 15 }}>Dashboard 📊</h1>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 13 }}>Desde:</label>
        <input type="date" style={inputStyle} value={filtros.fecha_desde} onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })} />
        <label style={{ fontSize: 13 }}>Hasta:</label>
        <input type="date" style={inputStyle} value={filtros.fecha_hasta} onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })} />
        <button onClick={aplicarFiltros} style={btnStyle('#1976d2')}>Filtrar</button>
        <button onClick={() => { setFiltros({ fecha_desde: '', fecha_hasta: '' }); setTimeout(fetchAll, 100); }} style={btnStyle('#999')}>Limpiar</button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <KPICard title="Camiones este mes" value={stats.camiones_este_mes} icon="🚛" color="#1565c0" subtitle="Métrica principal" />
        <KPICard title="Tickets hoy" value={stats.tickets_creados_hoy} icon="📝" color="#e65100" />
        <KPICard title="Pendientes" value={stats.tickets_pendientes} icon="🟡" color="#f57f17" />
        <KPICard title="Confirmados" value={stats.tickets_confirmados} icon="✅" color="#2e7d32" />
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <KPICard title="Cumplimiento" value={`${stats.pct_cumplimiento}%`} icon="📈" color="#00695c" subtitle={`${stats.camiones_confirmados_total} de ${stats.camiones_solicitados} camiones`} />
        <KPICard title="Tiempo promedio" value={stats.tiempo_promedio_confirmacion_horas ? `${stats.tiempo_promedio_confirmacion_horas}h` : '—'} icon="⏱️" color="#6a1b9a" subtitle="Ticket → Confirmación" />
        <KPICard title="% Rechazos" value={`${stats.pct_rechazos}%`} icon="❌" color="#c62828" subtitle="De asignaciones enviadas" />
      </div>

      {/* Camiones por mes */}
      {stats.camiones_por_mes && stats.camiones_por_mes.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 24 }}>
          <BarChart data={stats.camiones_por_mes} label="🚛 Camiones confirmados por mes" valueKey="confirmados" nameKey="mes" color="#1565c0" />
        </div>
      )}

      {/* Ranking de Transportes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 15px', fontSize: 15 }}>🏆 Ranking de Transportes</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Transporte</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Asignaciones</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Aceptación</th>
                <th style={{ padding: 8, textAlign: 'right' }}>T. Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {transportes.map((t, i) => (
                <tr key={t.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 8 }}>
                    <span style={{ fontWeight: 'bold', marginRight: 6, color: i < 3 ? '#e65100' : '#999' }}>{i + 1}.</span>
                    {t.nombre}
                  </td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{t.total_asignaciones}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>
                    <span style={{ color: (t.tasa_aceptacion || 0) >= 70 ? '#2e7d32' : (t.tasa_aceptacion || 0) >= 40 ? '#f57f17' : '#c62828', fontWeight: 'bold' }}>
                      {t.tasa_aceptacion || 0}%
                    </span>
                  </td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{t.tiempo_respuesta_min ? `${t.tiempo_respuesta_min} min` : '—'}</td>
                </tr>
              ))}
              {transportes.length === 0 && <tr><td colSpan="4" style={{ padding: 15, textAlign: 'center', color: '#999' }}>Sin datos</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Rendimiento por Cliente / Finca */}
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 15px', fontSize: 15 }}>👥 Rendimiento por Cliente / Finca</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>Cliente</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Finca</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Tickets</th>
                <th style={{ padding: 8, textAlign: 'right' }}>Camiones</th>
                <th style={{ padding: 8, textAlign: 'right' }}>T. Prom</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: 8 }}>{c.nombre}</td>
                  <td style={{ padding: 8 }}>{c.origen_default || '—'}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{c.total_tickets}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{c.camiones_confirmados}/{c.camiones_solicitados}</td>
                  <td style={{ padding: 8, textAlign: 'right' }}>{c.tiempo_promedio_horas ? `${c.tiempo_promedio_horas}h` : '—'}</td>
                </tr>
              ))}
              {clientes.length === 0 && <tr><td colSpan="5" style={{ padding: 15, textAlign: 'center', color: '#999' }}>Sin datos</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
