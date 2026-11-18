// What is done to the tree from the Categories pane (docs/demos/shared/page-categories.js
// `grantCustody`, `editCategory`, `newChild`, `del`; permissions.md §3, Categories; intentions.md
// §1.1.1, §1.2): the custody set granted on a category, written whole; a new category, or one
// renamed or moved; and deleting an empty leaf, with what it leaves behind as the server counts it.
// Nothing here edits a mix: a category entering a set has no share there, and one leaving it
// leaves its share unallocated, flagged where the mix is edited.
import type { CategoryNode, CustodyGrant } from "@vera/contract/categories";
import { categoryPathOf, isInSubtree, placesFor, scopeOfCategory } from "@vera/domain/categories";
import type { Category, Session } from "@vera/domain/entities";
import { namesToSave } from "@vera/domain/names";
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
import { NamesField } from "@/components/fields/names-field";
import { AddSelect, RemoveButton } from "@/components/fields/picked-list";
import { FieldError } from "@/components/iteration-dialogs";
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
import { i18n } from "@/i18n";

const message = (key: string, options?: Record<string, unknown>) =>
  i18n.t(key, { ns: "categories", ...options });
const refusalTexts = () => ({
  "category.name_taken": message("categoryDialog.nameTaken"),
  "category.holds_documents": message("categoryDialog.holdsDocuments"),
  "category.has_children": message("categoryDialog.hasChildren"),
  "category.scope": message("categoryDialog.intentionScoped"),
  403: message("categoryDialog.forbidden"),
});

// Done, and what to say in the pane about it.
export interface CategoryNotice {
  title: string;
  text: string;
}

const pathTextOf = (categories: readonly Category[], categoryId: string) =>
  categoryPathOf(categories, categoryId)
    .map((step) => step.name)
    .join(` ${message("categoryDialog.pathSeparator")} `);

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
    refusalTexts: refusalTexts(),
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
      title={message("categoryDialog.custodyTitle", { name: category.name })}
      description={message("categoryDialog.custodyDescription", { name: category.name })}
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
              title={message("categoryDialog.groups")}
              hint={message("categoryDialog.groupHint")}
              grants={picked("group")}
              noneText={message("categoryDialog.noGroup")}
              onRemove={remove}
            />
            {freeGroups.length > 0 && (
              <AddSelect
                placeholder={message("categoryDialog.addGroup")}
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
              title={message("categoryDialog.people")}
              hint={message("categoryDialog.directly")}
              grants={picked("person")}
              noneText={message("categoryDialog.noPeopleDirectly")}
              onRemove={remove}
            />
            {freePeople.length > 0 && (
              <AddSelect
                placeholder={message("categoryDialog.addPerson")}
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
          {message("categoryDialog.custodySummary", { name: category.name, count: leafCount })}
          {isBounded &&
            held.length > 0 &&
            message("categoryDialog.boundedGrant", {
              names: held.map((heldCategory) => heldCategory.name).join(", "),
              verb: held.length === 1 ? "is" : "are",
            })}
        </p>
      )}
      invalidReasonOf={() => null}
      submitLabel={message("categoryDialog.saveCustody")}
      onSave={async (grants) => {
        const result = await save.run(grants);
        if (result.isDone) {
          onSaved({
            title: message("categoryDialog.custodySaved"),
            text: message("categoryDialog.custodySavedText", {
              count: result.value.grants.length,
              name: category.name,
              previous: node.grants.length,
            }),
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
              <RemoveButton
                label={message("categoryDialog.removeGrant", { name: grant.name })}
                onSelect={() => onRemove(grant)}
              />
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

const categoryFormSchemaOf = () =>
  z.object({
    names: z
      .object({ cs: z.string().optional(), en: z.string().optional() })
      .refine(
        (names) => !!names.cs?.trim() || !!names.en?.trim(),
        message("categoryDialog.nameRequired"),
      ),
    parentId: z.string(),
  });
type CategoryForm = z.infer<ReturnType<typeof categoryFormSchemaOf>>;

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
  const schema = categoryFormSchemaOf();
  const save = useActionMutation({
    call: (form: CategoryForm) => {
      const draft = {
        names: namesToSave(form.names),
        parentId: parentIdOf(form.parentId),
      };
      return category === null ? createCategory(draft) : saveCategory(category.id, draft);
    },
    invalidates: categoryInvalidations,
    refusalTexts: refusalTexts(),
  });
  const nameOf = (categoryId: string | null) =>
    categoryId === null
      ? message("categoryDialog.topLevel")
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
          ? message("categoryDialog.editTitle", { name: category.name })
          : parentId === null
            ? message("categoryDialog.newTopLevel")
            : message("categoryDialog.newUnder", { name: nameOf(parentId) })
      }
      description={
        category === null
          ? message("categoryDialog.newDescription")
          : message("categoryDialog.editDescription")
      }
      schema={schema}
      defaultValues={{ names: category?.names ?? {}, parentId: parent ?? topLevel }}
      submitLabel={
        category === null ? message("categoryDialog.create") : message("categoryDialog.save")
      }
      fieldOf={(refusal) => (refusal.code === "category.name_taken" ? "names" : null)}
      onSubmit={async (form) => {
        const result = await save.run(form);
        if (result.isDone) {
          const isMoved = category !== null && parentIdOf(form.parentId) !== category.parentId;
          onSaved(
            result.value,
            category === null
              ? {
                  title: message("categoryDialog.createdTitle", { name: result.value.name }),
                  text: message("categoryDialog.createdText", { parent: nameOf(parentId) }),
                }
              : {
                  title: message("categoryDialog.saved"),
                  text: isMoved
                    ? message("categoryDialog.movedText", {
                        parent: nameOf(parentIdOf(form.parentId)),
                      })
                    : message("categoryDialog.renamed"),
                },
          );
        }

        return result;
      }}
      warningOf={(form) =>
        category !== null && parentIdOf(form.parentId) !== category.parentId ? (
          <p className="text-xs text-tone-amber-foreground">
            {message("categoryDialog.moveWarning")}
          </p>
        ) : undefined
      }
      render={(form) => (
        <>
          <NamesField
            id={`${id}-name`}
            label={message("categoryDialog.name")}
            placeholder={message("categoryDialog.namePlaceholder")}
            names={form.watch("names")}
            onChange={(names) =>
              form.setValue("names", names, { shouldDirty: true, shouldValidate: true })
            }
            autoFocus
          />
          <FieldError message={form.formState.errors.names?.message} />
          {category !== null && (
            <Field id={`${id}-parent`} label={message("categoryDialog.under")}>
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
                        ? message("categoryDialog.allCategoriesTopLevel")
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
                {message("categoryDialog.newCategoryHelp")}
                {isParentLeaf &&
                  ` ${message("categoryDialog.parentLeafHelp", { parent: nameOf(parentId) })}`}
              </>
            ) : (
              message("categoryDialog.moveHelp")
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
    refusalTexts: refusalTexts(),
  });
  const parentName =
    categories.find((candidate) => candidate.id === category.parentId)?.name ??
    message("categoryDialog.topLevel");
  const consequences: Consequence[] | undefined =
    impact === undefined
      ? undefined
      : [
          { text: message("categoryDialog.deleteNoDocuments") },
          ...impact.shares.map(
            (share): Consequence => ({
              text:
                message("categoryDialog.deleteShare", {
                  mix: share.mix.name,
                  share: share.share,
                  parent: parentName,
                  count: share.intentionCount,
                }) +
                (share.intentionCount > 0
                  ? message("categoryDialog.deleteShareIntentions", { count: share.intentionCount })
                  : ""),
              tone: "amber",
            }),
          ),
          ...(impact.otherMixCount > 0
            ? [
                {
                  text: message("categoryDialog.otherMixShare", { count: impact.otherMixCount }),
                  tone: "amber" as const,
                },
              ]
            : []),
          ...(impact.shares.length === 0 && impact.otherMixCount === 0
            ? [{ text: message("categoryDialog.noMixShare") }]
            : []),
          ...(impact.grantCount > 0
            ? [{ text: message("categoryDialog.grantsGoWith", { count: impact.grantCount }) }]
            : []),
          ...(impact.scopedIntentionCount > 0
            ? [
                {
                  text: message("categoryDialog.scopedIntentions", {
                    count: impact.scopedIntentionCount,
                    names: impact.scopedIntentions.map((intention) => intention.name).join(", "),
                  }),
                  tone: "red" as const,
                },
              ]
            : []),
        ];

  return (
    <ConsequenceDialog
      isOpen={isOpen}
      onClose={onClose}
      title={message("categoryDialog.deleteTitle", { name: category.name })}
      description={message("categoryDialog.deleteDescription")}
      consequences={consequences}
      confirmLabel={message("categoryDialog.delete")}
      isDestructive
      onConfirm={async () => {
        const result = await remove.run(undefined);
        if (result.isDone) {
          onDeleted({
            title: message("categoryDialog.deletedTitle", { name: category.name }),
            text:
              impact !== undefined && impact.shares.length + impact.otherMixCount > 0
                ? message("categoryDialog.deletedShare")
                : message("categoryDialog.noSetChanged"),
          });
        }

        return result;
      }}
    />
  );
}
