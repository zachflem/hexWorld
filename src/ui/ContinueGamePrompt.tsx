import { Save } from "lucide-react";
import type { ProfileEntry } from "../data/profileRegistry";
import "./onboarding/onboarding.css";

export function ContinueGamePrompt({
  profileName,
  onContinue,
  onStartNew,
  onLoadFromFile,
}: {
  profileName: string;
  onContinue: () => void;
  onStartNew: () => void;
  onLoadFromFile: () => void;
}) {
  return (
    <section className="onboarding-root">
      <div className="onboarding-notebook">
        <div className="onboarding-notebook__binding" aria-hidden="true" />
        <article className="onboarding-manual">
          <header className="onboarding-manual__header">
            <h1 className="onboarding-manual__title">Pick up where you left off?</h1>
          </header>
          <div className="onboarding-manual__body">
            <div className="onboarding-page-content">
              <p>You have a saved game on this device ({profileName}).</p>
              <p>Do you want to continue where you left off?</p>
            </div>
          </div>
          <footer className="onboarding-manual__footer onboarding-continue__footer">
            <div className="onboarding-manual__footer-left">
              <button type="button" className="onboarding-manual__btn" onClick={onStartNew}>
                New Game
              </button>
            </div>
            <div className="onboarding-manual__footer-center">
              <button
                type="button"
                className="onboarding-manual__btn onboarding-manual__btn--primary"
                onClick={onContinue}
              >
                Continue
              </button>
            </div>
            <div className="onboarding-manual__footer-right">
              <button type="button" className="onboarding-manual__btn onboarding-continue__load" onClick={onLoadFromFile}>
                <Save size={16} strokeWidth={2} aria-hidden="true" />
                Load
              </button>
            </div>
          </footer>
        </article>
      </div>
    </section>
  );
}

export function profileDisplayName(registry: ProfileEntry[], slug: string): string {
  return registry.find((p) => p.slug === slug)?.name ?? slug;
}
