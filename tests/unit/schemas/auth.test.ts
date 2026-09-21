/**
 * @file tests/unit/schemas/auth.test.ts
 * @description Unit tests for candidate authentication and registration validation schemas.
 * 
 * Task ID: TASK-09010102 (Subtask: SUB-0901010201)
 * Architecture Reference: ADR-001, ADR-003, ADR-013, AGENTS.md (Rule 1 & Rule 2)
 */

import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema } from "@/lib/schemas/auth";

describe("loginSchema", () => {
  it("TC-AUTH-LOG-01: should pass with valid email address and password", () => {
    const validData = {
      email: "candidate@upaguru.in",
      password: "ValidPassword123!",
    };

    const result = loginSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("candidate@upaguru.in");
    }
  });

  it("TC-AUTH-LOG-02: should trim whitespace around email address", () => {
    const result = loginSchema.safeParse({
      email: "  applicant@example.com  ",
      password: "Password123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("applicant@example.com");
    }
  });

  it("TC-AUTH-LOG-03: should reject malformed email format", () => {
    const result = loginSchema.safeParse({
      email: "not-a-valid-email",
      password: "Password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Please enter a valid email address");
    }
  });

  it("TC-AUTH-LOG-04: should reject password shorter than 8 characters", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Password must be at least 8 characters");
    }
  });

  it("TC-AUTH-LOG-05: should reject missing email or password", () => {
    const emptyResult = loginSchema.safeParse({});
    expect(emptyResult.success).toBe(false);
  });
});

describe("registerSchema", () => {
  const validRegistration = {
    fullName: "Prajna Gowda",
    email: "prajna@upaguru.in",
    password: "SecurePassword123",
    confirmPassword: "SecurePassword123",
  };

  it("TC-AUTH-REG-01: should pass with complete and matching registration credentials", () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fullName).toBe("Prajna Gowda");
    }
  });

  it("TC-AUTH-REG-02: should reject mismatched password confirmation", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: "DifferentPassword456",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Passwords do not match");
    }
  });

  it("TC-AUTH-REG-03: should reject passwords lacking an uppercase letter", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "lowercasepassword123",
      confirmPassword: "lowercasepassword123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Password must contain at least one uppercase letter");
    }
  });

  it("TC-AUTH-REG-04: should reject passwords lacking numeric digits", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "NoDigitsPassword",
      confirmPassword: "NoDigitsPassword",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Password must contain at least one numeric digit");
    }
  });

  it("TC-AUTH-REG-05: should reject full names with prohibited scripting or invalid symbols", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      fullName: "Prajna <script>alert(1)</script>",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("Full name may only contain letters");
    }
  });
});
