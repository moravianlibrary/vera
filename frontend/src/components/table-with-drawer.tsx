// A table whose row opens in a drawer (component-interfaces.md §1.6; docs/demos/shared/vera-ui.js
// `detail('drawer')`): what sits above it (tiles, running cards, a timeline), the table, what
// sits under it, and the open row's drawer at the right, 28rem at every tier and full width on a
// phone. The drawer does not hold the page: another row opens in it at once, and Escape or ×
// closes it. The open row comes from the URL (`?run=`), which the page owns.
// TODO(rrandiak): labels move to i18n.

import type { ReactNode } from "react";
import type { DataTableProps } from "@/components/data-table";
import { DataTable } from "@/components/data-table";
import { DetailDrawer } from "@/components/detail-drawer";
import type { RecordSwipe } from "@/hooks/use-swipe-between";

interface TableWithDrawerProps<Row> {
  table: DataTableProps<Row>;
  openId: string | null;
  onClose: () => void;
  drawerTitle: string;
  // A line under the title: the record's number and what it is.
  drawerSubtitle?: ReactNode;
  drawer: ReactNode;
  above?: ReactNode;
  below?: ReactNode;
  tableSection?: {
    header: ReactNode;
    className: string;
  };
  swipe?: RecordSwipe<Row>;
}

export function TableWithDrawer<Row>({
  table,
  openId,
  onClose,
  drawerTitle,
  drawerSubtitle,
  drawer,
  above,
  below,
  tableSection,
  swipe,
}: TableWithDrawerProps<Row>) {
  const tableAndNote = (
    <>
      <DataTable {...table} focusedId={openId} />
      {below}
    </>
  );
  return (
    <>
      {above}
      {tableSection === undefined ? (
        tableAndNote
      ) : (
        <section className={tableSection.className}>
          {tableSection.header}
          <DataTable {...table} focusedId={openId} stickyHeader />
          {below}
        </section>
      )}
      <DetailDrawer
        open={openId !== null}
        onClose={onClose}
        title={drawerTitle}
        subtitle={drawerSubtitle}
        swipe={swipe}
      >
        {drawer}
      </DetailDrawer>
    </>
  );
}
