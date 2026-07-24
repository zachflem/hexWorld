import { useEffect, useId, useRef, type ReactNode } from "react";

export function ManualPage({
  title,
  pageKey,
  children,
  showBack,
  onBack,
  leftLabel,
  onLeft,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  storyPageIndex,
  storyPageCount,
}: {
  title?: string;
  /** Drives the fade animation and focus reset on page change. */
  pageKey: string | number;
  children: ReactNode;
  showBack: boolean;
  onBack: () => void;
  /** Optional secondary action in the left footer (e.g. Load from file on cover). */
  leftLabel?: string;
  onLeft?: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  storyPageIndex?: number;
  storyPageCount?: number;
}) {
  const headingId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryRef.current?.focus();
  }, [pageKey]);

  const counterLabel =
    storyPageIndex != null && storyPageCount != null
      ? `Story page ${storyPageIndex} of ${storyPageCount}`
      : null;

  return (
    <div className="onboarding-notebook">
      <div className="onboarding-notebook__binding" aria-hidden="true" />
      <article className="onboarding-manual" aria-labelledby={title ? headingId : undefined}>
      {title ? (
        <header className="onboarding-manual__header">
          <h1 id={headingId} className="onboarding-manual__title">
            {title}
          </h1>
        </header>
      ) : null}

      <div className="onboarding-manual__body">
        <div key={pageKey} className="onboarding-page-content">
          {children}
        </div>
      </div>

      <footer className="onboarding-manual__footer">
        <div className="onboarding-manual__footer-left">
          {showBack ? (
            <button type="button" className="onboarding-manual__btn" onClick={onBack}>
              ← Back
            </button>
          ) : null}
          {!showBack && leftLabel && onLeft ? (
            <button type="button" className="onboarding-manual__btn" onClick={onLeft}>
              {leftLabel}
            </button>
          ) : null}
        </div>

        <div className="onboarding-manual__footer-center">
          {counterLabel ? (
            <p className="onboarding-manual__counter" aria-live="polite">
              Page {storyPageIndex} of {storyPageCount}
            </p>
          ) : null}
        </div>

        <div className="onboarding-manual__footer-right">
          <button
            ref={primaryRef}
            type="button"
            className="onboarding-manual__btn onboarding-manual__btn--primary"
            onClick={onPrimary}
            disabled={primaryDisabled}
          >
            {primaryLabel}
          </button>
        </div>
      </footer>
      </article>
    </div>
  );
}
