// src/pages/EliminacionDatos.jsx
import PublicLayout from '../components/PublicLayout';

const cardStyle = {
  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
  boxShadow: '0 2px 8px rgba(16,24,40,.05)', padding: '32px 28px', marginBottom: 20,
};
const h2Style = { fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 };
const pStyle = { fontSize: 14.5, lineHeight: 1.75, color: '#374151', margin: '0 0 10px' };

const pasos = [
  { num: 1, titulo: 'Envia un correo electronico', desc: 'Escribe a otakuogeek@gmail.com con el asunto "Eliminacion de datos".', icono: '\u2709\ufe0f' },
  { num: 2, titulo: 'Identificate', desc: 'Incluye en el correo tu nombre, numero de telefono registrado y el tipo de cuenta (cliente, transporte u operador).', icono: '🪪' },
  { num: 3, titulo: 'Verificacion de identidad', desc: 'Validaremos tu identidad para proteger tus datos. Podremos solicitarte informacion adicional.', icono: '🔍' },
  { num: 4, titulo: 'Procesamiento', desc: 'Una vez verificada tu identidad, eliminaremos o anonimizaremos tus datos en un plazo maximo de 15 dias habiles.', icono: '\u2699\ufe0f' },
  { num: 5, titulo: 'Confirmacion', desc: 'Te enviaremos un correo confirmando que la eliminacion fue completada.', icono: '\u2705' },
];

export default function EliminacionDatos() {
  return (
    <PublicLayout
      titulo="Eliminacion de Datos"
      subtitulo="Instrucciones para solicitar la eliminacion de tus datos personales del sistema FALC."
      icono={<span role="img" aria-label="eliminar">{'🗑\ufe0f'}</span>}
    >
      <div style={{ marginTop: -8 }}>

        <p style={{ ...pStyle, marginBottom: 24, color: '#6b7280', fontSize: 13 }}>
          Ultima actualizacion: 13 de marzo de 2026 — En cumplimiento con las politicas de Meta y normativas de proteccion de datos.
        </p>

        {/* Pasos visuales */}
        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>{'📝'}</span> Como solicitar la eliminacion</h2>
          <p style={pStyle}>Sigue estos pasos para solicitar que eliminemos tus datos del sistema:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 16 }}>
            {pasos.map((p, i) => (
              <div key={p.num} style={{ display: 'flex', gap: 16, position: 'relative', paddingBottom: i < pasos.length - 1 ? 24 : 0 }}>
                {i < pasos.length - 1 && (
                  <div style={{ position: 'absolute', left: 21, top: 44, bottom: 0, width: 2, background: '#e5e7eb' }} />
                )}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', background: '#eef4ff', border: '2px solid #c7d9f5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0, zIndex: 1,
                }}>
                  {p.icono}
                </div>
                <div style={{ paddingTop: 4 }}>
                  <strong style={{ fontSize: 15, color: '#1a1a2e' }}>Paso {p.num}: {p.titulo}</strong>
                  <p style={{ ...pStyle, margin: '4px 0 0', fontSize: 14 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Datos que se eliminan */}
        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>{'📦'}</span> Datos que se eliminan</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 8 }}>
            {[
              { dato: 'Datos personales', detalle: 'Nombre, telefono, documento', color: '#10b981' },
              { dato: 'Mensajes de WhatsApp', detalle: 'Historial de conversaciones', color: '#2356a8' },
              { dato: 'Tickets asociados', detalle: 'Solicitudes de transporte', color: '#f59e0b' },
              { dato: 'Credenciales', detalle: 'Usuario y contrasena cifrada', color: '#ef4444' },
            ].map(d => (
              <div key={d.dato} style={{ background: '#f8fafc', borderRadius: 10, padding: '14px 16px', border: '1px solid #e5e7eb', borderLeft: '4px solid ' + d.color }}>
                <strong style={{ fontSize: 13.5, color: '#1a1a2e' }}>{d.dato}</strong>
                <p style={{ fontSize: 12.5, color: '#6b7280', margin: '2px 0 0' }}>{d.detalle}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Excepciones */}
        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>{'\u26a0\ufe0f'}</span> Excepciones</h2>
          <p style={pStyle}>
            Podemos conservar ciertos datos cuando exista una obligacion legal, como:
          </p>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li>Registros contables o tributarios exigidos por ley.</li>
            <li>Datos necesarios para resolver disputas pendientes.</li>
            <li>Logs de auditoria anonimizados (sin informacion personal identificable).</li>
          </ul>
        </div>

        {/* Plazos */}
        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>{'\u23f1\ufe0f'}</span> Plazos</h2>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
            {[
              { label: 'Acuse de recibo', plazo: '2 dias habiles', bg: '#eef4ff' },
              { label: 'Verificacion', plazo: '3-5 dias habiles', bg: '#fef3cd' },
              { label: 'Eliminacion completa', plazo: 'Max. 15 dias habiles', bg: '#d1fae5' },
            ].map(t => (
              <div key={t.label} style={{ flex: '1 1 160px', textAlign: 'center', background: t.bg, borderRadius: 10, padding: '16px 12px' }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a2e' }}>{t.plazo}</div>
                <div style={{ fontSize: 12.5, color: '#6b7280', marginTop: 4 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #0f3460, #1a1a2e)', color: '#fff', textAlign: 'center', padding: '40px 28px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{'📧'}</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: '#fff' }}>Listo para solicitar?</h2>
          <p style={{ fontSize: 14.5, opacity: 0.8, margin: '0 0 20px', lineHeight: 1.6 }}>
            Envia tu solicitud de eliminacion a nuestro correo con el asunto &quot;Eliminacion de datos&quot;.
          </p>
          <a
            href="mailto:otakuogeek@gmail.com?subject=Eliminaci%C3%B3n%20de%20datos"
            style={{
              display: 'inline-block', background: '#fff', color: '#2356a8', fontWeight: 700,
              padding: '12px 28px', borderRadius: 10, textDecoration: 'none', fontSize: 15,
            }}
          >
            otakuogeek@gmail.com
          </a>
        </div>

      </div>
    </PublicLayout>
  );
}
