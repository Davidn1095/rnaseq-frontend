import { useMemo, useState } from "react";
import "./App.css";

type Mode = "single" | "compare";

type AccRow = {
  id: string;
  disease: string;
  platform: string;
  donors: number;
  cells: number;
  tissue: string;
};

type Manifest = {
  ok: boolean;
  tissue: string;
  diseases: string[];
  accessions: AccRow[];
  cell_types: string[];
  marker_panels: Record<string, string[]>;
};

const DEFAULT_API_BASE = "https://rnaseq-backend-y654q6wo2q-ew.a.run.app";

function uniqSorted(xs: string[]) {
  return Array.from(new Set(xs)).sort();
}

export default function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("single");
  const [cellType, setCellType] = useState("CD4 T cells");

  const [diseaseA, setDiseaseA] = useState("SjS");
  const [leftDisease, setLeftDisease] = useState("SjS");
  const [rightDisease, setRightDisease] = useState("SLE");

  const [diseaseAAcc, setDiseaseAAcc] = useState<string[]>([]);
  const [leftAcc, setLeftAcc] = useState<string[]>([]);
  const [rightAcc, setRightAcc] = useState<string[]>([]);

  const [vizTab, setVizTab] = useState<"umap" | "dot" | "comp" | "volcano" | "overlap">("umap");
  const [contrast, setContrast] = useState<"left" | "right">("left");

  async function loadManifest() {
    setLoadErr(null);
    setManifest(null);
    try {
      const res = await fetch(`${apiBase.replace(/\/+$/, "")}/atlas/manifest`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const js = (await res.json()) as Manifest;
      if (!js.ok) throw new Error("manifest.ok=false");
      setManifest(js);

      // set defaults from manifest
      if (js.cell_types?.length) setCellType(js.cell_types[0]);

      // auto-select Healthy accessions
      const healthy = js.accessions.filter((a) => a.disease === "Healthy").map((a) => a.id);

      const diseaseIds = (d: string) => js.accessions.filter((a) => a.disease === d).map((a) => a.id);

      // seed selections
      setDiseaseAAcc(diseaseIds(diseaseA));
      setLeftAcc(diseaseIds(leftDisease));
      setRightAcc(diseaseIds(rightDisease));

      // basic sanity checks
      console.assert(healthy.length >= 1, "Expected at least one Healthy accession");
    } catch (e: any) {
      setLoadErr(String(e?.message ?? e));
    }
  }

  const diseases = manifest?.diseases ?? ["Healthy", "SLE", "SjS", "RA"];
  const nonHealthyDiseases = diseases.filter((d) => d !== "Healthy");
  const accessions = manifest?.accessions ?? [];
  const healthyAcc = useMemo(() => accessions.filter((a) => a.disease === "Healthy").map((a) => a.id), [accessions]);

  const idsForDisease = (d: string) => accessions.filter((a) => a.disease === d).map((a) => a.id);

  const selectedAcc = useMemo(() => {
    if (mode === "single") return uniqSorted([...healthyAcc, ...diseaseAAcc]);
    return uniqSorted([...healthyAcc, ...leftAcc, ...rightAcc]);
  }, [mode, healthyAcc, diseaseAAcc, leftAcc, rightAcc]);

  const contrastLabel = useMemo(() => {
    if (mode === "single") return `${diseaseA} vs Healthy`;
    return contrast === "left" ? `${leftDisease} vs Healthy` : `${rightDisease} vs Healthy`;
  }, [mode, diseaseA, leftDisease, rightDisease, contrast]);

  const setDiseaseAAndReset = (d: string) => {
    setDiseaseA(d);
    if (manifest) setDiseaseAAcc(idsForDisease(d));
  };
  const setLeftDiseaseAndReset = (d: string) => {
    setLeftDisease(d);
    if (manifest) setLeftAcc(idsForDisease(d));
  };
  const setRightDiseaseAndReset = (d: string) => {
    setRightDisease(d);
    if (manifest) setRightAcc(idsForDisease(d));
  };

  function AccessionList({
    title,
    disease,
    selected,
    onChange,
  }: {
    title: string;
    disease: string;
    selected: string[];
    onChange: (xs: string[]) => void;
  }) {
    const rows = accessions.filter((a) => a.disease === disease);
    const ids = rows.map((r) => r.id);
    const allChecked = ids.length > 0 && ids.every((id) => selected.includes(id));

    return (
      <div className="card">
        <div className="row between">
          <div>
            <div className="h3">{title}</div>
            <div className="muted small">{disease} · {rows.length} accessions</div>
          </div>
          <button className="btn ghost" onClick={() => onChange(allChecked ? [] : ids)} disabled={ids.length === 0}>
            {allChecked ? "Clear" : "Select all"}
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="box muted">No accessions available.</div>
        ) : (
          <div className="list">
            {rows.map((a) => {
              const checked = selected.includes(a.id);
              return (
                <label key={a.id} className="item">
                  <span className="row gap">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) onChange([...selected, a.id]);
                        else onChange(selected.filter((x) => x !== a.id));
                      }}
                    />
                    <span className="mono">{a.id}</span>
                  </span>
                  <span className="muted small">{a.donors} donors · {a.cells.toLocaleString()} cells</span>
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function Placeholder({ title, lines }: { title: string; lines: string[] }) {
    return (
      <div className="card">
        <div className="h3">{title}</div>
        <ul className="ul">
          {lines.map((l, i) => (
            <li key={i} className="muted small">{l}</li>
          ))}
        </ul>
        <div className="placeholder">Placeholder</div>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="header">
        <div>
          <div className="title">Autoimmune Public Atlas</div>
          <div className="muted">PBMC-only · text-only placeholders</div>
        </div>

        <div className="api">
          <input
            className="input mono"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            placeholder="https://rnaseq-backend-xxxxx.europe-west1.run.app"
          />
          <button className="btn" onClick={loadManifest}>Load manifest</button>
        </div>
      </header>

      {loadErr ? <div className="err">Manifest load error: {loadErr}</div> : null}
      {manifest ? <div className="ok">Loaded {manifest.accessions.length} accessions from backend.</div> : null}

      <div className="grid">
        <section className="col">
          <div className="card">
            <div className="row between">
              <div className="h2">Analysis setup</div>
              <span className="pill">{mode === "single" ? "Single disease" : "Comparison"}</span>
            </div>

            <div className="row gap top">
              <button className={`btn ${mode === "single" ? "" : "ghost"}`} onClick={() => setMode("single")}>
                Single disease
              </button>
              <button className={`btn ${mode === "compare" ? "" : "ghost"}`} onClick={() => setMode("compare")}>
                Comparison
              </button>
            </div>

            <div className="sep" />

            <div className="card sub">
              <div className="row between">
                <div>
                  <div className="h3">Healthy controls</div>
                  <div className="muted small">Auto-selected</div>
                </div>
                <span className="pill">{healthyAcc.length}</span>
              </div>
              <div className="chips">
                {healthyAcc.map((id) => (
                  <span key={id} className="chip mono">{id}</span>
                ))}
              </div>
            </div>

            <div className="row gap top">
              <div className="field">
                <label className="muted small">Cell type</label>
                <select className="select" value={cellType} onChange={(e) => setCellType(e.target.value)}>
                  {(manifest?.cell_types ?? ["CD4 T cells"]).map((ct) => (
                    <option key={ct} value={ct}>{ct}</option>
                  ))}
                </select>
              </div>
            </div>

            {mode === "single" ? (
              <>
                <div className="row gap top">
                  <div className="field">
                    <label className="muted small">Disease</label>
                    <select className="select" value={diseaseA} onChange={(e) => setDiseaseAAndReset(e.target.value)}>
                      {nonHealthyDiseases.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="muted small">Contrast</label>
                    <div className="pill big">{diseaseA} vs Healthy</div>
                  </div>
                </div>

                <AccessionList title={`${diseaseA} accessions`} disease={diseaseA} selected={diseaseAAcc} onChange={setDiseaseAAcc} />

                <div className="row between">
                  <button className="btn">Compute Disease vs Healthy</button>
                  <button className="btn ghost">View top genes</button>
                </div>
              </>
            ) : (
              <>
                <div className="row gap top">
                  <div className="field">
                    <label className="muted small">Left disease</label>
                    <select className="select" value={leftDisease} onChange={(e) => setLeftDiseaseAndReset(e.target.value)}>
                      {nonHealthyDiseases.filter((d) => d !== rightDisease).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="muted small">Right disease</label>
                    <select className="select" value={rightDisease} onChange={(e) => setRightDiseaseAndReset(e.target.value)}>
                      {nonHealthyDiseases.filter((d) => d !== leftDisease).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="row gap">
                  <span className="pill big">{leftDisease} vs Healthy</span>
                  <span className="pill big">{rightDisease} vs Healthy</span>
                </div>

                <div className="row gap top">
                  <AccessionList title={`${leftDisease} accessions`} disease={leftDisease} selected={leftAcc} onChange={setLeftAcc} />
                  <AccessionList title={`${rightDisease} accessions`} disease={rightDisease} selected={rightAcc} onChange={setRightAcc} />
                </div>

                <div className="row between">
                  <button className="btn">Compute overlap</button>
                  <button className="btn ghost">View lists</button>
                </div>
              </>
            )}

            <div className="sep" />
            <div className="muted small">Selected accessions in session: <span className="mono">{selectedAcc.length}</span></div>
          </div>
        </section>

        <section className="col">
          <div className="card">
            <div className="row between">
              <div className="h2">Visualization</div>
              <span className="pill">{vizTab}</span>
            </div>

            {mode === "compare" ? (
              <div className="row gap top">
                <div className="field">
                  <label className="muted small">Contrast for Dot plot and Volcano</label>
                  <select className="select" value={contrast} onChange={(e) => setContrast(e.target.value as any)}>
                    <option value="left">{leftDisease} vs Healthy</option>
                    <option value="right">{rightDisease} vs Healthy</option>
                  </select>
                </div>
              </div>
            ) : null}

            <div className="tabs">
              <button className={`tab ${vizTab === "umap" ? "on" : ""}`} onClick={() => setVizTab("umap")}>UMAP</button>
              <button className={`tab ${vizTab === "dot" ? "on" : ""}`} onClick={() => setVizTab("dot")}>Dot plot</button>
              <button className={`tab ${vizTab === "comp" ? "on" : ""}`} onClick={() => setVizTab("comp")}>Composition</button>
              <button className={`tab ${vizTab === "volcano" ? "on" : ""}`} onClick={() => setVizTab("volcano")}>Volcano plot</button>
              {mode === "compare" ? (
                <button className={`tab ${vizTab === "overlap" ? "on" : ""}`} onClick={() => setVizTab("overlap")}>Overlap</button>
              ) : null}
            </div>

            {vizTab === "umap" ? (
              <Placeholder title="UMAP" lines={[
                `Cell type: ${cellType}`,
                `Selected accessions: ${selectedAcc.length}`,
                "Color options: disease, accession, donor, cell type",
              ]} />
            ) : null}

            {vizTab === "dot" ? (
              <Placeholder title="Dot plot" lines={[
                "Axes: genes on x, cell types on y",
                "Size: percent expressed",
                `Color: log fold change for ${contrastLabel}`,
                "Gene panel: from backend manifest marker_panels.default",
              ]} />
            ) : null}

            {vizTab === "comp" ? (
              <Placeholder title="Composition" lines={[
                "Cell type composition for selected cohort",
                "Option: group by disease or accession",
              ]} />
            ) : null}

            {vizTab === "volcano" ? (
              <Placeholder title="Volcano plot" lines={[
                "Axes: log fold change on x, -log10 adjusted p-value on y",
                `Contrast: ${contrastLabel}`,
                `Cell type: ${cellType}`,
              ]} />
            ) : null}

            {vizTab === "overlap" && mode === "compare" ? (
              <Placeholder title="Overlap" lines={[
                `Significant genes: ${leftDisease} vs Healthy and ${rightDisease} vs Healthy`,
                "Show shared, left-only, right-only sets",
                "Report Jaccard similarity",
              ]} />
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
