import type { ReactNode } from "react";
import { Link } from "react-router";
import type { AccessIndex } from "@/api/access";
import { Button } from "@/components/ui/button";
import type { AccessNames } from "@/features/access/access-records";
import { categoryPath, categorySourcesOf, uniquePeople } from "@/features/access/access-resources";
import type { AccessSelection } from "@/features/access/access-view";

export type ManagementSelection =
  | Exclude<AccessSelection, { kind: "watchlists" }>
  | { kind: "categories"; id: string };

interface DetailProps {
  index: AccessIndex;
  names: AccessNames;
  onSelect: (selection: ManagementSelection) => void;
}

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailRow({ children, note }: { children: ReactNode; note?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b py-2 text-sm last:border-b-0">
      <span>{children}</span>
      {note !== undefined && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  );
}

function RecordButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="font-medium text-primary hover:underline" onClick={onClick}>
      {children}
    </button>
  );
}

export function CategoryAccessDetail({
  index,
  names,
  onSelect,
  categoryId,
}: DetailProps & { categoryId: string }) {
  const sources = categorySourcesOf(index, categoryId);
  const people = uniquePeople(sources);
  const here = sources.filter((source) => source.grantedOnId === categoryId);
  const inherited = sources.filter((source) => source.grantedOnId !== categoryId);
  const rows = (items: typeof sources) =>
    items.map((source) => (
      <DetailRow
        key={`${source.grantedOnId}:${source.viaGroupId ?? "direct"}:${source.userId}`}
        note={`${source.viaGroupId === null ? "Direct" : `via ${names.group(source.viaGroupId)}`} · ${categoryPath(index, source.grantedOnId ?? categoryId)}`}
      >
        <RecordButton onClick={() => onSelect({ kind: "users", id: source.userId })}>
          {names.user(source.userId)}
        </RecordButton>
      </DetailRow>
    ));
  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Custody of this category includes every descendant. Inherited assignments come from an
        ancestor branch.
      </p>
      <DetailSection title="Assigned here">
        {here.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : rows(here)}
      </DetailSection>
      <DetailSection title="Inherited from ancestors">
        {inherited.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          rows(inherited)
        )}
      </DetailSection>
      <DetailSection title={`Effective custodians · ${people.length}`}>
        {people.length === 0 && <p className="text-sm text-muted-foreground">Nobody.</p>}
        {people.map((userId) => (
          <DetailRow
            key={userId}
            note={`${sources.filter((source) => source.userId === userId).length} source(s)`}
          >
            <RecordButton onClick={() => onSelect({ kind: "users", id: userId })}>
              {names.user(userId)}
            </RecordButton>
          </DetailRow>
        ))}
      </DetailSection>
      <Button asChild variant="outline" size="sm" className="mt-5">
        <Link to={`/categories?c=${encodeURIComponent(categoryId)}`}>
          Open category and manage custody
        </Link>
      </Button>
    </div>
  );
}
