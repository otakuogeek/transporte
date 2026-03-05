import { useState, useEffect } from 'react';
import api from '../api/client';

const KPICard = ({ title, value, subtitle, color, icon }) => (
  <div className="card kpi-card h-100">
    <div className="card-body py-3 px-3">
      <div className="small text-muted mb-1">{title}</div>
      <div className="fs-4 fw-semibold" style={{ color }}>{value}</div>
      {subtitle && <div className="text-muted mt-1" style={{ fontSize: 12 }}>{subtitle}</div>}
    </div>
  </div>
);

const BarChart = ({ data, label, valueKey, nameKey, color }) => {
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  return (
    <div>
      <h6 className="fw-semibold mb-3">{label}</h6>
      {data.map((d, i) => (
        <div key={i} className="d-flex align-items-center gap-2 mb-1">
          <div className="text-end text-muted small text-truncate" style={{ width: 120 }}>{d[nameKey]}</div>
          <div className="flex-grow-1 rounded overflow-hidden" style={{ background: '#f0f0f0', height: 22 }}>
            <div className="h-100 rounded d-flex align-items-center justify-content-end pe-1"
              style={{ width: `${(d[valueKey] / max) * 100}%`, background: color || '#1976d2', minWidth: d[valueKey] > 0 ? 20 : 0, fontSize: 11, color: '#fff', fontWeight: 'bold', transition: 'width 0.4s' }}>
              {d[valueKey]}
            </div>
          </div>
        </div>
      ))}
      {data.length === 0 && <p className="text-muted small">Sin datos</p>}
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

  if (loading) return <p className="p-4">Cargando dashboard...</p>;
  if (!stats) return <p className="p-4">Error cargando datos</p>;

  return (
    <div>
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h1 className="h4 fw-semibold mb-0">Panel de Gestión</h1>
        <small className="text-muted">Vista general operativa</small>
      </div>

      {/* Filtros */}
      <div className="card mb-3">
        <div className="card-body py-2 px-3">
          <div className="row g-2 align-items-end">
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label fw-semibold small mb-1">Desde</label>
              <input type="date" className="form-control form-control-sm"
                value={filtros.fecha_desde} onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })} />
            </div>
            <div className="col-6 col-md-3 col-lg-2">
              <label className="form-label fw-semibold small mb-1">Hasta</label>
              <input type="date" className="form-control form-control-sm"
                value={filtros.fecha_hasta} onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })} />
            </div>
            <div className="col-12 col-md-6 col-lg-4 d-flex gap-2">
              <button onClick={fetchAll} className="btn btn-falc btn-sm">Aplicar filtros</button>
              <button onClick={() => { setFiltros({ fecha_desde: '', fecha_hasta: '' }); setTimeout(fetchAll, 100); }} className="btn btn-outline-secondary btn-sm">Limpiar</button>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs fila 1 */}
      <div className="row g-3 mb-3">
        <div className="col-6 col-md-3"><KPICard title="Camiones este mes" value={stats.camiones_este_mes} icon="" color="#1f4b93" subtitle="Métrica principal" /></div>
        <div className="col-6 col-md-3"><KPICard title="Tickets hoy" value={stats.tickets_creados_hoy} icon="" color="#2356a8" /></div>
        <div className="col-6 col-md-3"><KPICard title="Pendientes" value={stats.tickets_pendientes} icon="" color="#b45309" /></div>
        <div className="col-6 col-md-3"><KPICard title="Confirmados" value={stats.tickets_confirmados} icon="" color="#047857" /></div>
      </div>

      {/* KPIs fila 2 */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-4"><KPICard title="Cumplimiento" value={`${stats.pct_cumplimiento}%`} icon="" color="#0f766e" subtitle={`${stats.camiones_confirmados_total} de ${stats.camiones_solicitados} camiones`} /></div>
        <div className="col-6 col-md-4"><KPICard title="Tiempo promedio" value={stats.tiempo_promedio_confirmacion_horas ? `${stats.tiempo_promedio_confirmacion_horas}h` : '—'} icon="" color="#6d28d9" subtitle="Ticket a confirmación" /></div>
        <div className="col-12 col-md-4"><KPICard title="Rechazos" value={`${stats.pct_rechazos}%`} icon="" color="#b91c1c" subtitle="Sobre asignaciones enviadas" /></div>
      </div>

      {/* Camiones por mes */}
      {stats.camiones_por_mes && stats.camiones_por_mes.length > 0 && (
        <div className="card mb-4">
          <div className="card-body">
            <BarChart data={stats.camiones_por_mes} label="Camiones confirmados por mes" valueKey="confirmados" nameKey="mes" color="#2356a8" />
          </div>
        </div>
      )}

      {/* Rankings */}
      <div className="row g-3 mb-4">
        <div className="col-12 col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="fw-semibold mb-3">Ranking de transportes</h6>
              <div className="table-responsive d-none d-md-block">
                <table className="table table-sm table-hover mb-0 small">
                  <thead className="table-light">
                    <tr>
                      <th>Transporte</th>
                      <th className="text-end">Asignaciones</th>
                      <th className="text-end">Aceptación</th>
                      <th className="text-end">T. Respuesta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transportes.map((t, i) => (
                      <tr key={t.id}>
                        <td><span className="fw-bold me-1" style={{ color: i < 3 ? '#2356a8' : '#94a3b8' }}>{i + 1}.</span>{t.nombre}</td>
                        <td className="text-end">{t.total_asignaciones}</td>
                        <td className="text-end">
                          <span className="fw-bold" style={{ color: (t.tasa_aceptacion || 0) >= 70 ? '#047857' : (t.tasa_aceptacion || 0) >= 40 ? '#b45309' : '#b91c1c' }}>
                            {t.tasa_aceptacion || 0}%
                          </span>
                        </td>
                        <td className="text-end">{t.tiempo_respuesta_min ? `${t.tiempo_respuesta_min} min` : '—'}</td>
                      </tr>
                    ))}
                    {transportes.length === 0 && <tr><td colSpan="4" className="text-center text-muted py-3">Sin datos</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="d-md-none">
                {transportes.length === 0 ? (
                  <div className="text-center text-muted py-3 small">Sin datos</div>
                ) : (
                  <div className="row g-2">
                    {transportes.map((t, i) => (
                      <div key={t.id} className="col-12">
                        <div className="border rounded p-2">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <span className="fw-semibold text-truncate">
                              <span className="me-1" style={{ color: i < 3 ? '#2356a8' : '#94a3b8' }}>{i + 1}.</span>
                              {t.nombre}
                            </span>
                            <span className="small fw-semibold">{t.total_asignaciones} asig.</span>
                          </div>
                          <div className="d-flex justify-content-between small text-muted">
                            <span>Aceptación</span>
                            <span style={{ color: (t.tasa_aceptacion || 0) >= 70 ? '#047857' : (t.tasa_aceptacion || 0) >= 40 ? '#b45309' : '#b91c1c' }}>
                              {t.tasa_aceptacion || 0}%
                            </span>
                          </div>
                          <div className="d-flex justify-content-between small text-muted mt-1">
                            <span>Tiempo respuesta</span>
                            <span>{t.tiempo_respuesta_min ? `${t.tiempo_respuesta_min} min` : '—'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="card h-100">
            <div className="card-body">
              <h6 className="fw-semibold mb-3">Rendimiento por cliente / finca</h6>
              <div className="table-responsive d-none d-md-block">
                <table className="table table-sm table-hover mb-0 small">
                  <thead className="table-light">
                    <tr>
                      <th>Cliente</th>
                      <th>Finca</th>
                      <th className="text-end">Tickets</th>
                      <th className="text-end">Camiones</th>
                      <th className="text-end">T. Prom</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map(c => (
                      <tr key={c.id}>
                        <td>{c.nombre}</td>
                        <td>{c.origen_default || '—'}</td>
                        <td className="text-end">{c.total_tickets}</td>
                        <td className="text-end">{c.camiones_confirmados}/{c.camiones_solicitados}</td>
                        <td className="text-end">{c.tiempo_promedio_horas ? `${c.tiempo_promedio_horas}h` : '—'}</td>
                      </tr>
                    ))}
                    {clientes.length === 0 && <tr><td colSpan="5" className="text-center text-muted py-3">Sin datos</td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="d-md-none">
                {clientes.length === 0 ? (
                  <div className="text-center text-muted py-3 small">Sin datos</div>
                ) : (
                  <div className="row g-2">
                    {clientes.map(c => (
                      <div key={c.id} className="col-12">
                        <div className="border rounded p-2">
                          <div className="fw-semibold text-truncate mb-1">{c.nombre}</div>
                          <div className="small text-muted mb-1">{c.origen_default || '—'}</div>
                          <div className="d-flex justify-content-between small">
                            <span className="text-muted">Tickets</span>
                            <span>{c.total_tickets}</span>
                          </div>
                          <div className="d-flex justify-content-between small mt-1">
                            <span className="text-muted">Camiones</span>
                            <span>{c.camiones_confirmados}/{c.camiones_solicitados}</span>
                          </div>
                          <div className="d-flex justify-content-between small mt-1">
                            <span className="text-muted">Tiempo prom</span>
                            <span>{c.tiempo_promedio_horas ? `${c.tiempo_promedio_horas}h` : '—'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
