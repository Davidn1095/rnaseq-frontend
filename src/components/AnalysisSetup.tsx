import type { Manifest, Mode } from "../lib/types";

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
  cohortAccessionCount: number;
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
  cohortAccessionCount,
}: AnalysisSetupProps) {
  const diseases = manifest?.diseases ?? [];
  const nonHealthyDiseases = diseases.filter((item) => item !== "Healthy");
  const cellTypes = manifest?.cell_types ?? [];
  const allCellTypesSelected = cellTypes.length > 0 && selectedCellTypes.length === cellTypes.length;

  const groupCellTypes = (items: string[]) => {
    const groups: Record<string, string[]> = {
      "T cells": [],
      "B cells": [],
      "NK cells": [],
      Monocytes: [],
      "Myeloid/DC": [],
      Neutrophils: [],
      Basophils: [],
      Plasma: [],
      Progenitors: [],
      Other: [],
    };

    const classify = (label: string) => {
      const name = label.toLowerCase();
      if (name.includes("t cells") || name.includes("t cell") || name.includes("cd4") || name.includes("cd8") || name.includes("tcr") || name.includes("gd t") || name.includes("gamma delta")) {
        return "T cells";
      }
      if (name.includes("b cells") || name.includes("b cell")) {
        return "B cells";
      }
      if (name.includes("nk")) {
        return "NK cells";
      }
      if (name.includes("monocyte")) {
        return "Monocytes";
      }
      if (name.includes("dendritic") || name.includes("dc") || name.includes("myeloid")) {
        return "Myeloid/DC";
      }
      if (name.includes("neutrophil")) {
        return "Neutrophils";
      }
      if (name.includes("basophil")) {
        return "Basophils";
      }
      if (name.includes("plasma") || name.includes("plasmablast")) {
        return "Plasma";
      }
      if (name.includes("progenitor") || name.includes("stem")) {
        return "Progenitors";
      }
      return "Other";
    };

    items.forEach((item) => {
      const key = classify(item);
      groups[key].push(item);
    });

    return Object.entries(groups)
      .map(([key, values]) => [key, values.sort((a, b) => a.localeCompare(b))] as const)
      .filter(([, values]) => values.length > 0);
  };

  const groupedCellTypes = groupCellTypes(cellTypes);

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
                      <div className="multi-select-options grouped">
                        {groupedCellTypes.map(([group, items]) => (
                          <div key={group} className="multi-select-group">
                            <div className="muted small group-label">{group}</div>
                            {items.map((item) => (
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
                      <div className="multi-select-options grouped">
                        {groupedCellTypes.map(([group, items]) => (
                          <div key={group} className="multi-select-group">
                            <div className="muted small group-label">{group}</div>
                            {items.map((item) => (
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
                  Accessions in cohort: <span className="mono">{cohortAccessionCount}</span>
                </div>
              </div>
            </>
          )}
        </div>
        {mode === "single" ? (
          <>
            <div className="sep" />
            <div className="muted small">
              Accessions in cohort: <span className="mono">{cohortAccessionCount}</span>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
