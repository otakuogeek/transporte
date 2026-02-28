// src/components/StatusBadge.jsx - Badge de estado
const statusColors = {
  Pendiente: { bg: '#fff3e0', text: '#e65100' },
  Cotizando: { bg: '#e3f2fd', text: '#1565c0' },
  Adjudicada: { bg: '#e8f5e9', text: '#2e7d32' },
  Rechazada: { bg: '#ffebee', text: '#c62828' },
  Completada: { bg: '#e0f2f1', text: '#00695c' },
  Disponible: { bg: '#e8f5e9', text: '#2e7d32' },
  'En Viaje': { bg: '#e3f2fd', text: '#1565c0' },
  Inactivo: { bg: '#f5f5f5', text: '#616161' },
};

export default function StatusBadge({ status }) {
  const colors = statusColors[status] || { bg: '#f5f5f5', text: '#333' };
  return (
    <span style={{
      display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      background: colors.bg, color: colors.text,
    }}>
      {status}
    </span>
  );
}
