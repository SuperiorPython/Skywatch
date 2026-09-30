import { useEffect, useMemo, useRef, useState } from "react";
// react-globe.gl ships its own bundled types, but I can't install the
// package in my sandbox (npm registry is blocked there) to confirm the
// exact shape of its exports — see the `any` casts below, which are a
// deliberate, documented trade-off rather than sloppiness. Everything here
// matches the library's published usage examples as closely as I can from
// memory; the real test is running it. The riskiest single piece is
// `htmlElementVisibilityModifier` below (fading a label when its pin
// rotates to the far side of the globe) — I'm fairly confident in the prop
// name but haven't been able to verify it. The `pathsData` layer used for
// the dot-to-label connector lines is the next riskiest: I'm confident in
// the general shape (a list of paths, each a list of [lat, lng, alt]
// points) but haven't verified the exact default point-accessor behavior.
import Globe from "react-globe.gl";
import { FEEDS, type FeedKey, type FeedMeta } from "../lib/feeds";
import type { FeedStatus } from "../lib/useFeedHealth";
import { subsolarPoint, sublunarPoint } from "../lib/celestial";

const PIN_COLOR_ACTIVE = "#ffffff"; // healthy feed — nav chrome, not chart data
const PIN_COLOR_DOWN = "#e66767"; // --status-critical
const SUN_COLOR = "#ffd27f";
const MOON_COLOR = "#c7c9d1";

// How far outside the globe's surface the floating label sits, along the
// same lat/lng radial line as its dot — this is real 3D placement (not a
// 2D screen-space offset), so the library's own projection keeps the label
// correctly positioned as the globe rotates, without me hand-computing it.
const LABEL_ALTITUDE = 0.35;
const DOT_ALTITUDE = 0.01;

// How often the Sun/Moon markers are recomputed so they visibly drift if
// someone leaves the globe screen open — mirrors the ISS tracker's own
// polling pattern.
const CELESTIAL_REFRESH_MS = 60_000;

type FeedPoint = FeedMeta & { kind: "feed"; size: number; color: string };
type CelestialPoint = {
  kind: "celestial";
  key: "sun" | "moon";
  label: string;
  lat: number;
  lng: number;
  size: number;
  color: string;
};
type GlobePoint = FeedPoint | CelestialPoint;

interface HomeGlobeProps {
  onSelect: (key: FeedKey) => void;
  status: Record<FeedKey, FeedStatus>;
}

export function HomeGlobe({ onSelect, status }: HomeGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // See the top-of-file note: `any` because I can't resolve the library's
  // real ref-method type (GlobeMethods or similar) without installing it.
  const globeRef = useRef<any>(null);
  const [width, setWidth] = useState(0);
  const [celestial, setCelestial] = useState(() => ({
    sun: subsolarPoint(new Date()),
    moon: sublunarPoint(new Date()),
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Gentle idle rotation so the landing screen doesn't sit dead-still;
    // OrbitControls (exposed via .controls()) takes over normal drag/zoom.
    const controls = globeRef.current?.controls?.();
    if (!controls) return;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
  }, [width]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setCelestial({ sun: subsolarPoint(new Date()), moon: sublunarPoint(new Date()) });
    }, CELESTIAL_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const feedPoints = useMemo<FeedPoint[]>(
    () =>
      FEEDS.map((feed) => ({
        ...feed,
        kind: "feed",
        size: 0.55,
        color: status[feed.key] === "down" ? PIN_COLOR_DOWN : PIN_COLOR_ACTIVE,
      })),
    [status]
  );

  const celestialPoints = useMemo<CelestialPoint[]>(
    () => [
      { kind: "celestial", key: "sun", label: "Sun", size: 0.7, color: SUN_COLOR, ...celestial.sun },
      { kind: "celestial", key: "moon", label: "Moon", size: 0.5, color: MOON_COLOR, ...celestial.moon },
    ],
    [celestial]
  );

  const allPoints = useMemo<GlobePoint[]>(
    () => [...feedPoints, ...celestialPoints],
    [feedPoints, celestialPoints]
  );

  // One connector "flight path" per feed, running straight up from its
  // surface dot to its floating label at the same lat/lng.
  const connectorPaths = useMemo(
    () =>
      feedPoints.map((feed) => ({
        key: feed.key,
        color: feed.color,
        coords: [
          [feed.lat, feed.lng, DOT_ALTITUDE],
          [feed.lat, feed.lng, LABEL_ALTITUDE],
        ],
      })),
    [feedPoints]
  );

  return (
    <div className="home-globe-wrap" ref={containerRef}>
      {width > 0 && (
        <Globe
          ref={globeRef}
          width={width}
          height={520}
          backgroundColor="rgba(0,0,0,0)"
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          pointsData={allPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor="color"
          pointRadius="size"
          pointAltitude={DOT_ALTITUDE}
          pointResolution={32}
          pointLabel={(d: unknown) => {
            const point = d as GlobePoint;
            if (point.kind === "celestial") {
              return `<div class="globe-pin-tooltip">${point.label}</div>`;
            }
            const down = status[point.key] === "down";
            return `<div class="globe-pin-tooltip${down ? " globe-pin-tooltip-down" : ""}">${
              point.globeLabel
            }${down ? " — unavailable" : ""}</div>`;
          }}
          onPointClick={(point: unknown) => {
            const p = point as GlobePoint;
            if (p.kind === "feed") onSelect(p.key);
          }}
          onPointHover={(point: unknown) => {
            if (containerRef.current) {
              containerRef.current.style.cursor = point ? "pointer" : "grab";
            }
          }}
          // Connector lines from each feed's dot up to its floating label.
          pathsData={connectorPaths}
          pathPoints="coords"
          pathPointLat={(p: unknown) => (p as number[])[0]}
          pathPointLng={(p: unknown) => (p as number[])[1]}
          pathPointAlt={(p: unknown) => (p as number[])[2]}
          pathColor={(d: unknown) => (d as { color: string }).color}
          pathStroke={0.4}
          pathTransitionDuration={0}
          // The floating labels — real 3D-anchored HTML that follows its
          // pin as the globe rotates, always at LABEL_ALTITUDE outside the
          // surface so it never sits over the planet itself. Feeds only —
          // the Sun and Moon get a hover tooltip (above) but no label.
          htmlElementsData={feedPoints}
          htmlLat="lat"
          htmlLng="lng"
          htmlAltitude={LABEL_ALTITUDE}
          htmlElement={(d: unknown) => {
            const feed = d as FeedPoint;
            const down = status[feed.key] === "down";
            const el = document.createElement("div");
            el.className = `globe-pin-label${down ? " globe-pin-label-down" : ""}`;
            el.textContent = feed.navLabel;
            el.style.pointerEvents = "auto";
            el.addEventListener("click", (evt) => {
              evt.stopPropagation();
              onSelect(feed.key);
            });
            return el;
          }}
          htmlElementVisibilityModifier={(el: HTMLElement, isVisible: boolean) => {
            el.style.opacity = isVisible ? "1" : "0";
            el.style.pointerEvents = isVisible ? "auto" : "none";
          }}
        />
      )}
    </div>
  );
}