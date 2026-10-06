// What a generator made of the request (intentions.md §4.2–4.3; page-lists.js run): the picks'
// pages against the pages asked, within its tolerance, how many were re-spread, any late copies,
// and which categories ended short or unallocated, with why. A list silently short of its own
// plan is worse than one that says so. Shown in the Generate preview and, once taken, in the
// editor's top strip until dismissed.
// TODO(rrandiak): labels move to i18n.

import { X } from "lucide-react";
import type { GenerationDraft, ShortfallCause } from "@/api/lists";
import { categoryLabelOf } from "@/components/classification-fields";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

export const generatorClassLabels = {
  RuleBased: "rule-based",
  AiBased: "AI-based",
} as const satisfies Record<GenerationDraft["generator"]["generatorClass"], string>;

const shortfallTexts = {
  leftOut: "left out of the categories",
  overshoot: "what is ready would overshoot",
  noSupply: "nothing more is ready",
  unallocated: "no share in the mix — unallocated, not drawn from",
} as const satisfies Record<ShortfallCause, string>;

interface GenerationReportProps {
  draft: GenerationDraft;
  onDismiss?: () => void;
}

export function GenerationReport({ draft, onDismiss }: GenerationReportProps) {
  const { data: categories = [] } = useCategoriesQuery();
  const { generator, picks, requestedPages, totalPages, spreadCount, shortfalls } = draft;
  const off = totalPages - requestedPages;
  const offShare = Math.round((off / requestedPages) * 100);
  const lateCopies = picks.filter(({ item }) => item.lateCopy !== null).length;
  const parts = [
    generatorClassLabels[generator.generatorClass],
    `${plural(picks.length, "pick")}, ${formatCount(totalPages)} of ${formatCount(requestedPages)} pp (${off >= 0 ? "+" : ""}${offShare}%, tolerance ${Math.round(generator.tolerance * 100)}%)`,
    spreadCount > 0 ? `${spreadCount} re-spread to categories with supply left` : null,
    lateCopies > 0
      ? `${lateCopies} with a copy that appeared after approval — look at ${lateCopies === 1 ? "it" : "them"}`
      : null,
  ].filter((part) => part !== null);

  return (
    <div className="relative">
      <StatusNote
        tone={shortfalls.length > 0 ? "amber" : "green"}
        title={`Draft from ${generator.plugin} ${generator.version}`}
        className={onDismiss === undefined ? undefined : "pr-10"}
      >
        {parts.join(" · ")}.{" "}
        {generator.generatorClass === "AiBased" &&
          "Each reason is the model’s own; review them before saving. "}
        Nothing is saved yet.
      </StatusNote>
      {onDismiss !== undefined && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-7"
          aria-label="Hide the report"
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </Button>
      )}
      {shortfalls.length > 0 && (
        <details className="mt-1 px-3.5 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {plural(shortfalls.length, "category", "categories")} short or unallocated — show
          </summary>
          <ul className="mt-1 grid gap-0.5 pb-1">
            {shortfalls.map((shortfall) => (
              <li key={shortfall.categoryId}>
                <b className="font-semibold text-foreground">
                  {categoryLabelOf(categories, shortfall.categoryId)}
                </b>{" "}
                {shortfall.cause === "unallocated"
                  ? shortfallTexts.unallocated
                  : `${formatCount(shortfall.pages)} pp short — ${shortfallTexts[shortfall.cause]}`}
                {shortfall.inReviewCount > 0 &&
                  ` (${shortfall.inReviewCount} more waiting in review)`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
