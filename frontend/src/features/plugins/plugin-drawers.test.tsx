// What the implementation drawer says an Input and a Catalog adapter can do.

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImplementationDrawer } from "@/features/plugins/plugin-drawers";
import { pluginIndex } from "@/mocks/plugins";

const index = pluginIndex();
const names = {
  userOf: (userId: string) => userId,
  categoryOf: (categoryId: string) => categoryId,
  roleOf: (roleId: string) => roleId,
  custodyOf: (custodyId: string) => custodyId,
};

function drawer(implementationId: string) {
  const implementation = index.implementations.find(({ id }) => id === implementationId);
  if (implementation === undefined) throw new Error(`Missing fixture ${implementationId}`);

  return render(
    <ImplementationDrawer
      implementation={implementation}
      instances={[]}
      onOpenInstance={() => {}}
      names={names}
      actions={[]}
    />,
  );
}

describe("ImplementationDrawer operations", () => {
  it("names an Input version's way in by its declared operation", () => {
    drawer("pt9");

    expect(screen.getByText("Way in")).toBeInTheDocument();
    expect(screen.getByText("Barcode")).toBeInTheDocument();
  });

  it("says what a catalog adapter can do", () => {
    drawer("pt1");

    expect(screen.getByText("Can")).toBeInTheDocument();
    expect(screen.getByText("Record link, Search")).toBeInTheDocument();
  });
});
