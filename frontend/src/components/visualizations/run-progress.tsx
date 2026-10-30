// How far a run has got (component-interfaces.md §5 RunProgress; navigation.md §6): a bar, and
// under it the count, the errors so far and the time left, on a running card; the bar alone
// under the name in the sidebar's panel, where progress is the whole message. The numbers are
// the server's.

import { useTranslation } from "react-i18next";
import { formatCount } from "@/lib/format-number";
import { cn } from "@/lib/utils";

interface RunProgressProps {
  done: number;
  total: number;
  errors: number;
  // "4 min left".
  timeLeft?: string;
  form: "card" | "sidebar";
}

export function percentOf(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

export function RunProgress({ done, total, errors, timeLeft, form }: RunProgressProps) {
  const { t } = useTranslation("common");
  const percent = percentOf(done, total);
  const bar = (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={t("runProgress.percentDone", { percent })}
      className={cn(
        "overflow-hidden rounded-full",
        form === "card" ? "h-1.5 bg-secondary" : "h-1 bg-sidebar-accent",
      )}
    >
      <div
        className={cn("h-full", errors > 0 ? "bg-tone-amber-foreground" : "bg-chart-3")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );

  if (form === "sidebar") {
    return bar;
  }

  return (
    <div className="grid gap-1.5">
      {bar}
      <div className="flex flex-wrap justify-between gap-x-3 text-xs">
        <span className="tabular-nums">
          <b className="font-semibold">{formatCount(done)}</b> / {formatCount(total)} · {percent}%
          {errors > 0 && (
            <span className="text-tone-red-foreground">
              {" "}
              · {t("runProgress.errorsSoFar", { count: errors })}
            </span>
          )}
        </span>
        {timeLeft !== undefined && <span className="text-muted-foreground">{timeLeft}</span>}
      </div>
    </div>
  );
}
