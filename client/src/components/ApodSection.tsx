import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";

export function ApodSection() {
  const state = useFetch(() => api.getApod(), []);

  return (
    <section className="section apod-section">
      <h2>Astronomy Picture of the Day</h2>

      {state.status === "loading" && <p className="muted">Loading today's picture…</p>}

      {state.status === "error" && (
        <p className="error">Couldn't load today's picture: {state.message}</p>
      )}

      {state.status === "success" && (
        <div className="apod-card">
          {state.data.media_type === "image" ? (
            <img
              className="apod-media"
              src={state.data.url}
              alt={state.data.title}
              loading="lazy"
            />
          ) : (
            <iframe
              className="apod-media apod-video"
              src={state.data.url}
              title={state.data.title}
              allowFullScreen
            />
          )}
          <div className="apod-meta">
            <h3>{state.data.title}</h3>
            <p className="muted">
              {state.data.date}
              {state.data.copyright ? ` · © ${state.data.copyright}` : ""}
            </p>
            <p>{state.data.explanation}</p>
          </div>
        </div>
      )}
    </section>
  );
}
