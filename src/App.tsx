import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock,
  DatabaseZap,
  GraduationCap,
  KeyRound,
  Loader2,
  ShieldCheck,
  XOctagon,
} from "lucide-react";
import {
  checkHealth,
  issueToken,
  loadDashboard,
  loadOperationsMetrics,
  type DashboardFilters,
} from "./api";
import type {
  CourseAttributes,
  DashboardData,
  JsonApiList,
  JsonApiSingle,
  Metrics,
  ProgramBreakdown,
  AuditLogAttributes,
} from "./types";
import { loadAuditLogs, submitExport, pollExport } from "./api";

const defaultFilters: DashboardFilters = {
  termId: "2025-FALL",
  programId: "",
  modality: "",
  dropoutRate: 0.2,
};

const defaultScopes = "analytics:read analytics:read:institution";

export default function App() {
  const [health, setHealth] = useState<"checking" | "online" | "offline">("checking");
  const [clientId, setClientId] = useState("local-dashboard");
  const [scopes, setScopes] = useState(defaultScopes);
  const [programClaim, setProgramClaim] = useState("");
  const [token, setToken] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [data, setData] = useState<DashboardData | null>(null);
  const [operations, setOperations] = useState<JsonApiSingle<Record<string, unknown>> | null>(null);
  const [auditLogs, setAuditLogs] = useState<JsonApiList<AuditLogAttributes> | null>(null);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [viewer, setViewer] = useState<unknown>({ estado: "Listo para conectar con la API local." });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    checkHealth()
      .then((ok) => setHealth(ok ? "online" : "offline"))
      .catch(() => setHealth("offline"));
  }, []);

  const metrics = data?.institution.data.attributes.metrics;
  const programBreakdown = data?.institution.data.attributes.program_breakdown ?? [];
  const selectedProgram = filters.programId || "Institucion";

  const topPrograms = useMemo(
    () =>
      [...programBreakdown]
        .sort((a, b) => (b.metrics.dropout_rate ?? 0) - (a.metrics.dropout_rate ?? 0))
        .slice(0, 5),
    [programBreakdown],
  );

  async function connectAndLoad() {
    setLoading(true);
    setError("");

    try {
      const accessToken = await issueToken({
        client_id: clientId,
        scope: scopes,
        program_id: programClaim || undefined,
      });
      setToken(accessToken);
      const dashboard = await loadDashboard(accessToken, filters);
      setData(dashboard);
      setViewer(dashboard);
    } catch (caught) {
      showError(caught);
    } finally {
      setLoading(false);
    }
  }

  async function refreshDashboard(nextFilters = filters) {
    if (!token) {
      await connectAndLoad();
      return;
    }

    setLoading(true);
    setError("");

    try {
      const dashboard = await loadDashboard(token, nextFilters);
      setData(dashboard);
      setViewer(dashboard);
    } catch (caught) {
      showError(caught);
    } finally {
      setLoading(false);
    }
  }

  async function loadOps() {
    setLoading(true);
    setError("");

    try {
      const auditToken = await issueToken({
        client_id: "local-dashboard-audit",
        scope: "analytics:audit:read",
      });
      const [ops, logs] = await Promise.all([
        loadOperationsMetrics(auditToken),
        loadAuditLogs(auditToken),
      ]);
      setOperations(ops);
      setAuditLogs(logs);
      setViewer({ ops, logs });
    } catch (caught) {
      showError(caught);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportUrl(null);
    try {
      const exportToken = await issueToken({
        client_id: "local-dashboard-export",
        scope: "analytics:export",
      });
      const location = await submitExport(exportToken, {
        query: JSON.stringify(filters),
        format: "csv",
        filename: `export-${filters.termId}.csv`,
      });

      if (!location) throw new Error("No se devolvió ubicación de exportación");

      const poll = async () => {
        try {
          const statusData = await pollExport(exportToken, location);
          if (statusData.data.attributes.status === "complete") {
            setExportUrl(statusData.data.attributes.download_url ?? null);
            setExporting(false);
          } else if (statusData.data.attributes.status === "failed") {
            throw new Error("La exportación falló en el servidor");
          } else {
            setTimeout(() => { void poll(); }, 2000);
          }
        } catch (err) {
          showError(err);
          setExporting(false);
        }
      };
      setTimeout(() => { void poll(); }, 2000);
    } catch (caught) {
      showError(caught);
      setExporting(false);
    }
  }

  function updateFilters(partial: Partial<DashboardFilters>) {
    const next = { ...filters, ...partial };
    setFilters(next);
    if (token) {
      void refreshDashboard(next);
    }
  }

  function showError(caught: unknown) {
    const message = caught instanceof Error ? caught.message : String(caught);
    setError(message);
    setViewer({ error: message });
  }

  return (
    <main className="min-h-screen overflow-hidden bg-ink text-bone">
      <div className="scanlines pointer-events-none fixed inset-0 opacity-30" />
      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
        <aside className="cut-panel sticky top-5 h-fit border border-bone/15 bg-graphite/90 p-4 shadow-cut">
          <div className="mb-6 flex items-center gap-3 border-b border-bone/15 pb-4">
            <div className="grid h-11 w-11 place-items-center border border-signal bg-signal text-ink">
              <GraduationCap size={22} />
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-signal">
                Gestion API
              </p>
              <h1 className="text-xl font-black uppercase leading-none">Command Desk</h1>
            </div>
          </div>

          <StatusRail health={health} hasToken={Boolean(token)} loading={loading} />

          <div className="mt-6 space-y-4">
            <Field label="Client ID">
              <input value={clientId} onChange={(event) => setClientId(event.target.value)} />
            </Field>
            <Field label="Scopes">
              <textarea
                rows={3}
                value={scopes}
                onChange={(event) => setScopes(event.target.value)}
              />
            </Field>
            <Field label="Program claim opcional">
              <input
                placeholder="CS"
                value={programClaim}
                onChange={(event) => setProgramClaim(event.target.value.toUpperCase())}
              />
            </Field>
            <button className="primary-action w-full" onClick={connectAndLoad} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" size={18} /> : <KeyRound size={18} />}
              Emitir token y cargar
            </button>
          </div>
        </aside>

        <section className="space-y-6">
          <header className="hero-cut relative overflow-hidden border border-bone/15 bg-panel p-6 shadow-cut lg:p-8">
            <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(233,255,92,0.22),transparent_42%)]" />
            <div className="relative grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.45em] text-volt">
                  Analitica academica local
                </p>
                <h2 className="mt-4 max-w-3xl text-4xl font-black uppercase leading-[0.92] tracking-tight sm:text-6xl">
                  Pulso institucional sin paneles de plantilla
                </h2>
                <p className="mt-5 max-w-2xl text-sm leading-6 text-bone/70">
                  Interfaz Vite para explorar metricas protegidas, cursos con riesgo,
                  distribucion GPA y senales operativas de la API local.
                </p>
              </div>
              <div className="border-l border-signal/60 pl-5">
                <p className="font-mono text-xs uppercase text-bone/50">Scope activo</p>
                <p className="mt-2 break-all font-mono text-sm text-signal">
                  {token ? "Bearer token listo" : "Sin token emitido"}
                </p>
                <p className="mt-8 font-mono text-xs uppercase text-bone/50">Vista</p>
                <p className="mt-2 text-2xl font-black uppercase">{selectedProgram}</p>
              </div>
            </div>
          </header>

          {error ? (
            <div className="border-l-4 border-danger bg-danger/10 p-4 text-sm text-danger">
              {error}
            </div>
          ) : null}

          <FilterBar data={data} filters={filters} onChange={updateFilters} onOps={loadOps} onExport={handleExport} exporting={exporting} exportUrl={exportUrl} />

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <MetricBlock label="Headcount" value={formatNumber(metrics?.headcount)} icon={<DatabaseZap />} />
            <MetricBlock label="Pass rate" value={formatPct(metrics?.pass_rate)} icon={<ShieldCheck />} />
            <MetricBlock label="Dropout" value={formatPct(metrics?.dropout_rate)} danger icon={<AlertTriangle />} />
            <MetricBlock label="Fail rate" value={formatPct(metrics?.fail_rate)} danger icon={<XOctagon />} />
            <MetricBlock label="Incompleto" value={formatPct(metrics?.incomplete_rate)} icon={<Clock />} />
            <MetricBlock label="GPA medio" value={formatDecimal(metrics?.gpa_mean)} icon={<Activity />} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <CourseHotspots courses={data?.courses} />
            <GpaPanel data={data?.gpa} />
          </section>

          <section className="grid gap-6 xl:grid-cols-[0.7fr_0.6fr_0.7fr]">
            <ProgramPressure programs={topPrograms} />
            <AuditPanel logs={auditLogs} />
            <JsonConsole viewer={viewer} operations={operations} />
          </section>
        </section>
      </section>
    </main>
  );
}

function StatusRail({
  health,
  hasToken,
  loading,
}: {
  health: "checking" | "online" | "offline";
  hasToken: boolean;
  loading: boolean;
}) {
  const items = [
    ["API", health === "online" ? "online" : health === "checking" ? "checking" : "offline"],
    ["Auth", hasToken ? "token" : "pendiente"],
    ["UI", loading ? "cargando" : "estable"],
  ];

  return (
    <div className="grid grid-cols-3 border border-bone/10">
      {items.map(([label, value]) => (
        <div key={label} className="border-r border-bone/10 p-3 last:border-r-0">
          <p className="font-mono text-[10px] uppercase text-bone/45">{label}</p>
          <p className="mt-1 font-mono text-xs uppercase text-signal">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.25em] text-bone/50">
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterBar({
  data,
  filters,
  onChange,
  onOps,
  onExport,
  exporting,
  exportUrl,
}: {
  data: DashboardData | null;
  filters: DashboardFilters;
  onChange: (filters: Partial<DashboardFilters>) => void;
  onOps: () => void;
  onExport: () => void;
  exporting: boolean;
  exportUrl: string | null;
}) {
  const terms = data?.terms.data ?? [];
  const programs = data?.programs.data ?? [];

  return (
    <div className="cut-panel grid gap-3 border border-bone/15 bg-graphite p-4 lg:grid-cols-5">
      <Field label="Periodo">
        <select value={filters.termId} onChange={(event) => onChange({ termId: event.target.value })}>
          {terms.length === 0 ? <option>2025-FALL</option> : null}
          {terms.map((term) => (
            <option key={term.id} value={term.id}>
              {term.attributes.code}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Programa">
        <select
          value={filters.programId}
          onChange={(event) => onChange({ programId: event.target.value })}
        >
          <option value="">Institucion</option>
          {programs.map((program) => (
            <option key={program.id} value={program.id}>
              {program.attributes.code} - {program.attributes.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Modalidad">
        <select value={filters.modality} onChange={(event) => onChange({ modality: event.target.value })}>
          <option value="">Todas</option>
          <option value="online">Online</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">Onsite</option>
        </select>
      </Field>
      <Field label="Dropout min">
        <input
          type="number"
          min="0"
          max="1"
          step="0.05"
          value={filters.dropoutRate}
          onChange={(event) => onChange({ dropoutRate: Number(event.target.value) })}
        />
      </Field>
      <div className="flex flex-col justify-end gap-2 sm:flex-row lg:flex-col">
        <button className="secondary-action w-full" onClick={onOps}>
          <ArrowUpRight size={17} /> Operaciones
        </button>
        {exportUrl ? (
          <a href={`/api${exportUrl}`} className="primary-action w-full block text-center leading-[2.2rem]" target="_blank" rel="noreferrer">
            Descargar CSV
          </a>
        ) : (
          <button className="primary-action w-full bg-volt text-ink hover:bg-volt/80" onClick={onExport} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" size={17} /> : <DatabaseZap size={17} />} Exportar
          </button>
        )}
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  icon,
  danger = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <article className={`metric-cut border bg-panel p-5 ${danger ? "border-danger/70 shadow-danger" : "border-bone/15"}`}>
      <div className="flex items-start justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-bone/50">{label}</p>
        <div className={danger ? "text-danger" : "text-signal"}>{icon}</div>
      </div>
      <p className="mt-8 text-4xl font-black uppercase tracking-tight">{value}</p>
    </article>
  );
}

function CourseHotspots({ courses }: { courses?: JsonApiList<CourseAttributes> }) {
  const rows = courses?.data ?? [];

  return (
    <Panel eyebrow="Cursos" title="Hotspots de abandono">
      <div className="space-y-3">
        {rows.length === 0 ? (
          <EmptyState text="Carga un token para ver cursos con mayor dropout." />
        ) : (
          rows.map((course, index) => <CourseRow key={course.id} course={course.attributes} rank={index + 1} />)
        )}
      </div>
    </Panel>
  );
}

function CourseRow({ course, rank }: { course: CourseAttributes; rank: number }) {
  const dropout = course.metrics.dropout_rate ?? 0;

  return (
    <div className="grid gap-3 border border-bone/10 bg-ink/35 p-3 sm:grid-cols-[44px_1fr_120px]">
      <div className="grid h-11 w-11 place-items-center border border-signal/50 font-mono text-sm text-signal">
        {String(rank).padStart(2, "0")}
      </div>
      <div>
        <p className="font-bold uppercase">{course.code}</p>
        <p className="text-sm text-bone/60">{course.title}</p>
        <Bar value={dropout} tone="danger" />
      </div>
      <div className="text-left sm:text-right">
        <p className="text-2xl font-black text-danger">{formatPct(dropout)}</p>
        <p className="font-mono text-[10px] uppercase text-bone/45">
          {course.metrics.enrollment_count ?? 0} alumnos
        </p>
      </div>
    </div>
  );
}

function GpaPanel({ data }: { data?: JsonApiSingle<{ histogram: Array<{ bin: string; pct: number; count: number }>; summary: { mean: number | null } }> }) {
  const histogram = data?.data.attributes.histogram ?? [];
  const mean = data?.data.attributes.summary.mean;

  return (
    <Panel eyebrow="Distribucion" title={`GPA medio ${formatDecimal(mean)}`}>
      <div className="space-y-3">
        {histogram.length === 0 ? (
          <EmptyState text="Sin histograma GPA cargado." />
        ) : (
          histogram.map((bin) => (
            <div key={bin.bin} className="grid grid-cols-[72px_1fr_48px] items-center gap-3">
              <span className="font-mono text-xs text-bone/50">{bin.bin}</span>
              <Bar value={bin.pct} tone="signal" />
              <span className="text-right font-mono text-xs">{bin.count}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function ProgramPressure({ programs }: { programs: ProgramBreakdown[] }) {
  return (
    <Panel eyebrow="Programas" title="Presion por dropout">
      <div className="space-y-3">
        {programs.length === 0 ? (
          <EmptyState text="La API devolvera el breakdown al cargar metricas institucionales." />
        ) : (
          programs.map((program) => (
            <div key={program.program_id} className="border-l-2 border-signal bg-ink/35 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold uppercase">{program.code}</p>
                  <p className="text-sm text-bone/60">{program.name}</p>
                </div>
                <p className="font-mono text-sm text-danger">{formatPct(program.metrics.dropout_rate)}</p>
              </div>
              <Bar value={program.metrics.dropout_rate ?? 0} tone="danger" />
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function JsonConsole({
  viewer,
  operations,
}: {
  viewer: unknown;
  operations: JsonApiSingle<Record<string, unknown>> | null;
}) {
  const attrs = operations?.data.attributes;

  return (
    <Panel eyebrow="Consola" title="Respuesta API">
      {attrs ? (
        <div className="mb-4 grid grid-cols-3 border border-bone/10">
          {Object.entries(attrs)
            .filter(([, value]) => typeof value === "number")
            .slice(0, 3)
            .map(([key, value]) => (
              <div key={key} className="border-r border-bone/10 p-3 last:border-r-0">
                <p className="font-mono text-[10px] uppercase text-bone/45">{key}</p>
                <p className="text-xl font-black">{String(value)}</p>
              </div>
            ))}
        </div>
      ) : null}
      <div className="max-h-[420px] overflow-auto border border-bone/10 bg-ink p-4 min-w-0">
        <pre className="font-mono text-xs leading-5 text-bone/75 break-all whitespace-pre-wrap">
          {JSON.stringify(viewer, null, 2)}
        </pre>
      </div>
    </Panel>
  );
}

function Panel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="cut-panel border border-bone/15 bg-graphite p-5 flex flex-col min-w-0">
      <div className="mb-5 flex items-end justify-between gap-4 border-b border-bone/10 pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-volt">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-black uppercase leading-none">{title}</h3>
        </div>
      </div>
      {children}
    </article>
  );
}

function Bar({ value, tone }: { value: number; tone: "signal" | "danger" }) {
  const width = `${Math.max(4, Math.min(100, value * 100))}%`;
  const color = tone === "danger" ? "bg-danger" : "bg-signal";

  return (
    <div className="mt-3 h-2 border border-bone/10 bg-ink">
      <div className={`h-full ${color}`} style={{ width }} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="border border-dashed border-bone/20 p-5 text-sm text-bone/50">{text}</div>;
}

function formatNumber(value?: number | null) {
  return value == null ? "n/a" : new Intl.NumberFormat("es-DO").format(value);
}

function formatPct(value?: number | null) {
  return value == null ? "n/a" : `${Math.round(value * 100)}%`;
}

function formatDecimal(value?: number | null) {
  return value == null ? "n/a" : value.toFixed(2);
}

function AuditPanel({ logs }: { logs: JsonApiList<AuditLogAttributes> | null }) {
  const rows = logs?.data ?? [];
  return (
    <Panel eyebrow="Auditoría" title="Logs Recientes">
      <div className="space-y-3">
        {rows.length === 0 ? (
          <EmptyState text="Carga operaciones para ver el registro de auditoría local." />
        ) : (
          rows.map((log) => (
            <div key={log.id} className={`border-l-2 ${log.attributes.outcome === 'success' ? 'border-volt' : 'border-danger'} bg-ink/35 p-3 flex justify-between items-center`}>
              <div className="overflow-hidden">
                <p className="font-mono text-xs uppercase text-bone/70 truncate">{log.attributes.method} {log.attributes.endpoint}</p>
                <p className="font-mono text-xs text-signal mt-1">{log.attributes.client_id}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`font-black text-sm uppercase ${log.attributes.outcome === 'success' ? 'text-volt' : 'text-danger'}`}>{log.attributes.outcome}</p>
                <p className="font-mono text-[10px] text-bone/50">{new Date(log.attributes.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
