// src/pages/Clientes.jsx
import { useState, useEffect } from 'react';
import api from '../api/client';
import DataTable from '../components/DataTable';

const emptyForm = () => ({ nombre: '', apellidos: '', telefonos: [''], origen_default: '', email: '' });

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());

  useEffect(() => { loadClientes(); }, []);

  async function loadClientes() {
    try {
      const res = await api.get('/clientes');
      setClientes(res.data);
    } catch (err) {
      console.error('Error cargando clientes:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleNuevo() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function handleEdit(row) {
    setEditing(row);
    const telefonos = Array.isArray(row.telefonos) && row.telefonos.length > 0
      ? row.telefonos
      : (row.telefono_whatsapp ? [row.telefono_whatsapp] : ['']);
    setForm({
      nombre: row.nombre || '',
      apellidos: row.apellidos || '',
      telefonos,
      origen_default: row.origen_default || '',
      email: row.email || '',
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      nombre: form.nombre,
      apellidos: form.apellidos,
      telefonos: form.telefonos.filter(t => t.trim() !== ''),
      origen_default: form.origen_default,
      email: form.email,
    };
    try {
      if (editing) {
        await api.put(`/clientes/${editing.id}`, payload);
      } else {
        await api.post('/clientes', payload);
      }
      setShowForm(false);
      setEditing(null);
      setForm(emptyForm());
      loadClientes();
    } catch (err) {
      alert(err.response?.data?.error || 'Error guardando cliente');
    }
  }

  async function handleDelete(id) {
    const cliente = clientes.find(c => c.id === id);
    if (!confirm(`¿Eliminar al cliente "${cliente?.nombre || id}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/clientes/${id}`);
      loadClientes();
    } catch (err) {
      const msg = err.response?.data?.error || 'Error eliminando cliente';
      alert(msg);
    }
  }

  // Helpers for multi-phone input
  function setTelefono(index, value) {
    const arr = [...form.telefonos];
    arr[index] = value;
    setForm({ ...form, telefonos: arr });
  }

  function addTelefono() {
    setForm({ ...form, telefonos: [...form.telefonos, ''] });
  }

  function removeTelefono(index) {
    const arr = form.telefonos.filter((_, i) => i !== index);
    setForm({ ...form, telefonos: arr.length > 0 ? arr : [''] });
  }

  const inputStyle = { width: '100%', padding: 8, border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box', fontSize: 14 };
  const labelStyle = { display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#333' };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Cargando...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 22, color: '#1a1a2e' }}>👥 Clientes</h1>
        <button onClick={handleNuevo}
          style={{ background: '#e94560', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
          + Nuevo Cliente
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 10, padding: 24, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 16, color: '#1a1a2e' }}>{editing ? 'Editar Cliente' : 'Nuevo Cliente'}</h3>
          <form onSubmit={handleSubmit}>
            {/* Fila 1: Nombre + Apellidos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Nombre *</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required
                  placeholder="Ej: Carlos" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Apellidos *</label>
                <input value={form.apellidos} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} required
                  placeholder="Ej: Ramírez Gómez" style={inputStyle} />
              </div>
            </div>

            {/* Fila 2: WhatsApp multi */}
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Números WhatsApp *</label>
              {form.telefonos.map((tel, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={tel} onChange={(e) => setTelefono(idx, e.target.value)}
                    required={idx === 0} placeholder="Ej: 573001234567"
                    style={{ ...inputStyle, flex: 1 }} />
                  {form.telefonos.length > 1 && (
                    <button type="button" onClick={() => removeTelefono(idx)}
                      title="Quitar número"
                      style={{ background: '#c62828', color: '#fff', border: 'none', borderRadius: 4, padding: '0 12px', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addTelefono}
                style={{ background: 'none', border: '1px dashed #aaa', color: '#555', padding: '6px 14px', borderRadius: 4, cursor: 'pointer', fontSize: 13, marginTop: 2 }}>
                + Agregar número
              </button>
            </div>

            {/* Fila 3: Finca/Origen + Email */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Finca / Origen</label>
                <input value={form.origen_default} onChange={(e) => setForm({ ...form, origen_default: e.target.value })}
                  placeholder="Ej: Finca La Aurora" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Correo electrónico</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="Ej: cliente@correo.com" style={inputStyle} />
              </div>
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit"
                style={{ background: '#4caf50', color: '#fff', border: 'none', padding: '9px 22px', borderRadius: 5, cursor: 'pointer', fontWeight: 600 }}>
                Guardar
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ background: '#999', color: '#fff', border: 'none', padding: '9px 22px', borderRadius: 5, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <DataTable
        columns={[
          { key: 'id', label: '#' },
          {
            key: 'nombre', label: 'Nombre',
            render: (v, row) => <span style={{ fontWeight: 500 }}>{v} {row.apellidos || ''}</span>,
          },
          {
            key: 'telefonos', label: 'WhatsApp',
            render: (v, row) => {
              const nums = Array.isArray(v) && v.length > 0 ? v : (row.telefono_whatsapp ? [row.telefono_whatsapp] : []);
              if (nums.length === 0) return <span style={{ color: '#999' }}>—</span>;
              return (
                <span>
                  {nums[0]}
                  {nums.length > 1 && (
                    <span style={{ marginLeft: 6, background: '#e94560', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 600 }}>
                      +{nums.length - 1}
                    </span>
                  )}
                </span>
              );
            },
          },
          { key: 'origen_default', label: 'Finca/Origen', render: (v) => v || <span style={{ color: '#999' }}>—</span> },
          { key: 'email', label: 'Email', render: (v) => v || <span style={{ color: '#999' }}>—</span> },
          { key: 'total_solicitudes', label: 'Solicitudes' },
          { key: 'fecha_registro', label: 'Registro', render: (v) => new Date(v).toLocaleDateString('es-PE') },
          {
            key: 'acciones', label: 'Acciones', render: (_, row) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }}
                  style={{ background: '#1565c0', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Editar</button>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }}
                  style={{ background: '#c62828', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Eliminar</button>
              </div>
            ),
          },
        ]}
        data={clientes}
      />
    </div>
  );
}
