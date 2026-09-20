import type { FractionVisual as FractionVisualData } from "@knowgate/domain";

export function FractionVisual({
  visual,
  compact = false,
}: {
  visual?: FractionVisualData;
  compact?: boolean;
}) {
  if (!visual) return null;
  const compareTo = visual.compareTo;

  return (
    <div
      className={`fraction-visual${compact ? " fraction-visual--compact" : ""}`}
      role="img"
      aria-label={`长条平均分成 ${visual.total} 份，涂色 ${visual.active} 份`}
    >
      <div className="fraction-visual__bar">
        {Array.from({ length: visual.total }, (_, index) => (
          <span
            className="fraction-visual__part"
            data-active={index < visual.active}
            key={index}
          />
        ))}
      </div>
      {compareTo !== undefined ? (
        <div className="fraction-visual__bar fraction-visual__bar--compare">
          {Array.from({ length: visual.total }, (_, index) => (
            <span
              className="fraction-visual__part"
              data-active={index < compareTo}
              key={index}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
