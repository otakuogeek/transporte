// src/components/StatusBadge.jsx - Badge de estado con Bootstrap
const statusMap = {
  Pendiente:   'bg-warning-subtle text-warning',
  Cotizando:   'bg-primary-subtle text-primary',
  Adjudicada:  'bg-success-subtle text-success',
  Rechazada:   'bg-danger-subtle text-danger',
  Completada:  'bg-info-subtle text-info',
  Disponible:  'bg-success-subtle text-success',
  'En Viaje':  'bg-primary-subtle text-primary',
  Inactivo:    'bg-secondary-subtle text-secondary',
};

export default function StatusBadge({ status }) {
  const cls = statusMap[status] || 'bg-secondary-subtle text-secondary';
  return <span className={`badge rounded-pill ${cls}`}>{status}</span>;
}
