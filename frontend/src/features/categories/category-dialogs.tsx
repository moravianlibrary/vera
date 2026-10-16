// What is done to the tree from the Categories pane (docs/demos/shared/page-categories.js
// `grantCustody`, `editCategory`, `newChild`, `del`; permissions.md §3, Categories; intentions.md
// §1.1.1, §1.2): the custody set granted on a category, written whole; a new category, or one
// renamed or moved; and deleting an empty leaf, with what it leaves behind as the server counts it.
// Nothing here edits a mix: a category entering a set has no share there, and one leaving it
// leaves its share unallocated, flagged where the mix is edited.
// TODO(rrandiak): labels move to i18n.

import type { CategoryNode, CustodyGrant } from "@vera/contract/categories";
import { categoryPathOf, isInSubtree, placesFor, scopeOfCategory } from "@vera/domain/categories";
import type { Category, Session } from "@vera/domain/entities";
import { can } from "@vera/domain/permissions";
import { useId } from "react";
import { z } from "zod";
import {
  createCategory,
  deleteCategory,
  saveCategory,
  saveCategoryCustody,
} from "@/api/categories";
import { Field } from "@/components/classification-fields";
import type { Consequence } from "@/components/dialogs/consequence-dialog";
import { ConsequenceDialog } from "@/components/dialogs/consequence-dialog";
import { FormDialog } from "@/components/dialogs/form-dialog";
import { SetEditorDialog } from "@/components/dialogs/set-editor-dialog";
import { AddSelect, RemoveButton } from "@/components/fields/picked-list";
import { FieldError } from "@/components/iteration-dialogs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  categoryInvalidations,
  useCategoryImpactQuery,
} from "@/features/categories/use-categories-query";
import { useActionMutation } from "@/hooks/use-action-mutation";
import { useGroupsQuery, useUsersQuery } from "@/hooks/use-reference-query";
import { plural } from "@/lib/plural";

const refusalTexts = {
  "category.name_taken": "A category beside it already has that name.",
  "category.holds_documents":
    "It holds documents, so it cannot take a child. Refine it instead, which moves them.",
  "category.has_children": "It has categories under it now.",
  "category.scope": "An intention is scoped to it. Change that intention's categories first.",
  403: "You may no longer change this part of the tree.",
} as const;

// Done, and what to say in the pane about it.
export interface CategoryNotice {
  title: string;
  text: string;
}

const pathTextOf = (categories: readonly Category[], categoryId: string) =>
  categoryPathOf(categories, categoryId)
    .map((step) => step.name)
    .join(" › ");

// ---------------------------------------------------------------- custody

interface CustodyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: readonly Category[];
  category: Category;
  node: CategoryNode;
  session: Session;
  onSaved: (notice: CategoryNotice) => void;
}

// Groups and people, the whole set (component-interfaces.md §6.5). It makes them responsible for
// the subtree; what they may do there is their role. At `custody` a curator grants only inside
// their own subtree (permissions.md §3), which is the only place the action is offered.
export function CustodyDialog({
  isOpen,
  onClose,
  categories,
  category,
  node,
  session,
  onSaved,
}: CustodyDialogProps) {
  const { data: users = [] } = useUsersQuery();
  const { data: groups = [] } = useGroupsQuery({ isEnabled: isOpen });
  const save = useActionMutation({
    call: (grants: readonly CustodyGrant[]) =>
      saveCategoryCustody(category.id, {
        groupIds: grants.filter((grant) => grant.kind === "group").map((grant) => grant.id),
        userIds: grants.filter((grant) => grant.kind === "person").map((grant) => grant.id),
      }),
    invalidates: categoryInvalidations,
    refusalTexts,
  });
  const leafCount = categories.filter(
    (candidate) =>
      isInSubtree(categories, candidate.id, category.id) &&
      !categories.some((child) => child.parentId === candidate.id),
  ).length;
  const isBounded = !can(session, "category.grant_custody", { kind: "unscoped" });
  const held = session.custodyCategoryIds.flatMap(
    (id) => categories.find((candidate) => candidate.id === id) ?? [],
  );

  return (
    <SetEditorDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Custody — ${category.name}`}
      description={`Who holds custody granted on ${category.name}, the whole set.`}
      entries={node.grants}
      renderEntries={(grants, onChange) => {
        const picked = (kind: CustodyGrant["kind"]) =>
          grants.filter((grant) => grant.kind === kind);
        const remove = (grant: CustodyGrant) =>
          onChange(
            grants.filter(
              (candidate) => !(candidate.kind === grant.kind && candidate.id === grant.id),
            ),
          );
        const freeGroups = groups.filter(
          (group) => !picked("group").some((grant) => grant.id === group.id),
        );
        const freePeople = users.filter(
          (user) =>
            user.kind === "person" && !picked("person").some((grant) => grant.id === user.id),
        );
        return (
          <>
            <GrantList
              title="Groups"
              hint="everyone in one, while they are in it"
              grants={picked("group")}
              noneText="No group."
              onRemove={remove}
            />
            {freeGroups.length > 0 && (
              <AddSelect
                placeholder="Add a group…"
                options={freeGroups.map((group) => ({ value: group.id, label: group.name }))}
                onAdd={(groupId) =>
                  onChange([
                    ...grants,
                    {
                      kind: "group",
                      id: groupId,
                      name: groups.find((group) => group.id === groupId)?.name ?? groupId,
                    },
                  ])
                }
              />
            )}
            <GrantList
              title="People"
              hint="directly"
              grants={picked("person")}
              noneText="Nobody directly."
              onRemove={remove}
            />
            {freePeople.length > 0 && (
              <AddSelect
                placeholder="Add a person…"
                options={freePeople.map((user) => ({ value: user.id, label: user.name }))}
                onAdd={(userId) =>
                  onChange([
                    ...grants,
                    {
                      kind: "person",
                      id: userId,
                      name: users.find((user) => user.id === userId)?.name ?? userId,
                    },
                  ])
                }
              />
            )}
          </>
        );
      }}
      summaryOf={() => (
        <p className="text-xs text-muted-foreground">
          It reaches {category.name} and everything under it — {plural(leafCount, "leaf", "leaves")}
          . It makes them responsible; what they may <i>do</i> there is their role.
          {isBounded &&
            held.length > 0 &&
            ` You grant it only inside ${held.map((heldCategory) => heldCategory.name).join(", ")}, which ${held.length === 1 ? "is" : "are"} yours.`}
        </p>
      )}
      invalidReasonOf={() => null}
      submitLabel="Save custody"
      onSave={async (grants) => {
        const result = await save.run(grants);
        if (result.isDone) {
          onSaved({
            title: "Custody saved",
            text: `${plural(result.value.grants.length, "grant")} on ${category.name}, was ${node.grants.length}.`,
          });
        }

        return result;
      }}
    />
  );
}

interface GrantListProps {
  title: string;
  hint: string;
  grants: readonly CustodyGrant[];
  noneText: string;
  onRemove: (grant: CustodyGrant) => void;
}

function GrantList({ title, hint, grants, noneText, onRemove }: GrantListProps) {
  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">
        {title} <span className="font-normal text-muted-foreground">— {hint}</span>
      </p>
      {grants.length === 0 ? (
        <p className="text-xs text-muted-foreground">{noneText}</p>
      ) : (
        <ul className="divide-y rounded-md border text-sm">
          {grants.map((grant) => (
            <li key={grant.id} className="flex items-center gap-2 px-3 py-1.5">
              <span className="min-w-0 flex-1">{grant.name}</span>
              <RemoveButton label={`Remove ${grant.name}`} onSelect={() => onRemove(grant)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- new and edit

// The top level in a select, which cannot hold an empty value.
const topLevel = "top";

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, "A category needs a name."),
  parentId: z.string(),
});
type CategoryForm = z.infer<typeof categoryFormSchema>;

const parentIdOf = (value: string) => (value === topLevel ? null : value);

interface CategoryFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: readonly Category[];
  // Edited; null for a new one under `parentId`.
  category: Category | null;
  // Where a new one goes; null is the top level.
  parentId: string | null;
  // Whether the category holds documents, by what the page counted.
  holdsDocuments: (categoryId: string) => boolean;
  session: Session;
  onSaved: (category: Category, notice: CategoryNotice) => void;
}

// A new category, or one renamed or moved with everything under it. It goes only where the person
// may change the tree, and never under a leaf that holds documents.
export function CategoryFormDialog({
  isOpen,
  onClose,
  categories,
  category,
  parentId,
  holdsDocuments,
  session,
  onSaved,
}: CategoryFormDialogProps) {
  const id = useId();
  const save = useActionMutation({
    call: (form: CategoryForm) => {
      const draft = { name: form.name, parentId: parentIdOf(form.parentId) };
      return category === null ? createCategory(draft) : saveCategory(category.id, draft);
    },
    invalidates: categoryInvalidations,
    refusalTexts,
  });
  const nameOf = (categoryId: string | null) =>
    categoryId === null
      ? "the top level"
      : (categories.find((candidate) => candidate.id === categoryId)?.name ?? categoryId);
  const parent = category === null ? parentId : category.parentId;
  const places =
    category === null
      ? []
      : placesFor(categories, category.id, holdsDocuments).filter((placeId) =>
          can(session, "category.edit", scopeOfCategory(categories, placeId)),
        );
  const isParentLeaf =
    parentId !== null && !categories.some((candidate) => candidate.parentId === parentId);

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        category !== null
          ? `Edit — ${category.name}`
          : parentId === null
            ? "New top-level category"
            : `New category under ${nameOf(parentId)}`
      }
      description={
        category === null ? "A line of work, under its parent." : "Rename it, or move it."
      }
      schema={categoryFormSchema}
      defaultValues={{ name: category?.name ?? "", parentId: parent ?? topLevel }}
      submitLabel={category === null ? "Create" : "Save"}
      fieldOf={(refusal) => (refusal.code === "category.name_taken" ? "name" : null)}
      onSubmit={async (form) => {
        const result = await save.run(form);
        if (result.isDone) {
          const isMoved = category !== null && parentIdOf(form.parentId) !== category.parentId;
          onSaved(
            result.value,
            category === null
              ? {
                  title: `Created ${result.value.name}`,
                  text: `Under ${nameOf(parentId)}, with no share in any mix yet, so its set is flagged until somebody gives it one.`,
                }
              : {
                  title: "Saved",
                  text: isMoved
                    ? `Now under ${nameOf(parentIdOf(form.parentId))}, with no share there in any mix. Where it was, its share is unallocated.`
                    : "Renamed.",
                },
          );
        }

        return result;
      }}
      warningOf={(form) =>
        category !== null && parentIdOf(form.parentId) !== category.parentId ? (
          <p className="text-xs text-tone-amber-foreground">
            <b className="font-semibold">It starts with no share in its new place</b>, in every mix
            — it cannot take from shares somebody already set there. Where it was, its share becomes{" "}
            <b className="font-semibold">unallocated</b> and is flagged. Custody follows the tree:
            whoever holds its new place holds it.
          </p>
        ) : undefined
      }
      render={(form) => (
        <>
          <Field id={`${id}-name`} label="Name">
            <Input
              id={`${id}-name`}
              placeholder="The line of work it stands for"
              autoFocus
              {...form.register("name")}
            />
          </Field>
          <FieldError message={form.formState.errors.name?.message} />
          {category !== null && (
            <Field id={`${id}-parent`} label="Under">
              <Select
                value={form.watch("parentId")}
                onValueChange={(value) => form.setValue("parentId", value, { shouldDirty: true })}
              >
                <SelectTrigger id={`${id}-parent`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {places.map((placeId) => (
                    <SelectItem key={placeId ?? topLevel} value={placeId ?? topLevel}>
                      {placeId === null
                        ? "All categories — top level"
                        : pathTextOf(categories, placeId)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <p className="text-xs text-muted-foreground">
            {category === null ? (
              <>
                It starts with <b className="font-semibold">no share in any mix</b> — it cannot take
                from shares somebody already set. Give it one on Mixes.
                {isParentLeaf &&
                  ` ${nameOf(parentId)} holds no documents, so it simply stops being a leaf; nothing moves.`}
              </>
            ) : (
              "Moving it takes everything under it along. A leaf that holds documents cannot take a child, so it is not offered."
            )}
          </p>
        </>
      )}
    />
  );
}

// ---------------------------------------------------------------- delete

interface DeleteCategoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  categories: readonly Category[];
  category: Category;
  onDeleted: (notice: CategoryNotice) => void;
}

// Offered on an empty leaf only. What it leaves is the server's count: the share it had in each
// mix becomes unallocated in its parent's set, nothing rebalances, and custody granted on it goes.
export function DeleteCategoryDialog({
  isOpen,
  onClose,
  categories,
  category,
  onDeleted,
}: DeleteCategoryDialogProps) {
  const { data: impact } = useCategoryImpactQuery(category.id, isOpen);
  const remove = useActionMutation({
    call: () => deleteCategory(category.id),
    invalidates: categoryInvalidations,
    refusalTexts,
  });
  const parentName =
    categories.find((candidate) => candidate.id === category.parentId)?.name ?? "the top level";
  const consequences: Consequence[] | undefined =
    impact === undefined
      ? undefined
      : [
          { text: "It holds no documents, so nothing moves." },
          ...impact.shares.map(
            (share): Consequence => ({
              text: `${share.mix.name}: its ${share.share}% becomes unallocated in ${parentName}'s set${
                share.intentionCount > 0
                  ? `, for ${plural(share.intentionCount, "intention")} using it too`
                  : ""
              }.`,
              tone: "amber",
            }),
          ),
          ...(impact.otherMixCount > 0
            ? [
                {
                  text: `${plural(impact.otherMixCount, "more mix", "more mixes")} you cannot read ${impact.otherMixCount === 1 ? "gives" : "give"} it a share, unallocated there too.`,
                  tone: "amber" as const,
                },
              ]
            : []),
          ...(impact.shares.length === 0 && impact.otherMixCount === 0
            ? [{ text: "It has no share in any mix, so no set changes." }]
            : []),
          ...(impact.grantCount > 0
            ? [{ text: `Custody granted on it (${impact.grantCount}) goes with it.` }]
            : []),
          ...(impact.scopedIntentionCount > 0
            ? [
                {
                  text: `${plural(impact.scopedIntentionCount, "intention is", "intentions are")} scoped to it${
                    impact.scopedIntentions.length > 0
                      ? ` (${impact.scopedIntentions.map((intention) => intention.name).join(", ")})`
                      : ""
                  }, so it cannot be deleted yet.`,
                  tone: "red" as const,
                },
              ]
            : []),
        ];

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={`Delete ${category.name}?`}
      description="An empty leaf, removed from the tree."
      consequences={consequences}
      confirmLabel="Delete"
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(undefined);
        if (result.isDone) {
          onDeleted({
            title: `Deleted ${category.name}`,
            text:
              impact !== undefined && impact.shares.length + impact.otherMixCount > 0
                ? "Its share is unallocated here, and flagged."
                : "No set changed.",
          });
        }

        return result;
      }}
    />
  );
}
