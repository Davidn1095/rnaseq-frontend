import type { Manifest } from "../lib/types";

type AnalysisSetupProps = {
  manifest: Manifest | null;
  isLoading: boolean;
  selectedCellTypes: string[];
  onSelectedCellTypesChange: (next: string[]) => void;
  leftDisease: string;
  rightDisease: string;
  onLeftDiseaseChange: (disease: string) => void;
  onRightDiseaseChange: (disease: string) => void;
};

export default function AnalysisSetup({
  manifest,
  isLoading,
  selectedCellTypes,
  onSelectedCellTypesChange,
  leftDisease,
  rightDisease,
  onLeftDiseaseChange,
  onRightDiseaseChange,
}: AnalysisSetupProps) {
  const diseases = manifest?.diseases ?? [];
  const nonHealthyDiseases = diseases.filter((item) => item !== "Healthy");
  const cellTypes = manifest?.cell_types ?? [];

  const diseaseLabel = (value: string) => {
    const normalized = value.trim();
    if (normalized === "RA") return "Rheumatoid arthritis";
    if (normalized === "SjS") return "Sjögren syndrome";
    if (normalized === "SLE") return "Systemic lupus erythematosus";
    return value;
  };

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
      if (
        name.includes("t cells") ||
        name.includes("t cell") ||
        name.includes("cd4") ||
        name.includes("cd8") ||
        name.includes("tcr") ||
        name.includes("gd t") ||
        name.includes("gamma delta") ||
        name.includes("th1") ||
        name.includes("th2") ||
        name.includes("th17") ||
        name.includes("treg") ||
        name.includes("t regulatory") ||
        name.includes("regulatory t") ||
        name.includes("t helper") ||
        name.includes("helper t")
      ) {
        return "T cells";
      }
      if (name.includes("b cells") || name.includes("b cell")) {
        return "B cells";
      }
      if (name.includes("nk") || name.includes("natural killer")) {
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

  const handleToggleGroup = (items: string[]) => {
    const allSelected = items.every((item) => selectedCellTypes.includes(item));
    if (allSelected) {
      onSelectedCellTypesChange(selectedCellTypes.filter((item) => !items.includes(item)));
      return;
    }
    const merged = Array.from(new Set([...selectedCellTypes, ...items]));
    onSelectedCellTypesChange(merged);
  };

  return (
    <section className="col">
      <div className="card">
        <div className="row between">
          <div className="h2">Analysis setup</div>
          <span className="pill">{rightDisease && rightDisease !== "NA" ? "Comparison" : "Single disease"}</span>
        </div>

        <div className="analysis-stack">
          <div className="comparison-grid">
            <div className="card sub comparison-card">
              <div className="field">
                <label className="muted small">Disease 1</label>
                {isLoading ? (
                  <div className="skeleton input" />
                ) : (
                  <select className="select" value={leftDisease} onChange={(event) => onLeftDiseaseChange(event.target.value)}>
                    {nonHealthyDiseases.filter((item) => item !== rightDisease).map((item) => (
                      <option key={item} value={item}>{diseaseLabel(item)}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
            <div className="card sub comparison-card">
              <div className="field">
                <label className="muted small">Disease 2</label>
                {isLoading ? (
                  <div className="skeleton input" />
                ) : (
                  <select className="select" value={rightDisease} onChange={(event) => onRightDiseaseChange(event.target.value)}>
                    <option value="NA">NA</option>
                    {nonHealthyDiseases.filter((item) => item !== leftDisease).map((item) => (
                      <option key={item} value={item}>{diseaseLabel(item)}</option>
                    ))}
                  </select>
                )}
              </div>
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
                    <div />
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
                    {groupedCellTypes.map(([group, items]) => {
                      const groupClass = items.length <= 2
                        ? "multi-select-group tiny"
                        : items.length <= 4
                          ? "multi-select-group compact"
                          : "multi-select-group";
                      const selectedCount = items.filter((item) => selectedCellTypes.includes(item)).length;
                      const allSelected = selectedCount === items.length;
                      const indeterminate = selectedCount > 0 && !allSelected;
                      const groupLabelText = items.length === 1 ? items[0] : group;

                      return (
                      <div key={group} className={groupClass}>
                        <div className="group-header">
                          <label className="group-toggle">
                            <span className="group-label">{groupLabelText}</span>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = indeterminate;
                              }}
                              onChange={() => handleToggleGroup(items)}
                            />
                          </label>
                        </div>
                        {items.length > 1 ? items.map((item) => (
                          <label key={item} className="multi-select-option">
                            <input
                              type="checkbox"
                              checked={selectedCellTypes.includes(item)}
                              onChange={() => handleToggleCellType(item)}
                            />
                            <span>{item}</span>
                          </label>
                        )) : null}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
