// What a generator made of the request (intentions.md §4.2–4.3; page-lists.js run): the picks'
// pages against the pages asked, within its tolerance, how many were re-spread, any late copies,
// and which categories ended short or unallocated, with why. A list silently short of its own
// plan is worse than one that says so. Shown in the Generate preview and, once taken, in the
// editor's top strip until dismissed.

import type { GenerationDraft, ShortfallCause } from "@vera/contract/lists";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { categoryLabelOf } from "@/components/classification-fields";
import { StatusNote } from "@/components/status-note";
import { Button } from "@/components/ui/button";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { formatCount } from "@/lib/format-number";

export const generatorClassLabels = {
  RuleBased: "lists:generationReport.ruleBased",
  AiBased: "lists:generationReport.aiBased",
} as const satisfies Record<GenerationDraft["generator"]["generatorClass"], string>;

const shortfallTexts = {
  leftOut: "generationReport.leftOut",
  overshoot: "generationReport.overshoot",
  noSupply: "generationReport.noSupply",
  unallocated: "generationReport.unallocated",
} as const satisfies Record<ShortfallCause, string>;

interface GenerationReportProps {
  draft: GenerationDraft;
  onDismiss?: () => void;
}

export function GenerationReport({ draft, onDismiss }: GenerationReportProps) {
  const { t } = useTranslation("lists");
  const { data: categories = [] } = useCategoriesQuery();
  const { generator, picks, requestedPages, totalPages, spreadCount, shortfalls } = draft;
  const off = totalPages - requestedPages;
  const offShare = Math.round((off / requestedPages) * 100);
  const lateCopies = picks.filter(({ item }) => item.lateCopy !== null).length;
  const parts = [
    t(generatorClassLabels[generator.generatorClass].replace("lists:", "")),
    t("generationReport.summary", {
      count: picks.length,
      total: formatCount(totalPages),
      requested: formatCount(requestedPages),
      off: `${off >= 0 ? "+" : ""}${offShare}`,
      tolerance: Math.round(generator.tolerance * 100),
    }),
    spreadCount > 0 ? t("generationReport.respread", { count: spreadCount }) : null,
    lateCopies > 0 ? t("generationReport.lateCopies", { count: lateCopies }) : null,
  ].filter((part) => part !== null);

  return (
    <div className="relative">
      <StatusNote
        tone={shortfalls.length > 0 ? "amber" : "green"}
        title={t("generationReport.title", {
          plugin: generator.plugin,
          version: generator.version,
        })}
        className={onDismiss === undefined ? undefined : "pr-10"}
      >
        {parts.join(" · ")}.{" "}
        {generator.generatorClass === "AiBased" && `${t("generationReport.aiReview")} `}
        {t("generationReport.notSaved")}
      </StatusNote>
      {onDismiss !== undefined && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-1 right-1 size-7"
          aria-label={t("generationReport.hide")}
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </Button>
      )}
      {shortfalls.length > 0 && (
        <details className="mt-1 px-3.5 text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            {t("generationReport.shortfalls", { count: shortfalls.length })}
          </summary>
          <ul className="mt-1 grid gap-0.5 pb-1">
            {shortfalls.map((shortfall) => (
              <li key={shortfall.categoryId}>
                <b className="font-semibold text-foreground">
                  {categoryLabelOf(categories, shortfall.categoryId)}
                </b>{" "}
                {shortfall.cause === "unallocated"
                  ? t(shortfallTexts.unallocated)
                  : t("generationReport.shortfall", {
                      pages: formatCount(shortfall.pages),
                      cause: t(shortfallTexts[shortfall.cause]),
                    })}
                {shortfall.inReviewCount > 0 &&
                  ` ${t("generationReport.inReview", { count: shortfall.inReviewCount })}`}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
