import { describe, expect, it } from "bun:test";
import { hasValidGoogleMapsBrowserKey } from "../../src/client/lib/google-maps";

describe("Google Maps browser configuration", () => {
    it("accepts keys with the Google Maps browser key shape", () => {
        expect(hasValidGoogleMapsBrowserKey(`AIza${"a".repeat(35)}`)).toBe(true);
    });

    it("rejects incomplete and placeholder keys", () => {
        expect(hasValidGoogleMapsBrowserKey("short-key")).toBe(false);
        expect(hasValidGoogleMapsBrowserKey("DEMO_MAP_ID")).toBe(false);
        expect(hasValidGoogleMapsBrowserKey("")).toBe(false);
    });
});
