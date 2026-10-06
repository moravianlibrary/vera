// Generate… in the list editor (view-map.md §2.4, flows.md L3–L5; page-lists.js generate): over
// one configured list generator, ask for the pages (required) and the categories (all if none),
// let the generator draft a fill, show it, and hand it to the editor's left pane. One generator
// needs no picker; several each say whether a rule or a model chose. The current members stay
// fixed and the draft tops them up. Nothing is saved by generating, and nothing is attached:
// what the list counts towards follows from what ends up on it (intentions.md §5).
// TODO(rrandiak): *Shape by* another intention than Overall, and a correcting run's allocation,
// wait for intentions in the mock API (plan.md step 6); labels move to i18n.

import { useId } from "react";
import type { GenerationDraft, ListGenerator } from "@/api/lists";
import { generateDraft } from "@/api/lists";
import { Field } from "@/components/classification-fields";
import type { DialogStep } from "@/components/dialogs/stepped-dialog";
import { SteppedDialog } from "@/components/dialogs/stepped-dialog";
import { ToneBadge } from "@/components/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GenerationReport, generatorClassLabels } from "@/features/lists/generation-report";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useCategoriesQuery } from "@/hooks/use-reference-query";
import { formatCount } from "@/lib/format-number";
import { plural } from "@/lib/plural";

interface GenerateState {
  generatorId: string;
  // As typed; digits only count.
  pages: string;
  // Top-level categories; none means all.
  categoryIds: readonly string[];
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
  // The list's target, offered as the pages.
  target: number | null;
  onDraft: (draft: GenerationDraft) => void;
}

export function GenerateDialog({
  isOpen,
  onClose,
  generators,
  memberIds,
  memberPages,
  target,
  onDraft,
}: GenerateDialogProps) {
  const generate = useActionMutation({ call: generateDraft, invalidates: [] });

  const steps: DialogStep<GenerateState>[] = [
    {
      label: "Ask",
      advanceLabel: "Generate draft",
      canAdvance: (state) => pagesOf(state.pages) !== null && state.generatorId !== "",
      render: (state, setState) => (
        <AskStep
          state={state}
          onChange={setState}
          generators={generators}
          memberCount={memberIds.length}
          memberPages={memberPages}
        />
      ),
      onAdvance: async (state) => {
        const result = await generate.run({
          generatorId: state.generatorId,
          pages: pagesOf(state.pages) ?? 0,
          categoryIds: [...state.categoryIds],
          memberIds: [...memberIds],
        });
        return result.isDone ? { isDone: true, value: { ...state, draft: result.value } } : result;
      },
    },
    {
      label: "Preview",
      canAdvance: (state) => state.draft !== null,
      render: (state) => (state.draft === null ? null : <PreviewStep draft={state.draft} />),
    },
  ];

  return (
    <SteppedDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Generate a draft"
      description="Let a list generator draft what goes on this list."
      width="wide"
      steps={steps}
      initialState={{
        generatorId: generators[0]?.id ?? "",
        pages: target === null ? "" : String(target),
        categoryIds: [],
        draft: null,
      }}
      isDirty={(state) => state.draft !== null || state.categoryIds.length > 0}
      submitLabel={(state) =>
        state.draft === null || state.draft.picks.length === 0
          ? "Use this draft"
          : `Put ${state.draft.picks.length} on the list`
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
}

function AskStep({ state, onChange, generators, memberCount, memberPages }: AskStepProps) {
  const id = useId();
  const { data: categories = [] } = useCategoriesQuery();
  const tops = categories.filter((category) => category.parentId === null);
  const [only] = generators;
  const change = (patch: Partial<GenerateState>) => onChange({ ...state, ...patch, draft: null });

  return (
    <div className="grid gap-5">
      {generators.length === 1 && only !== undefined ? (
        <div>
          Using <b className="font-semibold">{only.plugin}</b> · {only.name}{" "}
          <GeneratorClassBadge generator={only} />
          <p className="mt-0.5 text-xs text-muted-foreground">{only.description}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          <Label>Generator</Label>
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
        <Field id={`${id}-pages`} label="Pages" hint="required">
          <Input
            id={`${id}-pages`}
            inputMode="numeric"
            placeholder="e.g. 4,000"
            value={state.pages}
            onChange={(event) => change({ pages: event.target.value })}
          />
        </Field>
        <div className="grid content-start gap-2">
          <Label>
            Categories{" "}
            <span className="font-normal text-muted-foreground">— all if none ticked</span>
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
          The {plural(memberCount, "item")} already on it stay — {formatCount(memberPages)} pp. It
          tops up towards the pages you give; it never swaps out what is there.
        </p>
      )}

      <div className="grid gap-1">
        <Label>Shape by</Label>
        <p>
          Overall, the default{" "}
          <span className="text-muted-foreground">
            — one intention supplies the scope and the mix
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          It is not attached to anything by this: what the list counts towards is worked out from
          what ends up on it.
        </p>
      </div>
    </div>
  );
}

function PreviewStep({ draft }: { draft: GenerationDraft }) {
  return (
    <div className="grid gap-4">
      <p className="text-xs text-muted-foreground">
        Shaped by <b className="font-semibold text-foreground">{draft.shapedBy.name}</b>. The picks
        go on the left, each marked <i>generated</i> with its reason; adjust by hand before saving.
      </p>
      <GenerationReport draft={draft} />
      {draft.picks.length === 0 ? (
        <p className="text-muted-foreground">Nothing ready fits what was asked.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {draft.picks.map(({ item, reason }) => (
            <li key={item.iteration.id} className="flex items-start gap-3 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block leading-snug font-medium">{item.document.title}</span>
                <span className="block text-xs text-muted-foreground">{reason}</span>
              </span>
              <span className="shrink-0 text-xs tabular-nums">
                {item.pages === null ? "—" : `${formatCount(item.pages)} pp`}
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
      {generatorClassLabels[generator.generatorClass]}
    </ToneBadge>
  );
}
