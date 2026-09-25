import { ApodSection } from "./components/ApodSection";
import { ExoplanetsSection } from "./components/ExoplanetsSection";
import { SpaceWeatherSection } from "./components/SpaceWeatherSection";
import { IssSection } from "./components/IssSection";
import { NeoWsSection } from "./components/NeoWsSection";

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>Skywatch</h1>
        <p className="muted">A live look at near-Earth space, built on NASA's public APIs.</p>
      </header>

      <main>
        <ApodSection />
        <ExoplanetsSection />
        <SpaceWeatherSection />
        <IssSection />
        <NeoWsSection />
      </main>
    </div>
  );
}

export default App;