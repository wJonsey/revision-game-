import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../../src/core/eventBus.js";

describe("EventBus", () => {
  it("delivers the payload to a registered handler", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    bus.on("AnswerSubmitted", handler);
    bus.emit("AnswerSubmitted", { correct: true });
    expect(handler).toHaveBeenCalledWith({ correct: true });
  });

  it("stops delivering after unsubscribe", () => {
    const bus = new EventBus();
    const handler = vi.fn();
    const unsubscribe = bus.on("RoundEnded", handler);
    unsubscribe();
    bus.emit("RoundEnded");
    expect(handler).not.toHaveBeenCalled();
  });

  it("does nothing when an event has no listeners", () => {
    const bus = new EventBus();
    expect(() => bus.emit("NobodyListening")).not.toThrow();
  });

  it("keeps calling other handlers when one throws", () => {
    const bus = new EventBus();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const goodHandler = vi.fn();
    bus.on("XPAwarded", () => {
      throw new Error("broken listener");
    });
    bus.on("XPAwarded", goodHandler);
    bus.emit("XPAwarded", 100);
    expect(goodHandler).toHaveBeenCalledWith(100);
    consoleSpy.mockRestore();
  });

  it("rejects a handler that is not a function (erroneous data)", () => {
    const bus = new EventBus();
    expect(() => bus.on("AnswerSubmitted", "not a function")).toThrow(TypeError);
  });
});
