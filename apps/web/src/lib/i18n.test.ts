import { describe, expect, test } from "vitest";
import { getMessages, isLocale } from "./i18n.js";

describe("localized interface messages", () => {
  test("supports Ukrainian, English, and Russian", () => {
    expect(isLocale("uk")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("de")).toBe(false);
  });

  test("returns distinct primary actions for every locale", () => {
    expect(getMessages("uk").lobby.playComputer).toBe("Грати з комп’ютером");
    expect(getMessages("en").lobby.playComputer).toBe("Play the computer");
    expect(getMessages("ru").lobby.playComputer).toBe("Играть с компьютером");
  });
});
