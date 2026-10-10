// A table whose row opens in a drawer (component-interfaces.md §1.6; docs/demos/shared/vera-ui.js
// `detail('drawer')`): what sits above it (tiles, running cards, a timeline), the table, what
// sits under it, and the open row's drawer at the right, 28rem at every tier and full width on a
// phone. The drawer does not hold the page: another row opens in it at once, and Escape or ×
// closes it. The open row comes from the URL (`?run=`), which the page owns.
// TODO(rrandiak): labels move to i18n.

import { XIcon } from "lucide-react";
import { Dialog as DrawerPrimitive } from "radix-ui";
import type { ReactNode } from "react";
import type { DataTableProps } from "@/components/data-table";
import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";

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
      <DrawerPrimitive.Root
        open={openId !== null}
        modal={false}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            onClose();
          }
        }}
      >
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Content
            // Clicking another row opens it here; only × and Escape close.
            onInteractOutside={(event) => event.preventDefault()}
            className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-xl outline-none data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:slide-in-from-right sm:w-[28rem]"
          >
            <div className="flex items-start gap-3 border-b px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <DrawerPrimitive.Title className="text-[0.9375rem] font-semibold leading-snug">
                  {drawerTitle}
                </DrawerPrimitive.Title>
                <DrawerPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                  {drawerSubtitle}
                </DrawerPrimitive.Description>
              </div>
              <DrawerPrimitive.Close asChild>
                <Button variant="ghost" size="icon" className="-mr-2 size-8" aria-label="Close">
                  <XIcon />
                </Button>
              </DrawerPrimitive.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{drawer}</div>
          </DrawerPrimitive.Content>
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </>
  );
}
