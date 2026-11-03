import { endpoints } from "@vera/contract/endpoints";
import type { RecordingCall } from "./recording";

type EndpointName = keyof typeof endpoints;

export function endpointOf(call: Pick<RecordingCall, "method" | "path">): EndpointName | undefined {
  const callPath = new URL(call.path, "http://recording.invalid").pathname.split("/");
  const match = Object.entries(endpoints).find(([, endpoint]) => {
    if (endpoint.method !== call.method) return false;
    const endpointPath = `/api${endpoint.path}`.split("/");
    return (
      endpointPath.length === callPath.length &&
      endpointPath.every(
        (part, index) =>
          part.startsWith(":") || callPath[index] === "$NEW_DOCUMENT" || part === callPath[index],
      )
    );
  });
  return match?.[0] as EndpointName | undefined;
}
