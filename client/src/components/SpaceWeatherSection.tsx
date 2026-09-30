import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type SpaceWeatherEvent } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { formatDateTime, formatShortDay, isoDay, lastNDays } from "../lib/format";

const DAYS = 30;
const MAX_FEED_ITEMS = 60;

// Stacking order, bottom to top. Fixed order = the CVD-safety mechanism
// (see dataviz skill, palette.md) — never reassign these on filter.
const EVENT_TYPES: SpaceWeatherEvent["type"][] = ["Solar Flare", "CME", "Geomagnetic Storm"];

const TYPE_COLOR: Record<SpaceWeatherEvent["type"], string> = {
  "Solar Flare": "var(--series-1)", // blue
  CME: "var(--series-2)", // orange
  "Geomagnetic Storm": "var(--series-3)", // aqua
};

interface DayBucket {
  date: string;
  "Solar Flare": number;
  CME: number;
  "Geomagnetic Storm": number;
}

/**
 * Renders one stacked-bar segment, inset 1px top and bottom so touching
 * segments leave a 2px surface-color gap at their shared edge instead of a
 * border (see dataviz skill, marks-and-anatomy.md — a stroke would add
 * data-weight ink that isn't data). Only the top-of-stack series rounds its
 * top corners; this rounds unconditionally for that series rather than only
 * on days where it's the actual tallest visible segment, which is a
 * deliberate simplification.
 */
function StackSegment(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  roundTop?: boolean;
}) {
  const { x, y, width, height, fill, roundTop } = props;
  if (x === undefined || y === undefined || width === undefined || !height || height <= 0) {
    return null;
  }

  const inset = 1;
  const ry = y + inset;
  const rh = Math.max(height - inset * 2, 0);

  if (!roundTop) {
    return <rect x={x} y={ry} width={width} height={rh} fill={fill} />;
  }

  const r = Math.min(3, width / 2, rh);
  const d = `M${x},${ry + rh} L${x},${ry + r} Q${x},${ry} ${x + r},${ry} L${
    x + width - r
  },${ry} Q${x + width},${ry} ${x + width},${ry + r} L${x + width},${ry + rh} Z`;
  return <path d={d} fill={fill} />;
}

function WeatherTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: { dataKey: SpaceWeatherEvent["type"]; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="chart-tooltip">
      <div className="tooltip-title">{label ? formatShortDay(label) : ""}</div>
      {EVENT_TYPES.map((type) => {
        const entry = payload.find((p) => p.dataKey === type);
        if (!entry || entry.value === 0) return null;
        return (
          <div className="tooltip-row" key={type}>
            <span>
              <span className="type-dot" style={{ background: TYPE_COLOR[type] }} />
              {type}
            </span>
            <strong>{entry.value}</strong>
          </div>
        );
      })}
      {total === 0 && <div className="tooltip-row muted">No events</div>}
    </div>
  );
}

export function SpaceWeatherSection() {
  const state = useFetch(() => api.getSpaceWeather(DAYS), []);

  const dailyCounts = useMemo<DayBucket[]>(() => {
    const days = lastNDays(DAYS);
    const buckets = new Map<string, DayBucket>(
      days.map((date) => [date, { date, "Solar Flare": 0, CME: 0, "Geomagnetic Storm": 0 }])
    );

    if (state.status === "success") {
      for (const event of state.data) {
        const day = isoDay(new Date(event.time));
        const bucket = buckets.get(day);
        if (bucket) bucket[event.type] += 1;
      }
    }

    return days.map((d) => buckets.get(d)!);
  }, [state]);

  const feed = useMemo<SpaceWeatherEvent[]>(() => {
    if (state.status !== "success") return [];
    return [...state.data]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, MAX_FEED_ITEMS);
  }, [state]);

  const totalEvents = state.status === "success" ? state.data.length : 0;

  return (
    <section className="section">
      <h2>Space weather (last {DAYS} days)</h2>

      {state.status === "loading" && <p className="muted">Loading DONKI feed…</p>}
      {state.status === "error" && (
        <p className="error">Couldn't load space weather data: {state.message}</p>
      )}

      {state.status === "success" && (
        <div className="exoplanets-layout">
          <div className="chart-card">
            <h3>{totalEvents.toLocaleString()} events by day</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyCounts} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDay}
                  interval={Math.ceil(DAYS / 10)}
                  tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
                  stroke="var(--chart-grid)"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: "var(--chart-axis)", fontSize: 12 }}
                  stroke="var(--chart-grid)"
                  width={28}
                />
                <Tooltip content={<WeatherTooltip />} cursor={{ fill: "var(--border)" }} />
                <Legend
                  wrapperStyle={{ color: "var(--text-muted)", fontSize: 12, paddingTop: 8 }}
                  iconType="circle"
                  iconSize={8}
                />
                <Bar
                  dataKey="Solar Flare"
                  stackId="events"
                  barSize={16}
                  isAnimationActive={false}
                  shape={(p: object) => (
                    <StackSegment {...p} fill={TYPE_COLOR["Solar Flare"]} roundTop={false} />
                  )}
                />
                <Bar
                  dataKey="CME"
                  stackId="events"
                  barSize={16}
                  isAnimationActive={false}
                  shape={(p: object) => <StackSegment {...p} fill={TYPE_COLOR.CME} roundTop={false} />}
                />
                <Bar
                  dataKey="Geomagnetic Storm"
                  stackId="events"
                  barSize={16}
                  isAnimationActive={false}
                  shape={(p: object) => (
                    <StackSegment {...p} fill={TYPE_COLOR["Geomagnetic Storm"]} roundTop={true} />
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div>
            <h3 className="feed-heading">Recent activity</h3>
            <ul className="event-feed">
              {feed.map((event: SpaceWeatherEvent) => (
                <li key={event.id} className="event-item">
                  <span className="type-dot" style={{ background: TYPE_COLOR[event.type] }} />
                  <div className="event-item-body">
                    <div className="event-item-headline">{event.headline}</div>
                    <div className="muted event-item-meta">
                      {event.type} · {formatDateTime(event.time)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {feed.length === 0 && <p className="muted">No space weather events in this window.</p>}
            {totalEvents > MAX_FEED_ITEMS && (
              <p className="muted table-note">
                Showing the {MAX_FEED_ITEMS} most recent of {totalEvents} events.
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}