// The parts a record's detail pane is built from (docs/demos/shared/vera.css § cards inside a
// pane): stat tiles across the top, cards with a small uppercase title and an optional action,
// facts as label and value pairs, rows that read across with their date or badge on the right,
// and the fine print under them. Two columns of facts and three of tiles where the pane has the
// room; one on a phone.

import type { ReactNode } from "react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DetailCardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

export function DetailCard({ title, action, children }: DetailCardProps) {
  return (
    <Card className="gap-3.5 rounded-lg py-4 shadow-none">
      <CardHeader className="items-center px-5">
        <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
        </CardTitle>
        {action !== undefined && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="@container px-5 text-sm">{children}</CardContent>
    </Card>
  );
}

export interface Fact {
  label: string;
  value: ReactNode;
}

export function FactGrid({ facts }: { facts: readonly Fact[] }) {
  return (
    <dl className="grid gap-x-8 gap-y-3.5 @sm:grid-cols-2">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{fact.label}</dt>
          <dd className="mt-0.5 font-medium break-words">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface DetailRowProps {
  // On the right: a date, a count or a badge.
  aside?: ReactNode;
  children: ReactNode;
}

export function DetailRow({ aside, children }: DetailRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-1.5 last:border-b-0">
      <div className="min-w-0">{children}</div>
      {aside !== undefined && <div className="shrink-0 text-right">{aside}</div>}
    </div>
  );
}

export function FinePrint({ children }: { children: ReactNode }) {
  return <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{children}</p>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

export interface Stat {
  label: string;
  value: ReactNode;
  foot?: ReactNode;
  // A word or a badge rather than a number, set smaller.
  isText?: boolean;
  // How far along, 0–100, as a bar under the value.
  meter?: number;
}

export function StatTiles({ stats }: { stats: readonly Stat[] }) {
  return (
    <div className="grid gap-3.5 @sm:grid-cols-2 @xl:grid-cols-3">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-0 rounded-lg border bg-card px-4 py-3.5">
          <div className="text-[0.625rem] font-semibold tracking-wider text-muted-foreground uppercase">
            {stat.label}
          </div>
          <div
            className={cn(
              "mt-1.5 tabular-nums",
              stat.isText ? "text-[0.9375rem] font-semibold" : "text-2xl font-bold",
            )}
          >
            {stat.value}
          </div>
          {stat.meter !== undefined && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-chart-3"
                style={{ width: `${Math.min(100, Math.max(0, stat.meter))}%` }}
              />
            </div>
          )}
          {stat.foot !== undefined && (
            <div className="mt-1 text-xs text-muted-foreground">{stat.foot}</div>
          )}
        </div>
      ))}
    </div>
  );
}
