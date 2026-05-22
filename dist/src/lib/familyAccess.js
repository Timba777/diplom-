"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserFamilyIds = getUserFamilyIds;
exports.getOwnerFamilyIds = getOwnerFamilyIds;
exports.isFamilyMember = isFamilyMember;
exports.isFamilyOwner = isFamilyOwner;
exports.categoryScope = categoryScope;
exports.limitScope = limitScope;
exports.canManageCategory = canManageCategory;
exports.canManageBudgetLimit = canManageBudgetLimit;
exports.getFamilyMemberRole = getFamilyMemberRole;
exports.canManageGoal = canManageGoal;
exports.canContributeToGoal = canContributeToGoal;
exports.canCreateFamilyGoal = canCreateFamilyGoal;
const prisma_1 = require("../prisma");
async function getUserFamilyIds(userId) {
    const memberships = await prisma_1.prisma.familyMember.findMany({
        where: { userId },
        select: { familyId: true },
    });
    return memberships.map((m) => m.familyId);
}
async function getOwnerFamilyIds(userId) {
    const memberships = await prisma_1.prisma.familyMember.findMany({
        where: { userId, role: "OWNER" },
        select: { familyId: true },
    });
    return memberships.map((m) => m.familyId);
}
async function isFamilyMember(familyId, userId) {
    const m = await prisma_1.prisma.familyMember.findFirst({
        where: { familyId, userId },
        select: { id: true },
    });
    return !!m;
}
async function isFamilyOwner(familyId, userId) {
    const m = await prisma_1.prisma.familyMember.findFirst({
        where: { familyId, userId },
        select: { role: true },
    });
    return m?.role === "OWNER";
}
function categoryScope(familyId) {
    return familyId === null ? "PERSONAL" : "FAMILY";
}
function limitScope(userId, familyId) {
    return familyId !== null ? "FAMILY" : "PERSONAL";
}
async function canManageCategory(category, userId) {
    if (category.familyId === null) {
        return category.userId === userId;
    }
    return isFamilyOwner(category.familyId, userId);
}
async function canManageBudgetLimit(limit, userId) {
    if (limit.familyId !== null) {
        return isFamilyOwner(limit.familyId, userId);
    }
    return limit.userId === userId;
}
async function getFamilyMemberRole(familyId, userId) {
    const m = await prisma_1.prisma.familyMember.findFirst({
        where: { familyId, userId },
        select: { role: true },
    });
    return m?.role ?? null;
}
async function canManageGoal(goal, userId) {
    if (goal.familyId === null) {
        return goal.userId === userId;
    }
    if (goal.createdById === userId)
        return true;
    return isFamilyOwner(goal.familyId, userId);
}
async function canContributeToGoal(goal, userId) {
    if (goal.familyId === null) {
        return goal.userId === userId;
    }
    const role = await getFamilyMemberRole(goal.familyId, userId);
    return role === "OWNER" || role === "MEMBER";
}
async function canCreateFamilyGoal(familyId, userId) {
    const role = await getFamilyMemberRole(familyId, userId);
    return role === "OWNER" || role === "MEMBER";
}
