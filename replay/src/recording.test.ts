import { expect, it } from "bun:test";
import { mediaTypeOf, recordingSchema } from "./recording";

it("records and matches plain-text answers with their media type", async () => {
  const response = new Response("run started\n", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
  const call = recordingSchema.shape.scenarios.element.shape.calls.element.parse({
    method: "GET",
    path: "/api/tasks/T-1/log",
    status: 200,
    text: "run started\n",
    contentType: "text/plain",
  });

  expect(call).toMatchObject({ text: "run started\n", contentType: "text/plain" });
  expect(mediaTypeOf(response.headers.get("Content-Type"))).toBe("text/plain");
  expect(await response.text()).toBe("run started\n");
});
