import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import { api, type IssPosition } from "../lib/api";

const POLL_MS = 2 * 60 * 1000;
const MAX_TRAIL_POINTS = 30;

type Point = [number, number];

type TrackState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; position: IssPosition; trail: Point[] };

// A DivIcon sidesteps the well-known Leaflet + bundler problem where the
// default marker image paths don't resolve after bundling — no image
// imports to get wrong, just a styled element.
const issIcon = L.divIcon({
  className: "iss-marker",
  html: '<span class="iss-marker-dot"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function formatCoord(value: number, positiveSuffix: string, negativeSuffix: string): string {
  const suffix = value >= 0 ? positiveSuffix : negativeSuffix;
  return `${Math.abs(value).toFixed(2)}° ${suffix}`;
}

/** Pans the map to follow the ISS as new positions come in, without fighting the user's own zoom. */
function FollowMarker({ position }: { position: Point }) {
  const map = useMap();
  useEffect(() => {
    map.panTo(position, { animate: true, duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position[0], position[1]]);
  return null;
}

export function IssSection() {
  const [state, setState] = useState<TrackState>({ status: "loading" });
  const trailRef = useRef<Point[]>([]);
  const lastTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const position = await api.getIssPosition();
        if (cancelled) return;

        if (position.timestamp !== lastTimestampRef.current) {
          lastTimestampRef.current = position.timestamp;
          const newPoint: Point = [position.latitude, position.longitude];
          trailRef.current = [...trailRef.current, newPoint].slice(-MAX_TRAIL_POINTS);
        }

        setState({ status: "success", position, trail: trailRef.current });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: "error",
            message: err instanceof Error ? err.message : "Something went wrong.",
          });
        }
      }
    }

    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <section className="section">
      <h2>ISS tracker</h2>

      {state.status === "loading" && <p className="muted">Locating the ISS…</p>}
      {state.status === "error" && (
        <p className="error">Couldn't load the ISS position: {state.message}</p>
      )}

      {state.status === "success" && (
        <div className="iss-layout">
          <div className="iss-stats">
            <div className="stat-tile">
              <div className="stat-label">Latitude</div>
              <div className="stat-value">
                {formatCoord(state.position.latitude, "N", "S")}
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Longitude</div>
              <div className="stat-value">
                {formatCoord(state.position.longitude, "E", "W")}
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-label">Last update</div>
              <div className="stat-value stat-value-time">
                {new Date(state.position.timestamp * 1000).toLocaleTimeString()}
              </div>
            </div>
          </div>

          <div className="iss-map-wrap">
            <MapContainer
              center={[state.position.latitude, state.position.longitude]}
              zoom={3}
              scrollWheelZoom={false}
              style={{ height: "100%", width: "100%" }}
              attributionControl={true}
            >
              <TileLayer
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {state.trail.length > 1 && (
                <Polyline
                  positions={state.trail}
                  pathOptions={{ color: "var(--series-1)", weight: 2, opacity: 0.6 }}
                />
              )}
              <Marker
                position={[state.position.latitude, state.position.longitude]}
                icon={issIcon}
              />
              <FollowMarker position={[state.position.latitude, state.position.longitude]} />
            </MapContainer>
          </div>
          <p className="muted table-note">
            Refreshes every 2 minutes. The trail shows the last {MAX_TRAIL_POINTS} distinct
            positions received this session.
          </p>
        </div>
      )}
    </section>
  );
}
