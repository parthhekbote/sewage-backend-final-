const { randomUUID } = require("crypto");
const prisma = require("../../config/db");

const recordInclude = {
  plant: { select: { id: true, name: true, building: { select: { organizationId: true } } } },
  scheduledBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
};

const accessWhere = (user, plantId) => {
  if (user.role === "ADMIN") return plantId ? { plantId } : {};
  if (user.role === "CLIENT") {
    return {
      ...(plantId && { plantId }),
      plant: { building: { organizationId: user.organizationId || "__none__" } },
    };
  }
  return { plantId: user.plantId || "__none__", ...(plantId && { AND: { plantId } }) };
};

const parseScheduledAt = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const listDesludging = async (req, res) => {
  try {
    const status = req.query.status?.toUpperCase();
    const allowed = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
    if (status && !allowed.includes(status)) return res.status(400).json({ success: false, message: "Invalid desludging status" });
    const records = await prisma.desludgingRecord.findMany({
      where: { ...accessWhere(req.user, req.query.plantId), ...(status && { status }) },
      include: recordInclude,
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    });
    return res.json({ success: true, records });
  } catch (error) {
    console.error("List desludging error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch desludging records" });
  }
};

const getDesludging = async (req, res) => {
  try {
    const record = await prisma.desludgingRecord.findFirst({ where: { id: req.params.id, ...accessWhere(req.user) }, include: recordInclude });
    if (!record) return res.status(404).json({ success: false, message: "Desludging record not found" });
    return res.json({ success: true, record });
  } catch (error) {
    console.error("Get desludging error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch desludging record" });
  }
};

const scheduleDesludging = async (req, res) => {
  try {
    const { plantId, scheduledAt, notes } = req.body;
    const date = parseScheduledAt(scheduledAt);
    if (!plantId || !date || date <= new Date()) return res.status(400).json({ success: false, message: "A future scheduled date and plant are required" });
    if (!req.user.plantId || req.user.plantId !== plantId) return res.status(403).json({ success: false, message: "You can only schedule your assigned plant" });
    const plant = await prisma.plant.findFirst({ where: { id: plantId, status: "ACTIVE" }, select: { id: true } });
    if (!plant) return res.status(404).json({ success: false, message: "Plant not found" });
    const active = await prisma.desludgingRecord.findFirst({ where: { plantId, status: { in: ["SCHEDULED", "IN_PROGRESS"] } }, select: { id: true } });
    if (active) return res.status(409).json({ success: false, message: "This plant already has an active desludging schedule" });

    const record = await prisma.$transaction(async (tx) => {
      const created = await tx.desludgingRecord.create({ data: { plantId, scheduledAt: date, scheduledById: req.user.id, notes: notes?.trim() || null }, include: recordInclude });
      await tx.plantMetrics.upsert({ where: { plantId }, update: { nextDesludging: date }, create: { id: randomUUID(), plantId, nextDesludging: date } });
      return created;
    });
    return res.status(201).json({ success: true, message: "Desludging scheduled", record });
  } catch (error) {
    console.error("Schedule desludging error:", error);
    return res.status(500).json({ success: false, message: "Failed to schedule desludging" });
  }
};

const rescheduleDesludging = async (req, res) => {
  try {
    const date = parseScheduledAt(req.body.scheduledAt);
    if (!date || date <= new Date()) return res.status(400).json({ success: false, message: "A future scheduled date is required" });
    const existing = await prisma.desludgingRecord.findFirst({ where: { id: req.params.id, plantId: req.user.plantId || "__none__", status: "SCHEDULED" } });
    if (!existing) return res.status(404).json({ success: false, message: "Active schedule not found for your assigned plant" });
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.desludgingRecord.update({ where: { id: existing.id }, data: { scheduledAt: date, ...(req.body.notes !== undefined && { notes: req.body.notes?.trim() || null }) }, include: recordInclude });
      await tx.plantMetrics.updateMany({ where: { plantId: existing.plantId }, data: { nextDesludging: date } });
      return updated;
    });
    return res.json({ success: true, message: "Desludging rescheduled", record });
  } catch (error) {
    console.error("Reschedule desludging error:", error);
    return res.status(500).json({ success: false, message: "Failed to reschedule desludging" });
  }
};

const cancelDesludging = async (req, res) => {
  try {
    const existing = await prisma.desludgingRecord.findFirst({ where: { id: req.params.id, plantId: req.user.plantId || "__none__", status: "SCHEDULED" } });
    if (!existing) return res.status(404).json({ success: false, message: "Active schedule not found for your assigned plant" });
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.desludgingRecord.update({ where: { id: existing.id }, data: { status: "CANCELLED" }, include: recordInclude });
      await tx.plantMetrics.updateMany({ where: { plantId: existing.plantId }, data: { nextDesludging: null } });
      return updated;
    });
    return res.json({ success: true, message: "Desludging schedule cancelled", record });
  } catch (error) {
    console.error("Cancel desludging error:", error);
    return res.status(500).json({ success: false, message: "Failed to cancel desludging" });
  }
};

const startDesludging = async (req, res) => {
  try {
    const existing = await prisma.desludgingRecord.findFirst({ where: { id: req.params.id, plantId: req.user.plantId || "__none__", status: "SCHEDULED" } });
    if (!existing) return res.status(404).json({ success: false, message: "Scheduled desludging not found for your assigned plant" });
    const record = await prisma.desludgingRecord.update({ where: { id: existing.id }, data: { status: "IN_PROGRESS", startedAt: new Date() }, include: recordInclude });
    return res.json({ success: true, message: "Desludging started", record });
  } catch (error) {
    console.error("Start desludging error:", error);
    return res.status(500).json({ success: false, message: "Failed to start desludging" });
  }
};

const completeDesludging = async (req, res) => {
  try {
    const volume = Number(req.body.volume);
    const agency = req.body.agency?.trim();
    const tankerNumber = req.body.tankerNumber?.trim();
    if (!Number.isFinite(volume) || volume <= 0 || !agency || !tankerNumber) return res.status(400).json({ success: false, message: "Positive volume, agency and tanker number are required" });
    const existing = await prisma.desludgingRecord.findFirst({ where: { id: req.params.id, plantId: req.user.plantId || "__none__", status: "IN_PROGRESS" } });
    if (!existing) return res.status(404).json({ success: false, message: "In-progress desludging not found for your assigned plant" });
    const completedAt = new Date();
    const record = await prisma.$transaction(async (tx) => {
      const updated = await tx.desludgingRecord.update({
        where: { id: existing.id },
        data: { status: "COMPLETED", completedAt, completedById: req.user.id, volume, volumeUnit: req.body.volumeUnit?.trim() || "kL", agency, tankerNumber, notes: req.body.notes?.trim() || existing.notes, receiptImageUrl: req.body.receiptImageUrl?.trim() || null },
        include: recordInclude,
      });
      await tx.plantMetrics.upsert({ where: { plantId: existing.plantId }, update: { lastDesludging: completedAt, nextDesludging: null }, create: { id: randomUUID(), plantId: existing.plantId, lastDesludging: completedAt } });
      return updated;
    });
    return res.json({ success: true, message: "Desludging completed", record });
  } catch (error) {
    console.error("Complete desludging error:", error);
    return res.status(500).json({ success: false, message: "Failed to complete desludging" });
  }
};

module.exports = { listDesludging, getDesludging, scheduleDesludging, rescheduleDesludging, cancelDesludging, startDesludging, completeDesludging };
