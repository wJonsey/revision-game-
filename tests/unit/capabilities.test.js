import { describe, expect, it } from "vitest";
import { hasLocalStorage, hasWebGL } from "../../src/core/capabilities.js";

const fakeDocument = (context) => ({
  createElement: () => ({ getContext: () => context }),
});

describe("hasWebGL", () => {
  it("returns true when a WebGL context is available", () => {
    expect(hasWebGL(fakeDocument({}))).toBe(true);
  });

  it("returns false when WebGL is disabled", () => {
    expect(hasWebGL(fakeDocument(null))).toBe(false);
  });

  it("returns false instead of crashing when canvas creation throws", () => {
    const brokenDocument = { createElement: () => { throw new Error("blocked"); } };
    expect(hasWebGL(brokenDocument)).toBe(false);
  });
});

describe("hasLocalStorage", () => {
  it("returns true when storage can be written", () => {
    const store = new Map();
    const storage = {
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    };
    expect(hasLocalStorage(() => storage)).toBe(true);
    expect(store.size).toBe(0);
  });

  it("returns false when the browser blocks storage access", () => {
    expect(hasLocalStorage(() => { throw new Error("SecurityError"); })).toBe(false);
  });
});
