// Three bars against a target (component-interfaces.md §5; docs/demos/shared/vera.css .pj-bars):
// the time gone, the pages planned and the pages delivered. A mark on planned and delivered shows
// where an even pace would be by today. Delivered is a part of planned and the two are never
// added. Every number is the server's; this only draws them. Labels sit beside the bars where the
// room allows and the value drops under the bar where it does not.

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatCount } from "@/lib/format-number";
import { cn } from "@/lib/utils";

export interface PaceBarsProps {
  target: number;
  // 0 to 1; null for an open-ended target, which has no time bar and no pace.
  timeElapsed: number | null;
  // "36% elapsed · 371 days left", "starts 1 Sep 2026 · in 67 days".
  timeLabel: string;
  // Null while nothing is funded: only the time bar is drawn.
  pages: { planned: number; delivered: number } | null;
  // 0 to 1, where planned and delivered would be by today.
  evenPace?: number | null;
  density?: "card" | "detail";
}

const share = (value: number, target: number) => (target === 0 ? 0 : value / target);

export function PaceBars({
  target,
  timeElapsed,
  timeLabel,
  pages,
  evenPace = null,
  density = "card",
}: PaceBarsProps) {
  const { t } = useTranslation("common");
  const ofTarget = (value: number) => (
    <>
      {formatCount(value)} / {formatCount(target)} pp ·{" "}
      <b className="font-semibold">{Math.round(share(value, target) * 100)}%</b>
    </>
  );

  return (
    <div className={cn("@container grid gap-2", density === "detail" ? "text-ui" : "text-xs")}>
      {timeElapsed !== null && (
        <PaceBar
          label={t("pace.time")}
          fill={timeElapsed}
          tone="bg-muted-foreground"
          density={density}
        >
          {timeLabel}
        </PaceBar>
      )}
      {pages !== null && (
        <>
          <PaceBar
            label={t("pace.planned")}
            fill={share(pages.planned, target)}
            mark={evenPace}
            tone="bg-chart-1"
            density={density}
          >
            {ofTarget(pages.planned)}
            {pages.planned > target && (
              <span className="text-muted-foreground">
                {" "}
                · {t("pace.over", { count: formatCount(pages.planned - target) })}
              </span>
            )}
          </PaceBar>
          <PaceBar
            label={t("pace.delivered")}
            fill={share(pages.delivered, target)}
            mark={evenPace}
            tone="bg-chart-3"
            density={density}
          >
            {ofTarget(pages.delivered)}
          </PaceBar>
        </>
      )}
    </div>
  );
}

interface PaceBarProps {
  label: string;
  fill: number;
  mark?: number | null;
  tone: string;
  density: "card" | "detail";
  children: ReactNode;
}

function PaceBar({ label, fill, mark = null, tone, density, children }: PaceBarProps) {
  const { t } = useTranslation("common");
  return (
    <div
      className={cn(
        "grid grid-cols-[4.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5",
        density === "detail"
          ? "@lg:grid-cols-[5.5rem_minmax(0,1fr)_16rem]"
          : "@md:grid-cols-[4.75rem_minmax(0,1fr)_13rem]",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <div
        className={cn(
          "relative rounded-full bg-secondary",
          density === "detail" ? "h-2.5" : "h-1.75",
        )}
      >
        <div
          className={cn("h-full rounded-full", tone)}
          style={{ width: `${Math.min(100, Math.max(0, fill * 100))}%` }}
        />
        {mark !== null && (
          <b
            className="absolute -top-0.75 -bottom-0.75 -ml-px w-0.5 rounded-full bg-foreground"
            style={{ left: `${Math.min(100, Math.max(0, mark * 100))}%` }}
            title={t("pace.evenPace")}
          />
        )}
      </div>
      <span
        className={cn(
          "col-start-2 tabular-nums",
          density === "detail" ? "@lg:col-start-3" : "@md:col-start-3",
        )}
      >
        {children}
      </span>
    </div>
  );
}
