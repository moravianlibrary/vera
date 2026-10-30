// A mix drawn as stacked bars (component-interfaces.md §5; docs/demos/shared/vera.css .in-strip):
// each category's share in its own blue of the chart ramp, in the same order and colour on every
// bar, so the intended mix and the output read against each other; what no category has a share
// of is left hatched. Every number is the server's; this only draws them. Where a row has no room
// for bars, as on Categories, the markers form says only how far outside the ±5 band it is.

import { mixBand } from "@vera/domain/intentions";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const shareTones = ["bg-chart-5", "bg-chart-3", "bg-chart-2", "bg-chart-1", "bg-tone-blue"];

// The colour a category is drawn in, by its place among the categories of the mix.
export const shareToneOf = (index: number) => shareTones[index % shareTones.length];

export interface MixShare {
  id: string;
  label: string;
  // Percent; null or 0 draws nothing.
  value: number | null;
}

interface MixBarProps {
  shares: readonly MixShare[];
  // Percent left to no category; drawn hatched at the end.
  unallocated?: number;
  className?: string;
}

export function MixBar({ shares, unallocated = 0, className }: MixBarProps) {
  const { t } = useTranslation("common");
  return (
    <div className={cn("flex h-2 overflow-hidden rounded-full bg-secondary", className)}>
      {shares.map((share, index) =>
        share.value === null || share.value <= 0 ? null : (
          <i
            key={share.id}
            className={cn("h-full border-r border-background last:border-r-0", shareToneOf(index))}
            style={{ width: `${share.value}%` }}
            title={t("mixBars.sharePercent", {
              label: share.label,
              percent: Math.round(share.value),
            })}
          />
        ),
      )}
      {unallocated > 0.5 && (
        <i
          className="h-full bg-[repeating-linear-gradient(45deg,var(--color-tone-amber)_0_4px,var(--color-amber-300)_4px_6px)]"
          style={{ width: `${unallocated}%` }}
          title={t("mixBars.unallocated", { percent: Math.round(unallocated) })}
        />
      )}
    </div>
  );
}

export interface MixCategory {
  id: string;
  label: string;
  intended: number | null;
  actual: number | null;
}

interface MixBarsProps {
  categories: readonly MixCategory[];
}

// The intended mix over the actual one, labelled, on one scale.
export function MixBars({ categories }: MixBarsProps) {
  const { t } = useTranslation("common");
  const bars = [
    {
      key: "intended",
      label: t("mixBars.intended"),
      valueOf: (category: MixCategory) => category.intended,
    },
    {
      key: "actual",
      label: t("mixBars.output"),
      valueOf: (category: MixCategory) => category.actual,
    },
  ];
  return (
    <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs">
      {bars.map((bar) => (
        <div key={bar.key} className="contents">
          <span className="text-muted-foreground">{bar.label}</span>
          <MixBar
            shares={categories.map((category) => ({
              id: category.id,
              label: category.label,
              value: bar.valueOf(category),
            }))}
          />
        </div>
      ))}
    </div>
  );
}

interface DriftMarkerProps {
  // Percent; nothing is drawn when either is missing.
  intended: number | null;
  actual: number | null;
}

// ▲ over the mix, ▼ under it, in whole points; nothing inside the band.
export function DriftMarker({ intended, actual }: DriftMarkerProps) {
  const { t } = useTranslation("common");
  if (intended === null || actual === null) {
    return null;
  }

  const drift = Math.round(actual - intended);
  if (Math.abs(drift) <= mixBand) {
    return null;
  }

  const isOver = drift > 0;
  return (
    <span
      className={cn(
        "ml-1 text-xs font-semibold tabular-nums",
        isOver ? "text-tone-red-foreground" : "text-tone-blue-foreground",
      )}
      title={t(isOver ? "mixBars.pointsOver" : "mixBars.pointsUnder", { count: Math.abs(drift) })}
    >
      {isOver ? "▲" : "▼"}
      {Math.abs(drift)}
    </span>
  );
}
