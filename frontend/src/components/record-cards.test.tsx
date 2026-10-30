import { render, screen } from "@testing-library/react";
import type { StatusLogEntry } from "@vera/domain/entities";
import type { EventEntry } from "@vera/domain/events";
import { describe, expect, it } from "vitest";
import { HistoryCard } from "@/components/record-cards";

const event: EventEntry = {
  id: "e1",
  subjectKind: "request",
  subjectId: "r1",
  at: "2026-01-01T00:00:00Z",
  actor: { kind: "user", userId: "u1" },
  correlationId: "c1",
  reason: { public: "We received it", internal: "staff note" },
  code: "request.created",
  data: { batch: { id: "b1", name: "January batch" }, source: null },
};
const legacy: StatusLogEntry = {
  id: "e2",
  subjectKind: "request",
  subjectId: "r2",
  at: "2026-01-02T00:00:00Z",
  actor: { kind: "system" },
  correlationId: "c2",
  event: "Old wording",
  detail: "Old detail",
};

describe("HistoryCard", () => {
  it("shows staff wording, both reasons, public wording alone, and legacy wording", () => {
    const { rerender } = render(
      <HistoryCard log={[event, legacy]} nameOf={() => "Ada"} isPublic={false} />,
    );
    expect(screen.getByText("Asked for")).toBeInTheDocument();
    expect(screen.getByText("January batch")).toBeInTheDocument();
    expect(screen.getByText("staff note")).toBeInTheDocument();
    expect(screen.getByText("Told the asker: We received it")).toBeInTheDocument();
    expect(screen.getByText("Old wording")).toBeInTheDocument();
    expect(screen.getByText("Old detail")).toBeInTheDocument();

    rerender(<HistoryCard log={[event]} nameOf={() => "Ada"} isPublic />);
    expect(screen.getByText("Asked")).toBeInTheDocument();
    expect(screen.queryByText("January batch")).not.toBeInTheDocument();
    expect(screen.queryByText("staff note")).not.toBeInTheDocument();
    expect(screen.queryByText("We received it")).not.toBeInTheDocument();
  });
});
