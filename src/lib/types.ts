export type Mode = "single" | "compare";

export type Accession = {
  id: string;
  disease: string;
  platform: string;
  donors: number;
  cells: number;
  tissue: string;
};

export type Manifest = {
  ok: boolean;
  tissue: string;
  diseases: string[];
  accessions: Accession[];
  cell_types: string[];
  marker_panels: Record<string, string[]>;
};

export type MarkersResponse = {
  ok: boolean;
  genes: string[];
};

export type DeRow = {
  gene: string;
  logfc: number;
  groups?: string[];
  p_val?: number;
  p_val_adj?: number;
  padj?: number;
};

export type DeResponse = {
  ok: boolean;
  contrast?: string;
  cell_type?: string;
  total?: number;
  limit?: number;
  offset?: number;
  rows?: DeRow[];
  top_up?: DeRow[];
  top_down?: DeRow[];
  error?: string;
  available?: string[];
};

export type ViolinSummary = {
  label: string;
  histogram?: {
    bins: number[];
    counts: number[];
  };
  quantiles?: {
    min: number;
    q1: number;
    median: number;
    q3: number;
    max: number;
  };
};
export type UmapResponse = {
  ok: boolean;
  filters?: {
    disease?: string | null;
    cell_type?: string | null;
  };
  color_key?: string;
  x?: number[];
  y?: number[];
  cell_id?: string[];
  color?: string[];
  value_key?: string;
  value?: Array<number | null>;
  error?: string;
  available?: string[];
};

export type DotplotResponse = {
  ok: boolean;
  group_by?: string;
  groups?: string[];
  genes?: string[];
  avg?: number[][];
  pct?: number[][];
  error?: string;
  unknown?: string[];
};

export type ViolinResponse = {
  ok: boolean;
  gene?: string;
  group_by?: string;
  kind?: "hist" | "quantile";
  groups?: string[];
  bins?: number[];
  counts?: number[][];
  quantiles?: Array<{ min: number; q1: number; median: number; q3: number; max: number }>;
  error?: string;
  available?: string[];
};

export type CompositionResponse = {
  ok: boolean;
  group_by?: string;
  groups?: string[];
  cell_types?: string[];
  counts?: number[][];
  error?: string;
  available?: string[];
};
