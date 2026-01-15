type OverlapPlaceholderProps = {
  leftDisease: string;
  rightDisease: string;
};

export default function OverlapPlaceholder({ leftDisease, rightDisease }: OverlapPlaceholderProps) {
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <div className="h3">Overlap</div>
          <div className="muted small">Shared signals between {leftDisease} and {rightDisease}</div>
        </div>
      </div>

      <div className="overlap-stats">
        <div className="stat">
          <div className="stat-label">Shared</div>
          <div className="stat-value">—</div>
        </div>
        <div className="stat">
          <div className="stat-label">Left-only</div>
          <div className="stat-value">—</div>
        </div>
        <div className="stat">
          <div className="stat-label">Right-only</div>
          <div className="stat-value">—</div>
        </div>
        <div className="stat">
          <div className="stat-label">Jaccard</div>
          <div className="stat-value">—</div>
        </div>
      </div>

      <svg className="placeholder-svg" viewBox="0 0 420 200" aria-hidden="true">
        <circle cx="170" cy="100" r="60" fill="#bfdbfe" opacity="0.7" />
        <circle cx="250" cy="100" r="60" fill="#93c5fd" opacity="0.7" />
        <text x="130" y="100" fill="#1e3a8a" fontSize="12">Left</text>
        <text x="270" y="100" fill="#1e3a8a" fontSize="12">Right</text>
      </svg>
    </div>
  );
}
