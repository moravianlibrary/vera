// Test setup. jsdom's FormData and File are its own, which Node's fetch does not recognise and
// sends as text; a browser's fetch and FormData are one, so the tests use Node's.
import "@testing-library/jest-dom/vitest";
import { File as NodeFile } from "node:buffer";

const nodeForm = await new Response("a=b", {
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
}).formData();
Object.assign(globalThis, { FormData: nodeForm.constructor, File: NodeFile });
