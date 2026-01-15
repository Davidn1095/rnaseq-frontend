import AccessionPicker from "./AccessionPicker";
import type { Accession, Manifest, Mode } from "../lib/types";

type AnalysisSetupProps = {
  manifest: Manifest | null;
  isLoading: boolean;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  selectedCellTypes: string[];
  onSelectedCellTypesChange: (next: string[]) => void;
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
  selectedCellTypes,
  onSelectedCellTypesChange,
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
  const diseases = manifest?.diseases ?? [];
  const nonHealthyDiseases = diseases.filter((item) => item !== "Healthy");
  const cellTypes = manifest?.cell_types ?? [];
  const allCellTypesSelected = cellTypes.length > 0 && selectedCellTypes.length === cellTypes.length;

  const handleToggleCellType = (cell: string) => {
    if (selectedCellTypes.includes(cell)) {
      onSelectedCellTypesChange(selectedCellTypes.filter((item) => item !== cell));
    } else {
      onSelectedCellTypesChange([...selectedCellTypes, cell]);
    }
  };

  const handleSelectAllCellTypes = () => {
    onSelectedCellTypesChange(cellTypes);
  };

  const handleClearCellTypes = () => {
    onSelectedCellTypesChange([]);
  };

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

        <div className="analysis-stack">
          {mode === "single" ? (
            <>
              <div className="row gap">
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
              </div>

              <div className="row gap">
                <div className="field">
                  <label className="muted small">Contrast</label>
                  <div className="pill big subtle">{disease} vs Healthy</div>
                </div>
              </div>

              <div className="row gap">
                <div className="field">
                  <label className="muted small">Cell types</label>
                  {isLoading ? (
                    <div className="skeleton input" />
                  ) : (
                    <div className="multi-select">
                      <div className="row between">
                        <div className="muted small">
                          {allCellTypesSelected
                            ? "All cell types selected"
                            : `${selectedCellTypes.length} selected`}
                        </div>
                        <div className="multi-select-actions">
                          <button className="btn ghost small-button" onClick={handleSelectAllCellTypes} type="button">
                            Select all
                          </button>
                          <button className="btn ghost small-button" onClick={handleClearCellTypes} type="button">
                            Clear all
                          </button>
                        </div>
                      </div>
                      <div className="multi-select-options">
                        {cellTypes.map((item) => (
                          <label key={item} className="multi-select-option">
                            <input
                              type="checkbox"
                              checked={selectedCellTypes.includes(item)}
                              onChange={() => handleToggleCellType(item)}
                            />
                            <span>{item}</span>
                          </label>
                        ))}
                      </div>
                      <div className="chips">
                        {selectedCellTypes.length > 0 ? (
                          selectedCellTypes.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="chip removable"
                              onClick={() => handleToggleCellType(item)}
                            >
                              {item}
                              <span aria-hidden="true">×</span>
                            </button>
                          ))
                        ) : (
                          <span className="muted small">No cell types selected.</span>
                        )}
                      </div>
                    </div>
                  )}
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

              <div className="row">
                <button className="btn" disabled>Compute disease vs healthy</button>
              </div>
            </>
          ) : (
            <>
              <div className="comparison-grid">
                <div className="card sub comparison-card">
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
                    <label className="muted small">Contrast</label>
                    <div className="pill big subtle">{leftDisease} vs Healthy</div>
                  </div>
                  <AccessionPicker
                    title={`${leftDisease} accessions`}
                    description={`${leftDisease} · ${(accessionsByDisease[leftDisease] ?? []).length} accessions`}
                    accessions={accessionsByDisease[leftDisease] ?? []}
                    selected={selectedLeftAcc}
                    onChange={onSelectedLeftAccChange}
                    isLoading={isLoading}
                  />
                </div>
                <div className="card sub comparison-card">
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
                  <div className="field">
                    <label className="muted small">Contrast</label>
                    <div className="pill big subtle">{rightDisease} vs Healthy</div>
                  </div>
                  <AccessionPicker
                    title={`${rightDisease} accessions`}
                    description={`${rightDisease} · ${(accessionsByDisease[rightDisease] ?? []).length} accessions`}
                    accessions={accessionsByDisease[rightDisease] ?? []}
                    selected={selectedRightAcc}
                    onChange={onSelectedRightAccChange}
                    isLoading={isLoading}
                  />
                </div>
              </div>

              <div className="card sub shared-settings">
                <div className="row between">
                  <div className="h3">Shared settings</div>
                  <div className="muted small">Comparison-wide filters</div>
                </div>
                <div className="field">
                  <label className="muted small">Cell types</label>
                  {isLoading ? (
                    <div className="skeleton input" />
                  ) : (
                    <div className="multi-select">
                      <div className="row between">
                        <div className="muted small">
                          {allCellTypesSelected
                            ? "All cell types selected"
                            : `${selectedCellTypes.length} selected`}
                        </div>
                        <div className="multi-select-actions">
                          <button className="btn ghost small-button" onClick={handleSelectAllCellTypes} type="button">
                            Select all
                          </button>
                          <button className="btn ghost small-button" onClick={handleClearCellTypes} type="button">
                            Clear all
                          </button>
                        </div>
                      </div>
                      <div className="multi-select-options">
                        {cellTypes.map((item) => (
                          <label key={item} className="multi-select-option">
                            <input
                              type="checkbox"
                              checked={selectedCellTypes.includes(item)}
                              onChange={() => handleToggleCellType(item)}
                            />
                            <span>{item}</span>
                          </label>
                        ))}
                      </div>
                      <div className="chips">
                        {selectedCellTypes.length > 0 ? (
                          selectedCellTypes.map((item) => (
                            <button
                              key={item}
                              type="button"
                              className="chip removable"
                              onClick={() => handleToggleCellType(item)}
                            >
                              {item}
                              <span aria-hidden="true">×</span>
                            </button>
                          ))
                        ) : (
                          <span className="muted small">No cell types selected.</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="row between comparison-actions">
                <button className="btn" disabled>Compute overlap</button>
                <div className="muted small">
                  Selected accessions in session: <span className="mono">{totalSelected}</span>
                </div>
              </div>
            </>
          )}
        </div>
        {mode === "single" ? (
          <>
            <div className="sep" />
            <div className="muted small">
              Selected accessions in session: <span className="mono">{totalSelected}</span>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
