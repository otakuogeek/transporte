// src/components/DataTable.jsx - Tabla genérica reutilizable con Bootstrap
export default function DataTable({ columns, data, onRowClick }) {
  const renderValue = (col, row) => (col.render ? col.render(row[col.key], row) : row[col.key]);
  const titleColumn = columns.find((c) => c.cardTitle) || columns[0];
  const actionColumn = columns.find((c) => c.key === 'acciones' || c.isAction);
  const detailColumns = columns.filter((c) => c.key !== titleColumn?.key && c.key !== actionColumn?.key && !c.hideOnMobileCard);

  return (
    <>
      <div className="card shadow-sm d-none d-md-block">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr>
                {columns.map((col) => (
                  <th key={col.key} className="small fw-semibold text-muted">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center text-muted py-4">
                    No hay datos disponibles
                  </td>
                </tr>
              ) : (
                data.map((row, i) => (
                  <tr key={row.id || i} onClick={() => onRowClick?.(row)}
                    style={{ cursor: onRowClick ? 'pointer' : 'default' }}>
                    {columns.map((col) => (
                      <td key={col.key}>
                        {renderValue(col, row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="d-md-none">
        {data.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body text-center text-muted py-4">No hay datos disponibles</div>
          </div>
        ) : (
          <div className="row g-2">
            {data.map((row, i) => (
              <div key={row.id || i} className="col-12">
                <div
                  className="card shadow-sm h-100"
                  onClick={() => onRowClick?.(row)}
                  style={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  <div className="card-body p-3">
                    {titleColumn && (
                      <div className="fw-semibold mb-2" style={{ fontSize: 15 }}>
                        {renderValue(titleColumn, row)}
                      </div>
                    )}

                    <div className="d-flex flex-column gap-1">
                      {detailColumns.map((col) => (
                        <div key={col.key} className="d-flex justify-content-between gap-2">
                          <span className="small text-muted">{col.label}</span>
                          <span className="small text-end">{renderValue(col, row) ?? '—'}</span>
                        </div>
                      ))}
                    </div>

                    {actionColumn && (
                      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                        {renderValue(actionColumn, row)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
