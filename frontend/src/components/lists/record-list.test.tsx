// A phone long-press picks its row, and a later tap toggles another row.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { RecordList } from "@/components/lists/record-list";
import { i18n } from "@/i18n";

function PickingList() {
  const [picked, setPicked] = useState<ReadonlySet<string> | null>(null);
  const rows = [{ id: "one" }, { id: "two" }];
  return (
    <RecordList
      rows={rows}
      rowId={(row) => row.id}
      total={2}
      columns={[
        { key: "name", header: "common:recordList.name", track: "1fr", cell: (row) => row.id },
      ]}
      card={{ title: (row) => row.id }}
      toolbar={{ count: "2 documents" }}
      paging={{ hasMore: false, isLoadingMore: false, onLoadMore: () => {} }}
      isLoading={false}
      selectedId={null}
      onSelect={() => {}}
      onLongPress={(id) => setPicked(new Set([id]))}
      picking={
        picked === null
          ? undefined
          : {
              pickedIds: picked,
              onToggle: (id) =>
                setPicked((current) => {
                  const next = new Set(current ?? []);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                }),
            }
      }
      loadingText="Loading documents…"
      emptyText="No documents"
      loadingMoreText="Loading more documents…"
    />
  );
}

describe("RecordList phone picking", () => {
  it("starts picking on long-press and toggles another row on tap", () => {
    vi.useFakeTimers();
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    });
    render(
      <I18nextProvider i18n={i18n}>
        <PickingList />
      </I18nextProvider>,
    );
    const first = screen.getByRole("button", { name: "one one" });
    fireEvent.pointerDown(first, { pointerType: "touch", clientX: 20, clientY: 20 });
    act(() => vi.advanceTimersByTime(500));
    fireEvent.pointerUp(first, { pointerType: "touch" });
    expect(first).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "two two" }));
    expect(first).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "two two" })).toHaveAttribute("aria-pressed", "true");
    vi.useRealTimers();
  });
});

describe("RecordList empty state", () => {
  it("renders block empty text outside a paragraph", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <RecordList
          rows={[]}
          rowId={(row: { id: string }) => row.id}
          total={0}
          columns={[
            { key: "name", header: "common:recordList.name", track: "1fr", cell: (row) => row.id },
          ]}
          card={{ title: (row) => row.id }}
          toolbar={{ count: "0 documents" }}
          paging={{ hasMore: false, isLoadingMore: false, onLoadMore: () => {} }}
          isLoading={false}
          selectedId={null}
          onSelect={() => {}}
          loadingText="Loading documents…"
          emptyText={<div>No documents</div>}
          loadingMoreText="Loading more documents…"
        />
      </I18nextProvider>,
    );

    expect(container.querySelector("p div")).toBeNull();
    expect(container.querySelector(".p-4.text-sm.text-muted-foreground")?.tagName).toBe("DIV");
  });
});
