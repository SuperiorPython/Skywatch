import { useState } from "react";
import { ApodSection } from "./components/ApodSection";
import { ExoplanetsSection } from "./components/ExoplanetsSection";
import { SpaceWeatherSection } from "./components/SpaceWeatherSection";
import { IssSection } from "./components/IssSection";
import { NeoWsSection } from "./components/NeoWsSection";
import { HomeGlobe } from "./components/HomeGlobe";
import { TabHeader } from "./components/TabHeader";
import { FeatureUnavailable } from "./components/FeatureUnavailable";
import { FEEDS, type FeedKey } from "./lib/feeds";
import { useFeedHealth } from "./lib/useFeedHealth";

function feedLabel(key: FeedKey): string {
  return FEEDS.find((f) => f.key === key)?.navLabel ?? key;
}

function App() {
  // null = the globe landing screen; otherwise the active tab.
  const [activeTab, setActiveTab] = useState<FeedKey | null>(null);
  const feedHealth = useFeedHealth();

  let content: JSX.Element;
  if (activeTab === null) {
    content = <HomeGlobe onSelect={setActiveTab} status={feedHealth} />;
  } else if (feedHealth[activeTab] === "down") {
    content = <FeatureUnavailable label={feedLabel(activeTab)} />;
  } else {
    switch (activeTab) {
      case "apod":
        content = <ApodSection />;
        break;
      case "exoplanets":
        content = <ExoplanetsSection />;
        break;
      case "space-weather":
        content = <SpaceWeatherSection />;
        break;
      case "iss":
        content = <IssSection />;
        break;
      case "neows":
        content = <NeoWsSection />;
        break;
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Skywatch</h1>
        <p className="muted">A live look at near-Earth space, built on NASA's public APIs.</p>
      </header>

      {activeTab !== null && <TabHeader active={activeTab} onHome={() => setActiveTab(null)} />}

      <main>{content}</main>
    </div>
  );
}

export default App;