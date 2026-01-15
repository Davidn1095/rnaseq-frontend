type CompositionPlaceholderProps = {
  groupBy: "disease" | "accession";
  onGroupByChange: (next: "disease" | "accession") => void;
};

export default function CompositionPlaceholder({ groupBy, onGroupByChange }: CompositionPlaceholderProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Composition</div>
          <div className="muted small">Cell type composition overview</div>
        </div>
        <div className="field">
          <label className="muted small">Group by</label>
          <select
            className="select"
            value={groupBy}
            onChange={(event) => onGroupByChange(event.target.value as "disease" | "accession")}
          >
            <option value="disease">Disease</option>
            <option value="accession">Accession</option>
          </select>
        </div>
      </div>
      <svg className="placeholder-svg" viewBox="0 0 420 200" aria-hidden="true">
        <rect x="30" y="30" width="360" height="130" rx="12" fill="#f8fafc" stroke="#e2e8f0" />
        <rect x="60" y="90" width="40" height="50" fill="#93c5fd" />
        <rect x="120" y="70" width="40" height="70" fill="#60a5fa" />
        <rect x="180" y="50" width="40" height="90" fill="#3b82f6" />
        <rect x="240" y="80" width="40" height="60" fill="#93c5fd" />
      </svg>
    </div>
  );
}
