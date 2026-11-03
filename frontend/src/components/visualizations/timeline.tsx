// What will run by itself over the next day, week or month (component-interfaces.md §5 Timeline;
// docs/demos/shared/page-tasks.js `timeline`): a lane per schedule, a dot per run, a band where
// runs are too dense to show one by one, and hatching where a schedule is paused. The moments are
// the server's; the axis starts at its now. A phone ticks every 6 hours, 2 days or 10 days, and
// draws a band sooner.

import { useTranslation } from "react-i18next";
import { useTier } from "@/hooks/use-tier";
import { localeOf } from "@/lib/locale";
import { cn } from "@/lib/utils";

export const timelineSpans = ["day", "week", "month"] as const;
export type TimelineSpan = (typeof timelineSpans)[number];

export interface TimelineLane {
  id: string;
  label: string;
  // Within the window; empty when more ran than the server lists.
  runsAt: readonly Date[];
  runCount: number;
  isPaused: boolean;
  // Said on a band: "every 15 min".
  bandText: string;
  // Said when nothing falls in the window: "next Mon 29 Jun 06:00".
  emptyText: string;
  // A repeat's dots are told apart from a plugin's.
  isRepeat: boolean;
}

interface TimelineProps {
  span: TimelineSpan;
  now: Date;
  end: Date;
  lanes: readonly TimelineLane[];
}

// More dots than this in a lane read as a band.
const denseAt = {
  day: 48,
  week: 28,
  month: 40,
} as const satisfies Record<TimelineSpan, number>;
const phoneDenseAt = 24;

const hourMilliseconds = 3_600_000;
const dayMilliseconds = 24 * hourMilliseconds;

function formatsOf() {
  const locale = localeOf();
  return {
    clock: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }),
    weekday: new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" }),
    day: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }),
  };
}

interface Tick {
  at: Date;
  label: string;
}

function startOfDay(moment: Date): Date {
  return new Date(moment.getFullYear(), moment.getMonth(), moment.getDate());
}

function ticksOf(
  span: TimelineSpan,
  now: Date,
  end: Date,
  isPhone: boolean,
  formats: ReturnType<typeof formatsOf>,
): Tick[] {
  const ticks: Tick[] = [];
  if (span === "day") {
    const step = isPhone ? 6 : 3;
    const first = startOfDay(now);
    first.setHours((Math.floor(now.getHours() / step) + 1) * step);
    for (let at = first; at < end; at = new Date(at.getTime() + step * hourMilliseconds)) {
      ticks.push({ at, label: formats.clock.format(at) });
    }

    return ticks;
  }

  const every = span === "week" ? (isPhone ? 2 : 1) : isPhone ? 10 : 5;
  let dayIndex = 1;
  for (
    let at = new Date(startOfDay(now).getTime() + dayMilliseconds);
    at < end;
    at = new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1), dayIndex += 1
  ) {
    if (dayIndex % every === 0) {
      ticks.push({
        at,
        label: span === "week" ? formats.weekday.format(at) : formats.day.format(at),
      });
    }
  }

  return ticks;
}

export function Timeline({ span, now, end, lanes }: TimelineProps) {
  const { t } = useTranslation("common");
  const isPhone = useTier() === "phone";
  const formats = formatsOf();
  const length = end.getTime() - now.getTime();
  const left = (at: Date) => `${(((at.getTime() - now.getTime()) / length) * 100).toFixed(2)}%`;
  // A tick too close to "now" would overlap its label.
  const ticks = ticksOf(span, now, end, isPhone, formats).filter(
    (tick) => (tick.at.getTime() - now.getTime()) / length > (isPhone ? 0.32 : 0.09),
  );
  const denseLimit = isPhone ? phoneDenseAt : denseAt[span];

  return (
    <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 text-xs @2xl:grid-cols-[minmax(0,12rem)_minmax(0,1fr)]">
      <div />
      <div className="relative h-5 border-b text-caption text-muted-foreground">
        <span className="absolute left-0 font-medium text-foreground">
          {t("timeline.now", { time: formats.clock.format(now) })}
        </span>
        {ticks.map((tick) => (
          <span
            key={tick.at.getTime()}
            className="absolute -translate-x-1/2 whitespace-nowrap"
            style={{ left: left(tick.at) }}
          >
            {tick.label}
          </span>
        ))}
      </div>
      {lanes.map((lane) => (
        <TimelineRow
          key={lane.id}
          lane={lane}
          left={left}
          clockFormat={formats.clock}
          isDense={lane.runCount > denseLimit || (lane.runCount > 0 && lane.runsAt.length === 0)}
        />
      ))}
    </div>
  );
}

function TimelineRow({
  lane,
  left,
  clockFormat,
  isDense,
}: {
  lane: TimelineLane;
  left: (at: Date) => string;
  clockFormat: Intl.DateTimeFormat;
  isDense: boolean;
}) {
  const { t } = useTranslation("common");
  const band = (text: string, className?: string) => (
    <div
      className={cn(
        "absolute inset-x-0 top-1/2 flex h-4 -translate-y-1/2 items-center rounded-xs bg-tone-blue px-2 text-2xs text-tone-blue-foreground",
        className,
      )}
    >
      <span className="truncate">{text}</span>
    </div>
  );

  return (
    <>
      <div className="truncate text-muted-foreground" title={lane.label}>
        {lane.label}
      </div>
      <div className="relative h-6 rounded-xs bg-muted/60">
        {lane.isPaused ? (
          band(
            t("timeline.paused"),
            "bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,var(--border)_6px_12px)] text-muted-foreground",
          )
        ) : isDense ? (
          band(lane.bandText)
        ) : lane.runsAt.length === 0 ? (
          <span className="absolute inset-y-0 left-2 flex items-center text-caption text-muted-foreground">
            {lane.emptyText}
          </span>
        ) : (
          lane.runsAt.map((at) => (
            <i
              key={at.getTime()}
              title={clockFormat.format(at)}
              className={cn(
                "absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                lane.isRepeat ? "bg-chart-4" : "bg-chart-3",
              )}
              style={{ left: left(at) }}
            />
          ))
        )}
      </div>
    </>
  );
}
