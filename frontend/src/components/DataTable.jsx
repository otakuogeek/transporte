// src/components/DataTable.jsx - Tabla genérica reutilizable
export default function DataTable({ columns, data, onRowClick }) {
  return (
    <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f7f8fa' }}>
            {columns.map((col) => (
              <th key={col.key} style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: '#555', borderBottom: '2px solid #e0e0e0' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                No hay datos disponibles
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={row.id || i}
                onClick={() => onRowClick?.(row)}
                style={{ borderBottom: '1px solid #f0f0f0', cursor: onRowClick ? 'pointer' : 'default', transition: 'background 0.15s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f8f9ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {columns.map((col) => (
                  <td key={col.key} style={{ padding: '10px 16px' }}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
