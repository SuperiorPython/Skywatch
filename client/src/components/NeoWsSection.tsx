import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type CloseApproach } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { formatNumber, kmToLunarDistances, kphToKps } from "../lib/format";

type SortKey = "name" | "date" | "avgDiameterKm" | "velocityKph" | "missDistanceKm";
type SortDir = "asc" | "desc";

interface Row extends CloseApproach {
  avgDiameterKm: number;
}

function toRow(r: CloseApproach): Row {
  return { ...r, avgDiameterKm: (r.diameterKmMin + r.diameterKmMax) / 2 };
}

/**
 * This is an "emphasis" chart, not a categorical one (see dataviz skill,
 * choosing-a-form.md): the story is "which of these are potentially
 * hazardous," so hazardous objects get the status-critical color and
 * everything else recedes into gray, rather than every object getting its
 * own hue.
 */
function NeoTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <div className="tooltip-title">
        {row.isHazardous && <span className="type-dot" style={{ background: "var(--status-critical)" }} />}
        {row.name}
      </div>
      <div className="tooltip-row">
        <span>Close approach</span>
        <strong>{row.date}</strong>
      </div>
      <div className="tooltip-row">
        <span>Diameter</span>
        <strong>
          {formatNumber(row.diameterKmMin, 2)}–{formatNumber(row.diameterKmMax, 2)} km
        </strong>
      </div>
      <div className="tooltip-row">
        <span>Velocity</span>
        <strong>{formatNumber(kphToKps(row.velocityKph), 1)} km/s</strong>
      </div>
      <div className="tooltip-row">
        <span>Miss distance</span>
        <strong>{formatNumber(kmToLunarDistances(row.missDistanceKm), 2)} LD</strong>
      </div>
    </div>
  );
}

function NeoDot(props: { cx?: number; cy?: number; fill?: string }) {
  const { cx, cy, fill } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      <circle cx={cx} cy={cy} r={5} fill={fill} stroke="var(--chart-surface)" strokeWidth={2} />
    </g>
  );
}

const legendPayload = [
  { value: "Potentially hazardous", type: "circle" as const, color: "var(--status-critical)" },
  { value: "Other", type: "circle" as const, color: "var(--dot-muted)" },
];

export function NeoWsSection() {
  const state = useFetch(() => api.getNearEarthObjects(), []);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const rows = useMemo(() => (state.status === "success" ? state.data.map(toRow) : []), [state]);
  const hazardous = useMemo(() => rows.filter((r) => r.isHazardous), [rows]);
  const nonHazardous = useMemo(() => rows.filter((r) => !r.isHazardous), [rows]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "string" ? String(av).localeCompare(String(bv)) : Number(av) - Number(bv);
      return cmp * (sortDir === "asc" ? 1 : -1);
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <section className="section">
      <h2>Near-Earth objects (next 7 days)</h2>

      {state.status === "loading" && <p className="muted">Loading close-approach data…</p>}
      {state.status === "error" && (
        <p className="error">Couldn't load near-Earth object data: {state.message}</p>
      )}

      {state.status === "success" && (
        <div className="exoplanets-layout">
          <div className="chart-card">
            <h3>
              {rows.length.toLocaleString()} close approaches ·{" "}
              <span style={{ color: "var(--status-critical)" }}>
                {hazardous.length} potentially hazardous
              </span>
            </h3>
            <ResponsiveContainer width="100%" height={340}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="missDistanceKm"
                  type="number"
                  scale="log"
                  domain={["auto", "auto"]}
                  tickFormatter={(v: number) => formatNumber(kmToLunarDistances(v), 1)}
                  tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
                  stroke="var(--chart-grid)"
                  label={{
                    value: "Miss distance (lunar distances, log scale)",
                    position: "insideBottom",
                    offset: -12,
                    fill: "var(--chart-axis)",
                    fontSize: 12,
                  }}
                />
                <YAxis
                  dataKey="avgDiameterKm"
                  type="number"
                  scale="log"
                  domain={["auto", "auto"]}
                  tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
                  stroke="var(--chart-grid)"
                  label={{
                    value: "Estimated diameter (km, log scale)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--chart-axis)",
                    fontSize: 12,
                  }}
                />
                <Tooltip content={<NeoTooltip />} cursor={{ stroke: "var(--chart-grid)" }} />
                <Legend payload={legendPayload} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Scatter
                  data={nonHazardous}
                  shape={<NeoDot fill="var(--dot-muted)" />}
                  isAnimationActive={false}
                />
                <Scatter
                  data={hazardous}
                  shape={<NeoDot fill="var(--status-critical)" />}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => toggleSort("name")}>Object{sortIndicator("name")}</th>
                  <th onClick={() => toggleSort("date")}>Approach date{sortIndicator("date")}</th>
                  <th>Hazardous</th>
                  <th className="numeric" onClick={() => toggleSort("avgDiameterKm")}>
                    Diameter (km){sortIndicator("avgDiameterKm")}
                  </th>
                  <th className="numeric" onClick={() => toggleSort("velocityKph")}>
                    Velocity (km/s){sortIndicator("velocityKph")}
                  </th>
                  <th className="numeric" onClick={() => toggleSort("missDistanceKm")}>
                    Miss distance (LD){sortIndicator("missDistanceKm")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={`${r.id}-${r.date}`}>
                    <td>{r.name}</td>
                    <td>{r.date}</td>
                    <td>
                      {r.isHazardous ? (
                        <>
                          <span className="type-dot" style={{ background: "var(--status-critical)" }} />
                          Yes
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="numeric">
                      {formatNumber(r.diameterKmMin, 2)}–{formatNumber(r.diameterKmMax, 2)}
                    </td>
                    <td className="numeric">{formatNumber(kphToKps(r.velocityKph), 1)}</td>
                    <td className="numeric">{formatNumber(kmToLunarDistances(r.missDistanceKm), 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}