// Refine, in the pane (docs/demos/shared/page-categories.js `refine`; intentions.md §1.2, *A leaf
// that gains a child*; component-interfaces.md §1.9): a leaf that holds documents gains a child,
// and every document moves into it, so they stay on a leaf. Two steps, because it moves data: the
// new category's name, then what moves, as the server counts it. The child takes all of the leaf's
// share in each mix that gives it one, since it holds everything that was there; left with none,
// the branch would drop out of generation. Routed as `?c=ID&refine=1`.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import { useId, useState } from "react";
import type { CategoryNode } from "@/api/categories";
import { refineCategory } from "@/api/categories";
import { Field } from "@/components/classification-fields";
import { DetailCard, DetailRow, FinePrint, Muted } from "@/components/detail-card";
import { PaneWizard } from "@/components/pane-wizard";
import { Input } from "@/components/ui/input";
import { isNameTaken } from "@/domain/categories";
import type { Category } from "@/domain/entities";
import type { CategoryNotice } from "@/features/categories/category-dialogs";
import {
  categoryInvalidations,
  useCategoryImpactQuery,
} from "@/features/categories/use-categories-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

const steps = ["Name the new category", "What moves"];

interface RefineWizardProps {
  categories: readonly Category[];
  category: Category;
  node: CategoryNode;
  breadcrumb: ReactNode;
  onCancel: () => void;
  onRefined: (child: Category, notice: CategoryNotice) => void;
}

export function RefineWizard({
  categories,
  category,
  node,
  breadcrumb,
  onCancel,
  onRefined,
}: RefineWizardProps) {
  const id = useId();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [isTouched, setIsTouched] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const { data: impact } = useCategoryImpactQuery(category.id, stepIndex === 1);
  const refine = useActionMutation({
    call: (childName: string) => refineCategory(category.id, { name: childName }),
    invalidates: categoryInvalidations,
    refusalTexts: {
      "category.name_taken": "A category beside it already has that name.",
      "category.has_children": "It has a category under it now; it is no longer a leaf.",
      403: "You may no longer change this part of the tree.",
    },
  });
  const trimmed = name.trim();
  const nameProblem =
    trimmed === ""
      ? "The new category needs a name."
      : isNameTaken(categories, category.id, trimmed, null)
        ? "A category beside it already has that name."
        : null;
  const { documentCount } = node;

  const submit = async () => {
    const result = await refine.run(trimmed);
    if (!result.isDone) {
      setRefusal(result.refusal);
      return;
    }

    onRefined(result.value, {
      title: `Moved ${plural(documentCount, "document")} into ${result.value.name}`,
      text: `${category.name} is now a branch, and ${result.value.name} holds its whole share.`,
    });
  };

  return (
    <PaneWizard
      title={`Refine ${category.name}`}
      description="a leaf that holds documents gains a child"
      breadcrumb={breadcrumb}
      steps={steps}
      currentIndex={stepIndex}
      onCancel={onCancel}
      onBack={
        stepIndex === 0
          ? undefined
          : () => {
              setRefusal(null);
              setStepIndex(0);
            }
      }
      refusal={refusal}
      primary={
        stepIndex === 0
          ? {
              label: "Next — see what moves",
              onSelect: () => {
                setIsTouched(true);
                if (nameProblem === null) {
                  setStepIndex(1);
                }
              },
            }
          : {
              label: `Refine and move ${plural(documentCount, "document")}`,
              isPending: refine.isPending,
              onSelect: () => void submit(),
            }
      }
    >
      {stepIndex === 0 ? (
        <DetailCard title="Name the new category">
          <Field id={`${id}-name`} label="Name">
            <Input
              id={`${id}-name`}
              autoFocus
              value={name}
              placeholder={`e.g. ${category.name} — before 1918`}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  setIsTouched(true);
                  if (nameProblem === null) {
                    setStepIndex(1);
                  }
                }
              }}
            />
          </Field>
          {isTouched && nameProblem !== null && (
            <p className="mt-1.5 text-xs text-destructive">{nameProblem}</p>
          )}
          <FinePrint>
            Documents sit on leaves only, so {category.name} cannot hold documents and a child at
            once. All {documentCount} of them move into the new category, and {category.name}{" "}
            becomes a branch. Sort them into further categories afterwards.
          </FinePrint>
        </DetailCard>
      ) : (
        <DetailCard title="What this moves">
          <DetailRow>
            <b className="font-semibold">{plural(documentCount, "document")}</b> ·{" "}
            {formatCount(node.pages)} pages
            <span className="block text-xs text-muted-foreground">
              {category.name} → {category.name} ›{" "}
              <b className="font-semibold text-foreground">{trimmed}</b>
            </span>
          </DetailRow>
          {impact?.shares.map((share) => (
            <DetailRow key={share.mix.id}>
              {share.mix.name}
              {share.trackerCount > 0 && (
                <Muted> · and {plural(share.trackerCount, "intention")} tracking it</Muted>
              )}
              <span className="block text-xs text-muted-foreground">
                {trimmed} gets <b className="font-semibold text-foreground">100%</b> of{" "}
                {category.name}&apos;s {share.share}%
              </span>
            </DetailRow>
          ))}
          {impact !== undefined && impact.otherMixCount > 0 && (
            <DetailRow>
              <Muted>
                {plural(impact.otherMixCount, "more mix", "more mixes")} you cannot read, the same
                way
              </Muted>
            </DetailRow>
          )}
          <FinePrint>
            The new category takes <b className="font-semibold">all</b> of {category.name}&apos;s
            share in each mix, since it holds everything that was there. Left with none, the whole
            branch would drop out of generation. Custody on {category.name} still reaches them: it
            inherits down.
          </FinePrint>
          <FinePrint>
            Their status does not change. Each one&apos;s history records the move.
          </FinePrint>
        </DetailCard>
      )}
    </PaneWizard>
  );
}
