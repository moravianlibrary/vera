// Test setup. jsdom's FormData and File are its own, which Node's fetch does not recognise and
// sends as text; a browser's fetch and FormData are one, so the tests use Node's.
import "@testing-library/jest-dom/vitest";
import { File as NodeFile } from "node:buffer";
import { afterEach } from "vitest";
import { i18n } from "@/i18n";

const missingKeys = new Set<string>();
i18n.init({
  saveMissing: true,
  missingKeyHandler: (_languages, namespace, key) => {
    missingKeys.add(`${namespace}:${key}`);
  },
});

afterEach(() => {
  const missing = [...missingKeys];
  missingKeys.clear();
  if (missing.length) throw new Error(`Missing i18n messages: ${missing.join(", ")}`);
});

const nodeForm = await new Response("a=b", {
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
}).formData();
Object.assign(globalThis, { FormData: nodeForm.constructor, File: NodeFile });

// Node's own localStorage, unset without --localstorage-file, hides jsdom's; a browser keeps one
// per origin, so each test file gets an empty one.
if (window.localStorage === undefined) {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
  Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
}

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
