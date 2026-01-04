import { useMemo, useState } from "react";

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
    details = "LogNormalize, log1p counts divided by library size times 1e4";
  } else if (method === "CPM") {
    details = "CPM, log1p counts divided by library size times 1e6";
  } else if (method === "SCTransform") {
    Xnorm = zscoreRows(base as number[][]);
    details = "SCTransform approximation, log1p normalize then gene wise z score";
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
  if (header.length < 3) throw new Error("Expected at least 2 cells in columns");

  const geneCol = header[0] || "gene_id";
  const cells = header.slice(1);

  if (delimiter === "," && lines[0].includes("\t")) throw new Error("Mixed delimiter header should fail fast");
  if (delimiter === "\t" && lines[0].includes(",")) throw new Error("Mixed delimiter header should fail fast");

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
      { id: 0, name: "Upload" },
      { id: 1, name: "Quality Control" },
      { id: 2, name: "Normalization" },
      { id: 3, name: "Batch Correction" },
    ],
    [],
  );

  const stepReady = useMemo(
    () => [true, data.uploaded, data.qcDone, data.normalized],
    [data.uploaded, data.qcDone, data.normalized],
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

  const card: React.CSSProperties = {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 16,
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
          normMethod: "SCTransform",
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
          normMethod: "SCTransform",
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
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch correction failed");
      setHarmony(null);
      setData((prev) => ({ ...prev, harmonized: false }));
    }
  };

  const goPrev = () => setCurrentPhase((p) => Math.max(0, p - 1));
  const goNext = () => {
    const next = Math.min(phases.length - 1, currentPhase + 1);
    if (canGoTo(next)) setCurrentPhase(next);
  };

  const nextDisabled = currentPhase === phases.length - 1 || !canGoTo(Math.min(phases.length - 1, currentPhase + 1));

  const renderPhase = () => {
    if (currentPhase === 0) {
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Step 1, upload count matrix</div>
            <div style={{ marginTop: 6, color: "#4b5563" }}>
              CSV or TSV, genes as rows, cells as columns, first column is gene identifiers
            </div>

            <div style={{ marginTop: 12 }}>
              <input type="file" accept=".csv,.tsv,.txt" onChange={handleUpload} />
            </div>

            {data.uploaded && stats && (
              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <div>
                  <strong>File</strong>: {data.fileName}
                </div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ ...card, padding: 12, minWidth: 160 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Genes</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(stats.nGenes)}</div>
                  </div>
                  <div style={{ ...card, padding: 12, minWidth: 160 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Cells</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(stats.nCells)}</div>
                  </div>
                  <div style={{ ...card, padding: 12, minWidth: 160 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Mito genes detected</div>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(stats.nMitoGenes)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ ...card, padding: 12, minWidth: 240 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Library size, min · median · max</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {fmt(stats.libSummary.min)} · {fmt(stats.libSummary.med)} · {fmt(stats.libSummary.max)}
                    </div>
                  </div>
                  <div style={{ ...card, padding: 12, minWidth: 240 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Detected genes, min · median · max</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {fmt(stats.detectedSummary.min)} · {fmt(stats.detectedSummary.med)} · {fmt(stats.detectedSummary.max)}
                    </div>
                  </div>
                  <div style={{ ...card, padding: 12, minWidth: 240 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Mito percent, min · median · max</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {fmt(stats.mitoPctSummary.min, 2)} · {fmt(stats.mitoPctSummary.med, 2)} ·{" "}
                      {fmt(stats.mitoPctSummary.max, 2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ ...card, borderColor: "#fecaca", background: "#fff1f2" }}>
              <strong style={{ color: "#991b1b" }}>Error</strong>
              <div style={{ color: "#991b1b", marginTop: 4 }}>{error}</div>
            </div>
          )}
        </div>
      );
    }

    if (currentPhase === 1) {
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Step 2, quality control</div>
            <div style={{ marginTop: 6, color: "#4b5563" }}>
              Gene filter, expressed in at least 2 cells. Cell filter, at least 200 detected genes.
            </div>

            <button
              onClick={runQC}
              disabled={!data.uploaded}
              style={{
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: data.uploaded ? "#111827" : "#9ca3af",
                color: "white",
                cursor: data.uploaded ? "pointer" : "not-allowed",
                fontWeight: 700,
              }}
            >
              Apply QC
            </button>

            {data.qcDone && qcReport && (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div>
                  <strong>QC complete</strong>
                </div>
                <div style={{ color: "#374151" }}>
                  Genes {fmt(qcReport.before.nGenes)} → {fmt(qcReport.after.nGenes)} · Cells {fmt(qcReport.before.nCells)} →
                  {fmt(qcReport.after.nCells)}
                </div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ ...card, padding: 12, minWidth: 220 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Library size median</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {fmt(qcReport.after.libSummary.med)}
                    </div>
                  </div>
                  <div style={{ ...card, padding: 12, minWidth: 220 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Detected genes median</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {fmt(qcReport.after.detectedSummary.med)}
                    </div>
                  </div>
                  <div style={{ ...card, padding: 12, minWidth: 220 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Mito percent median</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {fmt(qcReport.after.mitoPctSummary.med, 2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ ...card, borderColor: "#fecaca", background: "#fff1f2" }}>
              <strong style={{ color: "#991b1b" }}>Error</strong>
              <div style={{ color: "#991b1b", marginTop: 4 }}>{error}</div>
            </div>
          )}
        </div>
      );
    }

    if (currentPhase === 2) {
      return (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={card}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Step 3, normalization</div>
            <div style={{ marginTop: 6, color: "#4b5563" }}>
              Choose a method. This demo normalizes in the browser and keeps the transformed matrix for later steps.
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {[
                { id: "SCTransform", label: "SCTransform" },
                { id: "LogNormalize", label: "LogNormalize" },
                { id: "CPM", label: "CPM" },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => runNorm(m.id)}
                  disabled={!data.qcDone}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e5e7eb",
                    background: !data.qcDone ? "#f3f4f6" : data.normMethod === m.id ? "#111827" : "white",
                    color: !data.qcDone ? "#9ca3af" : data.normMethod === m.id ? "white" : "#111827",
                    cursor: data.qcDone ? "pointer" : "not-allowed",
                    fontWeight: 700,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {data.normalized && normalizedMatrix && (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <div>
                  <strong>Applied</strong>: {data.normMethod}
                </div>
                <div style={{ color: "#4b5563" }}>{normalizedMatrix.details}</div>

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ ...card, padding: 12, minWidth: 220 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Value min</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {fmt(normalizedMatrix.summary.min, 4)}
                    </div>
                  </div>
                  <div style={{ ...card, padding: 12, minWidth: 220 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Value median</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {fmt(normalizedMatrix.summary.med, 4)}
                    </div>
                  </div>
                  <div style={{ ...card, padding: 12, minWidth: 220 }}>
                    <div style={{ color: "#6b7280", fontSize: 12 }}>Value max</div>
                    <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                      {fmt(normalizedMatrix.summary.max, 4)}
                    </div>
                  </div>
                </div>

                <div style={{ color: "#6b7280", fontSize: 12 }}>
                  Summary computed on {normalizedMatrix.summary.sampled ? "a sample" : "all values"}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ ...card, borderColor: "#fecaca", background: "#fff1f2" }}>
              <strong style={{ color: "#991b1b" }}>Error</strong>
              <div style={{ color: "#991b1b", marginTop: 4 }}>{error}</div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={card}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Step 4, batch correction</div>
          <div style={{ marginTop: 6, color: "#4b5563" }}>
            Upload optional metadata mapping cell id to batch. Example header: cell,batch
          </div>

          <div style={{ marginTop: 12 }}>
            <input type="file" accept=".csv,.tsv,.txt" onChange={handleMetaUpload} />
          </div>

          {meta && (
            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div>
                <strong>Columns</strong>: {meta.header.join(", ")}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <div>
                  <span style={{ color: "#6b7280", fontSize: 12 }}>Batch column</span>
                  <select
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
                        setData((p) => ({ ...p, numBatches: nBatches, harmonized: false }));
                      }
                    }}
                    style={{ marginLeft: 8, padding: "6px 8px", borderRadius: 8, border: "1px solid #e5e7eb" }}
                  >
                    {meta.header.map((h, i) => (
                      <option key={h + String(i)} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ color: "#6b7280", fontSize: 12 }}>Rows: {fmt(meta.rows.length)}</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ ...card, padding: 12, minWidth: 220 }}>
              <div style={{ color: "#6b7280", fontSize: 12 }}>Detected batches</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{fmt(data.numBatches)}</div>
              <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                If no metadata is uploaded, all cells are treated as one batch
              </div>
            </div>
          </div>

          <button
            onClick={runHarmony}
            disabled={!data.normalized}
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: data.normalized ? "#111827" : "#9ca3af",
              color: "white",
              cursor: data.normalized ? "pointer" : "not-allowed",
              fontWeight: 700,
            }}
          >
            Run Harmony style correction in PC space
          </button>

          {data.harmonized && harmony && (
            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div>
                <strong>Batch correction complete</strong>
              </div>
              <div style={{ color: "#374151" }}>
                PCA: {fmt(harmony.nFeatures)} genes → {fmt(harmony.nPC)} PCs · Iterations: {fmt(harmony.iters)} · Alpha:{" "}
                {fmt(harmony.alpha, 2)}
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ ...card, padding: 12, minWidth: 260 }}>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>Batch centroid distance, median</div>
                  <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                    {fmt(harmony.distBeforeSummary.med, 4)} → {fmt(harmony.distAfterSummary.med, 4)}
                  </div>
                </div>
                <div style={{ ...card, padding: 12, minWidth: 260 }}>
                  <div style={{ color: "#6b7280", fontSize: 12 }}>Batch sizes</div>
                  <div style={{ color: "#374151" }}>
                    {harmony.batches.map((b: string, i: number) => `${b}: ${harmony.batchSizes[i]}`).join(" · ")}
                  </div>
                </div>
              </div>

              <div style={{ ...card, padding: 12 }}>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Explained variance, first 5 PCs</div>
                <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                  {harmony.explained
                    .slice(0, 5)
                    .map((x: number) => `${(x * 100).toFixed(1)}%`)
                    .join(" · ")}
                </div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ ...card, borderColor: "#fecaca", background: "#fff1f2" }}>
            <strong style={{ color: "#991b1b" }}>Error</strong>
            <div style={{ color: "#991b1b", marginTop: 4 }}>{error}</div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", padding: 18 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>Single cell RNA seq pipeline demo</div>
              <div style={{ color: "#6b7280", marginTop: 4 }}>Upload, QC, normalize, Harmony style correction in PC space</div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {phases.map((p) => {
                const disabled = !canGoTo(p.id);
                const active = currentPhase === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => !disabled && setCurrentPhase(p.id)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: active ? "#111827" : "white",
                      color: active ? "white" : disabled ? "#9ca3af" : "#111827",
                      cursor: disabled ? "not-allowed" : "pointer",
                      fontWeight: 800,
                    }}
                    title={disabled ? "Complete previous steps to unlock" : p.name}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 16 }}>{renderPhase()}</div>

          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={goPrev}
              disabled={currentPhase === 0}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: currentPhase === 0 ? "#f3f4f6" : "white",
                color: currentPhase === 0 ? "#9ca3af" : "#111827",
                cursor: currentPhase === 0 ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              Previous
            </button>

            <div style={{ color: "#6b7280", fontWeight: 700 }}>
              Step {currentPhase + 1} of {phases.length}
            </div>

            <button
              onClick={goNext}
              disabled={nextDisabled}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: nextDisabled ? "#9ca3af" : "#111827",
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
