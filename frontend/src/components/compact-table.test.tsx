import { render, screen, within } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it } from "vitest";
import { CompactTable } from "@/components/compact-table";
import { i18n } from "@/i18n";

describe("CompactTable", () => {
  it("renders headers, row cells and phone-hidden columns", () => {
    render(
      <I18nextProvider i18n={i18n}>
        <CompactTable
          rows={[{ id: "one", name: "Periodicals", before: "20%", after: "25%" }]}
          rowKey={(row) => row.id}
          columns={[
            { key: "name", header: "Category", cell: (row) => row.name },
            { key: "before", header: "Now", align: "end", cell: (row) => row.before },
            {
              key: "after",
              header: "After",
              align: "end",
              isHiddenOnPhone: true,
              cell: (row) => row.after,
            },
          ]}
        />
      </I18nextProvider>,
    );

    const table = screen.getByRole("table");
    expect(within(table).getByRole("columnheader", { name: "Category" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "Periodicals" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "After" })).toHaveClass(
      "hidden",
      "sm:table-cell",
    );
  });
});
