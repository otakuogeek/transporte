// src/pages/TerminosServicio.jsx
import PublicLayout from '../components/PublicLayout';

const cardStyle = {
  background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
  boxShadow: '0 2px 8px rgba(16,24,40,.05)', padding: '32px 28px', marginBottom: 20,
};
const h2Style = { fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 10 };
const pStyle = { fontSize: 14.5, lineHeight: 1.75, color: '#374151', margin: '0 0 10px' };

export default function TerminosServicio() {
  return (
    <PublicLayout
      titulo="Términos del Servicio"
      subtitulo="Condiciones que regulan el uso de la plataforma FALC Logística y su canal de WhatsApp."
      icono="📄"
    >
      <div style={{ marginTop: -8 }}>

        <p style={{ ...pStyle, marginBottom: 24, color: '#6b7280', fontSize: 13 }}>
          Última actualización: 13 de marzo de 2026 — Al utilizar FALC, aceptas estos términos.
        </p>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>🏢</span> 1. Descripción del servicio</h2>
          <p style={pStyle}>
            FALC es una plataforma web de gestión logística de transporte de carga que permite:
          </p>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li>Crear y gestionar tickets de transporte con flujo de estados completo.</li>
            <li>Asignar empresas de transporte y coordinar aceptaciones/rechazos.</li>
            <li>Automatizar comunicaciones operativas por WhatsApp con clientes y transportistas.</li>
            <li>Registrar vehículos (placa y conductor) y confirmar datos al cliente.</li>
            <li>Visualizar un dashboard analítico con KPIs, rendimiento y liquidaciones.</li>
          </ul>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>✅</span> 2. Aceptación de los términos</h2>
          <p style={pStyle}>
            Al acceder al panel de administración, utilizar la API o interactuar con el bot de WhatsApp,
            aceptas estos términos y nuestra <a href="/politica-privacidad" style={{ color: '#2356a8' }}>Política de Privacidad</a>.
            Si no estás de acuerdo, debes abstenerte de usar el servicio.
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>👤</span> 3. Cuentas y acceso</h2>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li>Cada usuario del panel requiere credenciales propias otorgadas por un administrador.</li>
            <li>Eres responsable de mantener la confidencialidad de tu contraseña.</li>
            <li>Las sesiones expiran automáticamente tras 24 horas de inactividad.</li>
            <li>El acceso está regulado por un sistema de permisos por rol.</li>
          </ul>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>🚚</span> 4. Uso permitido</h2>
          <p style={pStyle}>El servicio debe utilizarse exclusivamente para:</p>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li>Operaciones legítimas de logística y transporte de carga.</li>
            <li>Comunicación operativa con clientes y empresas de transporte.</li>
            <li>Gestión administrativa autorizada por los responsables del sistema.</li>
          </ul>
          <p style={pStyle}>
            <strong>Queda prohibido:</strong> usar el sistema para actividades fraudulentas, enviar spam
            por WhatsApp, intentar acceso no autorizado, o proporcionar datos falsos.
          </p>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>💬</span> 5. Bot de WhatsApp</h2>
          <p style={pStyle}>
            El bot conversacional de FALC opera como asistente virtual automatizado. Al interactuar con él:
          </p>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li>Tus mensajes se procesan para extraer información operativa (origen, destino, fecha, etc.).</li>
            <li>Los mensajes se registran en nuestros logs para auditoría y mejora del servicio.</li>
            <li>Un operador humano puede intervenir en cualquier momento pausando el bot.</li>
            <li>El bot solo responde a mensajes individuales; no opera en grupos.</li>
          </ul>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>⚖️</span> 6. Limitación de responsabilidad</h2>
          <p style={pStyle}>
            FALC actúa como herramienta de apoyo operativo y coordinación. No somos responsables de:
          </p>
          <ul style={{ ...pStyle, paddingLeft: 20 }}>
            <li>El cumplimiento de los transportes asignados (responsabilidad de la empresa de transporte).</li>
            <li>Pérdidas derivadas de datos incorrectos proporcionados por los usuarios.</li>
            <li>Interrupciones temporales del servicio por mantenimiento o fuerza mayor.</li>
            <li>Acciones de terceros (Meta/WhatsApp, proveedores de IA).</li>
          </ul>
        </div>

        <div style={cardStyle}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>🔄</span> 7. Modificaciones</h2>
          <p style={pStyle}>
            Nos reservamos el derecho de actualizar estos términos para mejorar el servicio o cumplir con
            requisitos legales. Los cambios se publicarán en esta misma página con la nueva fecha de actualización.
          </p>
        </div>

        <div style={{ ...cardStyle, background: '#f0f4ff', borderColor: '#c7d9f5' }}>
          <h2 style={h2Style}><span style={{ fontSize: 20 }}>📧</span> 8. Contacto</h2>
          <p style={pStyle}>
            Para consultas sobre estos términos, escríbenos a:
          </p>
          <p style={{ ...pStyle, fontWeight: 600, fontSize: 16, color: '#2356a8' }}>
            otakuogeek@gmail.com
          </p>
        </div>

      </div>
    </PublicLayout>
  );
}
