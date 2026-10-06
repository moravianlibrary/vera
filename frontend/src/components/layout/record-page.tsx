// A record's own page (component-interfaces.md §1.5; docs/demos/shared/vera.css .pj-detail): the
// header with the way back to the index, a note on where the record stands, then its cards
// beside a narrow aside of facts and people, its history under the aside. The room decides: one
// column where it is narrow, the aside on top and the history last, so a long history never
// stands between the facts and the cards.

import type { ComponentProps, ReactNode } from "react";
import { PageContent, PageHeader } from "@/components/layout/page-header";

interface RecordPageProps {
  header: ComponentProps<typeof PageHeader>;
  // Where it stands, in words.
  note?: ReactNode;
  aside?: ReactNode;
  history?: ReactNode;
  children: ReactNode;
}

export function RecordPage({ header, note, aside, history, children }: RecordPageProps) {
  return (
    <>
      <PageHeader {...header} />
      <PageContent className="@container">
        {note !== undefined && <div className="mb-4">{note}</div>}
        <div className="grid items-start gap-4 @4xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] @4xl:grid-rows-[auto_1fr]">
          {aside !== undefined && (
            <aside className="grid gap-4 @4xl:col-start-2 @4xl:row-start-1">{aside}</aside>
          )}
          <div className="grid min-w-0 gap-4 @4xl:col-start-1 @4xl:row-span-2 @4xl:row-start-1">
            {children}
          </div>
          {history !== undefined && (
            <div className="grid gap-4 @4xl:col-start-2 @4xl:row-start-2">{history}</div>
          )}
        </div>
      </PageContent>
    </>
  );
}
