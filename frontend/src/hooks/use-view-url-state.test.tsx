// useViewUrlState over the Documents declaration: the URL is the view's state, and each change
// keeps what the view keeps of it.

import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { documentsView } from "@/features/documents/documents-view";
import { useViewUrlState } from "@/hooks/use-view-url-state";

function renderAt(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ state: useViewUrlState(documentsView), location: useLocation() }), {
    wrapper,
  });
}

describe("useViewUrlState", () => {
  it("reads the filter, the open record, the grouping and the tab from the URL", () => {
    const { result } = renderAt("/documents?q=listy&id=D3&group=batch&watchlist=W1");

    const { state } = result.current;

    expect(state.query.search).toBe("listy");
    expect(state.selectedId).toBe("D3");
    expect(state.grouping).toBe("batch");
    expect(state.watchlistId).toBe("W1");
  });

  it("drops a grouping the view does not know", () => {
    const { result } = renderAt("/documents?group=colour");

    expect(result.current.state.grouping).toBeNull(); // a stale link still opens the view
  });

  it("keeps the open record, grouping and tab when the filter changes", () => {
    const { result } = renderAt("/documents?q=listy&id=D3&group=batch&watchlist=W1");

    act(() => result.current.state.setQuery({ decisions: ["Pending"] }));

    const params = new URLSearchParams(result.current.location.search);
    expect(Object.fromEntries(params)).toEqual({
      decision: "Pending",
      id: "D3",
      group: "batch",
      watchlist: "W1",
    });
  });

  it("replaces the filter from a tab and says so to the bar", () => {
    const { result } = renderAt("/documents?q=listy&group=project");
    const watchlist = {
      id: "W2",
      name: "Urgent",
      view: "documents",
      scope: "personal",
      filter: { priority: "Urgent" },
      createdAt: "2026-06-01T08:00:00Z",
    } as const;

    act(() => result.current.state.openWatchlist(watchlist));

    const { state } = result.current;
    expect(state.query.search).toBeUndefined();
    expect(state.query.priorities).toEqual(["Urgent"]);
    expect(state.watchlistId).toBe("W2");
    expect(state.grouping).toBe("project"); // grouping is presentation, not the filter
    expect(state.filterReplacements).toBe(1);
  });

  it("detaches a tab that is gone and keeps its filter", () => {
    const { result } = renderAt("/documents?priority=Urgent&watchlist=W2");

    act(() => result.current.state.detachWatchlist());

    expect(result.current.state.watchlistId).toBeNull();
    expect(result.current.state.filter).toEqual({ priority: "Urgent" });
  });

  it("counts a view naming only its grouping as bare", () => {
    const grouped = renderAt("/documents?group=batch");
    const filtered = renderAt("/documents?q=listy");

    expect(grouped.result.current.state.isBare).toBe(true);
    expect(filtered.result.current.state.isBare).toBe(false);
  });
});
