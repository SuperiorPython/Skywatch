import { useMemo, useState } from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type ExoplanetRow } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { formatNumber, parsecsToLightYears } from "../lib/format";

type SortKey = "pl_name" | "hostname" | "disc_year" | "pl_rade" | "pl_bmasse" | "lightYears";
type SortDir = "asc" | "desc";

interface Row extends ExoplanetRow {
  lightYears: number | null;
}

const MAX_TABLE_ROWS = 200;

function toRow(r: ExoplanetRow): Row {
  return { ...r, lightYears: r.sy_dist !== null ? parsecsToLightYears(r.sy_dist) : null };
}

/**
 * Distance vs. radius carries the "does this planet's size correlate with
 * how far away we found it" story better as a scatter than a table alone —
 * but the table stays, since a scatter can show the shape of the data while
 * hiding exactly which planet is which.
 */
function ExoplanetTooltip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <div className="tooltip-title">{row.pl_name}</div>
      <div className="tooltip-row">
        <span>Host star</span>
        <strong>{row.hostname}</strong>
      </div>
      <div className="tooltip-row">
        <span>Distance</span>
        <strong>{formatNumber(row.lightYears, 0)} ly</strong>
      </div>
      <div className="tooltip-row">
        <span>Radius</span>
        <strong>{formatNumber(row.pl_rade)} R⊕</strong>
      </div>
      <div className="tooltip-row">
        <span>Mass</span>
        <strong>{row.pl_bmasse !== null ? `${formatNumber(row.pl_bmasse)} M⊕` : "—"}</strong>
      </div>
      <div className="tooltip-row">
        <span>Discovered</span>
        <strong>
          {row.disc_year ?? "—"}
          {row.discoverymethod ? ` · ${row.discoverymethod}` : ""}
        </strong>
      </div>
    </div>
  );
}

/**
 * A plain 5px dot is a pinpoint nobody can reliably hover in a dense
 * scatter, so each point renders with an invisible 12px-radius hit area
 * around the visible mark (see dataviz skill, interaction.md) rather than
 * relying on landing dead-center.
 */
function ScatterDot(props: { cx?: number; cy?: number }) {
  const { cx, cy } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill="var(--series-1)"
        stroke="var(--chart-surface)"
        strokeWidth={2}
      />
    </g>
  );
}

export function ExoplanetsSection() {
  const state = useFetch(() => api.getExoplanets(), []);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("disc_year");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const rows = useMemo(
    () => (state.status === "success" ? state.data.map(toRow) : []),
    [state]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (r) => r.pl_name.toLowerCase().includes(term) || r.hostname.toLowerCase().includes(term)
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * (sortDir === "asc" ? 1 : -1);
      }
      return (Number(av) - Number(bv)) * (sortDir === "asc" ? 1 : -1);
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const visibleRows = sorted.slice(0, MAX_TABLE_ROWS);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <section className="section">
      <h2>Exoplanets</h2>

      {state.status === "loading" && <p className="muted">Loading exoplanet catalog…</p>}
      {state.status === "error" && (
        <p className="error">Couldn't load exoplanet data: {state.message}</p>
      )}

      {state.status === "success" && (
        <div className="exoplanets-layout">
          <div className="chart-card">
            <h3>Distance vs. radius ({filtered.length.toLocaleString()} planets)</h3>
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 8, right: 16, bottom: 24, left: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="lightYears"
                  type="number"
                  scale="log"
                  domain={["auto", "auto"]}
                  tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
                  stroke="var(--chart-grid)"
                  label={{
                    value: "Distance from Earth (light-years, log scale)",
                    position: "insideBottom",
                    offset: -12,
                    fill: "var(--chart-axis)",
                    fontSize: 12,
                  }}
                />
                <YAxis
                  dataKey="pl_rade"
                  type="number"
                  scale="log"
                  domain={["auto", "auto"]}
                  tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
                  stroke="var(--chart-grid)"
                  label={{
                    value: "Radius (Earth radii, log scale)",
                    angle: -90,
                    position: "insideLeft",
                    fill: "var(--chart-axis)",
                    fontSize: 12,
                  }}
                />
                <Tooltip content={<ExoplanetTooltip />} cursor={{ stroke: "var(--chart-grid)" }} />
                <Scatter data={filtered} shape={<ScatterDot />} isAnimationActive={false} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div className="table-controls">
              <input
                type="search"
                placeholder="Filter by planet or host star…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th onClick={() => toggleSort("pl_name")}>Planet{sortIndicator("pl_name")}</th>
                    <th onClick={() => toggleSort("hostname")}>
                      Host star{sortIndicator("hostname")}
                    </th>
                    <th onClick={() => toggleSort("disc_year")}>
                      Discovered{sortIndicator("disc_year")}
                    </th>
                    <th>Method</th>
                    <th className="numeric" onClick={() => toggleSort("pl_rade")}>
                      Radius (R⊕){sortIndicator("pl_rade")}
                    </th>
                    <th className="numeric" onClick={() => toggleSort("pl_bmasse")}>
                      Mass (M⊕){sortIndicator("pl_bmasse")}
                    </th>
                    <th className="numeric" onClick={() => toggleSort("lightYears")}>
                      Distance (ly){sortIndicator("lightYears")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((r) => (
                    <tr key={r.pl_name}>
                      <td>{r.pl_name}</td>
                      <td>{r.hostname}</td>
                      <td>{r.disc_year ?? "—"}</td>
                      <td>{r.discoverymethod ?? "—"}</td>
                      <td className="numeric">{formatNumber(r.pl_rade)}</td>
                      <td className="numeric">{formatNumber(r.pl_bmasse)}</td>
                      <td className="numeric">{formatNumber(r.lightYears, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted table-note">
              Showing {visibleRows.length.toLocaleString()} of {sorted.length.toLocaleString()}{" "}
              matching planets
              {sorted.length > MAX_TABLE_ROWS ? " — narrow your search to see more" : ""}.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}