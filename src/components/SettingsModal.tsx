import { useEffect, useState } from "react";

type SettingsModalProps = {
  isOpen: boolean;
  apiBase: string;
  defaultApiBase: string;
  onClose: () => void;
  onSave: (nextBase: string) => void;
  onReset: () => void;
};

export default function SettingsModal({
  isOpen,
  apiBase,
  defaultApiBase,
  onClose,
  onSave,
  onReset,
}: SettingsModalProps) {
  const [draft, setDraft] = useState(apiBase);

  useEffect(() => {
    if (isOpen) {
      setDraft(apiBase);
    }
  }, [isOpen, apiBase]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="row between">
          <div>
            <div className="h2">Settings</div>
            <div className="muted small">Override the API base URL for this session.</div>
          </div>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <div className="field top">
          <label className="muted small">API base URL</label>
          <input
            className="input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={defaultApiBase}
          />
          <div className="muted small">Default: {defaultApiBase}</div>
        </div>

        <div className="row gap top">
          <button
            className="btn"
            onClick={() => onSave(draft.trim())}
            disabled={draft.trim().length === 0}
          >
            Save
          </button>
          <button className="btn ghost" onClick={onReset}>Reset to default</button>
        </div>
      </div>
    </div>
  );
}
