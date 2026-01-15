import type { Manifest } from "../lib/types";

type HeaderProps = {
  manifest: Manifest | null;
  onReload: () => void;
  onOpenSettings: () => void;
};

export default function Header({ manifest, onReload, onOpenSettings }: HeaderProps) {
  const tissueLabel = manifest?.tissue ?? "Loading…";

  return (
    <header className="header">
      <div>
        <div className="title">Autoimmune Atlas</div>
        <div className="muted">Dataset: {tissueLabel}</div>
      </div>
      <div className="header-actions">
        <button className="btn ghost" onClick={onReload}>Reload manifest</button>
        <button className="btn" onClick={onOpenSettings}>Settings</button>
      </div>
    </header>
  );
}
