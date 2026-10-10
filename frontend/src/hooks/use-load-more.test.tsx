import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useLoadMore } from "@/hooks/use-load-more";

afterEach(() => vi.unstubAllGlobals());

it("loads another slice when the sentinel remains visible after rows are appended", () => {
  const callbacks: IntersectionObserverCallback[] = [];
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  const load = vi.fn();
  function ListEnd({ count }: { count: number }) {
    const ref = useLoadMore(true, false, load, count);
    return (
      <div style={{ overflowY: "auto" }}>
        <div ref={ref} />
      </div>
    );
  }
  const view = render(<ListEnd count={25} />);
  expect(callbacks).toHaveLength(1);
  act(() =>
    callbacks[0](
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
  expect(load).toHaveBeenCalledTimes(1);

  view.rerender(<ListEnd count={50} />);
  expect(callbacks).toHaveLength(2);
  act(() =>
    callbacks[1](
      [{ isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
  expect(load).toHaveBeenCalledTimes(2);
});
