import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import Header from "./components/Header";
import AnalysisSetup from "./components/AnalysisSetup";
import Visualization from "./components/Visualization";
import SettingsModal from "./components/SettingsModal";
import { DEFAULT_RESOLVED_BASE, fetchAccessions, fetchManifest, fetchMarkers } from "./lib/api";
import { clearStoredApiBase, getStoredApiBase, setStoredApiBase } from "./lib/storage";
import type { Accession, Manifest, Mode } from "./lib/types";

export default function App() {
  const storedBase = getStoredApiBase();
  const [apiBase, setApiBase] = useState(storedBase ?? DEFAULT_RESOLVED_BASE);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [manifestStatus, setManifestStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [backendReachable, setBackendReachable] = useState<boolean | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  const [cellType, setCellType] = useState("");
  const [disease, setDisease] = useState("");
  const [leftDisease, setLeftDisease] = useState("");
  const [rightDisease, setRightDisease] = useState("");
  const [accessionsByDisease, setAccessionsByDisease] = useState<Record<string, Accession[]>>({});
  const [selectedSingleAcc, setSelectedSingleAcc] = useState<string[]>([]);
  const [selectedLeftAcc, setSelectedLeftAcc] = useState<string[]>([]);
  const [selectedRightAcc, setSelectedRightAcc] = useState<string[]>([]);
  const [markerPanel, setMarkerPanel] = useState("default");
  const [markerGenes, setMarkerGenes] = useState<string[]>([]);
  const [markersLoading, setMarkersLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const isLoading = manifestStatus !== "loaded";

  const markerPanels = useMemo(() => {
    const panels = Object.keys(manifest?.marker_panels ?? {});
    return panels.length > 0 ? panels : ["default"];
  }, [manifest]);

  const healthyIds = useMemo(() => {
    return (accessionsByDisease.Healthy ?? []).map((row) => row.id);
  }, [accessionsByDisease]);

  const selectedAccessionCount = useMemo(() => {
    const all = new Set<string>();
    healthyIds.forEach((id) => all.add(id));
    if (mode === "single") {
      selectedSingleAcc.forEach((id) => all.add(id));
    } else {
      selectedLeftAcc.forEach((id) => all.add(id));
      selectedRightAcc.forEach((id) => all.add(id));
    }
    return all.size;
  }, [healthyIds, mode, selectedSingleAcc, selectedLeftAcc, selectedRightAcc]);

  const loadAccessionsForDisease = useCallback(
    async (targetDisease: string, onSeedSelection?: (rows: Accession[]) => void) => {
      if (!targetDisease) return;
      try {
        const response = await fetchAccessions(apiBase, targetDisease);
        if (!response.ok) {
          throw new Error("accessions.ok=false");
        }
        setAccessionsByDisease((prev) => ({ ...prev, [targetDisease]: response.accessions }));
        if (onSeedSelection) {
          onSeedSelection(response.accessions);
        }
      } catch (error) {
        setErrorMessage(`Accessions fetch failed for ${targetDisease}: ${String((error as Error).message ?? error)}`);
      }
    },
    [apiBase],
  );

  const loadMarkersForPanel = useCallback(
    async (panel: string) => {
      setMarkersLoading(true);
      try {
        const response = await fetchMarkers(apiBase, panel);
        if (!response.ok) {
          throw new Error("markers.ok=false");
        }
        setMarkerGenes(response.genes);
      } catch (error) {
        setErrorMessage(`Markers fetch failed for ${panel}: ${String((error as Error).message ?? error)}`);
      } finally {
        setMarkersLoading(false);
      }
    },
    [apiBase],
  );

  const loadManifest = useCallback(async () => {
    setManifestStatus("loading");
    setErrorMessage(null);
    setManifest(null);
    setAccessionsByDisease({});
    setMarkerGenes([]);
    try {
      const response = await fetchManifest(apiBase);
      if (!response.ok) {
        throw new Error("manifest.ok=false");
      }
      setManifest(response);
      setManifestStatus("loaded");
      setBackendReachable(true);
      setLastLoadedAt(new Date());

      if (import.meta.env.DEV) {
        console.assert(response.diseases.includes("Healthy"), "Manifest should include Healthy disease");
      }

      const nonHealthy = response.diseases.filter((item) => item !== "Healthy");
      const nextDisease = nonHealthy[0] ?? "";
      const nextLeft = nonHealthy[0] ?? "";
      const nextRight = nonHealthy[1] ?? nonHealthy[0] ?? "";
      const resolvedDisease = nonHealthy.includes(disease) ? disease : nextDisease;
      const resolvedLeft = nonHealthy.includes(leftDisease) ? leftDisease : nextLeft;
      const resolvedRight = nonHealthy.includes(rightDisease) ? rightDisease : nextRight;

      setCellType(response.cell_types[0] ?? "");
      setDisease(resolvedDisease);
      setLeftDisease(resolvedLeft);
      setRightDisease(resolvedRight);

      await loadAccessionsForDisease("Healthy");
      await loadAccessionsForDisease(resolvedDisease, (rows) => {
        setSelectedSingleAcc(rows.map((row) => row.id));
      });
      await loadAccessionsForDisease(resolvedLeft, (rows) => {
        setSelectedLeftAcc(rows.map((row) => row.id));
      });
      await loadAccessionsForDisease(resolvedRight, (rows) => {
        setSelectedRightAcc(rows.map((row) => row.id));
      });

      const panelKeys = Object.keys(response.marker_panels ?? {});
      const defaultPanel = panelKeys.includes("default") ? "default" : panelKeys[0] ?? "default";
      setMarkerPanel(defaultPanel);
      await loadMarkersForPanel(defaultPanel);
    } catch (error) {
      setManifestStatus("error");
      setBackendReachable(false);
      setErrorMessage(`Manifest fetch failed: ${String((error as Error).message ?? error)}`);
    }
  }, [apiBase, disease, leftDisease, rightDisease, loadAccessionsForDisease, loadMarkersForPanel]);

  useEffect(() => {
    loadManifest();
  }, [apiBase]);

  const handleDiseaseChange = (nextDisease: string) => {
    setDisease(nextDisease);
    loadAccessionsForDisease(nextDisease, (rows) => {
      const rowIds = new Set(rows.map((row) => row.id));
      setSelectedSingleAcc((prev) => prev.filter((id) => rowIds.has(id)));
    });
  };

  const handleLeftDiseaseChange = (nextDisease: string) => {
    setLeftDisease(nextDisease);
    loadAccessionsForDisease(nextDisease, (rows) => {
      const rowIds = new Set(rows.map((row) => row.id));
      setSelectedLeftAcc((prev) => prev.filter((id) => rowIds.has(id)));
    });
  };

  const handleRightDiseaseChange = (nextDisease: string) => {
    setRightDisease(nextDisease);
    loadAccessionsForDisease(nextDisease, (rows) => {
      const rowIds = new Set(rows.map((row) => row.id));
      setSelectedRightAcc((prev) => prev.filter((id) => rowIds.has(id)));
    });
  };

  const handleMarkerPanelChange = (panel: string) => {
    setMarkerPanel(panel);
    loadMarkersForPanel(panel);
  };

  const handleSaveApiBase = (nextBase: string) => {
    setStoredApiBase(nextBase);
    setApiBase(nextBase);
    setSettingsOpen(false);
  };

  const handleResetApiBase = () => {
    clearStoredApiBase();
    setApiBase(DEFAULT_RESOLVED_BASE);
    setSettingsOpen(false);
  };

  const lastLoadedLabel = lastLoadedAt
    ? lastLoadedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="page">
      <Header manifest={manifest} onReload={loadManifest} onOpenSettings={() => setSettingsOpen(true)} />

      {errorMessage ? (
        <div className="error-banner">
          <strong>Errors:</strong> {errorMessage}
        </div>
      ) : null}

      <div className="status-strip">
        <span className={`status-dot ${backendReachable ? "ok" : backendReachable === false ? "bad" : "idle"}`} />
        <span className="status-label">
          Backend {backendReachable ? "reachable" : backendReachable === false ? "unreachable" : "status unknown"}
        </span>
        <span className="status-sep" />
        <span className="muted small">Last manifest load: {lastLoadedLabel}</span>
      </div>

      <div className="grid">
        <AnalysisSetup
          manifest={manifest}
          isLoading={isLoading}
          mode={mode}
          onModeChange={setMode}
          cellType={cellType}
          onCellTypeChange={setCellType}
          disease={disease}
          onDiseaseChange={handleDiseaseChange}
          leftDisease={leftDisease}
          rightDisease={rightDisease}
          onLeftDiseaseChange={handleLeftDiseaseChange}
          onRightDiseaseChange={handleRightDiseaseChange}
          accessionsByDisease={accessionsByDisease}
          selectedSingleAcc={selectedSingleAcc}
          onSelectedSingleAccChange={setSelectedSingleAcc}
          selectedLeftAcc={selectedLeftAcc}
          onSelectedLeftAccChange={setSelectedLeftAcc}
          selectedRightAcc={selectedRightAcc}
          onSelectedRightAccChange={setSelectedRightAcc}
          totalSelected={selectedAccessionCount}
        />
        <Visualization
          manifest={manifest}
          isLoading={isLoading}
          mode={mode}
          onModeChange={setMode}
          disease={disease}
          leftDisease={leftDisease}
          rightDisease={rightDisease}
          cellType={cellType}
          selectedAccessionCount={selectedAccessionCount}
          markerPanels={markerPanels}
          markerPanel={markerPanel}
          onMarkerPanelChange={handleMarkerPanelChange}
          markerGenes={markerGenes}
          markersLoading={markersLoading}
        />
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        apiBase={apiBase}
        defaultApiBase={DEFAULT_RESOLVED_BASE}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveApiBase}
        onReset={handleResetApiBase}
      />
    </div>
  );
}
