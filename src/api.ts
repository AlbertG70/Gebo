import type {
  CourseAttributes,
  DashboardData,
  GpaAttributes,
  InstitutionAttributes,
  JsonApiList,
  JsonApiSingle,
  ProblemDetails,
  ProgramAttributes,
  TermAttributes,
  AuditLogAttributes,
  ExportAttributes,
} from "./types";

type TokenPayload = {
  client_id: string;
  scope: string;
  program_id?: string;
};

export type DashboardFilters = {
  termId: string;
  programId: string;
  modality: string;
  dropoutRate: number;
};

export async function checkHealth() {
  const response = await fetch("/api/health");
  return response.ok;
}

export async function issueToken(payload: TokenPayload) {
  const response = await fetch("/auth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as { access_token?: string; error_description?: string };

  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? "No se pudo emitir el token local.");
  }

  return body.access_token;
}

export async function loadDashboard(token: string, filters: DashboardFilters): Promise<DashboardData> {
  const programQuery = filters.programId ? `&filter[program_id]=${filters.programId}` : "";
  const modalityQuery = filters.modality ? `&filter[modality]=${filters.modality}` : "";
  const dropoutQuery = filters.dropoutRate > 0 ? `&filter[dropout_rate][gte]=${filters.dropoutRate}` : "";
  const courseQuery = [
    `/v1/courses?filter[term_id]=${filters.termId}`,
    programQuery,
    modalityQuery,
    dropoutQuery,
    "&filter[enrollment_count][gte]=10&sort=-dropout_rate&page[size]=8",
  ].join("");

  const gpaPath = filters.programId
    ? `/v1/programs/${filters.programId}/gpa-distribution?period[term_id]=${filters.termId}&include=institution_comparison`
    : `/v1/institution/gpa-distribution?period[term_id]=${filters.termId}`;

  const [institution, programs, courses, terms, gpa] = await Promise.all([
    apiGet<JsonApiSingle<InstitutionAttributes>>(
      `/v1/institution/metrics?period[term_id]=${filters.termId}&include=term_comparison`,
      token,
    ),
    apiGet<JsonApiList<ProgramAttributes>>("/v1/programs?page[size]=20", token),
    apiGet<JsonApiList<CourseAttributes>>(courseQuery, token),
    apiGet<JsonApiList<TermAttributes>>("/v1/terms?page[size]=20", token),
    apiGet<JsonApiSingle<GpaAttributes>>(gpaPath, token),
  ]);

  return { institution, programs, courses, terms, gpa };
}

export async function loadOperationsMetrics(token: string) {
  return apiGet<JsonApiSingle<Record<string, unknown>>>("/v1/operations/metrics", token);
}

export async function loadAuditLogs(token: string) {
  return apiGet<JsonApiList<AuditLogAttributes>>("/v1/audit/logs?sort=-timestamp&page[size]=10", token);
}

export async function submitExport(token: string, payload: { query: string; format: string; filename: string }) {
  const response = await fetch("/api/v1/exports", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await parseJson(response);
    const problem = body as ProblemDetails;
    throw new Error(problem.detail ?? problem.title ?? `Export returned ${response.status}`);
  }

  return response.headers.get("location");
}

export async function pollExport(token: string, path: string) {
  return apiGet<JsonApiSingle<ExportAttributes>>(path, token);
}

export async function apiGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  const body = await parseJson(response);

  if (!response.ok) {
    const problem = body as ProblemDetails;
    throw new Error(problem.detail ?? problem.title ?? `${path} devolvió ${response.status}`);
  }

  return body as T;
}

async function parseJson(response: Response) {
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}
