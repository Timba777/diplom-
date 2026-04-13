import { Router } from "express";
import { prisma } from "../prisma";
import { authMiddleware, AuthRequest } from "../middleware/auth";
import { FamilyRole } from "../../generated/prisma/enums";

export const familiesRouter = Router();

familiesRouter.use(authMiddleware);

function parseId(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseFamilyRole(value: unknown): FamilyRole | null {
  if (value === "OWNER" || value === "MEMBER" || value === "VIEWER") return value;
  return null;
}

async function requireFamilyMember(familyId: number, userId: number) {
  return prisma.familyMember.findFirst({
    where: { familyId, userId },
  });
}

async function requireOwner(familyId: number, userId: number) {
  const member = await requireFamilyMember(familyId, userId);
  if (!member) return { ok: false as const, status: 403 as const };
  if (member.role !== "OWNER") return { ok: false as const, status: 403 as const };
  return { ok: true as const, member };
}

familiesRouter.post("/", async (req: AuthRequest, res) => {
  const { name, description } = req.body;

  if (!isNonEmptyString(name)) {
    return res.status(400).json({ message: "name is required" });
  }

  const family = await prisma.familyGroup.create({
    data: {
      name,
      description: typeof description === "string" ? description : null,
      members: {
        create: {
          userId: req.user!.id,
          role: "OWNER",
        },
      },
    },
    include: { members: true },
  });

  return res.status(201).json(family);
});

familiesRouter.get("/", async (req: AuthRequest, res) => {
  const families = await prisma.familyGroup.findMany({
    where: {
      members: {
        some: {
          userId: req.user!.id,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return res.json(families);
});

familiesRouter.get("/:id", async (req: AuthRequest, res) => {
  const familyId = parseId(req.params.id);
  if (!familyId) return res.status(400).json({ message: "Invalid id" });

  const membership = await requireFamilyMember(familyId, req.user!.id);
  if (!membership) return res.status(403).json({ message: "Forbidden" });

  const family = await prisma.familyGroup.findUnique({
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

  if (!family) return res.status(404).json({ message: "Not found" });

  return res.json(family);
});

familiesRouter.get("/:id/members", async (req: AuthRequest, res) => {
  const familyId = parseId(req.params.id);
  if (!familyId) return res.status(400).json({ message: "Invalid id" });

  const membership = await requireFamilyMember(familyId, req.user!.id);
  if (!membership) return res.status(403).json({ message: "Forbidden" });

  const members = await prisma.familyMember.findMany({
    where: { familyId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return res.json(members);
});

familiesRouter.post("/:id/members", async (req: AuthRequest, res) => {
  const familyId = parseId(req.params.id);
  if (!familyId) return res.status(400).json({ message: "Invalid id" });

  const ownerCheck = await requireOwner(familyId, req.user!.id);
  if (!ownerCheck.ok) return res.status(ownerCheck.status).json({ message: "Forbidden" });

  const { email, role } = req.body as { email?: unknown; role?: unknown };

  if (!isNonEmptyString(email)) {
    return res.status(400).json({ message: "email is required" });
  }

  const parsedRole = role === undefined ? "MEMBER" : parseFamilyRole(role);
  if (!parsedRole) {
    return res.status(400).json({ message: "role must be OWNER, MEMBER or VIEWER" });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (!user) return res.status(404).json({ message: "User not found" });

  const existing = await prisma.familyMember.findFirst({
    where: { familyId, userId: user.id },
    select: { id: true },
  });

  if (existing) return res.status(409).json({ message: "User is already in family" });

  try {
    const member = await prisma.familyMember.create({
      data: {
        familyId,
        userId: user.id,
        role: parsedRole,
        invitedById: req.user!.id,
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    return res.status(201).json(member);
  } catch (e: unknown) {
    if (typeof e === "object" && e !== null && "code" in e) {
      const code = (e as { code?: string }).code;
      if (code === "P2002") {
        return res.status(409).json({ message: "User is already in family" });
      }
    }

    return res.status(500).json({ message: "Failed to add member" });
  }
});

familiesRouter.put("/:id/members/:memberId", async (req: AuthRequest, res) => {
  const familyId = parseId(req.params.id);
  const memberId = parseId(req.params.memberId);
  if (!familyId || !memberId) return res.status(400).json({ message: "Invalid id" });

  const ownerCheck = await requireOwner(familyId, req.user!.id);
  if (!ownerCheck.ok) return res.status(ownerCheck.status).json({ message: "Forbidden" });

  const { role } = req.body as { role?: unknown };
  const parsedRole = parseFamilyRole(role);
  if (!parsedRole) {
    return res.status(400).json({ message: "role must be OWNER, MEMBER or VIEWER" });
  }

  const member = await prisma.familyMember.findFirst({
    where: { id: memberId, familyId },
  });
  if (!member) return res.status(404).json({ message: "Member not found" });

  // Prevent removing the last OWNER.
  if (member.role === "OWNER" && parsedRole !== "OWNER") {
    const ownersCount = await prisma.familyMember.count({
      where: { familyId, role: "OWNER" },
    });
    if (ownersCount <= 1) {
      return res.status(409).json({ message: "Family must have at least one OWNER" });
    }
  }

  const updated = await prisma.familyMember.update({
    where: { id: member.id },
    data: { role: parsedRole },
    include: { user: { select: { id: true, email: true, name: true } } },
  });

  return res.json(updated);
});

familiesRouter.delete("/:id/members/:memberId", async (req: AuthRequest, res) => {
  const familyId = parseId(req.params.id);
  const memberId = parseId(req.params.memberId);
  if (!familyId || !memberId) return res.status(400).json({ message: "Invalid id" });

  const memberToDelete = await prisma.familyMember.findFirst({
    where: { id: memberId, familyId },
  });
  if (!memberToDelete) return res.status(404).json({ message: "Member not found" });

  const isSelfDelete = memberToDelete.userId === req.user!.id;

  // Owners can delete anyone; non-owners can only delete themselves.
  if (!isSelfDelete) {
    const ownerCheck = await requireOwner(familyId, req.user!.id);
    if (!ownerCheck.ok) return res.status(ownerCheck.status).json({ message: "Forbidden" });
  }

  // Cannot delete last OWNER.
  if (memberToDelete.role === "OWNER") {
    const ownersCount = await prisma.familyMember.count({
      where: { familyId, role: "OWNER" },
    });
    if (ownersCount <= 1) {
      return res.status(409).json({ message: "Cannot remove the last OWNER" });
    }
  }

  await prisma.familyMember.delete({ where: { id: memberToDelete.id } });
  return res.status(204).send();
});

