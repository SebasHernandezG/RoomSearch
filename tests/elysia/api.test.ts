import { describe, expect, it } from "bun:test";
import { googleAuthErrorMessage } from "../../src/client/api";

describe("Google authentication errors", () => {
    it("explains a failed OAuth exchange in Spanish", () => {
        expect(googleAuthErrorMessage("failed")).toBe(
            "Google rechazó el inicio de sesión. Revisa el secreto y la URI autorizada.",
        );
    });

    it("uses a safe message for an unknown error", () => {
        expect(googleAuthErrorMessage("unknown")).toBe(
            "No fue posible iniciar sesión con Google.",
        );
    });
});
