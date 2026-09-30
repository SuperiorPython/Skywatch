interface FeatureUnavailableProps {
  label: string;
}

/** Shown in place of a tab's real content when its feed's health check
 * failed — a consistent message instead of each section handling (or
 * mishandling) its own broken state differently. */
export function FeatureUnavailable({ label }: FeatureUnavailableProps) {
  return (
    <div className="feature-unavailable">
      <span className="feature-unavailable-dot" />
      <p>
        <strong>{label}</strong> isn't functioning right now — NASA's API may be
        temporarily unavailable. Try again in a bit.
      </p>
    </div>
  );
}