// src/components/StatCard.jsx - Tarjeta de estadística con Bootstrap
export default function StatCard({ icon, label, value, color = '#1a1a2e' }) {
  return (
    <div className="card shadow-sm h-100" style={{ borderLeft: `4px solid ${color}` }}>
      <div className="card-body d-flex align-items-center gap-3 py-3">
        <span style={{ fontSize: 32 }}>{icon}</span>
        <div>
          <div className="fw-bold fs-4" style={{ color }}>{value}</div>
          <div className="text-muted small">{label}</div>
        </div>
      </div>
    </div>
  );
}
