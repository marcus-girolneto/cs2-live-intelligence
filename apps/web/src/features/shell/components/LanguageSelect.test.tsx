// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageProvider } from "@/shared/i18n";
import { LanguageSelect } from "./LanguageSelect";

afterEach(cleanup);
const load = async () => ({ Language: "Idioma" });

describe("LanguageSelect", () => {
  it("is a keyboard listbox that switches the language and <html lang>", async () => {
    render(
      <LanguageProvider initial="en" load={load}>
        <LanguageSelect />
      </LanguageProvider>,
    );
    const button = screen.getByRole("button", { name: /English/ });
    expect(button.getAttribute("aria-haspopup")).toBe("listbox");
    fireEvent.keyDown(button, { key: "ArrowDown" });
    const list = screen.getByRole("listbox");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "English",
      "Português (Brasil)",
      "Español",
      "Русский",
      "简体中文",
      "Deutsch",
      "Français",
      "Polski",
      "Türkçe",
    ]);
    fireEvent.keyDown(list, { key: "ArrowDown" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    await act(async () => {
      fireEvent.keyDown(list, { key: "Enter" });
    });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByRole("button", { name: /Español/ })).toBeTruthy();
    expect(document.documentElement.lang).toBe("es");
    expect(document.cookie).toContain("lang=es");
    fireEvent.click(screen.getByRole("button", { name: /Español/ }));
    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
