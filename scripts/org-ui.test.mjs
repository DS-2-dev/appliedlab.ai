import assert from "node:assert/strict";
import test from "node:test";

// Who may do what on the organization page, and the Worker paths it uses.
const { canActOnPerson, canManageOrg, hasNoPrimary, orgActionPath, orgPagePath } = await import("../src/components/projectum/org-helpers.ts");

const org = { primaryUserId: "dana" };
const partner = (id, extra = {}) => ({ id, roles: ["partner"], admin: false, ...extra });

test("the primary and admins manage; other partners and reps only look", () => {
  assert.equal(canManageOrg(partner("dana"), org), true);
  assert.equal(canManageOrg(partner("sam"), org), false);
  assert.equal(canManageOrg({ id: "r", roles: ["rep"], admin: false }, org), false);
  assert.equal(canManageOrg({ id: "a", roles: ["rep", "admin"], admin: true }, org), true);
  assert.equal(canManageOrg({ id: "a", roles: ["admin"], admin: false }, org), true);
});

test("an org with no primary is managed by admins alone, and flagged", () => {
  const none = { primaryUserId: null };
  assert.equal(hasNoPrimary(none), true);
  assert.equal(hasNoPrimary(org), false);
  assert.equal(canManageOrg(partner("sam"), none), false);
  assert.equal(canManageOrg({ id: "a", roles: ["admin"], admin: true }, none), true);
});

test("remove and hand-over are offered for everyone but the primary", () => {
  assert.equal(canActOnPerson(partner("dana"), org, { primary: true }), false);
  assert.equal(canActOnPerson(partner("dana"), org, { primary: false }), true);
  assert.equal(canActOnPerson(partner("sam"), org, { primary: false }), false);
});

test("paths: own org by default, another by id for staff", () => {
  assert.equal(orgPagePath(null), "/orgs/mine");
  assert.equal(orgPagePath("o 1"), "/orgs/o%201");
  assert.equal(orgActionPath("", null), "/orgs/mine");
  assert.equal(orgActionPath("/transfer", null), "/orgs/mine/transfer");
  assert.equal(orgActionPath("/remove", "o1"), "/orgs/mine/remove?org=o1");
});
