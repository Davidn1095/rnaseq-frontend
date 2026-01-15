import { useState } from "react";
import AccessionPicker from "./AccessionPicker";
import type { Accession, Manifest, Mode } from "../lib/types";

type AnalysisSetupProps = {
  manifest: Manifest | null;
  isLoading: boolean;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  cellType: string;
  onCellTypeChange: (cellType: string) => void;
  disease: string;
  onDiseaseChange: (disease: string) => void;
  leftDisease: string;
  rightDisease: string;
  onLeftDiseaseChange: (disease: string) => void;
  onRightDiseaseChange: (disease: string) => void;
  accessionsByDisease: Record<string, Accession[]>;
  selectedSingleAcc: string[];
  onSelectedSingleAccChange: (next: string[]) => void;
  selectedLeftAcc: string[];
  onSelectedLeftAccChange: (next: string[]) => void;
  selectedRightAcc: string[];
  onSelectedRightAccChange: (next: string[]) => void;
  totalSelected: number;
};

export default function AnalysisSetup({
  manifest,
  isLoading,
  mode,
  onModeChange,
  cellType,
  onCellTypeChange,
  disease,
  onDiseaseChange,
  leftDisease,
  rightDisease,
  onLeftDiseaseChange,
  onRightDiseaseChange,
  accessionsByDisease,
  selectedSingleAcc,
  onSelectedSingleAccChange,
  selectedLeftAcc,
  onSelectedLeftAccChange,
  selectedRightAcc,
  onSelectedRightAccChange,
  totalSelected,
}: AnalysisSetupProps) {
  const [showHealthyTable, setShowHealthyTable] = useState(false);

  const diseases = manifest?.diseases ?? [];
  const nonHealthyDiseases = diseases.filter((item) => item !== "Healthy");
  const healthyRows = accessionsByDisease.Healthy ?? [];
  const healthyIds = healthyRows.map((row) => row.id);
  const cellTypes = manifest?.cell_types ?? [];

  return (
    <section className="col">
      <div className="card">
        <div className="row between">
          <div className="h2">Analysis setup</div>
          <span className="pill">{mode === "single" ? "Single disease" : "Comparison"}</span>
        </div>

        <div className="row gap top">
          <button
            className={`btn ${mode === "single" ? "" : "ghost"}`}
            onClick={() => onModeChange("single")}
          >
            Single disease
          </button>
          <button
            className={`btn ${mode === "compare" ? "" : "ghost"}`}
            onClick={() => onModeChange("compare")}
          >
            Comparison
          </button>
        </div>

        <div className="sep" />

        <div className="card sub">
          <div className="row between">
            <div>
              <div className="h3">Healthy controls</div>
              <div className="muted small">Locked selection</div>
            </div>
            <span className="pill">{healthyIds.length}</span>
          </div>
          {isLoading ? (
            <div className="skeleton chips" />
          ) : (
            <div className="chips">
              {healthyIds.map((id) => (
                <span key={id} className="chip locked mono">{id}</span>
              ))}
            </div>
          )}
          <button
            className="btn ghost small-button"
            onClick={() => setShowHealthyTable((prev) => !prev)}
            disabled={healthyRows.length === 0}
          >
            {showHealthyTable ? "Hide Healthy accession table" : "Show Healthy accession table"}
          </button>

          {showHealthyTable && healthyRows.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Platform</th>
                    <th>Donors</th>
                    <th>Cells</th>
                  </tr>
                </thead>
                <tbody>
                  {healthyRows.map((row) => (
                    <tr key={row.id}>
                      <td className="mono">{row.id}</td>
                      <td>{row.platform}</td>
                      <td>{row.donors}</td>
                      <td>{row.cells.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="row gap top">
          <div className="field">
            <label className="muted small">Cell type</label>
            {isLoading ? (
              <div className="skeleton input" />
            ) : (
              <select className="select" value={cellType} onChange={(event) => onCellTypeChange(event.target.value)}>
                {cellTypes.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {mode === "single" ? (
          <>
            <div className="row gap top">
              <div className="field">
                <label className="muted small">Disease</label>
                {isLoading ? (
                  <div className="skeleton input" />
                ) : (
                  <select className="select" value={disease} onChange={(event) => onDiseaseChange(event.target.value)}>
                    {nonHealthyDiseases.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="field">
                <label className="muted small">Contrast</label>
                <div className="pill big">{disease} vs Healthy</div>
              </div>
            </div>

            <AccessionPicker
              title={`${disease} accessions`}
              description={`${disease} · ${(accessionsByDisease[disease] ?? []).length} accessions`}
              accessions={accessionsByDisease[disease] ?? []}
              selected={selectedSingleAcc}
              onChange={onSelectedSingleAccChange}
              isLoading={isLoading}
            />

            <div className="row between">
              <button className="btn" disabled>Compute disease vs healthy</button>
              <button className="btn ghost" disabled>View top genes</button>
            </div>
          </>
        ) : (
          <>
            <div className="row gap top">
              <div className="field">
                <label className="muted small">Left disease</label>
                {isLoading ? (
                  <div className="skeleton input" />
                ) : (
                  <select className="select" value={leftDisease} onChange={(event) => onLeftDiseaseChange(event.target.value)}>
                    {nonHealthyDiseases.filter((item) => item !== rightDisease).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="field">
                <label className="muted small">Right disease</label>
                {isLoading ? (
                  <div className="skeleton input" />
                ) : (
                  <select className="select" value={rightDisease} onChange={(event) => onRightDiseaseChange(event.target.value)}>
                    {nonHealthyDiseases.filter((item) => item !== leftDisease).map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="row gap">
              <span className="pill big">{leftDisease} vs Healthy</span>
              <span className="pill big">{rightDisease} vs Healthy</span>
            </div>

            <div className="row gap top">
              <AccessionPicker
                title={`${leftDisease} accessions`}
                description={`${leftDisease} · ${(accessionsByDisease[leftDisease] ?? []).length} accessions`}
                accessions={accessionsByDisease[leftDisease] ?? []}
                selected={selectedLeftAcc}
                onChange={onSelectedLeftAccChange}
                isLoading={isLoading}
              />
              <AccessionPicker
                title={`${rightDisease} accessions`}
                description={`${rightDisease} · ${(accessionsByDisease[rightDisease] ?? []).length} accessions`}
                accessions={accessionsByDisease[rightDisease] ?? []}
                selected={selectedRightAcc}
                onChange={onSelectedRightAccChange}
                isLoading={isLoading}
              />
            </div>

            <div className="row between">
              <button className="btn" disabled>Compute overlap</button>
              <button className="btn ghost" disabled>View lists</button>
            </div>
          </>
        )}

        <div className="sep" />
        <div className="muted small">Selected accessions in session: <span className="mono">{totalSelected}</span></div>
      </div>
    </section>
  );
}
