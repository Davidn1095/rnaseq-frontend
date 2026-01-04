import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * RNA-seq Pipeline UI (frontend-only shell)
 * - No external UI libraries
 * - Works on a fresh Vite + React + TS template
 * - Can optionally call a backend if you set an API base URL in the UI
 */

type PhaseKey =
  | "upload"
  | "quality_control"
  | "normalization"
  | "batch_correction"
  | "clustering"
  | "export";

type Phase = {
  key: PhaseKey;
  title: string;
  subtitle: string;
};

type StepStatus = "idle" | "running" | "done" | "error";

type RunResult = {
  ok: boolean;
  message: string;
  payload?: unknown;
};

const PHASES: Phase[] = [
  {
    key: "upload",
    title: "Upload",
    subtitle: "Load counts matrix, CSV or TSV",
  },
  {
    key: "quality_control",
    title: "Quality control",
    subtitle: "Basic checks, missing values, filtering",
  },
  {
    key: "normalization",
    title: "Normalization",
    subtitle: "Log-normalization, scaling, or SCTransform-like",
  },
  {
    key: "batch_correction",
    title: "Harmony batch correction",
    subtitle: "Remove batch effects using Harmony",
  },
  {
    key: "clustering",
    title: "Clustering",
    subtitle: "Reduce dimensions, cluster, annotate",
  },
  {
    key: "export",
    title: "Export",
    subtitle: "Download results and reports",
  },
];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function prettyBytes(n: number) {
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

/**
 * Optional backend calling strategy
 * - If apiBase is empty, we simulate a run and return ok
 * - If apiBase is set, we POST to `${apiBase}${path}` with JSON by default
 * - For upload-like calls, use FormData
 */
async function runWithBackend(opts: {
  apiBase: string;
  path: string;
  method?: "GET" | "POST";
  json?: any;
  form?: FormData;
  timeoutMs?: number;
}): Promise<RunResult> {
  const { apiBase, path, method = "POST", json, form, timeoutMs = 120000 } = opts;

  if (!apiBase.trim()) {
    // Simulated run for UI-only usage
    await sleep(600 + Math.random() * 900);
    return { ok: true, message: "Completed (simulated). No API base URL set." };
  }

  const url = `${apiBase.replace(/\/+$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;

  const controller = new AbortController();
  const t = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: form ? undefined : { "Content-Type": "application/json" },
      body: form ? form : json ? JSON.stringify(json) : undefined,
      signal: controller.signal,
    });

    const data = await safeJson(res);
    if (!res.ok) {
      return {
        ok: false,
        message: `API error ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`,
        payload: data,
      };
    }

    return { ok: true, message: "Completed (API).", payload: data };
  } catch (e: any) {
    const msg =
      e?.name === "AbortError"
        ? "Request timed out."
        : e?.message
        ? e.message
        : "Network error.";
    return { ok: false, message: msg };
  } finally {
    window.clearTimeout(t);
  }
}

function StatusPill({ status }: { status: StepStatus }) {
  const label =
    status === "idle" ? "Idle" : status === "running" ? "Running" : status === "done" ? "Done" : "Error";
  const cls =
    status === "idle"
      ? "pill pill-idle"
      : status === "running"
      ? "pill pill-running"
      : status === "done"
      ? "pill pill-done"
      : "pill pill-error";
  return <span className={cls}>{label}</span>;
}

function Divider() {
  return <div className="divider" />;
}

export default function App() {
  const [phaseIndex, setPhaseIndex] = useState<number>(0);

  const [apiBase, setApiBase] = useState<string>(() => {
    // If you later add a Vite env var, it will auto-load.
    // Example: VITE_API_BASE_URL=https://your-backend.run.app
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = (import.meta as any)?.env?.VITE_API_BASE_URL;
    return typeof v === "string" ? v : "";
  });

  const [file, setFile] = useState<File | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; rows?: number; cols?: number } | null>(
    null
  );

  const [uploaded, setUploaded] = useState<boolean>(false);

  const [qcStatus, setQcStatus] = useState<StepStatus>("idle");
  const [normStatus, setNormStatus] = useState<StepStatus>("idle");
  const [harmStatus, setHarmStatus] = useState<StepStatus>("idle");
  const [clusStatus, setClusStatus] = useState<StepStatus>("idle");
  const [exportStatus, setExportStatus] = useState<StepStatus>("idle");

  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement | null>(null);

  const canRunQC = uploaded && qcStatus !== "running";
  const canRunNorm = qcStatus === "done" && normStatus !== "running";
  const canRunHarmony = normStatus === "done" && harmStatus !== "running";
  const canRunClustering = harmStatus === "done" && clusStatus !== "running";
  const canExport = clusStatus === "done" && exportStatus !== "running";

  const currentPhase = useMemo(() => PHASES[clamp(phaseIndex, 0, PHASES.length - 1)], [phaseIndex]);

  function log(line: string) {
    setLogLines((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);
  }

  useEffect(() => {
    if (!logRef.current) return;
    logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logLines]);

  async function parseQuickMatrixInfo(f: File) {
    // Lightweight heuristic: read a slice and estimate rows/cols
    const maxBytes = 256 * 1024;
    const blob = f.slice(0, maxBytes);
    const text = await blob.text();
    const lines = text.split(/\r?\n/).filter((x) => x.trim().length > 0);
    if (lines.length === 0) return { rows: undefined, cols: undefined };

    const sep = lines[0].includes("\t") ? "\t" : ",";
    const first = lines[0].split(sep);
    const cols = Math.max(0, first.length - 1); // assume first col is gene id
    // estimate rows by counting lines in slice minus header
    const rows = Math.max(0, lines.length - 1);

    return { rows, cols };
  }

  async function onChooseFile(f: File | null) {
    setFile(f);
    setUploaded(false);

    setQcStatus("idle");
    setNormStatus("idle");
    setHarmStatus("idle");
    setClusStatus("idle");
    setExportStatus("idle");

    setLogLines([]);

    if (!f) {
      setFileInfo(null);
      return;
    }

    log(`Selected file: ${f.name} (${prettyBytes(f.size)})`);
    const meta = await parseQuickMatrixInfo(f).catch(() => ({ rows: undefined, cols: undefined }));
    setFileInfo({ name: f.name, size: f.size, rows: meta.rows, cols: meta.cols });
  }

  async function doUpload() {
    if (!file) return;

    log("Uploading input…");
    // If your backend supports upload, set apiBase and implement /upload on backend.
    // Otherwise, we consider "uploaded" as a local UI state.
    const form = new FormData();
    form.append("file", file);

    const res = await runWithBackend({ apiBase, path: "/upload", form });
    if (res.ok) {
      setUploaded(true);
      log(res.payload ? "Upload completed with API response." : "Upload completed.");
    } else {
      // If no API is set, runWithBackend returns ok. If API is set, show error.
      log(`Upload failed: ${res.message}`);
      setUploaded(false);
    }
  }

  async function doQC() {
    if (!uploaded) return;
    setQcStatus("running");
    log("Quality control started…");

    const res = await runWithBackend({
      apiBase,
      path: "/qc",
      json: {
        // Adjust these to match your backend later
        min_counts_per_gene: 1,
        min_counts_per_cell: 1,
      },
    });

    if (res.ok) {
      setQcStatus("done");
      log("Quality control done.");
      setPhaseIndex(PHASES.findIndex((p) => p.key === "normalization"));
    } else {
      setQcStatus("error");
      log(`Quality control failed: ${res.message}`);
    }
  }

  async function doNormalization() {
    if (qcStatus !== "done") return;
    setNormStatus("running");
    log("Normalization started…");

    const res = await runWithBackend({
      apiBase,
      path: "/normalize",
      json: {
        method: "log1p",
        scale: true,
      },
    });

    if (res.ok) {
      setNormStatus("done");
      log("Normalization done.");
      setPhaseIndex(PHASES.findIndex((p) => p.key === "batch_correction"));
    } else {
      setNormStatus("error");
      log(`Normalization failed: ${res.message}`);
    }
  }

  async function doHarmony() {
    if (normStatus !== "done") return;
    setHarmStatus("running");
    log("Harmony batch correction started…");

    const res = await runWithBackend({
      apiBase,
      path: "/harmony",
      json: {
        batch_key: "batch",
        theta: 2,
        max_iter_harmony: 10,
      },
    });

    if (res.ok) {
      setHarmStatus("done");
      log("Harmony batch correction done.");
      setPhaseIndex(PHASES.findIndex((p) => p.key === "clustering"));
    } else {
      setHarmStatus("error");
      log(`Harmony failed: ${res.message}`);
    }
  }

  async function doClustering() {
    if (harmStatus !== "done") return;
    setClusStatus("running");
    log("Clustering started…");

    const res = await runWithBackend({
      apiBase,
      path: "/cluster",
      json: {
        method: "leiden",
        n_pcs: 30,
        resolution: 0.8,
        embedding: "umap",
      },
    });

    if (res.ok) {
      setClusStatus("done");
      log("Clustering done.");
      setPhaseIndex(PHASES.findIndex((p) => p.key === "export"));
    } else {
      setClusStatus("error");
      log(`Clustering failed: ${res.message}`);
    }
  }

  async function doExport() {
    if (clusStatus !== "done") return;
    setExportStatus("running");
    log("Preparing export…");

    const res = await runWithBackend({
      apiBase,
      path: "/export",
      method: "POST",
      json: { format: "zip" },
    });

    if (!apiBase.trim()) {
      // UI-only: create a small demo file
      await sleep(500);
      const content = JSON.stringify(
        {
          message: "Demo export. Set API base URL to download real results.",
          file: fileInfo?.name ?? null,
          steps: {
            quality_control: qcStatus,
            normalization: normStatus,
            harmony: harmStatus,
            clustering: clusStatus,
          },
        },
        null,
        2
      );
      const blob = new Blob([content], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "rnaseq_pipeline_demo_export.json";
      a.click();
      URL.revokeObjectURL(a.href);

      setExportStatus("done");
      log("Export downloaded (demo).");
      return;
    }

    if (res.ok) {
      setExportStatus("done");
      log("Export requested. If your backend returns a URL, implement a download step here.");
      // If your backend returns a signed URL or a file, handle it in this section.
    } else {
      setExportStatus("error");
      log(`Export failed: ${res.message}`);
    }
  }

  function resetAll() {
    setPhaseIndex(0);
    setFile(null);
    setFileInfo(null);
    setUploaded(false);
    setQcStatus("idle");
    setNormStatus("idle");
    setHarmStatus("idle");
    setClusStatus("idle");
    setExportStatus("idle");
    setLogLines([]);
  }

  return (
    <div className="page">
      <style>{`
        :root {
          color-scheme: dark;
        }

        .page {
          min-height: 100vh;
          background: radial-gradient(1200px 700px at 20% 0%, rgba(125, 211, 252, 0.12), transparent 60%),
                      radial-gradient(900px 600px at 80% 20%, rgba(167, 139, 250, 0.12), transparent 55%),
                      #0b0f19;
          color: rgba(255,255,255,0.92);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
          padding: 18px;
        }

        .shell {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 280px 1fr;
          gap: 14px;
        }

        .card {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 16px;
          box-shadow: 0 12px 30px rgba(0,0,0,0.35);
          overflow: hidden;
        }

        .side {
          padding: 14px;
        }

        .main {
          padding: 14px;
          display: grid;
          grid-template-rows: auto auto 1fr;
          gap: 12px;
        }

        .title {
          font-size: 18px;
          font-weight: 650;
          letter-spacing: 0.2px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .subtitle {
          margin-top: 4px;
          color: rgba(255,255,255,0.70);
          font-size: 13px;
          line-height: 1.3;
        }

        .divider {
          height: 1px;
          background: rgba(255,255,255,0.10);
          margin: 12px 0;
        }

        .phaseList {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 10px;
        }

        .phaseBtn {
          width: 100%;
          text-align: left;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.05);
          padding: 10px 10px;
          border-radius: 12px;
          cursor: pointer;
          transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
        }

        .phaseBtn:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.07);
          border-color: rgba(255,255,255,0.14);
        }

        .phaseBtnActive {
          background: rgba(125, 211, 252, 0.10);
          border-color: rgba(125, 211, 252, 0.25);
        }

        .phaseBtnTitle {
          font-weight: 650;
          font-size: 13px;
        }

        .phaseBtnSub {
          margin-top: 3px;
          font-size: 12px;
          color: rgba(255,255,255,0.70);
        }

        .grid2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .label {
          font-size: 12px;
          color: rgba(255,255,255,0.72);
        }

        .input {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(0,0,0,0.25);
          color: rgba(255,255,255,0.92);
          border-radius: 12px;
          padding: 10px 10px;
          outline: none;
        }

        .input:focus {
          border-color: rgba(167, 139, 250, 0.35);
          box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.12);
        }

        .row {
          display: flex;
          gap: 10px;
          align-items: center;
          flex-wrap: wrap;
        }

        .btn {
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.92);
          border-radius: 12px;
          padding: 10px 12px;
          cursor: pointer;
          font-weight: 650;
          font-size: 13px;
          transition: transform 120ms ease, background 120ms ease, border-color 120ms ease;
          user-select: none;
        }

        .btn:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.16);
        }

        .btnPrimary {
          background: rgba(125, 211, 252, 0.12);
          border-color: rgba(125, 211, 252, 0.26);
        }

        .btnDanger {
          background: rgba(248, 113, 113, 0.10);
          border-color: rgba(248, 113, 113, 0.24);
        }

        .btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
        }

        .pill {
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 650;
          border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06);
        }

        .pill-idle { color: rgba(255,255,255,0.72); }
        .pill-running { color: rgba(125, 211, 252, 0.95); border-color: rgba(125, 211, 252, 0.35); background: rgba(125, 211, 252, 0.10); }
        .pill-done { color: rgba(74, 222, 128, 0.95); border-color: rgba(74, 222, 128, 0.28); background: rgba(74, 222, 128, 0.10); }
        .pill-error { color: rgba(248, 113, 113, 0.95); border-color: rgba(248, 113, 113, 0.28); background: rgba(248, 113, 113, 0.10); }

        .log {
          height: 220px;
          overflow: auto;
          padding: 10px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          font-size: 12px;
          color: rgba(255,255,255,0.78);
          background: rgba(0,0,0,0.30);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 14px;
          line-height: 1.4;
          white-space: pre-wrap;
        }

        .hint {
          font-size: 12px;
          color: rgba(255,255,255,0.70);
        }

        .kpi {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .kpiBox {
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,0.10);
          background: rgba(255,255,255,0.05);
        }

        .kpiLabel {
          font-size: 12px;
          color: rgba(255,255,255,0.70);
        }

        .kpiValue {
          margin-top: 6px;
          font-size: 15px;
          font-weight: 700;
        }

        @media (max-width: 980px) {
          .shell {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="shell">
        <div className="card side">
          <div className="title">
            <span>RNA-seq pipeline</span>
            <button className="btn btnDanger" onClick={resetAll} type="button">
              Reset
            </button>
          </div>
          <div className="subtitle">A step-by-step UI. Set an API base URL to run real backend steps.</div>

          <Divider />

          <div className="field">
            <div className="label">API base URL</div>
            <input
              className="input"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              placeholder="https://your-backend-xxxxx.europe-west1.run.app"
            />
            <div className="hint">
              If empty, actions run in simulated mode. If set, the app calls /upload, /qc, /normalize, /harmony, /cluster,
              /export.
            </div>
          </div>

          <Divider />

          <div className="phaseList">
            {PHASES.map((p, idx) => (
              <button
                key={p.key}
                className={`phaseBtn ${idx === phaseIndex ? "phaseBtnActive" : ""}`}
                onClick={() => setPhaseIndex(idx)}
                type="button"
              >
                <div className="phaseBtnTitle">{p.title}</div>
                <div className="phaseBtnSub">{p.subtitle}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="card main">
          <div>
            <div className="title">
              <span>{currentPhase.title}</span>
              <span className="hint">{currentPhase.subtitle}</span>
            </div>
          </div>

          <div className="kpi">
            <div className="kpiBox">
              <div className="kpiLabel">Input</div>
              <div className="kpiValue">{fileInfo ? fileInfo.name : "No file selected"}</div>
              <div className="hint">
                {fileInfo ? `${prettyBytes(fileInfo.size)}${fileInfo.rows ? `, ~${fileInfo.rows} rows` : ""}${fileInfo.cols ? `, ~${fileInfo.cols} cols` : ""}` : "Select a counts matrix to begin."}
              </div>
            </div>

            <div className="kpiBox">
              <div className="kpiLabel">Progress</div>
              <div className="kpiValue">
                QC <StatusPill status={qcStatus} /> &nbsp; Norm <StatusPill status={normStatus} /> &nbsp; Harmony{" "}
                <StatusPill status={harmStatus} /> &nbsp; Cluster <StatusPill status={clusStatus} />
              </div>
              <div className="hint">
                Upload {uploaded ? "done" : "pending"}.
              </div>
            </div>
          </div>

          <div className="grid2">
            <div className="card" style={{ padding: 14, background: "rgba(255,255,255,0.04)" }}>
              <div className="title" style={{ fontSize: 14 }}>
                Actions
              </div>
              <div className="subtitle">Run pipeline steps in order.</div>

              <Divider />

              <div className="field">
                <div className="label">Counts matrix file</div>
                <input
                  className="input"
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={(e) => onChooseFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn btnPrimary" onClick={doUpload} type="button" disabled={!file || uploaded}>
                  {uploaded ? "Uploaded" : "Upload"}
                </button>

                <button className="btn" onClick={doQC} type="button" disabled={!canRunQC}>
                  Quality control
                </button>

                <button className="btn" onClick={doNormalization} type="button" disabled={!canRunNorm}>
                  Normalize
                </button>

                <button className="btn" onClick={doHarmony} type="button" disabled={!canRunHarmony}>
                  Harmony
                </button>

                <button className="btn" onClick={doClustering} type="button" disabled={!canRunClustering}>
                  Cluster
                </button>

                <button className="btn" onClick={doExport} type="button" disabled={!canExport}>
                  Export
                </button>
              </div>

              <Divider />

              <div className="hint">
                If your backend endpoints differ, update the paths in App.tsx: <code>/upload</code>, <code>/qc</code>,{" "}
                <code>/normalize</code>, <code>/harmony</code>, <code>/cluster</code>, <code>/export</code>.
              </div>
            </div>

            <div className="card" style={{ padding: 14, background: "rgba(255,255,255,0.04)" }}>
              <div className="title" style={{ fontSize: 14 }}>
                Run log
              </div>
              <div className="subtitle">Client-side log. Useful to debug API connectivity.</div>

              <Divider />

              <div ref={logRef} className="log">
                {logLines.length === 0 ? "No events yet." : logLines.join("\n")}
              </div>

              <Divider />

              <div className="row">
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(logLines.join("\n")).catch(() => undefined);
                  }}
                  disabled={logLines.length === 0}
                >
                  Copy log
                </button>

                <button className="btn" type="button" onClick={() => setLogLines([])} disabled={logLines.length === 0}>
                  Clear log
                </button>
              </div>

              <div className="hint" style={{ marginTop: 10 }}>
                Tip: open DevTools Console in your browser to see network errors.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
