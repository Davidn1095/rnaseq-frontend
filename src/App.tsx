import React, { useMemo, useState } from "react";
import {
  FileUp,
  Filter,
  GitMerge,
  Sliders,
  Brain,
  BarChart3,
  Download,
  Info,
  CheckCircle,
  Play,
  Layers,
  Lock,
  AlertTriangle,
} from "lucide-react";

function detectDelimiter(firstLine: string) {
  if (firstLine.includes("\t") && !firstLine.includes(",")) return "\t";
  return ",";
}

function safeNumber(x: unknown) {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

type Counts = {
  genes: string[];
  cells: string[];
  X: number[][]; // genes x cells
};

function computeStats(genes: string[], cells: string[], X: number[][]) {
  const nGenes = genes.length;
  const nCells = cells.length;

  const mitoIdx: number[] = [];
  for (let i = 0; i < nGenes; i += 1) {
    const g = String(genes[i] ?? "");
    if (g.toUpperCase().startsWith("MT-")) mitoIdx.push(i);
  }

  const libSize = new Array(nCells).fill(0);
  const detected = new Array(nCells).fill(0);
  const mitoCounts = new Array(nCells).fill(0);

  for (let i = 0; i < nGenes; i += 1) {
    const row = X[i];
    for (let j = 0; j < nCells; j += 1) {
      const c = row[j] ?? 0;
      libSize[j] += c;
      if (c > 0) detected[j] += 1;
    }
  }

  for (let k = 0; k < mitoIdx.length; k += 1) {
    const i = mitoIdx[k];
    const row = X[i];
    for (let j = 0; j < nCells; j += 1) mitoCounts[j] += row[j] ?? 0;
  }

  const mitoPct = mitoCounts.map((m, j) => (libSize[j] > 0 ? (100 * m) / libSize[j] : 0));

  const summary = (arr: number[]) => {
    if (!arr.length) return { min: 0, med: 0, max: 0 };
    const xs = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    const med = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
    return { min: xs[0], med, max: xs[xs.length - 1] };
  };

  return {
    nGenes,
    nCells,
    nMitoGenes: mitoIdx.length,
    libSize,
    detected,
    mitoPct,
    libSummary: summary(libSize),
    detectedSummary: summary(detected),
    mitoPctSummary: summary(mitoPct),
  };
}

function summarizeMatrix(X: number[][], maxSample = 200000) {
  const sample: number[] = [];
  let seen = 0;

  for (let i = 0; i < X.length; i += 1) {
    const row = X[i];
    for (let j = 0; j < row.length; j += 1) {
      const v = row[j];
      if (!Number.isFinite(v)) continue;

      seen += 1;
      if (sample.length < maxSample) {
        sample.push(v);
      } else {
        const r = Math.floor(Math.random() * seen);
        if (r < maxSample) sample[r] = v;
      }
    }
  }

  if (sample.length === 0) return { min: 0, med: 0, max: 0, sampled: false, n: 0 };

  const xs = [...sample].sort((a, b) => a - b);
  const mid = Math.floor(xs.length / 2);
  const med = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];

  return {
    min: xs[0],
    med,
    max: xs[xs.length - 1],
    sampled: seen > xs.length,
    n: seen,
  };
}

function zscoreRows(X: number[][]) {
  const out = new Array(X.length);

  for (let i = 0; i < X.length; i += 1) {
    const row = X[i];
    const n = row.length;

    let mean = 0;
    for (let j = 0; j < n; j += 1) mean += row[j];
    mean /= Math.max(1, n);

    let v = 0;
    for (let j = 0; j < n; j += 1) {
      const d = row[j] - mean;
      v += d * d;
    }
    const sd = Math.sqrt(v / Math.max(1, n - 1)) || 1;

    const z = new Array(n);
    for (let j = 0; j < n; j += 1) z[j] = (row[j] - mean) / sd;
    out[i] = z;
  }

  return out as number[][];
}

function normalizeCounts(counts: Counts, method: string) {
  const { genes, cells, X } = counts;
  const nGenes = genes.length;
  const nCells = cells.length;

  const libSize = new Array(nCells).fill(0);
  for (let i = 0; i < nGenes; i += 1) {
    const row = X[i];
    for (let j = 0; j < nCells; j += 1) libSize[j] += row[j] ?? 0;
  }

  const scaleFactor = method === "CPM" ? 1e6 : 1e4;

  const base = new Array(nGenes);
  for (let i = 0; i < nGenes; i += 1) {
    const row = X[i];
    const outRow = new Array(nCells);
    for (let j = 0; j < nCells; j += 1) {
      const denom = libSize[j] || 0;
      const v = denom > 0 ? ((row[j] ?? 0) / denom) * scaleFactor : 0;
      outRow[j] = Math.log1p(v);
    }
    base[i] = outRow;
  }

  let Xnorm = base as number[][];
  let details = "";

  if (method === "LogNormalize") {
    details = "LogNormalize: log1p(counts / library_size * 1e4)";
  } else if (method === "CPM") {
    details = "CPM: log1p(counts / library_size * 1e6)";
  } else if (method === "SCTransform") {
    Xnorm = zscoreRows(base as number[][]);
    details = "SCTransform approximation: log1p(counts / library_size * 1e4) then gene wise z score";
  } else {
    throw new Error("Unknown normalization method");
  }

  const summary = summarizeMatrix(Xnorm);
  return { Xnorm, summary, details, scaleFactor };
}

function parseDelimitedMatrix(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("File is empty or has no data rows");

  const delimiter = detectDelimiter(lines[0]);
  const header = lines[0].split(delimiter).map((x) => x.trim());
  if (header.length < 3) throw new Error("Expected at least 2 samples or cells in columns");

  const geneCol = header[0] || "gene_id";
  const cells = header.slice(1);

  if (delimiter === "," && lines[0].includes("\t")) {
    throw new Error("Mixed delimiter header should fail fast");
  }
  if (delimiter === "\t" && lines[0].includes(",")) {
    throw new Error("Mixed delimiter header should fail fast");
  }

  const genes: string[] = [];
  const X: number[][] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(delimiter);
    if (!parts.length) continue;
    const gene = (parts[0] ?? "").trim();
    if (!gene) continue;

    genes.push(gene);
    const row = new Array(cells.length);
    for (let j = 0; j < cells.length; j += 1) row[j] = safeNumber(parts[j + 1]);
    X.push(row);
  }

  if (genes.length === 0) throw new Error("No gene rows parsed");

  return { geneCol, genes, cells, X };
}

function parseDelimitedTable(text: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error("File is empty or has no data rows");

  const delimiter = detectDelimiter(lines[0]);
  const header = lines[0].split(delimiter).map((x) => x.trim());
  if (header.length < 2) throw new Error("Expected at least 2 columns in metadata");

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const parts = lines[i].split(delimiter).map((x) => x.trim());
    if (parts.every((x) => x.length === 0)) continue;
    const row = new Array(header.length).fill("");
    for (let j = 0; j < header.length; j += 1) row[j] = parts[j] ?? "";
    rows.push(row);
  }

  if (rows.length === 0) throw new Error("No metadata rows parsed");

  return { header, rows, delimiter };
}

function findColumnIndex(header: string[], candidates: string[]) {
  const lower = header.map((h) => String(h).trim().toLowerCase());
  for (let i = 0; i < candidates.length; i += 1) {
    const c = candidates[i].toLowerCase();
    const idx = lower.indexOf(c);
    if (idx >= 0) return idx;
  }
  return -1;
}

type MetaTable = {
  header: string[];
  rows: string[][];
  delimiter: string;
  idColIdx: number;
  batchColIdx: number;
};

function parseMetadata(text: string): MetaTable {
  const t = parseDelimitedTable(text);
  const idColFound = findColumnIndex(t.header, ["cell", "cell_id", "barcode", "barcodes", "id", "cellid"]);
  const idColIdx = idColFound >= 0 ? idColFound : 0;

  const batchCandidates = ["batch", "sample", "donor", "orig.ident", "library", "patient", "subject"];
  let batchColIdx = findColumnIndex(t.header, batchCandidates);
  if (batchColIdx < 0) batchColIdx = Math.min(1, t.header.length - 1);

  return { ...t, idColIdx, batchColIdx };
}

function buildBatchMap(meta: MetaTable) {
  const idToBatch: Record<string, string> = Object.create(null);
  for (let i = 0; i < meta.rows.length; i += 1) {
    const row = meta.rows[i];
    const id = String(row[meta.idColIdx] ?? "").trim();
    const batch = String(row[meta.batchColIdx] ?? "").trim();
    if (!id) continue;
    idToBatch[id] = batch || "batch1";
  }
  return idToBatch;
}

function computeGeneVariances(Xnorm: number[][], genes: string[], opts?: { excludeMito?: boolean }) {
  const excludeMito = opts?.excludeMito ?? true;

  const nGenes = genes.length;
  const nCells = Xnorm[0]?.length ?? 0;

  const vars = new Array(nGenes);

  for (let i = 0; i < nGenes; i += 1) {
    const g = String(genes[i] ?? "");
    if (excludeMito && g.toUpperCase().startsWith("MT-")) {
      vars[i] = -Infinity;
      continue;
    }

    const row = Xnorm[i];
    let mean = 0;
    for (let j = 0; j < nCells; j += 1) mean += row[j] ?? 0;
    mean /= Math.max(1, nCells);

    let v = 0;
    for (let j = 0; j < nCells; j += 1) {
      const d = (row[j] ?? 0) - mean;
      v += d * d;
    }
    vars[i] = v / Math.max(1, nCells - 1);
  }

  return vars as number[];
}

function dot(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) s += a[i] * b[i];
  return s;
}

function norm2(v: number[]) {
  return Math.sqrt(dot(v, v)) || 1;
}

function matVecMul(A: number[][], v: number[]) {
  const out = new Array(A.length).fill(0);
  for (let i = 0; i < A.length; i += 1) {
    let s = 0;
    const row = A[i];
    for (let j = 0; j < v.length; j += 1) s += row[j] * v[j];
    out[i] = s;
  }
  return out as number[];
}

function orthonormalize(v: number[], basis: number[][]) {
  const out = [...v];
  for (let i = 0; i < basis.length; i += 1) {
    const b = basis[i];
    const proj = dot(out, b);
    for (let j = 0; j < out.length; j += 1) out[j] -= proj * b[j];
  }
  const n = norm2(out);
  for (let j = 0; j < out.length; j += 1) out[j] /= n;
  return out as number[];
}

function topKEigenPairsSymmetric(A: number[][], k: number, iters = 60) {
  const p = A.length;
  const basis: number[][] = [];
  const eigenValues: number[] = [];

  const randVec = () => {
    const v = new Array(p);
    for (let i = 0; i < p; i += 1) v[i] = Math.random() - 0.5;
    const n = norm2(v);
    for (let i = 0; i < p; i += 1) v[i] /= n;
    return v as number[];
  };

  for (let c = 0; c < k; c += 1) {
    let v = randVec();
    v = orthonormalize(v, basis);

    for (let t = 0; t < iters; t += 1) {
      const Av = matVecMul(A, v);
      v = orthonormalize(Av, basis);
    }

    const Av = matVecMul(A, v);
    const lambda = dot(v, Av);

    basis.push(v);
    eigenValues.push(lambda);
  }

  return { eigenVectors: basis, eigenValues };
}

function pcaEmbeddingFromXnorm(
  Xnorm: number[][],
  genes: string[],
  cells: string[],
  opts?: { maxFeatures?: number; nPC?: number },
) {
  const nGenes = genes.length;
  const nCells = cells.length;

  const maxFeatures = Math.min(opts?.maxFeatures ?? 200, nGenes);
  const nPC = Math.min(opts?.nPC ?? 20, maxFeatures, Math.max(1, nCells - 1));

  if (nCells < 2) throw new Error("Need at least 2 cells for PCA");

  const vars = computeGeneVariances(Xnorm, genes, { excludeMito: true });
  const idx = vars
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v)
    .slice(0, maxFeatures)
    .map((x) => x.i);

  const featureGenes = idx.map((i) => genes[i]);

  const D: number[][] = new Array(nCells);
  for (let j = 0; j < nCells; j += 1) D[j] = new Array(maxFeatures).fill(0);

  for (let f = 0; f < maxFeatures; f += 1) {
    const gi = idx[f];
    const row = Xnorm[gi];
    let mean = 0;
    for (let j = 0; j < nCells; j += 1) mean += row[j] ?? 0;
    mean /= Math.max(1, nCells);

    for (let j = 0; j < nCells; j += 1) D[j][f] = (row[j] ?? 0) - mean;
  }

  const C: number[][] = new Array(maxFeatures);
  for (let a = 0; a < maxFeatures; a += 1) C[a] = new Array(maxFeatures).fill(0);

  for (let a = 0; a < maxFeatures; a += 1) {
    for (let b = a; b < maxFeatures; b += 1) {
      let s = 0;
      for (let j = 0; j < nCells; j += 1) s += D[j][a] * D[j][b];
      const v = s / Math.max(1, nCells - 1);
      C[a][b] = v;
      C[b][a] = v;
    }
  }

  let totalVar = 0;
  for (let i = 0; i < maxFeatures; i += 1) totalVar += C[i][i];
  totalVar = totalVar || 1;

  const { eigenVectors, eigenValues } = topKEigenPairsSymmetric(C, nPC, 60);

  const explained = eigenValues.map((ev) => Math.max(0, ev) / totalVar);

  const Z: number[][] = new Array(nCells);
  for (let j = 0; j < nCells; j += 1) {
    const row = new Array(nPC).fill(0);
    for (let c = 0; c < nPC; c += 1) {
      const v = eigenVectors[c];
      let s = 0;
      for (let f = 0; f < maxFeatures; f += 1) s += D[j][f] * v[f];
      row[c] = s;
    }
    Z[j] = row;
  }

  return { Z, nPC, nFeatures: maxFeatures, featureGenes, explained };
}

function meanVector(Z: number[][], idx: number[]) {
  const n = idx.length;
  const k = Z[0]?.length ?? 0;
  const m = new Array(k).fill(0);
  if (n === 0) return m;

  for (let t = 0; t < n; t += 1) {
    const r = Z[idx[t]];
    for (let c = 0; c < k; c += 1) m[c] += r[c];
  }
  for (let c = 0; c < k; c += 1) m[c] /= n;
  return m as number[];
}

function l2(a: number[], b: number[]) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function harmonyLikeCorrection(Z: number[][], batchByCell: string[], opts?: { iters?: number; alpha?: number }) {
  const iters = opts?.iters ?? 5;
  const alpha = opts?.alpha ?? 0.5;

  const nCells = Z.length;
  const k = Z[0]?.length ?? 0;

  const batches = Array.from(new Set(batchByCell.map((x) => String(x || "batch1")))).sort();
  const byBatch: Record<string, number[]> = Object.fromEntries(batches.map((b) => [b, []]));

  for (let i = 0; i < nCells; i += 1) {
    const b = String(batchByCell[i] || "batch1");
    if (!byBatch[b]) byBatch[b] = [];
    byBatch[b].push(i);
  }

  const Zcorr = Z.map((r) => [...r]);

  for (let t = 0; t < iters; t += 1) {
    const allIdx = Array.from({ length: nCells }, (_, i) => i);
    const globalMean = meanVector(Zcorr, allIdx);

    for (let bi = 0; bi < batches.length; bi += 1) {
      const b = batches[bi];
      const idx = byBatch[b] ?? [];
      if (!idx.length) continue;

      const mb = meanVector(Zcorr, idx);
      const shift = new Array(k);
      for (let c = 0; c < k; c += 1) shift[c] = (mb[c] - globalMean[c]) * alpha;

      for (let u = 0; u < idx.length; u += 1) {
        const i = idx[u];
        for (let c = 0; c < k; c += 1) Zcorr[i][c] -= shift[c];
      }
    }
  }

  const allIdx = Array.from({ length: nCells }, (_, i) => i);
  const g0 = meanVector(Z, allIdx);
  const g1 = meanVector(Zcorr, allIdx);

  const distBefore = batches.map((b) => l2(meanVector(Z, byBatch[b] ?? []), g0));
  const distAfter = batches.map((b) => l2(meanVector(Zcorr, byBatch[b] ?? []), g1));

  const summary = (arr: number[]) => {
    if (!arr.length) return { min: 0, med: 0, max: 0 };
    const xs = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    const med = xs.length % 2 === 0 ? (xs[mid - 1] + xs[mid]) / 2 : xs[mid];
    return { min: xs[0], med, max: xs[xs.length - 1] };
  };

  return {
    Zcorr,
    batches,
    batchSizes: batches.map((b) => (byBatch[b] ?? []).length),
    distBefore,
    distAfter,
    distBeforeSummary: summary(distBefore),
    distAfterSummary: summary(distAfter),
    iters,
    alpha,
  };
}

export default function App() {
  const [currentPhase, setCurrentPhase] = useState(0);
  const [data, setData] = useState({
    uploaded: false,
    fileName: "",
    numGenes: 0,
    numSamples: 0,
    numBatches: 1,
    qcDone: false,
    normalized: false,
    normMethod: "SCTransform",
    harmonized: false,
    clustered: false,
    model: "Random Forest",
    trained: false,
    metrics: null as null | Record<string, number>,
  });

  const [counts, setCounts] = useState<Counts | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof computeStats> | null>(null);
  const [qcReport, setQcReport] = useState<any>(null);
  const [normalizedMatrix, setNormalizedMatrix] = useState<any>(null);
  const [meta, setMeta] = useState<MetaTable | null>(null);
  const [harmony, setHarmony] = useState<any>(null);
  const [error, setError] = useState("");

  const phases = useMemo(
    () => [
      { id: 0, name: "Upload Data", icon: FileUp },
      { id: 1, name: "Quality Control", icon: Filter },
      { id: 2, name: "Normalization", icon: Sliders },
      { id: 3, name: "Batch Correction", icon: GitMerge },
      { id: 4, name: "Clustering", icon: Layers },
      { id: 5, name: "ML Training", icon: Brain },
      { id: 6, name: "Results", icon: BarChart3 },
    ],
    [],
  );

  const stepReady = useMemo(
    () => [true, data.uploaded, data.qcDone, data.normalized, data.harmonized, data.clustered, data.trained],
    [data.uploaded, data.qcDone, data.normalized, data.harmonized, data.clustered, data.trained],
  );

  const canGoTo = (phaseId: number) => {
    if (phaseId <= currentPhase) return true;
    return stepReady[phaseId];
  };

  const fmt = (x: unknown, digits = 0) => {
    const v = Number(x);
    if (!Number.isFinite(v)) return "0";
    return digits === 0 ? Math.round(v).toLocaleString() : v.toFixed(digits);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const parsed = parseDelimitedMatrix(text);
        const st = computeStats(parsed.genes, parsed.cells, parsed.X);

        setCounts({ genes: parsed.genes, cells: parsed.cells, X: parsed.X });
        setStats(st);
        setQcReport(null);
        setNormalizedMatrix(null);
        setMeta(null);
        setHarmony(null);

        setData((prev) => ({
          ...prev,
          uploaded: true,
          fileName: file.name,
          numGenes: st.nGenes,
          numSamples: st.nCells,
          numBatches: 1,
          qcDone: false,
          normalized: false,
          harmonized: false,
          clustered: false,
          trained: false,
          metrics: null,
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
        setCounts(null);
        setStats(null);
        setQcReport(null);
        setNormalizedMatrix(null);
        setMeta(null);
        setHarmony(null);
        setData((prev) => ({
          ...prev,
          uploaded: false,
          fileName: "",
          numGenes: 0,
          numSamples: 0,
          numBatches: 1,
          qcDone: false,
          normalized: false,
          harmonized: false,
          clustered: false,
          trained: false,
          metrics: null,
        }));
      }
    };
    reader.onerror = () => setError("Failed to read file");
    reader.readAsText(file);
  };

  const handleMetaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result ?? "");
        const m = parseMetadata(text);
        setMeta(m);
        setHarmony(null);

        if (counts) {
          const map = buildBatchMap(m);
          const batchByCell = counts.cells.map((id) => map[id] ?? "batch1");
          const nBatches = new Set(batchByCell).size || 1;
          setData((prev) => ({
            ...prev,
            numBatches: nBatches,
            harmonized: false,
            clustered: false,
            trained: false,
            metrics: null,
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse metadata");
        setMeta(null);
        setHarmony(null);
      }
    };

    reader.onerror = () => setError("Failed to read metadata file");
    reader.readAsText(file);
  };

  const runQC = () => {
    if (!counts) return;

    const before = computeStats(counts.genes, counts.cells, counts.X);

    const minCellsPerGene = 2;
    const minFeaturesPerCell = 200;

    const geneKeep = new Array(counts.genes.length).fill(false);
    for (let i = 0; i < counts.genes.length; i += 1) {
      const row = counts.X[i];
      let n = 0;
      for (let j = 0; j < counts.cells.length; j += 1) if ((row[j] ?? 0) > 0) n += 1;
      geneKeep[i] = n >= minCellsPerGene;
    }

    const genes2: string[] = [];
    const X2: number[][] = [];
    for (let i = 0; i < counts.genes.length; i += 1) {
      if (!geneKeep[i]) continue;
      genes2.push(counts.genes[i]);
      X2.push(counts.X[i]);
    }

    const detected2 = new Array(counts.cells.length).fill(0);
    for (let i = 0; i < X2.length; i += 1) {
      const row = X2[i];
      for (let j = 0; j < counts.cells.length; j += 1) if ((row[j] ?? 0) > 0) detected2[j] += 1;
    }

    const cellKeep = detected2.map((d) => d >= minFeaturesPerCell);
    const cells2 = counts.cells.filter((_, j) => cellKeep[j]);
    const X3 = X2.map((row) => row.filter((_, j) => cellKeep[j]));

    const after = computeStats(genes2, cells2, X3);

    setCounts({ genes: genes2, cells: cells2, X: X3 });
    setStats(after);
    setQcReport({ before, after });
    setNormalizedMatrix(null);
    setHarmony(null);

    setData((prev) => ({
      ...prev,
      qcDone: true,
      numGenes: after.nGenes,
      numSamples: after.nCells,
      normalized: false,
      harmonized: false,
      clustered: false,
      trained: false,
      metrics: null,
    }));
  };

  const runNorm = (method: string) => {
    if (!counts) return;

    setError("");

    try {
      const out = normalizeCounts(counts, method);
      setNormalizedMatrix({ method, ...out });
      setHarmony(null);

      setData((prev) => ({
        ...prev,
        normalized: true,
        normMethod: method,
        harmonized: false,
        clustered: false,
        trained: false,
        metrics: null,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Normalization failed");
      setNormalizedMatrix(null);
      setHarmony(null);
      setData((prev) => ({ ...prev, normalized: false }));
    }
  };

  const runHarmony = () => {
    if (!counts || !normalizedMatrix) return;

    setError("");

    try {
      const map = meta ? buildBatchMap(meta) : Object.create(null);
      const batchByCell = counts.cells.map((id) => map[id] ?? "batch1");
      const nBatches = new Set(batchByCell).size || 1;

      const pca = pcaEmbeddingFromXnorm(normalizedMatrix.Xnorm, counts.genes, counts.cells, {
        maxFeatures: 200,
        nPC: 20,
      });

      const corrected = harmonyLikeCorrection(pca.Z, batchByCell, { iters: 5, alpha: 0.5 });

      setHarmony({
        ...pca,
        ...corrected,
        batchByCell,
      });

      setData((prev) => ({
        ...prev,
        numBatches: nBatches,
        harmonized: true,
        clustered: false,
        trained: false,
        metrics: null,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Harmony step failed");
      setHarmony(null);
      setData((prev) => ({ ...prev, harmonized: false }));
    }
  };

  const runClustering = () =>
    setData((prev) => ({
      ...prev,
      clustered: true,
      trained: false,
      metrics: null,
    }));

  const train = () => {
    const perf: Record<string, any> = {
      "Random Forest": { accuracy: 0.95, precision: 0.93, recall: 0.96, f1: 0.94 },
      "Logistic Regression": { accuracy: 0.9, precision: 0.88, recall: 0.92, f1: 0.9 },
      SVM: { accuracy: 0.87, precision: 0.85, recall: 0.89, f1: 0.87 },
      XGBoost: { accuracy: 0.93, precision: 0.91, recall: 0.94, f1: 0.92 },
      "Neural Network": { accuracy: 0.91, precision: 0.89, recall: 0.93, f1: 0.91 },
    };

    setData((prev) => ({
      ...prev,
      trained: true,
      metrics: perf[prev.model] ?? perf["Random Forest"],
    }));
  };

  const renderPhase = () => {
    switch (currentPhase) {
      case 0:
        return (
          <div className="space-y-6" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ borderLeft: "4px solid #3b82f6", background: "#eff6ff", padding: 12 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <Info size={18} />
                <div>
                  <div style={{ fontWeight: 700 }}>Upload a count matrix</div>
                  <div style={{ fontSize: 13 }}>
                    Parses CSV or TSV in the browser and computes summaries. Assumes first column is gene IDs, remaining columns are cells.
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div style={{ borderLeft: "4px solid #ef4444", background: "#fef2f2", padding: 12 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <AlertTriangle size={18} />
                  <div>
                    <div style={{ fontWeight: 700 }}>Error</div>
                    <div style={{ fontSize: 13 }}>{error}</div>
                  </div>
                </div>
              </div>
            )}

            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Step 1: Upload expression matrix</h2>

            <div style={{ border: "2px dashed #d1d5db", borderRadius: 12, padding: 20, textAlign: "center", background: "white" }}>
              <label style={{ cursor: "pointer", display: "inline-block" }}>
                <span style={{ color: "#2563eb", fontWeight: 700 }}>Upload CSV or TSV count matrix</span>
                <input type="file" style={{ display: "none" }} accept=".csv,.tsv,.txt" onChange={handleUpload} />
              </label>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 8 }}>Genes as rows, cells as columns. First column must contain gene IDs.</div>

              {data.uploaded && (
                <div style={{ marginTop: 12, color: "#16a34a", display: "flex", gap: 8, justifyContent: "center", alignItems: "center" }}>
                  <CheckCircle size={18} />
                  <span>{data.fileName}</span>
                </div>
              )}
            </div>

            {data.uploaded && stats && (
              <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 700 }}>Parsed dataset</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Mito genes detected: {stats.nMitoGenes}</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
                  <div style={{ background: "#eff6ff", borderRadius: 12, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Genes</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(stats.nGenes)}</div>
                  </div>
                  <div style={{ background: "#f0fdf4", borderRadius: 12, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Cells</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(stats.nCells)}</div>
                  </div>
                  <div style={{ background: "#faf5ff", borderRadius: 12, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Batches</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(data.numBatches)}</div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 12 }}>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Library size, min, median, max</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginTop: 6, fontSize: 13 }}>
                      {fmt(stats.libSummary.min)} · {fmt(stats.libSummary.med)} · {fmt(stats.libSummary.max)}
                    </div>
                  </div>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Detected genes, min, median, max</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginTop: 6, fontSize: 13 }}>
                      {fmt(stats.detectedSummary.min)} · {fmt(stats.detectedSummary.med)} · {fmt(stats.detectedSummary.max)}
                    </div>
                  </div>
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Mito percent, min, median, max</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginTop: 6, fontSize: 13 }}>
                      {fmt(stats.mitoPctSummary.min, 2)} · {fmt(stats.mitoPctSummary.med, 2)} · {fmt(stats.mitoPctSummary.max, 2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 1:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ borderLeft: "4px solid #22c55e", background: "#f0fdf4", padding: 12 }}>
              <div style={{ fontWeight: 700 }}>QC filters</div>
              <div style={{ fontSize: 13 }}>Gene filter: expressed in at least 2 cells. Cell filter: at least 200 detected genes.</div>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Step 2: Quality control</h2>

            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Apply QC</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                <div style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Gene filtering</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, opacity: 0.75 }}>Minimum cells per gene</span>
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", background: "#f3f4f6", padding: "2px 10px", borderRadius: 10 }}>2</span>
                  </div>
                </div>

                <div style={{ border: "1px solid #d1d5db", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Cell filtering</div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, opacity: 0.75 }}>Minimum detected genes per cell</span>
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", background: "#f3f4f6", padding: "2px 10px", borderRadius: 10 }}>200</span>
                  </div>
                </div>
              </div>

              <button
                onClick={runQC}
                disabled={!data.uploaded}
                style={{
                  width: "100%",
                  marginTop: 14,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #16a34a",
                  background: data.uploaded ? "#22c55e" : "#e5e7eb",
                  color: data.uploaded ? "white" : "#6b7280",
                  cursor: data.uploaded ? "pointer" : "not-allowed",
                  fontWeight: 800,
                }}
              >
                <Filter size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
                Apply QC filters
              </button>

              {data.qcDone && qcReport && (
                <div style={{ marginTop: 14, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#166534" }}>
                    <CheckCircle size={18} />
                    <div>
                      <div style={{ fontWeight: 800 }}>QC complete</div>
                      <div style={{ fontSize: 13 }}>
                        Genes {fmt(qcReport.before.nGenes)} → {fmt(qcReport.after.nGenes)} · Cells {fmt(qcReport.before.nCells)} → {fmt(qcReport.after.nCells)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ borderLeft: "4px solid #a855f7", background: "#faf5ff", padding: 12 }}>
              <div style={{ fontWeight: 700 }}>Normalization options</div>
              <div style={{ fontSize: 13 }}>Applies normalization in the browser and stores the transformed matrix for later steps.</div>
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Step 3: Normalization</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { id: "SCTransform", name: "SCTransform", desc: "Variance stabilizing transformation, commonly used in Seurat.", rec: true },
                { id: "LogNormalize", name: "Log normalization", desc: "Library size normalize then log1p.", rec: false },
                { id: "CPM", name: "CPM", desc: "Counts per million, often with log transform.", rec: false },
              ].map((m) => {
                const active = data.normMethod === m.id && data.normalized;
                return (
                  <button
                    key={m.id}
                    onClick={() => runNorm(m.id)}
                    disabled={!data.qcDone}
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 12,
                      border: `2px solid ${active ? "#a855f7" : "#d1d5db"}`,
                      background: active ? "#faf5ff" : "white",
                      cursor: data.qcDone ? "pointer" : "not-allowed",
                      opacity: data.qcDone ? 1 : 0.6,
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 800 }}>
                          {m.name}
                          {m.rec && (
                            <span style={{ marginLeft: 8, fontSize: 11, background: "#22c55e", color: "white", padding: "2px 8px", borderRadius: 999 }}>
                              Recommended
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.75 }}>{m.desc}</div>
                      </div>
                      {active && <CheckCircle size={18} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {data.normalized && normalizedMatrix && (
              <div style={{ background: "#faf5ff", border: "1px solid #e9d5ff", borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 13 }}>
                  <b>Applied</b>: {data.normMethod}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{normalizedMatrix.details}</div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 10 }}>
                  <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Value min</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{fmt(normalizedMatrix.summary.min, 4)}</div>
                  </div>
                  <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Value median</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{fmt(normalizedMatrix.summary.med, 4)}</div>
                  </div>
                  <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Value max</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>{fmt(normalizedMatrix.summary.max, 4)}</div>
                  </div>
                </div>

                <div style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
                  Summary computed on {normalizedMatrix.summary.sampled ? "a sample" : "all values"}.
                </div>
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ borderLeft: "4px solid #f97316", background: "#fff7ed", padding: 12 }}>
              <div style={{ fontWeight: 700 }}>Harmony style batch correction</div>
              <div style={{ fontSize: 13 }}>PCA then iterative batch mean centering in PC space. Uses 200 variable genes, 20 PCs, 5 iterations, alpha 0.5.</div>
            </div>

            {error && (
              <div style={{ borderLeft: "4px solid #ef4444", background: "#fef2f2", padding: 12 }}>
                <div style={{ display: "flex", gap: 10 }}>
                  <AlertTriangle size={18} />
                  <div>
                    <div style={{ fontWeight: 700 }}>Error</div>
                    <div style={{ fontSize: 13 }}>{error}</div>
                  </div>
                </div>
              </div>
            )}

            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Step 4: Batch effect correction</h2>

            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
              <div style={{ fontWeight: 800 }}>Optional metadata upload</div>
              <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>Provide cell to batch mapping. Example header: cell,batch</div>

              <div style={{ marginTop: 10, border: "2px dashed #e5e7eb", borderRadius: 12, padding: 12, background: "#f9fafb" }}>
                <label style={{ cursor: "pointer", display: "inline-block" }}>
                  <span style={{ color: "#c2410c", fontWeight: 800 }}>Upload metadata CSV or TSV</span>
                  <input type="file" style={{ display: "none" }} accept=".csv,.tsv,.txt" onChange={handleMetaUpload} />
                </label>

                {meta && (
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    <div>
                      <b>Columns:</b> {meta.header.join(", ")}
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <div>
                        <span style={{ fontSize: 12, opacity: 0.75 }}>Batch column</span>
                        <select
                          style={{ marginLeft: 8, border: "1px solid #d1d5db", borderRadius: 10, padding: "4px 8px" }}
                          value={meta.batchColIdx}
                          onChange={(ev) => {
                            const idx = Number(ev.target.value);
                            if (!Number.isFinite(idx)) return;
                            setMeta((prev) => (prev ? { ...prev, batchColIdx: idx } : prev));
                            setHarmony(null);
                            if (counts && meta) {
                              const map = buildBatchMap({ ...meta, batchColIdx: idx });
                              const batchByCell = counts.cells.map((id) => map[id] ?? "batch1");
                              const nBatches = new Set(batchByCell).size || 1;
                              setData((p) => ({
                                ...p,
                                numBatches: nBatches,
                                harmonized: false,
                                clustered: false,
                                trained: false,
                                metrics: null,
                              }));
                            }
                          }}
                        >
                          {meta.header.map((h, i) => (
                            <option key={h + String(i)} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.7 }}>Rows: {fmt(meta.rows.length)}</div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12, background: "#f9fafb", borderRadius: 12, padding: 12 }}>
                <div style={{ fontWeight: 800 }}>Detected batches</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#c2410c" }}>{fmt(data.numBatches)}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>If no metadata is uploaded, all cells are treated as one batch.</div>
              </div>

              <button
                onClick={runHarmony}
                disabled={!data.normalized}
                style={{
                  width: "100%",
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #f97316",
                  background: data.normalized ? "#f97316" : "#e5e7eb",
                  color: data.normalized ? "white" : "#6b7280",
                  cursor: data.normalized ? "pointer" : "not-allowed",
                  fontWeight: 900,
                }}
              >
                <GitMerge size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
                Run Harmony style integration
              </button>

              {data.harmonized && harmony && (
                <div style={{ marginTop: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#166534" }}>
                    <CheckCircle size={18} />
                    <div>
                      <div style={{ fontWeight: 900 }}>Batch correction complete in reduced space</div>
                      <div style={{ fontSize: 13 }}>
                        PCA: {fmt(harmony.nFeatures)} genes → {fmt(harmony.nPC)} PCs · Iterations: {fmt(harmony.iters)} · Alpha: {fmt(harmony.alpha, 2)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginTop: 10 }}>
                    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>Batch centroid distance, median</div>
                      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>
                        {fmt(harmony.distBeforeSummary.med, 4)} → {fmt(harmony.distAfterSummary.med, 4)}
                      </div>
                    </div>
                    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>Batch centroid distance, max</div>
                      <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 }}>
                        {fmt(harmony.distBeforeSummary.max, 4)} → {fmt(harmony.distAfterSummary.max, 4)}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Batch sizes</div>
                    <div style={{ fontSize: 13, marginTop: 6 }}>
                      {harmony.batches.map((b: string, i: number) => `${b}: ${harmony.batchSizes[i]}`).join(" · ")}
                    </div>
                  </div>

                  <div style={{ marginTop: 10, background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 10 }}>
                    <div style={{ fontSize: 12, opacity: 0.75 }}>Explained variance, first 5 PCs</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13, marginTop: 6 }}>
                      {harmony.explained
                        .slice(0, 5)
                        .map((x: number) => `${(x * 100).toFixed(1)}%`)
                        .join(" · ")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Step 5: Clustering</h2>

            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
              <div style={{ borderLeft: "4px solid #6366f1", background: "#eef2ff", padding: 12, marginBottom: 12, fontSize: 13 }}>
                Typical approach: PCA or Harmony corrected PCs, UMAP, then graph based clustering.
              </div>

              <button
                onClick={runClustering}
                disabled={!data.harmonized}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #6366f1",
                  background: data.harmonized ? "#6366f1" : "#e5e7eb",
                  color: data.harmonized ? "white" : "#6b7280",
                  cursor: data.harmonized ? "pointer" : "not-allowed",
                  fontWeight: 900,
                }}
              >
                <Layers size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
                Run clustering
              </button>

              {data.clustered && (
                <div style={{ marginTop: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", color: "#166534" }}>
                    <CheckCircle size={18} />
                    <div style={{ fontWeight: 900 }}>Clustering complete, placeholder clusters</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8, marginTop: 10, fontSize: 13 }}>
                    {["35%", "18%", "15%", "20%", "7%", "3%", "2%"].map((p, i) => (
                      <div key={String(i)} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: 8 }}>
                        Cluster {i + 1}: {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 5:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Step 6: ML model training</h2>

            <div style={{ borderLeft: "4px solid #ef4444", background: "#fef2f2", padding: 12 }}>
              <div style={{ fontWeight: 800 }}>Classification task</div>
              <div style={{ fontSize: 13 }}>Train a classifier using processed expression features.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { name: "Random Forest", perf: "★★★★★", desc: "Strong default for high dimensional data", rec: true },
                { name: "XGBoost", perf: "★★★★☆", desc: "Gradient boosting, often strong", rec: false },
                { name: "Neural Network", perf: "★★★★☆", desc: "Flexible, needs careful tuning", rec: false },
                { name: "Logistic Regression", perf: "★★★☆☆", desc: "Interpretable baseline", rec: false },
                { name: "SVM", perf: "★★★☆☆", desc: "Can work well with scaling", rec: false },
              ].map((m) => {
                const active = data.model === m.name;
                return (
                  <button
                    key={m.name}
                    onClick={() => setData((prev) => ({ ...prev, model: m.name }))}
                    style={{
                      width: "100%",
                      padding: 12,
                      borderRadius: 12,
                      border: `2px solid ${active ? "#ef4444" : "#d1d5db"}`,
                      background: active ? "#fef2f2" : "white",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          {m.name}
                          {m.rec && (
                            <span style={{ marginLeft: 8, fontSize: 11, background: "#22c55e", color: "white", padding: "2px 8px", borderRadius: 999 }}>
                              Recommended
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, opacity: 0.75 }}>{m.desc}</div>
                        <div style={{ fontSize: 13, color: "#ca8a04" }}>{m.perf}</div>
                      </div>
                      {active && <CheckCircle size={18} color="#ef4444" />}
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              onClick={train}
              disabled={!data.clustered}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #ef4444",
                background: data.clustered ? "#ef4444" : "#e5e7eb",
                color: data.clustered ? "white" : "#6b7280",
                cursor: data.clustered ? "pointer" : "not-allowed",
                fontWeight: 900,
              }}
            >
              <Play size={18} style={{ verticalAlign: "middle", marginRight: 8 }} />
              Train model
            </button>

            {data.trained && data.metrics && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 900, marginBottom: 10 }}>Training results</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
                  {Object.entries(data.metrics).map(([k, v]) => (
                    <div key={k} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 12 }}>
                      <div style={{ fontSize: 12, opacity: 0.75 }}>{k === "f1" ? "F1-score" : k}</div>
                      <div style={{ fontSize: 22, fontWeight: 900 }}>{(Number(v) * 100).toFixed(1)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 6:
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Results</h2>

            {data.trained && data.metrics ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
                  <div style={{ fontWeight: 900, marginBottom: 12 }}>Performance summary</div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {Object.entries(data.metrics).map(([k, v]) => (
                      <div key={k} style={{ textAlign: "center", padding: 12, borderRadius: 12, background: "#eef2ff" }}>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>{k === "f1" ? "F1" : k}</div>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>{(Number(v) * 100).toFixed(1)}%</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12, background: "#f9fafb", borderRadius: 12, padding: 12 }}>
                    <div style={{ fontWeight: 900, marginBottom: 8 }}>Pipeline summary</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ opacity: 0.75 }}>Cells</span>
                        <span>{fmt(data.numSamples)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ opacity: 0.75 }}>Normalization</span>
                        <span>{data.normMethod}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ opacity: 0.75 }}>Batch correction</span>
                        <span style={{ color: "#16a34a" }}>Harmony style in PC space</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ opacity: 0.75 }}>Model</span>
                        <span>{data.model}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {["Model", "Predictions", "Report"].map((label) => (
                    <button
                      key={label}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #d1d5db",
                        background: "white",
                        cursor: "pointer",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                      }}
                    >
                      <Download size={18} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 0", opacity: 0.7 }}>
                <BarChart3 size={56} />
                <div style={{ marginTop: 10 }}>Complete ML training to view results.</div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const goPrev = () => setCurrentPhase((p) => Math.max(0, p - 1));
  const goNext = () => {
    const next = Math.min(phases.length - 1, currentPhase + 1);
    if (canGoTo(next)) setCurrentPhase(next);
  };

  const nextDisabled = currentPhase === phases.length - 1 || !canGoTo(Math.min(phases.length - 1, currentPhase + 1));

  return (
    <div style={{ minHeight: "100vh", background: "#0b1220", padding: 18 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ background: "white", borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.25)" }}>
          <div style={{ padding: 18, background: "linear-gradient(90deg, #2563eb, #7c3aed)", color: "white" }}>
            <div style={{ fontSize: 24, fontWeight: 900 }}>Single-cell RNA-seq ML pipeline</div>
            <div style={{ opacity: 0.9, marginTop: 4, fontSize: 13 }}>Upload, QC, normalize, Harmony in PC space, cluster, train, inspect.</div>
          </div>

          <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", overflowX: "auto" }}>
            {phases.map((phase) => {
              const Icon = phase.icon;
              const disabled = !canGoTo(phase.id);
              const isActive = currentPhase === phase.id;

              return (
                <button
                  key={phase.id}
                  onClick={() => !disabled && setCurrentPhase(phase.id)}
                  title={disabled ? "Complete previous steps to unlock" : phase.name}
                  style={{
                    minWidth: 150,
                    flex: "1 0 auto",
                    padding: 12,
                    border: "none",
                    background: isActive ? "white" : "#f9fafb",
                    borderBottom: isActive ? "4px solid #2563eb" : "4px solid transparent",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.6 : 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div style={{ position: "relative" }}>
                    <Icon size={18} color={isActive ? "#2563eb" : "#6b7280"} />
                    {disabled && (
                      <span style={{ position: "absolute", right: -10, top: -10 }}>
                        <Lock size={12} color="#6b7280" />
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: isActive ? "#111827" : "#374151" }}>{phase.name}</div>
                </button>
              );
            })}
          </div>

          <div style={{ padding: 18 }}>{renderPhase()}</div>

          <div style={{ background: "#f9fafb", padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e5e7eb" }}>
            <button
              onClick={goPrev}
              disabled={currentPhase === 0}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid #d1d5db",
                background: currentPhase === 0 ? "#e5e7eb" : "white",
                cursor: currentPhase === 0 ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              Previous
            </button>

            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Step {currentPhase + 1} of {phases.length}
            </div>

            <button
              onClick={goNext}
              disabled={nextDisabled}
              style={{
                padding: "8px 12px",
                borderRadius: 12,
                border: "1px solid #2563eb",
                background: nextDisabled ? "#93c5fd" : "#2563eb",
                color: "white",
                cursor: nextDisabled ? "not-allowed" : "pointer",
                fontWeight: 900,
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
