import type { Manifest } from "../lib/types";

type AnalysisSetupProps = {
  manifest: Manifest | null;
  selectedCellTypes: string[];
  onSelectedCellTypesChange: (next: string[]) => void;
};

export default function AnalysisSetup({
  manifest,
  selectedCellTypes,
  onSelectedCellTypesChange,
}: AnalysisSetupProps) {
  const cellTypes = manifest?.cell_types ?? [];

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
      .filter(([, values]) => values.length > 0)
      .sort(([, a], [, b]) => b.length - a.length);
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
        </div>
        <div className="analysis-stack">
          <div className="row gap">
            <div className="field">
              <div className="row between">
                <label className="label">Cell types</label>
                <div className="row gap-sm">
                  <button type="button" className="btn btn-sm ghost" onClick={handleSelectAllCellTypes}>
                    Select all
                  </button>
                  <button type="button" className="btn btn-sm ghost" onClick={handleClearCellTypes}>
                    Clear
                  </button>
                </div>
              </div>
              <div className="multi-select-options grouped">
                {groupedCellTypes.map(([groupName, items]) => {
                  const allSelected = items.every((item) => selectedCellTypes.includes(item));
                  const someSelected = items.some((item) => selectedCellTypes.includes(item));
                  const isSingleItem = items.length === 1;
                  
                  return (
                    <div key={groupName} className={`multi-select-group ${items.length <= 3 ? 'tiny' : items.length <= 6 ? 'compact' : ''}`}>
                      {isSingleItem ? (
                        <div className="multi-select-option">
                          <input
                            type="checkbox"
                            checked={selectedCellTypes.includes(items[0])}
                            onChange={() => handleToggleCellType(items[0])}
                          />
                          <span>{items[0]}</span>
                        </div>
                      ) : (
                        <>
                          <div className="group-header">
                            <span className="group-label">{groupName}</span>
                            <input
                              type="checkbox"
                              checked={allSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someSelected && !allSelected;
                              }}
                              onChange={() => handleToggleGroup(items)}
                            />
                          </div>
                          {items.map((cellType) => (
                            <div key={cellType} className="multi-select-option">
                              <input
                                type="checkbox"
                                checked={selectedCellTypes.includes(cellType)}
                                onChange={() => handleToggleCellType(cellType)}
                              />
                              <span>{cellType}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}