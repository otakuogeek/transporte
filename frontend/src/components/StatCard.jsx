// src/components/StatCard.jsx - Tarjeta de estadística
export default function StatCard({ icon, label, value, color = '#1a1a2e' }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, padding: '20px 24px', minWidth: 180,
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: 16,
      borderLeft: `4px solid ${color}`,
    }}>
      <span style={{ fontSize: 32 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
        <div style={{ fontSize: 13, color: '#888' }}>{label}</div>
      </div>
    </div>
  );
}
