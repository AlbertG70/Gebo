export type Metrics = {
  headcount?: number;
  enrollment_count?: number;
  pass_rate?: number;
  dropout_rate?: number;
  fail_rate?: number;
  incomplete_rate?: number;
  gpa_mean?: number | null;
  completion_rate?: number;
  credits_attempted?: number;
  credits_earned?: number;
};

export type JsonApiResource<TAttributes> = {
  type: string;
  id: string;
  attributes: TAttributes;
  links?: Record<string, string>;
};

export type JsonApiSingle<TAttributes> = {
  data: JsonApiResource<TAttributes>;
  included?: Array<JsonApiResource<Record<string, unknown>>>;
  meta?: Record<string, unknown>;
};

export type JsonApiList<TAttributes> = {
  data: Array<JsonApiResource<TAttributes>>;
  links?: Record<string, string>;
  meta?: {
    page_size?: number;
    next_cursor?: string;
    has_more?: boolean;
    total_estimate?: number;
    [key: string]: unknown;
  };
};

export type InstitutionAttributes = {
  name: string;
  period?: {
    term_id?: string | null;
    kind?: string;
  };
  metrics: Metrics;
  program_breakdown?: ProgramBreakdown[];
  term_comparison?: {
    previous_term_id?: string;
    deltas?: Record<string, { absolute: number; percent: number | null }>;
  } | null;
  computed_at?: string;
  source_data_as_of?: string;
};

export type ProgramAttributes = {
  code: string;
  name: string;
  level: string;
  modality: string;
  status: string;
  period?: {
    term_id?: string | null;
  };
  metrics?: Metrics;
};

export type CourseAttributes = {
  code: string;
  title: string;
  program_id: string;
  term_id?: string | null;
  section_count?: number;
  metrics: Metrics;
};

export type TermAttributes = {
  code: string;
  start_date: string;
  end_date: string;
  academic_year: number;
  subterm: string;
};

export type GpaAttributes = {
  population_size: number;
  histogram: Array<{
    bin: string;
    count: number;
    pct: number;
  }>;
  percentiles: Record<string, number | null>;
  summary: {
    mean: number | null;
    stddev: number | null;
    min: number | null;
    max: number | null;
  };
};

export type ProgramBreakdown = {
  program_id: string;
  code: string;
  name: string;
  metrics: Metrics;
};

export type ProblemDetails = {
  title?: string;
  status?: number;
  detail?: string;
  type?: string;
};

export type DashboardData = {
  institution: JsonApiSingle<InstitutionAttributes>;
  programs: JsonApiList<ProgramAttributes>;
  courses: JsonApiList<CourseAttributes>;
  terms: JsonApiList<TermAttributes>;
  gpa: JsonApiSingle<GpaAttributes>;
};

export type AuditLogAttributes = {
  timestamp: string;
  client_id: string;
  endpoint: string;
  method: string;
  scope: string;
  outcome: "success" | "error";
  error_type?: string;
};

export type ExportAttributes = {
  status: "queued" | "running" | "complete" | "failed";
  download_url?: string;
  format: string;
  filename: string;
  created_at: string;
};
