"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.familiesRouter = void 0;
const express_1 = require("express");
const prisma_1 = require("../prisma");
const auth_1 = require("../middleware/auth");
exports.familiesRouter = (0, express_1.Router)();
exports.familiesRouter.use(auth_1.authMiddleware);
function parseId(value) {
    const n = typeof value === "string" ? Number(value) : Number(value);
    if (!Number.isInteger(n) || n <= 0)
        return null;
    return n;
}
function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}
function parseFamilyRole(value) {
    if (value === "OWNER" || value === "MEMBER" || value === "VIEWER")
        return value;
    return null;
}
async function requireFamilyMember(familyId, userId) {
    return prisma_1.prisma.familyMember.findFirst({
        where: { familyId, userId },
    });
}
async function requireOwner(familyId, userId) {
    const member = await requireFamilyMember(familyId, userId);
    if (!member)
        return { ok: false, status: 403 };
    if (member.role !== "OWNER")
        return { ok: false, status: 403 };
    return { ok: true, member };
}
exports.familiesRouter.post("/", async (req, res) => {
    const { name, description } = req.body;
    if (!isNonEmptyString(name)) {
        return res.status(400).json({ message: "name is required" });
    }
    const family = await prisma_1.prisma.familyGroup.create({
        data: {
            name,
            description: typeof description === "string" ? description : null,
            members: {
                create: {
                    userId: req.user.id,
                    role: "OWNER",
                },
            },
        },
        include: { members: true },
    });
    return res.status(201).json(family);
});
exports.familiesRouter.get("/", async (req, res) => {
    const families = await prisma_1.prisma.familyGroup.findMany({
        where: {
            members: {
                some: {
                    userId: req.user.id,
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
    return res.json(families);
});
exports.familiesRouter.get("/:id", async (req, res) => {
    const familyId = parseId(req.params.id);
    if (!familyId)
        return res.status(400).json({ message: "Invalid id" });
    const membership = await requireFamilyMember(familyId, req.user.id);
    if (!membership)
        return res.status(403).json({ message: "Forbidden" });
    const family = await prisma_1.prisma.familyGroup.findUnique({
        where: { id: familyId },
        include: {
            members: {
                include: {
                    user: { select: { id: true, email: true, name: true } },
                },
                orderBy: { createdAt: "asc" },
            },
        },
    });
    if (!family)
        return res.status(404).json({ message: "Not found" });
    return res.json(family);
});
exports.familiesRouter.get("/:id/members", async (req, res) => {
    const familyId = parseId(req.params.id);
    if (!familyId)
        return res.status(400).json({ message: "Invalid id" });
    const membership = await requireFamilyMember(familyId, req.user.id);
    if (!membership)
        return res.status(403).json({ message: "Forbidden" });
    const members = await prisma_1.prisma.familyMember.findMany({
        where: { familyId },
        include: { user: { select: { id: true, email: true, name: true } } },
        orderBy: { createdAt: "asc" },
    });
    return res.json(members);
});
exports.familiesRouter.post("/:id/members", async (req, res) => {
    const familyId = parseId(req.params.id);
    if (!familyId)
        return res.status(400).json({ message: "Invalid id" });
    const ownerCheck = await requireOwner(familyId, req.user.id);
    if (!ownerCheck.ok)
        return res.status(ownerCheck.status).json({ message: "Forbidden" });
    const { email, role } = req.body;
    if (!isNonEmptyString(email)) {
        return res.status(400).json({ message: "email is required" });
    }
    const parsedRole = role === undefined ? "MEMBER" : parseFamilyRole(role);
    if (!parsedRole) {
        return res.status(400).json({ message: "role must be OWNER, MEMBER or VIEWER" });
    }
    const user = await prisma_1.prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, name: true },
    });
    if (!user)
        return res.status(404).json({ message: "User not found" });
    const existing = await prisma_1.prisma.familyMember.findFirst({
        where: { familyId, userId: user.id },
        select: { id: true },
    });
    if (existing)
        return res.status(409).json({ message: "User is already in family" });
    try {
        const member = await prisma_1.prisma.familyMember.create({
            data: {
                familyId,
                userId: user.id,
                role: parsedRole,
                invitedById: req.user.id,
            },
            include: { user: { select: { id: true, email: true, name: true } } },
        });
        return res.status(201).json(member);
    }
    catch (e) {
        if (typeof e === "object" && e !== null && "code" in e) {
            const code = e.code;
            if (code === "P2002") {
                return res.status(409).json({ message: "User is already in family" });
            }
        }
        return res.status(500).json({ message: "Failed to add member" });
    }
});
exports.familiesRouter.put("/:id/members/:memberId", async (req, res) => {
    const familyId = parseId(req.params.id);
    const memberId = parseId(req.params.memberId);
    if (!familyId || !memberId)
        return res.status(400).json({ message: "Invalid id" });
    const ownerCheck = await requireOwner(familyId, req.user.id);
    if (!ownerCheck.ok)
        return res.status(ownerCheck.status).json({ message: "Forbidden" });
    const { role } = req.body;
    const parsedRole = parseFamilyRole(role);
    if (!parsedRole) {
        return res.status(400).json({ message: "role must be OWNER, MEMBER or VIEWER" });
    }
    const member = await prisma_1.prisma.familyMember.findFirst({
        where: { id: memberId, familyId },
    });
    if (!member)
        return res.status(404).json({ message: "Member not found" });
    // Prevent removing the last OWNER.
    if (member.role === "OWNER" && parsedRole !== "OWNER") {
        const ownersCount = await prisma_1.prisma.familyMember.count({
            where: { familyId, role: "OWNER" },
        });
        if (ownersCount <= 1) {
            return res.status(409).json({ message: "Family must have at least one OWNER" });
        }
    }
    const updated = await prisma_1.prisma.familyMember.update({
        where: { id: member.id },
        data: { role: parsedRole },
        include: { user: { select: { id: true, email: true, name: true } } },
    });
    return res.json(updated);
});
exports.familiesRouter.delete("/:id/members/:memberId", async (req, res) => {
    const familyId = parseId(req.params.id);
    const memberId = parseId(req.params.memberId);
    if (!familyId || !memberId)
        return res.status(400).json({ message: "Invalid id" });
    const memberToDelete = await prisma_1.prisma.familyMember.findFirst({
        where: { id: memberId, familyId },
    });
    if (!memberToDelete)
        return res.status(404).json({ message: "Member not found" });
    const isSelfDelete = memberToDelete.userId === req.user.id;
    // Owners can delete anyone; non-owners can only delete themselves.
    if (!isSelfDelete) {
        const ownerCheck = await requireOwner(familyId, req.user.id);
        if (!ownerCheck.ok)
            return res.status(ownerCheck.status).json({ message: "Forbidden" });
    }
    // Cannot delete last OWNER.
    if (memberToDelete.role === "OWNER") {
        const ownersCount = await prisma_1.prisma.familyMember.count({
            where: { familyId, role: "OWNER" },
        });
        if (ownersCount <= 1) {
            return res.status(409).json({ message: "Cannot remove the last OWNER" });
        }
    }
    await prisma_1.prisma.familyMember.delete({ where: { id: memberToDelete.id } });
    return res.status(204).send();
});
exports.familiesRouter.delete("/:id", async (req, res) => {
    const familyId = parseId(req.params.id);
    if (!familyId)
        return res.status(400).json({ message: "Invalid id" });
    const ownerCheck = await requireOwner(familyId, req.user.id);
    if (!ownerCheck.ok) {
        return res.status(ownerCheck.status).json({ message: "Forbidden" });
    }
    const existing = await prisma_1.prisma.familyGroup.findUnique({
        where: { id: familyId },
    });
    if (!existing)
        return res.status(404).json({ message: "Not found" });
    try {
        await prisma_1.prisma.$transaction(async (tx) => {
            await tx.limit.deleteMany({ where: { familyId } });
            await tx.budgetLimit.deleteMany({ where: { familyId } });
            await tx.operation.updateMany({
                where: { familyId },
                data: { familyId: null },
            });
            await tx.category.updateMany({
                where: { familyId },
                data: { familyId: null },
            });
            await tx.familyMember.deleteMany({ where: { familyId } });
            await tx.familyGroup.delete({ where: { id: familyId } });
        });
        return res.json({ success: true });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({
            message: e instanceof Error ? e.message : "Failed to delete family",
        });
    }
});
