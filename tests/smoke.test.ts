import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { getDashboardPath } from "../src/lib/auth/role-routing";
import { loginPayloadSchema } from "../src/lib/auth/schemas";
import { canDelegateGymPermissions, canTransitionStaffStatus, isGymPermissionGranted } from "../src/lib/auth/policy";

describe("role-based dashboard routing", () => {
  it("routes each application role to its own dashboard", () => {
    expect(getDashboardPath(Role.SUPER_ADMIN)).toBe("/super-admin");
    expect(getDashboardPath(Role.OWNER)).toBe("/owner");
    expect(getDashboardPath(Role.MEMBER)).toBe("/member");
  });
});

describe("gym staff permission policy", () => {
  it("allows the primary gym owner full gym access", () => {
    expect(isGymPermissionGranted(Role.OWNER, true, [], "finance.write")).toBe(true);
  });

  it("allows staff only permissions explicitly granted", () => {
    expect(isGymPermissionGranted(Role.OWNER, false, ["members.read"], "members.read")).toBe(true);
    expect(isGymPermissionGranted(Role.OWNER, false, ["members.read"], "members.delete")).toBe(false);
  });

  it("does not grant gym permissions to members or platform admins", () => {
    expect(isGymPermissionGranted(Role.MEMBER, false, ["finance.read"], "finance.read")).toBe(false);
    expect(isGymPermissionGranted(Role.SUPER_ADMIN, false, ["finance.read"], "finance.read")).toBe(false);
  });
});

describe("staff permission delegation", () => {
  it("allows the primary gym owner to grant permissions", () => {
    expect(canDelegateGymPermissions(true, [], ["finance.write", "staff.manage"])).toBe(true);
  });

  it("limits staff to permissions they already hold", () => {
    expect(canDelegateGymPermissions(false, ["members.read"], ["members.read"])).toBe(true);
    expect(canDelegateGymPermissions(false, ["members.read"], ["finance.write"])).toBe(false);
  });

  it("blocks staff from delegating elevated permissions", () => {
    expect(canDelegateGymPermissions(false, ["staff.manage"], ["staff.manage"])).toBe(false);
    expect(canDelegateGymPermissions(false, ["members.delete"], ["members.delete"])).toBe(false);
  });
});

describe("login payload validation", () => {
  it("normalizes email addresses", () => {
    const result = loginPayloadSchema.safeParse({
      email: "  MEMBER@EXAMPLE.COM ",
      password: "Strong-passphrase-2026",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("member@example.com");
  });

  it("rejects weak and overlong bcrypt passwords", () => {
    expect(loginPayloadSchema.safeParse({ email: "member@example.com", password: "short" }).success).toBe(false);
    expect(loginPayloadSchema.safeParse({ email: "member@example.com", password: "é".repeat(37) }).success).toBe(false);
  });
});


describe("staff account status transitions", () => {
  it("allows active staff to be suspended and suspended staff to be reactivated", () => {
    expect(canTransitionStaffStatus("ACTIVE", "SUSPENDED")).toBe(true);
    expect(canTransitionStaffStatus("SUSPENDED", "ACTIVE")).toBe(true);
  });

  it("does not allow invited staff to bypass invitation activation", () => {
    expect(canTransitionStaffStatus("INVITED", "ACTIVE")).toBe(false);
    expect(canTransitionStaffStatus("INVITED", "SUSPENDED")).toBe(false);
  });

  it("does not allow redundant status changes", () => {
    expect(canTransitionStaffStatus("ACTIVE", "ACTIVE")).toBe(false);
    expect(canTransitionStaffStatus("SUSPENDED", "SUSPENDED")).toBe(false);
  });
});
