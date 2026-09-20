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
  const compareTotal = visual.compareTotal ?? visual.total;
  // A compare bar that repeats the main bar teaches nothing, so it is skipped
  // even if the content still passes an identical pair.
  const showCompare =
    compareTo !== undefined &&
    (compareTo !== visual.active || compareTotal !== visual.total);
  const [mainLabel, compareLabel] = visual.labels ?? [];

  const describe = (total: number, active: number) =>
    `平均分成 ${total} 份，涂色 ${active} 份`;
  const ariaLabel = showCompare
    ? `上条${describe(visual.total, visual.active)}；下条${describe(compareTotal, compareTo)}`
    : describe(visual.total, visual.active);

  return (
    <div
      className={`fraction-visual${compact ? " fraction-visual--compact" : ""}`}
      role="img"
      aria-label={ariaLabel}
    >
      <div className="fraction-visual__row">
        <div className="fraction-visual__bar">
          {Array.from({ length: visual.total }, (_, index) => (
            <span
              className="fraction-visual__part"
              data-active={index < visual.active}
              key={index}
            />
          ))}
        </div>
        {mainLabel ? (
          <span className="fraction-visual__label">{mainLabel}</span>
        ) : null}
      </div>
      {showCompare ? (
        <div className="fraction-visual__row fraction-visual__row--compare">
          <div className="fraction-visual__bar">
            {Array.from({ length: compareTotal }, (_, index) => (
              <span
                className="fraction-visual__part"
                data-active={index < compareTo}
                key={index}
              />
            ))}
          </div>
          {compareLabel ? (
            <span className="fraction-visual__label">{compareLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
