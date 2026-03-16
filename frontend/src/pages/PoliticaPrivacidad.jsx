// src/pages/PoliticaPrivacidad.jsx — Política de privacidad pública
import PublicLayout from '../components/PublicLayout';

const cardStyle = {
  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
  boxShadow: '0 2px 8px rgba(16,24,40,.05)', padding: '32px 28px', marginBottom: 20,
};
const h2Style = { fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 };
const pStyle = { fontSize: 14.5, lineHeight: 1.75, color: '#374151', margin: '0 0 10px' };

export default function PoliticaPrivacidad() {
  return (
    <PublicLayout
      titulo="Política de Privacidad"
      subtitulo="Conoce cómo recopilamos, usamos y protegemos tu información personal en FALC Logística."
      icono="🔒"
    >
      <div style={{ marginTop: -8 }}>

        <p style={{ ...pStyle, marginBottom: 24, color: '#6b7280', fontSize: 13 }}>
          Última actualización: 13 de marzo de 2026 — Vigencia: mientras el servicio esté activo.
        </p>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>📋</span> 1. Información que recopilamos</h2>
          <p style={pStyle}>
            Para prestar nuestro servicio de coordinación logística y automatización por WhatsApp, podemos recopilar:
          </p>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li><strong>Datos de identificación:</strong> nombre, razón social, NIT/documento y datos de contacto.</li>
            <li><strong>Números de teléfono:</strong> necesarios para la comunicación operativa por WhatsApp.</li>
            <li><strong>Mensajes de WhatsApp:</strong> contenido de las conversaciones operativas (solicitudes, cotizaciones, confirmaciones).</li>
            <li><strong>Datos operativos:</strong> tickets, asignaciones, placas, conductores, rutas de origen/destino y fechas de carga.</li>
            <li><strong>Datos de acceso:</strong> nombre de usuario y contraseña cifrada para el panel de administración.</li>
          </ul>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>🎯</span> 2. Finalidad del tratamiento</h2>
          <p style={pStyle}>Utilizamos los datos recopilados para:</p>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li>Operar y coordinar servicios de transporte de carga entre clientes y empresas de transporte.</li>
            <li>Enviar y recibir mensajes automáticos de estado (asignaciones, confirmaciones, datos de vehículo).</li>
            <li>Generar estadísticas operativas internas (dashboard, rendimiento, liquidaciones).</li>
            <li>Mejorar la calidad del servicio y la precisión del bot conversacional.</li>
          </ul>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>🤝</span> 3. Compartición de datos</h2>
          <p style={pStyle}>
            <strong>No vendemos ni alquilamos datos personales a terceros.</strong> Compartimos información únicamente con:
          </p>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li>Empresas de transporte asignadas a tus tickets, para la coordinación del servicio.</li>
            <li>Clientes que contrataron el servicio, al confirmar datos de vehículo y conductor.</li>
            <li>Proveedores tecnológicos necesarios (WhatsApp/Meta para mensajería, OpenAI para procesamiento de lenguaje natural).</li>
          </ul>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>🛡️</span> 4. Seguridad y conservación</h2>
          <p style={pStyle}>
            Implementamos medidas técnicas razonables: cifrado de contraseñas, tokens de sesión con expiración,
            queries parametrizadas contra inyección SQL y rate limiting en la API. Los datos se conservan mientras
            sean necesarios para el servicio o según lo exija la legislación vigente.
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>✅</span> 5. Derechos del usuario</h2>
          <p style={pStyle}>
            Como titular de tus datos, puedes ejercer en cualquier momento el derecho de:
          </p>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li><strong>Acceso:</strong> solicitar una copia de los datos que tenemos sobre ti.</li>
            <li><strong>Rectificación:</strong> corregir información inexacta o desactualizada.</li>
            <li><strong>Eliminación:</strong> pedir que eliminemos tus datos personales (ver <a href="/eliminacion-datos" style={{ color: '#2356a8' }}>instrucciones de eliminación</a>).</li>
            <li><strong>Oposición:</strong> solicitar que dejemos de procesar ciertos datos.</li>
          </ul>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>🌐</span> 6. Servicios de terceros</h2>
          <p style={pStyle}>FALC utiliza los siguientes servicios de terceros que pueden procesar datos:</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            {[
              { nombre: 'WhatsApp (Meta)', uso: 'Envío y recepción de mensajes' },
              { nombre: 'OpenAI', uso: 'Procesamiento de lenguaje natural' },
            ].map(s => (
              <div key={s.nombre} style={{ flex: '1 1 220px', background: '#f8fafc', borderRadius: 10, padding: '12px 16px', border: '1px solid #e5e7eb' }}>
                <strong style={{ fontSize: 13, color: '#1a1a2e' }}>{s.nombre}</strong>
                <p style={{ fontSize: 12.5, color: '#6b7280', margin: '4px 0 0' }}>{s.uso}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={{ ...cardStyle, background: '#f0f4ff', borderColor: '#c7d9f5' }}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>📧</span> 7. Contacto</h2>
          <p style={pStyle}>
            Para consultas sobre esta política o ejercer tus derechos, escríbenos a:
          </p>
          <p style={{ ...pStyle, fontWeight: 600, fontSize: 16, color: '#2356a8' }}>
            otakuogeek@gmail.com
          </p>
          <p style={{ ...pStyle, fontSize: 13, color: '#6b7280' }}>
            Nos comprometemos a responder en un plazo de 15 días hábiles.
          </p>
        </div>

      </div>
    </PublicLayout>
  );
}
