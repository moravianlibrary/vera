// Generate… in the list editor (view-map.md §2.4, flows.md L3–L5; page-lists.js generate): over
// one configured list generator, ask for the pages (required) and the categories (all if none),
// let the generator draft a fill, show it, and hand it to the editor's left pane. One generator
// needs no picker; several each say whether a rule or a model chose. The current members stay
// fixed and the draft tops them up. Nothing is saved by generating, and nothing is attached:
// what the list counts towards follows from what ends up on it (intentions.md §5). One intention
// shapes the draft, Overall unless another is picked or a card started it (§4.1, §4.4); a
// correcting run's allocation, accepted on Intentions, fixes the pages and the shape until it is
// dropped for the plain mix.

import type { GenerationDraft, ListGenerator, ListShape } from "@vera/contract/lists";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { generateDraft } from "@/api/lists";
import { Field } from "@/components/classification-fields";
import type { DialogStep } from "@/components/dialogs/stepped-dialog";
import { SteppedDialog } from "@/components/dialogs/stepped-dialog";
import { ToneBadge } from "@/components/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GenerationReport, generatorClassLabels } from "@/features/lists/generation-report";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { i18n } from "@/i18n";
import { formatCount, formatPages } from "@/lib/format-number";

interface GenerateState {
  generatorId: string;
  // As typed; digits only count.
  pages: string;
  // Top-level categories; none means all.
  categoryIds: readonly string[];
  // The intention it is shaped by.
  intentionId: string;
  draft: GenerationDraft | null;
}

function pagesOf(typed: string): number | null {
  const digits = Number.parseInt(typed.replace(/\D/g, ""), 10);
  return Number.isNaN(digits) || digits <= 0 ? null : digits;
}

interface GenerateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  generators: readonly ListGenerator[];
  // What is on the list now: fixed, topped up.
  memberIds: readonly string[];
  memberPages: number;
  // The list's target, offered as the pages, unless a card asked for others.
  target: number | null;
  shapes: readonly ListShape[];
  // Preselected; none is Overall.
  shapeId: string | null;
  // A correcting run's pages per category, and the pages they add up to.
  allocation: { pages: number; byCategory: Readonly<Record<string, number>> } | null;
  // Back to the intention's plain mix.
  onDropAllocation: () => void;
  onDraft: (draft: GenerationDraft) => void;
}

export function GenerateDialog({
  isOpen,
  onClose,
  generators,
  memberIds,
  memberPages,
  target,
  shapes,
  shapeId,
  allocation,
  onDropAllocation,
  onDraft,
}: GenerateDialogProps) {
  const { t } = useTranslation("lists");
  const generate = useActionMutation({ call: generateDraft, invalidates: [] });

  const steps: DialogStep<GenerateState>[] = [
    {
      label: t("generateDialog.ask"),
      advanceLabel: t("generateDialog.generateDraft"),
      canAdvance: (state) => pagesOf(state.pages) !== null && state.generatorId !== "",
      render: (state, setState) => (
        <AskStep
          state={state}
          onChange={setState}
          generators={generators}
          memberCount={memberIds.length}
          memberPages={memberPages}
          shapes={shapes}
          allocation={allocation}
          onDropAllocation={onDropAllocation}
        />
      ),
      onAdvance: async (state) => {
        const result = await generate.run({
          generatorId: state.generatorId,
          pages: pagesOf(state.pages) ?? 0,
          categoryIds: [...state.categoryIds],
          memberIds: [...memberIds],
          intentionId: state.intentionId === "" ? null : state.intentionId,
          allocation: allocation === null ? null : { ...allocation.byCategory },
        });
        return result.isDone ? { isDone: true, value: { ...state, draft: result.value } } : result;
      },
    },
    {
      label: t("generateDialog.preview"),
      canAdvance: (state) => state.draft !== null,
      render: (state) => (state.draft === null ? null : <PreviewStep draft={state.draft} />),
    },
  ];

  return (
    <SteppedDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("generateDialog.title")}
      description={t("generateDialog.description")}
      width="wide"
      steps={steps}
      initialState={{
        generatorId: generators[0]?.id ?? "",
        pages:
          allocation !== null ? String(allocation.pages) : target === null ? "" : String(target),
        categoryIds: [],
        intentionId: shapeId ?? shapes.find((shape) => shape.isOverall)?.id ?? "",
        draft: null,
      }}
      isDirty={(state) => state.draft !== null || state.categoryIds.length > 0}
      submitLabel={(state) =>
        state.draft === null || state.draft.picks.length === 0
          ? t("generateDialog.useDraft")
          : t("generateDialog.putOnList", { count: state.draft.picks.length })
      }
      onSubmit={async (state) => {
        if (state.draft !== null) {
          onDraft(state.draft);
        }

        return { isDone: true, value: state };
      }}
    />
  );
}

interface AskStepProps {
  state: GenerateState;
  onChange: (next: GenerateState) => void;
  generators: readonly ListGenerator[];
  memberCount: number;
  memberPages: number;
  shapes: readonly ListShape[];
  allocation: GenerateDialogProps["allocation"];
  onDropAllocation: () => void;
}

function AskStep({
  state,
  onChange,
  generators,
  memberCount,
  memberPages,
  shapes,
  allocation,
  onDropAllocation,
}: AskStepProps) {
  const { t } = useTranslation("lists");
  const id = useId();
  const { data: categories = [] } = useCategoriesQuery();
  const tops = categories.filter((category) => category.parentId === null);
  const [only] = generators;
  const change = (patch: Partial<GenerateState>) => onChange({ ...state, ...patch, draft: null });

  return (
    <div className="grid gap-5">
      {generators.length === 1 && only !== undefined ? (
        <div>
          {t("generateDialog.using")} <b className="font-semibold">{only.plugin}</b> · {only.name}{" "}
          <GeneratorClassBadge generator={only} />
          <p className="mt-0.5 text-xs text-muted-foreground">{only.description}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          <Label>{t("generateDialog.generator")}</Label>
          <RadioGroup
            value={state.generatorId}
            onValueChange={(generatorId) => change({ generatorId })}
          >
            {generators.map((generator) => (
              <Label
                key={generator.id}
                htmlFor={`${id}-${generator.id}`}
                className="flex items-start gap-2.5 font-normal"
              >
                <RadioGroupItem
                  id={`${id}-${generator.id}`}
                  value={generator.id}
                  className="mt-0.5"
                />
                <span>
                  <b className="font-semibold">{generator.plugin}</b> · {generator.name}{" "}
                  <GeneratorClassBadge generator={generator} />
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {generator.description}
                  </span>
                </span>
              </Label>
            ))}
          </RadioGroup>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
        <Field
          id={`${id}-pages`}
          label={t("generateDialog.pages")}
          hint={t("generateDialog.required")}
        >
          <Input
            id={`${id}-pages`}
            inputMode="numeric"
            placeholder={t("generateDialog.pagesPlaceholder")}
            value={state.pages}
            readOnly={allocation !== null}
            onChange={(event) => change({ pages: event.target.value })}
          />
        </Field>
        <div className="grid content-start gap-2">
          <Label>
            {t("generateDialog.categories")}{" "}
            <span className="font-normal text-muted-foreground">
              — {t("generateDialog.allIfNone")}
            </span>
          </Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {tops.map((top) => (
              <Label key={top.id} className="flex items-center gap-1.5 font-normal">
                <Checkbox
                  checked={state.categoryIds.includes(top.id)}
                  onCheckedChange={(checked) =>
                    change({
                      categoryIds:
                        checked === true
                          ? [...state.categoryIds, top.id]
                          : state.categoryIds.filter((categoryId) => categoryId !== top.id),
                    })
                  }
                />
                {top.name}
              </Label>
            ))}
          </div>
        </div>
      </div>

      {memberCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("generateDialog.existingMembers", {
            count: memberCount,
            pages: formatCount(memberPages),
          })}
        </p>
      )}

      {allocation !== null && (
        <div className="rounded-md border border-tone-purple-foreground/30 bg-tone-purple px-3 py-2 text-xs text-tone-purple-foreground">
          <b className="font-semibold">
            {t("generateDialog.correctingAllocationFrom", {
              name:
                shapes.find((shape) => shape.id === state.intentionId)?.name ??
                t("generateDialog.theIntention"),
            })}{" "}
          </b>{" "}
          {Object.entries(allocation.byCategory)
            .map(
              ([categoryId, pages]) =>
                `${categories.find((category) => category.id === categoryId)?.name ?? categoryId} ${formatPages(pages)}`,
            )
            .join(" · ")}
          . {t("generateDialog.allocationAccepted")}{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={onDropAllocation}
          >
            {t("generateDialog.usePlainMix")}
          </button>
        </div>
      )}

      <Field
        id={`${id}-shape`}
        label={t("generateDialog.shapeBy")}
        hint={t("generateDialog.shapeHint")}
      >
        <Select
          value={state.intentionId}
          disabled={allocation !== null}
          onValueChange={(intentionId) => change({ intentionId })}
        >
          <SelectTrigger id={`${id}-shape`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {shapes.map((shape) => (
              <SelectItem key={shape.id} value={shape.id}>
                {shapeLabelOf(shape)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <p className="-mt-3 text-xs text-muted-foreground">{t("generateDialog.notAttached")}</p>
    </div>
  );
}

// "NDK Periodika — 2026 Q3 · only Periodicals · funded by NDK Periodika".
function shapeLabelOf(shape: ListShape): string {
  const funding =
    shape.funding.kind === "project"
      ? i18n.t("lists:generateDialog.fundedBy", { name: shape.funding.name })
      : shape.funding.kind === "none"
        ? i18n.t("lists:generateDialog.unfundedOnly")
        : null;
  return [
    shape.isOverall
      ? i18n.t("lists:generateDialog.overallDefault", { name: shape.name })
      : shape.name,
    shape.scope === null ? null : i18n.t("lists:generateDialog.onlyScope", { scope: shape.scope }),
    funding,
  ]
    .filter((part) => part !== null)
    .join(" · ");
}

function PreviewStep({ draft }: { draft: GenerationDraft }) {
  const { t } = useTranslation("lists");
  return (
    <div className="grid gap-4">
      <p className="text-xs text-muted-foreground">
        {t("generateDialog.shapedBy", { name: draft.shapedBy.name })}{" "}
        {t("generateDialog.picksInstruction")}
      </p>
      <GenerationReport draft={draft} />
      {draft.picks.length === 0 ? (
        <p className="text-muted-foreground">{t("generateDialog.noFits")}</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {draft.picks.map(({ item, reason }) => (
            <li key={item.iteration.id} className="flex items-start gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block leading-snug font-medium">{item.document.title}</span>
                <span className="block text-xs text-muted-foreground">{reason}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums">
                {item.pages === null ? "—" : formatPages(item.pages)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GeneratorClassBadge({ generator }: { generator: ListGenerator }) {
  return (
    <ToneBadge tone={generator.generatorClass === "AiBased" ? "purple" : "slate"}>
      {i18n.t(generatorClassLabels[generator.generatorClass])}
    </ToneBadge>
  );
}
