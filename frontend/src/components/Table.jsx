export function Pill({ status }) {
  return <span className={`pill ${status}`}>{status.charAt(0) + status.slice(1).toLowerCase()}</span>;
}

export function Table({ heads, rows, empty }) {
  if (!rows.length) return <div className="table empty">{empty}</div>;
  return (
    <div className="table">
      <table>
        <thead><tr>{heads.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
