import { FEEDS, type FeedKey } from "../lib/feeds";

interface TabHeaderProps {
  active: FeedKey;
  onHome: () => void;
}

/** Shown only once a tab is open — the globe screen itself has no need for
 * this, since its floating labels are the navigation there. */
export function TabHeader({ active, onHome }: TabHeaderProps) {
  const label = FEEDS.find((f) => f.key === active)?.navLabel ?? active;
  return (
    <div className="tab-header">
      <button type="button" className="tab-header-home" onClick={onHome}>
        ◉ Home
      </button>
      <span className="tab-header-current">{label}</span>
    </div>
  );
}