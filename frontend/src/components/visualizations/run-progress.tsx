// How far a run has got (component-interfaces.md §5 RunProgress; navigation.md §6): a bar, and
// under it the count, the errors so far and the time left, on a running card; the bar alone
// under the name in the sidebar's panel, where progress is the whole message. The numbers are
// the server's.
// TODO(rrandiak): labels move to i18n.

import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";
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
  const percent = percentOf(done, total);
  const bar = (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`${percent}% done`}
      className={cn("overflow-hidden rounded-full bg-secondary", form === "card" ? "h-1.5" : "h-1")}
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
            <span className="text-tone-red-foreground"> · {plural(errors, "error")} so far</span>
          )}
        </span>
        {timeLeft !== undefined && <span className="text-muted-foreground">{timeLeft}</span>}
      </div>
    </div>
  );
}
