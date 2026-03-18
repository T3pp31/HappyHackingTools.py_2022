import React from "react";

interface DataTableProps<T> {
  columns: { key: keyof T; label: string }[];
  data: T[];
}

export function DataTable<T extends object>({
  columns,
  data,
}: DataTableProps<T>) {
  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  };

  const thStyle: React.CSSProperties = {
    textAlign: "left",
    padding: "10px 12px",
    borderBottom: "2px solid var(--border)",
    color: "var(--accent)",
    fontWeight: 600,
  };

  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    color: "var(--text-primary)",
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={String(col.key)} style={thStyle}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              style={{
                backgroundColor: i % 2 === 0 ? "transparent" : "var(--bg-tertiary)",
              }}
            >
              {columns.map((col) => (
                <td key={String(col.key)} style={tdStyle}>
                  {String((row as Record<string, unknown>)[col.key as string] ?? "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
