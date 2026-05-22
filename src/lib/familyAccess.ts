import { prisma } from "../prisma";

export type ResourceScope = "PERSONAL" | "FAMILY";

export async function getUserFamilyIds(userId: number): Promise<number[]> {
  const memberships = await prisma.familyMember.findMany({
    where: { userId },
    select: { familyId: true },
  });
  return memberships.map((m) => m.familyId);
}

export async function getOwnerFamilyIds(userId: number): Promise<number[]> {
  const memberships = await prisma.familyMember.findMany({
    where: { userId, role: "OWNER" },
    select: { familyId: true },
  });
  return memberships.map((m) => m.familyId);
}

export async function isFamilyMember(
  familyId: number,
  userId: number,
): Promise<boolean> {
  const m = await prisma.familyMember.findFirst({
    where: { familyId, userId },
    select: { id: true },
  });
  return !!m;
}

export async function isFamilyOwner(
  familyId: number,
  userId: number,
): Promise<boolean> {
  const m = await prisma.familyMember.findFirst({
    where: { familyId, userId },
    select: { role: true },
  });
  return m?.role === "OWNER";
}

export function categoryScope(familyId: number | null): ResourceScope {
  return familyId === null ? "PERSONAL" : "FAMILY";
}

export function limitScope(
  userId: number | null,
  familyId: number | null,
): ResourceScope {
  return familyId !== null ? "FAMILY" : "PERSONAL";
}

export async function canManageCategory(
  category: { userId: number; familyId: number | null },
  userId: number,
): Promise<boolean> {
  if (category.familyId === null) {
    return category.userId === userId;
  }
  return isFamilyOwner(category.familyId, userId);
}

export async function canManageBudgetLimit(
  limit: { userId: number | null; familyId: number | null },
  userId: number,
): Promise<boolean> {
  if (limit.familyId !== null) {
    return isFamilyOwner(limit.familyId, userId);
  }
  return limit.userId === userId;
}

export async function getFamilyMemberRole(
  familyId: number,
  userId: number,
): Promise<"OWNER" | "MEMBER" | "VIEWER" | null> {
  const m = await prisma.familyMember.findFirst({
    where: { familyId, userId },
    select: { role: true },
  });
  return m?.role ?? null;
}

export async function canManageGoal(
  goal: { userId: number | null; familyId: number | null; createdById: number },
  userId: number,
): Promise<boolean> {
  if (goal.familyId === null) {
    return goal.userId === userId;
  }
  if (goal.createdById === userId) return true;
  return isFamilyOwner(goal.familyId, userId);
}

export async function canContributeToGoal(
  goal: { userId: number | null; familyId: number | null },
  userId: number,
): Promise<boolean> {
  if (goal.familyId === null) {
    return goal.userId === userId;
  }
  const role = await getFamilyMemberRole(goal.familyId, userId);
  return role === "OWNER" || role === "MEMBER";
}

export async function canCreateFamilyGoal(
  familyId: number,
  userId: number,
): Promise<boolean> {
  const role = await getFamilyMemberRole(familyId, userId);
  return role === "OWNER" || role === "MEMBER";
}
