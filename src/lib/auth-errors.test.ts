import { describe, expect, it } from "vitest";
import { getRegistrationErrorMessage } from "./auth-errors";

describe("getRegistrationErrorMessage", () => {
  it("returns a French duplicate email message for Supabase duplicate registration errors", () => {
    expect(getRegistrationErrorMessage("User already registered")).toBe(
      "Cette adresse email est déjà utilisée."
    );
    expect(getRegistrationErrorMessage("A user with this email address has already been registered")).toBe(
      "Cette adresse email est déjà utilisée."
    );
  });

  it("returns a French retry message for rate limit errors", () => {
    expect(getRegistrationErrorMessage("Email rate limit exceeded")).toBe(
      "Trop de tentatives d'inscription. Réessayez dans quelques minutes."
    );
  });

  it("keeps unknown errors unchanged", () => {
    expect(getRegistrationErrorMessage("Unexpected provider failure")).toBe(
      "Unexpected provider failure"
    );
  });
});
