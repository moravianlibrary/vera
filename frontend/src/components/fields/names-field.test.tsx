import { fireEvent, render, screen } from "@testing-library/react";
import { namesAfterEdit } from "@vera/domain/names";
import { describe, expect, it, vi } from "vitest";
import { NamesField } from "@/components/fields/names-field";
import { i18n } from "@/i18n";

describe("NamesField", () => {
  it("shows the other language and edits both names through namesAfterEdit", () => {
    i18n.changeLanguage("en");
    const onChange = vi.fn();
    render(
      <NamesField
        id="record-name"
        label="Name"
        names={{ en: "Books", cs: "Knihy" }}
        onChange={onChange}
      />,
    );

    expect(screen.getByLabelText("Name in Czech")).toHaveValue("Knihy");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Volumes" } });
    expect(onChange).toHaveBeenLastCalledWith(
      namesAfterEdit({ en: "Books", cs: "Knihy" }, "en", "Volumes"),
    );
    fireEvent.change(screen.getByLabelText("Name in Czech"), { target: { value: "Svazky" } });
    expect(onChange).toHaveBeenLastCalledWith(
      namesAfterEdit({ en: "Books", cs: "Knihy" }, "cs", "Svazky"),
    );
  });

  it("adds an empty other-language field and focuses it", () => {
    i18n.changeLanguage("en");
    render(<NamesField id="record-name" label="Name" names={{ en: "Books" }} onChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Add Czech name" }));
    expect(screen.getByLabelText("Name in Czech")).toHaveValue("");
    expect(screen.getByLabelText("Name in Czech")).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Add Czech name" })).toBeNull();
  });
});
