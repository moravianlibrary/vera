// Refine, in the pane (docs/demos/shared/page-categories.js `refine`; intentions.md §1.2, *A leaf
// that gains a child*; component-interfaces.md §1.9): a leaf that holds documents gains a child,
// and every document moves into it, so they stay on a leaf. Two steps, because it moves data: the
// new category's name, then what moves, as the server counts it. The child takes all of the leaf's
// share in each mix that gives it one, since it holds everything that was there; left with none,
// the branch would drop out of generation. Routed as `?c=ID&refine=1`.
import type { CategoryNode } from "@vera/contract/categories";
import { isNameTaken } from "@vera/domain/categories";
import type { Category } from "@vera/domain/entities";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { refineCategory } from "@/api/categories";
import { Field } from "@/components/classification-fields";
import { DetailCard, DetailRow, FinePrint, Muted } from "@/components/detail-card";
import { PaneWizard } from "@/components/pane-wizard";
import { Input } from "@/components/ui/input";
import type { CategoryNotice } from "@/features/categories/category-dialogs";
import {
  categoryInvalidations,
  useCategoryImpactQuery,
} from "@/features/categories/use-categories-query";
import type { Refusal } from "@/hooks/use-action-mutation";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { i18n } from "@/i18n";
import { formatCount } from "@/lib/format-number";

const message = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: "categories", ...options });

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
  const steps = [message("refine.stepName"), message("refine.stepMoves")];
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState("");
  const [isTouched, setIsTouched] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const { data: impact } = useCategoryImpactQuery(category.id, stepIndex === 1);
  const refine = useActionMutation({
    call: (childName: string) => refineCategory(category.id, { name: childName }),
    invalidates: categoryInvalidations,
    refusalTexts: {
      "category.name_taken": message("categoryDialog.nameTaken"),
      "category.has_children": message("refine.hasChildren"),
      403: message("categoryDialog.forbidden"),
    },
  });
  const trimmed = name.trim();
  const nameProblem =
    trimmed === ""
      ? message("refine.nameRequired")
      : isNameTaken(categories, category.id, trimmed, null)
        ? message("categoryDialog.nameTaken")
        : null;
  const { documentCount } = node;

  const submit = async () => {
    const result = await refine.run(trimmed);
    if (!result.isDone) {
      setRefusal(result.refusal);
      return;
    }

    onRefined(result.value, {
      title: message("refine.movedTitle", { count: documentCount, name: result.value.name }),
      text: message("refine.movedText", { category: category.name, name: result.value.name }),
    });
  };

  return (
    <PaneWizard
      title={message("refine.title", { name: category.name })}
      description={message("refine.description")}
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
              label: message("refine.next"),
              onSelect: () => {
                setIsTouched(true);
                if (nameProblem === null) {
                  setStepIndex(1);
                }
              },
            }
          : {
              label: message("refine.submit", { count: documentCount }),
              isPending: refine.isPending,
              onSelect: () => void submit(),
            }
      }
    >
      {stepIndex === 0 ? (
        <DetailCard title={message("refine.stepName")}>
          <Field id={`${id}-name`} label={message("categoryDialog.name")}>
            <Input
              id={`${id}-name`}
              autoFocus
              value={name}
              placeholder={message("refine.placeholder", { name: category.name })}
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
            {message("refine.nameStepHelp", { category: category.name, count: documentCount })}
          </FinePrint>
        </DetailCard>
      ) : (
        <DetailCard title={message("refine.stepMoves")}>
          <DetailRow>
            {message("refine.documentsAndPages", {
              count: documentCount,
              pages: formatCount(node.pages),
            })}
            <span className="block text-xs text-muted-foreground">
              {message("refine.path", { category: category.name, name: trimmed })}
            </span>
          </DetailRow>
          {impact?.shares.map((share) => (
            <DetailRow key={share.mix.id}>
              {share.mix.name}
              {share.intentionCount > 0 && (
                <Muted>
                  {" "}
                  · {message("refine.intentionsUsing", { count: share.intentionCount })}
                </Muted>
              )}
              <span className="block text-xs text-muted-foreground">
                {message("refine.shareMoved", {
                  name: trimmed,
                  category: category.name,
                  share: share.share,
                })}
              </span>
            </DetailRow>
          ))}
          {impact !== undefined && impact.otherMixCount > 0 && (
            <DetailRow>
              <Muted>{message("refine.otherMixes", { count: impact.otherMixCount })}</Muted>
            </DetailRow>
          )}
          <FinePrint>{message("refine.mixExplanation", { category: category.name })}</FinePrint>
          <FinePrint>{message("refine.historyExplanation")}</FinePrint>
        </DetailCard>
      )}
    </PaneWizard>
  );
}
