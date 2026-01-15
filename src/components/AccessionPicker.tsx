import type { Accession } from "../lib/types";

type AccessionPickerProps = {
  title: string;
  description?: string;
  accessions: Accession[];
  selected: string[];
  onChange: (next: string[]) => void;
  isLoading?: boolean;
};

export default function AccessionPicker({
  title,
  description,
  accessions,
  selected,
  onChange,
  isLoading = false,
}: AccessionPickerProps) {
  const ids = accessions.map((row) => row.id);
  const allChecked = ids.length > 0 && ids.every((id) => selected.includes(id));

  if (isLoading) {
    return (
      <div className="card sub">
        <div className="row between">
          <div>
            <div className="h3">{title}</div>
            {description ? <div className="muted small">{description}</div> : null}
          </div>
        </div>
        <div className="skeleton list" />
      </div>
    );
  }

  return (
    <div className="card sub">
      <div className="row between">
        <div>
          <div className="h3">{title}</div>
          {description ? <div className="muted small">{description}</div> : null}
        </div>
        <button
          className="btn ghost"
          onClick={() => onChange(allChecked ? [] : ids)}
          disabled={ids.length === 0}
        >
          {allChecked ? "Clear" : "Select all"}
        </button>
      </div>

      {ids.length === 0 ? (
        <div className="empty">No accessions available.</div>
      ) : (
        <div className="list">
          {accessions.map((row) => {
            const checked = selected.includes(row.id);
            return (
              <label key={row.id} className="item">
                <span className="row gap">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onChange([...selected, row.id]);
                      } else {
                        onChange(selected.filter((id) => id !== row.id));
                      }
                    }}
                  />
                  <span className="mono">{row.id}</span>
                </span>
                <span className="muted small">{row.platform} · {row.donors} donors · {row.cells.toLocaleString()} cells</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
