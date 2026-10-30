// Test setup. jsdom's FormData and File are its own, which Node's fetch does not recognise and
// sends as text; a browser's fetch and FormData are one, so the tests use Node's.
import "@testing-library/jest-dom/vitest";
import { File as NodeFile } from "node:buffer";

const nodeForm = await new Response("a=b", {
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
}).formData();
Object.assign(globalThis, { FormData: nodeForm.constructor, File: NodeFile });

if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

if (!Reflect.has(window, "PointerEvent")) {
  class TestPointerEvent extends MouseEvent {
    readonly pointerType: string;

    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerType = init.pointerType ?? "";
    }
  }

  // jsdom has no PointerEvent, so retain the touch type and coordinates used by gesture tests.
  Object.defineProperty(window, "PointerEvent", { value: TestPointerEvent });
}
