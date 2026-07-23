import type { ProfileEntry } from "../data/profileRegistry";

export function ContinueGamePrompt({
  profileName,
  onContinue,
  onStartNew,
}: {
  profileName: string;
  onContinue: () => void;
  onStartNew: () => void;
}) {
  return (
    <section>
      <h1>Hex World</h1>
      <p>You have a saved game on this device ({profileName}).</p>
      <p>Do you want to continue where you left off?</p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1rem" }}>
        <button type="button" onClick={onContinue}>
          Yes!
        </button>
        <button type="button" onClick={onStartNew}>
          No. Start a New Game
        </button>
      </div>
    </section>
  );
}

export function profileDisplayName(registry: ProfileEntry[], slug: string): string {
  return registry.find((p) => p.slug === slug)?.name ?? slug;
}
