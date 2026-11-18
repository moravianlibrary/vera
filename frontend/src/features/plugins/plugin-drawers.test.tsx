// What the implementation drawer says an Input and a Catalog adapter can do.

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { ImplementationDrawer, InstanceDrawer } from "@/features/plugins/plugin-drawers";
import { pluginIndex } from "@/mocks/plugins";

const index = pluginIndex();
function resettableFixture() {
  const instance = index.instances.find(({ canReset }) => canReset);
  if (instance === undefined) throw new Error("Missing resettable plugin fixture");
  const implementation = index.implementations.find(({ id }) => id === instance.implementationId);
  if (implementation === undefined) throw new Error("Missing implementation fixture");
  return { instance, implementation };
}

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

  it("shows the installed version signer", () => {
    drawer("pt1");

    expect(screen.getAllByText(/signed by/)[0]).toBeInTheDocument();
  });
});

describe("InstanceDrawer mirror", () => {
  const { instance: resettable, implementation } = resettableFixture();
  const reach = { canSeeTasks: false, canSeeAccess: false, canSeeHooks: false };

  function instanceDrawer(mirror: typeof resettable.mirror) {
    return render(
      <MemoryRouter>
        <InstanceDrawer
          instance={{ ...resettable, mirror }}
          implementation={implementation}
          asOf="2026-06-25T09:00:00.000Z"
          names={names}
          reach={reach}
          onOpenImplementation={() => {}}
          actions={[]}
        />
      </MemoryRouter>,
    );
  }

  it("shows mirror freshness and count, and omits the line without a mirror", () => {
    const synced = instanceDrawer({ syncedAt: "2026-06-25T08:00:00.000Z", records: 2 });
    expect(screen.getByText(/Mirror: 2 records, synced/)).toBeInTheDocument();
    synced.unmount();
    instanceDrawer(null);
    expect(screen.queryByText(/Mirror:/)).not.toBeInTheDocument();
  });

  it("says when a mirror has not synced yet", () => {
    instanceDrawer({ syncedAt: null, records: 0 });
    expect(screen.getByText("Mirror: not synced yet")).toBeInTheDocument();
  });
});
