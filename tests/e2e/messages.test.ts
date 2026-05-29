import { describe, it, expect } from "vitest";
import { APP_BASE_URL } from "./setup";

async function postMessage(body: unknown) {
  return fetch(`${APP_BASE_URL}/api/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/messages (E2E)", () => {
  describe("input validation", () => {
    it("returns ok:false when message is empty", async () => {
      const res = await postMessage({ message: "" });
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBeTruthy();
    });

    it("returns ok:false when message is whitespace only", async () => {
      const res = await postMessage({ message: "   " });
      const data = await res.json();
      expect(data.ok).toBe(false);
    });

    it("returns ok:false when message exceeds 4000 characters", async () => {
      const res = await postMessage({ message: "a".repeat(4001) });
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toContain("4000");
    });

    it("returns ok:false for invalid JSON body", async () => {
      const res = await postMessage("not-json");
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.error).toBe("Invalid request body.");
    });

    it("accepts a message of exactly 4000 characters", async () => {
      const res = await postMessage({ message: "a".repeat(4000) });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });
  });

  describe("relay", () => {
    it("relays a valid message to both Slack and Teams", async () => {
      const res = await postMessage({ message: "hello world" });
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.results).toHaveLength(2);
      expect(data.results.every((r: { ok: boolean }) => r.ok)).toBe(true);
    });

    it("trims whitespace and relays the message", async () => {
      const res = await postMessage({ message: "  trimmed  " });
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it("includes relay results for both targets in the response", async () => {
      const res = await postMessage({ message: "check results" });
      const data = await res.json();
      const targets = data.results.map((r: { target: string }) => r.target);
      expect(targets).toContain("slack");
      expect(targets).toContain("teams");
    });
  });
});
