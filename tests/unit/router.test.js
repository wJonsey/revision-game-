import { describe, expect, it, vi } from "vitest";
import { createRouter } from "../../src/ui/router.js";

const fakeRoot = () => ({ replaceChildren: vi.fn() });

describe("createRouter", () => {
  it("clears the root and renders the requested screen", () => {
    const root = fakeRoot();
    const menu = vi.fn();
    const router = createRouter(root, { menu });
    router.navigate("menu");
    expect(root.replaceChildren).toHaveBeenCalledOnce();
    expect(menu).toHaveBeenCalledWith(root, expect.objectContaining({ navigate: expect.any(Function) }));
    expect(router.currentScreen).toBe("menu");
  });

  it("lets a screen navigate to another screen", () => {
    const settings = vi.fn();
    const router = createRouter(fakeRoot(), {
      menu: (root, { navigate }) => navigate("settings"),
      settings,
    });
    router.navigate("menu");
    expect(settings).toHaveBeenCalledOnce();
    expect(router.currentScreen).toBe("settings");
  });

  it("runs the previous screen's cleanup before showing the next screen", () => {
    const stopGame = vi.fn();
    const router = createRouter(fakeRoot(), { game: () => stopGame, menu: vi.fn() });
    router.navigate("game");
    expect(stopGame).not.toHaveBeenCalled();
    router.navigate("menu");
    expect(stopGame).toHaveBeenCalledOnce();
  });

  it("passes params to the screen", () => {
    const practice = vi.fn();
    const router = createRouter(fakeRoot(), { practice });
    router.navigate("practice", { areaId: "CA2" });
    expect(practice.mock.calls[0][1].params).toEqual({ areaId: "CA2" });
  });

  it("throws a clear error for an unknown screen", () => {
    const router = createRouter(fakeRoot(), {});
    expect(() => router.navigate("missing")).toThrow('Unknown screen "missing"');
  });
});
