// src/pages/Usuarios.jsx — Gestión de Usuarios y Roles
import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

const ROLES = [
    { value: 'superadmin', label: 'Super Admin', color: 'danger', desc: 'Acceso total + gestión de usuarios' },
    { value: 'admin', label: 'Administrador', color: 'primary', desc: 'Acceso total operativo, sin gestión de usuarios' },
    { value: 'operador', label: 'Operador', color: 'success', desc: 'Tickets, transportes, clientes y WhatsApp' },
    { value: 'visor', label: 'Visor', color: 'secondary', desc: 'Solo lectura: dashboard y liquidaciones' },
];

const rolBadge = (rol) => {
    const r = ROLES.find(x => x.value === rol) || { label: rol, color: 'secondary' };
    return <span className={`badge rounded-pill bg-${r.color}-subtle text-${r.color}`}>{r.label}</span>;
};

const PERMISOS_LABELS = {
    dashboard: 'Dashboard',
    tickets: 'Tickets',
    transportes: 'Transportes',
    'tipos-vehiculos': 'Tipos Vehículos',
    clientes: 'Clientes',
    liquidaciones: 'Liquidaciones',
    whatsapp: 'WhatsApp',
    configuracion: 'Configuración',
    usuarios: 'Usuarios',
};

export default function Usuarios() {
    const { admin } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [form, setForm] = useState({ username: '', password: '', nombre: '', rol: 'operador', activo: true });
    const [error, setError] = useState('');
    const [permisosMap, setPermisosMap] = useState({});

    useEffect(() => { fetchUsuarios(); fetchPermisos(); }, []);

    const fetchUsuarios = async () => {
        try {
            const { data } = await api.get('/usuarios');
            setUsuarios(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchPermisos = async () => {
        try {
            const { data } = await api.get('/auth/permisos');
            setPermisosMap(data.permisos || {});
        } catch (e) { console.error(e); }
    };

    const abrirModal = (u = null) => {
        setError('');
        if (u) {
            setEditando(u);
            setForm({ username: u.username, password: '', nombre: u.nombre, rol: u.rol, activo: !!u.activo });
        } else {
            setEditando(null);
            setForm({ username: '', password: '', nombre: '', rol: 'operador', activo: true });
        }
        setModalOpen(true);
    };

    const guardar = async () => {
        setError('');
        if (!form.username.trim() || !form.nombre.trim()) {
            return setError('Username y nombre son requeridos');
        }
        if (!editando && !form.password.trim()) {
            return setError('La contraseña es requerida para nuevos usuarios');
        }
        try {
            if (editando) {
                const body = { username: form.username, nombre: form.nombre, rol: form.rol, activo: form.activo };
                if (form.password.trim()) body.password = form.password;
                await api.put(`/usuarios/${editando.id}`, body);
            } else {
                await api.post('/usuarios', form);
            }
            setModalOpen(false);
            fetchUsuarios();
        } catch (e) {
            setError(e.response?.data?.error || 'Error al guardar');
        }
    };

    const eliminar = async (u) => {
        if (!window.confirm(`¿Eliminar al usuario "${u.username}"? Esta acción no se puede deshacer.`)) return;
        try {
            await api.delete(`/usuarios/${u.id}`);
            fetchUsuarios();
        } catch (e) {
            alert(e.response?.data?.error || 'Error al eliminar');
        }
    };

    const toggleActivo = async (u) => {
        try {
            await api.put(`/usuarios/${u.id}`, {
                username: u.username,
                nombre: u.nombre,
                rol: u.rol,
                activo: !u.activo
            });
            fetchUsuarios();
        } catch (e) {
            alert(e.response?.data?.error || 'Error al actualizar');
        }
    };

    // Obtener permisos para un rol
    const getPermisosRol = (rol) => {
        return Object.entries(permisosMap)
            .filter(([, roles]) => roles.includes(rol))
            .map(([seccion]) => seccion);
    };

    if (loading) return <p className="text-center text-muted py-4">Cargando...</p>;

    return (
        <div>
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <h1 className="fs-4 fw-semibold mb-0">Usuarios y Roles</h1>
                <button className="btn btn-falc btn-sm" onClick={() => abrirModal()}>Nuevo Usuario</button>
            </div>

            {/* Roles info */}
            <div className="card shadow-sm border-0 mb-3">
                <div className="card-body py-2 px-3">
                    <div className="small fw-semibold mb-2">Roles disponibles:</div>
                    <div className="row g-2">
                        {ROLES.map(r => (
                            <div key={r.value} className="col-6 col-md-3">
                                <div className="border rounded p-2 h-100">
                                    <div className="mb-1">{rolBadge(r.value)}</div>
                                    <small className="text-muted d-block">{r.desc}</small>
                                    <div className="mt-1">
                                        {getPermisosRol(r.value).map(p => (
                                            <span key={p} className="badge bg-light text-dark border me-1 mb-1" style={{ fontSize: '0.65rem' }}>
                                                {PERMISOS_LABELS[p] || p}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Users table - desktop */}
            <div className="card shadow-sm border-0 d-none d-md-block">
                <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 small">
                        <thead className="table-light">
                            <tr>
                                <th>ID</th>
                                <th>Usuario</th>
                                <th>Nombre</th>
                                <th>Rol</th>
                                <th className="text-center">Estado</th>
                                <th>Creado</th>
                                <th className="text-center">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usuarios.map(u => (
                                <tr key={u.id} className={!u.activo ? 'table-secondary' : ''}>
                                    <td className="fw-semibold">{u.id}</td>
                                    <td><code>{u.username}</code></td>
                                    <td>{u.nombre}</td>
                                    <td>{rolBadge(u.rol)}</td>
                                    <td className="text-center">
                                        {u.activo
                                            ? <span className="badge rounded-pill bg-success-subtle text-success">Activo</span>
                                            : <span className="badge rounded-pill bg-danger-subtle text-danger">Inactivo</span>}
                                    </td>
                                    <td><small className="text-muted">{new Date(u.fecha_creacion).toLocaleDateString('es-AR')}</small></td>
                                    <td className="text-center">
                                        <div className="d-flex gap-1 justify-content-center">
                                            <button className="btn btn-outline-primary btn-sm" title="Editar" onClick={() => abrirModal(u)}>✏️</button>
                                            <button className={`btn btn-sm ${u.activo ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                                title={u.activo ? 'Desactivar' : 'Activar'}
                                                onClick={() => toggleActivo(u)}
                                                disabled={u.id === admin?.id}>
                                                {u.activo ? '🔒' : '🔓'}
                                            </button>
                                            <button className="btn btn-outline-danger btn-sm" title="Eliminar"
                                                onClick={() => eliminar(u)}
                                                disabled={u.id === admin?.id}>🗑️</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Users cards - mobile */}
            <div className="d-md-none">
                <div className="row g-2">
                    {usuarios.map(u => (
                        <div key={u.id} className="col-12">
                            <div className={`card shadow-sm border-0 ${!u.activo ? 'opacity-50' : ''}`}>
                                <div className="card-body py-2 px-3">
                                    <div className="d-flex justify-content-between align-items-start mb-1">
                                        <div>
                                            <div className="fw-bold">{u.nombre}</div>
                                            <small className="text-muted"><code>{u.username}</code></small>
                                        </div>
                                        <div className="text-end">
                                            {rolBadge(u.rol)}
                                            <div className="mt-1">
                                                {u.activo
                                                    ? <span className="badge rounded-pill bg-success-subtle text-success" style={{ fontSize: '0.65rem' }}>Activo</span>
                                                    : <span className="badge rounded-pill bg-danger-subtle text-danger" style={{ fontSize: '0.65rem' }}>Inactivo</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="d-flex gap-1 mt-2">
                                        <button className="btn btn-outline-primary btn-sm flex-grow-1" onClick={() => abrirModal(u)}>✏️ Editar</button>
                                        <button className={`btn btn-sm ${u.activo ? 'btn-outline-warning' : 'btn-outline-success'}`}
                                            onClick={() => toggleActivo(u)} disabled={u.id === admin?.id}>
                                            {u.activo ? '🔒' : '🔓'}
                                        </button>
                                        <button className="btn btn-outline-danger btn-sm"
                                            onClick={() => eliminar(u)} disabled={u.id === admin?.id}>🗑️</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Modal Crear/Editar */}
            {modalOpen && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.5)' }} onClick={() => setModalOpen(false)}>
                    <div className="modal-dialog modal-dialog-centered" onClick={e => e.stopPropagation()}>
                        <div className="modal-content">
                            <div className="modal-header py-2">
                                <h5 className="modal-title fs-6">{editando ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}</h5>
                                <button className="btn-close" onClick={() => setModalOpen(false)} />
                            </div>
                            <div className="modal-body">
                                {error && <div className="alert alert-danger py-1 small">{error}</div>}

                                <div className="mb-2">
                                    <label className="form-label fw-semibold small mb-1">Username</label>
                                    <input className="form-control form-control-sm" value={form.username}
                                        onChange={e => setForm({ ...form, username: e.target.value })}
                                        placeholder="ej: jperez" autoComplete="off" />
                                </div>

                                <div className="mb-2">
                                    <label className="form-label fw-semibold small mb-1">Nombre completo</label>
                                    <input className="form-control form-control-sm" value={form.nombre}
                                        onChange={e => setForm({ ...form, nombre: e.target.value })}
                                        placeholder="ej: Juan Pérez" />
                                </div>

                                <div className="mb-2">
                                    <label className="form-label fw-semibold small mb-1">
                                        Contraseña {editando && <small className="text-muted fw-normal">(dejar vacío para no cambiar)</small>}
                                    </label>
                                    <input type="password" className="form-control form-control-sm" value={form.password}
                                        onChange={e => setForm({ ...form, password: e.target.value })}
                                        placeholder={editando ? '••••••••' : 'Contraseña segura'}
                                        autoComplete="new-password" />
                                </div>

                                <div className="mb-2">
                                    <label className="form-label fw-semibold small mb-1">Rol</label>
                                    <select className="form-select form-select-sm" value={form.rol}
                                        onChange={e => setForm({ ...form, rol: e.target.value })}>
                                        {ROLES.map(r => (
                                            <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Permisos preview */}
                                <div className="bg-light rounded p-2 mt-2 small">
                                    <div className="fw-semibold mb-1">Permisos del rol "{ROLES.find(r => r.value === form.rol)?.label}":</div>
                                    <div className="d-flex flex-wrap gap-1">
                                        {getPermisosRol(form.rol).map(p => (
                                            <span key={p} className="badge bg-white text-dark border">
                                                {PERMISOS_LABELS[p] || p}
                                            </span>
                                        ))}
                                        {getPermisosRol(form.rol).length === 0 && (
                                            <span className="text-muted">Cargando permisos...</span>
                                        )}
                                    </div>
                                </div>

                                {editando && (
                                    <div className="form-check form-switch mt-3">
                                        <input className="form-check-input" type="checkbox" checked={form.activo}
                                            onChange={e => setForm({ ...form, activo: e.target.checked })}
                                            disabled={editando.id === admin?.id} />
                                        <label className="form-check-label small">Usuario activo</label>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer py-1">
                                <button className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>Cancelar</button>
                                <button className="btn btn-falc btn-sm" onClick={guardar}>
                                    {editando ? '💾 Guardar Cambios' : '✓ Crear Usuario'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
