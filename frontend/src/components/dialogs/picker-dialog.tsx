// Kind E (component-interfaces.md §6.6): who or what is in a set, ticked from a list and saved
// whole. Long lists get a search; a list of two kinds (a custody's groups and people) comes in
// sections. A row may also be held some way the dialog does not change (a role an identity
// provider maps): it says so under the row, and the box is only this dialog's own way. What the
// pick gives, "Each person added gets …", sits above the list and follows the ticks. Typed
// changes make closing ask first.
// TODO(rrandiak): a role per picked item (a project's manager) when Projects moves onto it;
// labels move to i18n.

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { DialogShell } from "@/components/dialogs/dialog-shell";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { ActionResult, Refusal } from "@/hooks/use-action-mutation";

export interface PickerSection<Item> {
  // Absent for a list of one kind.
  title?: string;
  items: readonly Item[];
}

interface PickerDialogProps<Item> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  sections: readonly PickerSection<Item>[];
  // Unique across the sections.
  itemId: (item: Item) => string;
  // What the search matches.
  itemText: (item: Item) => string;
  renderItem: (item: Item, isPicked: boolean) => ReactNode;
  // Said under the row, for an item also held in a way this dialog does not change.
  heldOtherwiseOf?: (item: Item) => string | null;
  initiallyPicked: ReadonlySet<string>;
  // "Adding somebody here gives them …", or what the pick leaves.
  consequenceOf?: (picked: ReadonlySet<string>) => ReactNode;
  submitLabel: string;
  onSave: (picked: ReadonlySet<string>) => Promise<ActionResult<unknown>>;
}

// More than this, and the list can be searched.
const searchableFrom = 8;

export function PickerDialog<Item>({
  isOpen,
  onClose,
  title,
  description,
  sections,
  itemId,
  itemText,
  renderItem,
  heldOtherwiseOf,
  initiallyPicked,
  consequenceOf,
  submitLabel,
  onSave,
}: PickerDialogProps<Item>) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(initiallyPicked);
  const [search, setSearch] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const searchId = useId();
  const itemCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const needle = search.trim().toLowerCase();
  const isDirty =
    picked.size !== initiallyPicked.size || [...picked].some((id) => !initiallyPicked.has(id));

  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });

  const close = () => {
    setPicked(initiallyPicked);
    setSearch("");
    setRefusal(null);
    onClose();
  };

  const save = async () => {
    setIsPending(true);
    const result = await onSave(picked);
    setIsPending(false);
    if (result.isDone) {
      close();
      return;
    }

    setRefusal(result.refusal);
  };

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={close}
      title={title}
      description={description}
      isDirty={isDirty}
      refusal={refusal}
      primary={{ label: submitLabel, isPending, onSelect: () => void save() }}
    >
      <div className="grid gap-3">
        {consequenceOf?.(picked)}
        {itemCount > searchableFrom && (
          <Input
            id={searchId}
            aria-label="Search the list"
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        )}
        {sections.map((section) => {
          const items = section.items.filter(
            (item) => needle === "" || itemText(item).toLowerCase().includes(needle),
          );
          return (
            <div key={section.title ?? "items"} className="grid">
              {section.title !== undefined && (
                <h3 className="mb-1 text-xs font-semibold text-muted-foreground">
                  {section.title}
                </h3>
              )}
              {items.length === 0 && (
                <p className="py-1 text-xs text-muted-foreground">Nothing matches.</p>
              )}
              {items.map((item) => {
                const id = itemId(item);
                const heldOtherwise = heldOtherwiseOf?.(item) ?? null;
                const isPicked = picked.has(id);
                return (
                  <label
                    key={id}
                    htmlFor={`${searchId}-${id}`}
                    className="flex cursor-pointer items-start gap-2.5 border-b py-2 last:border-b-0"
                  >
                    <Checkbox
                      id={`${searchId}-${id}`}
                      checked={isPicked}
                      onCheckedChange={() => toggle(id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      {renderItem(item, isPicked)}
                      {heldOtherwise !== null && (
                        <span className="block text-xs text-muted-foreground">{heldOtherwise}</span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          );
        })}
      </div>
    </DialogShell>
  );
}
