const fs = require("fs");
const path = require("path");
const prisma = require("../../config/db");
const { uploadDirectory } = require("../../middleware/tankerReceiptUpload.middleware");

const activeAlertStatuses = ["OPEN", "ACKNOWLEDGED"];
const ticketStatuses = ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const priorities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const sensorTypes = ["PH", "TSS", "BOD", "COD", "DISSOLVED_OXYGEN", "TURBIDITY", "H2S", "TEMPERATURE"];

const pagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
};

const requireOrganization = (req, res) => {
  if (req.user.organizationId) return req.user.organizationId;
  res.status(403).json({ success: false, message: "Client is not assigned to an organization" });
  return null;
};

const plantAccess = (organizationId) => ({ building: { organizationId } });
const plantSummaryInclude = {
  building: { include: { organization: { select: { id: true, name: true } } } },
  metrics: true,
  _count: { select: { tanks: true, alerts: true, tickets: true, users: true, tasks: true } },
};

const getClient = (id) => prisma.user.findFirst({
  where: { id, role: "CLIENT" },
  select: {
    id: true, name: true, email: true, phone: true, role: true, status: true,
    organizationId: true, plantId: true, createdAt: true, updatedAt: true,
    organization: true,
    plant: { include: plantSummaryInclude },
  },
});

const getDashboard = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const client = await getClient(req.user.id);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    const access = plantAccess(organizationId);
    const [plants, activeAlertCount, openTicketCount, operatorCount, activeAlerts] = await Promise.all([
      prisma.plant.findMany({ where: access, orderBy: { name: "asc" }, include: plantSummaryInclude }),
      prisma.alert.count({ where: { plant: access, status: { in: activeAlertStatuses } } }),
      prisma.ticket.count({ where: { createdById: req.user.id, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
      prisma.user.count({ where: { role: "OPERATOR", plant: access, status: { not: "INACTIVE" } } }),
      prisma.alert.findMany({
        where: { plant: access, status: { in: activeAlertStatuses } },
        orderBy: { createdAt: "desc" }, take: 5,
        include: {
          plant: { select: { id: true, name: true, code: true } },
          sensor: { include: { tank: { select: { id: true, name: true } } } },
        },
      }),
    ]);
    return res.status(200).json({
      success: true,
      client: { id: client.id, name: client.name, email: client.email, phone: client.phone, status: client.status },
      organization: client.organization,
      metrics: {
        plantCount: plants.length, activeAlertCount, openTicketCount, operatorCount,
        treatedWater: plants.reduce((sum, plant) => sum + (plant.metrics?.treatedWater || 0), 0),
        flowRate: plants.reduce((sum, plant) => sum + (plant.metrics?.flowRate || 0), 0),
      },
      plants, activeAlerts,
    });
  } catch (error) {
    console.error("Get Client dashboard error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch Client dashboard" });
  }
};

const getProfile = async (req, res) => {
  try {
    const client = await getClient(req.user.id);
    if (!client) return res.status(404).json({ success: false, message: "Client not found" });
    return res.status(200).json({ success: true, client });
  } catch (error) {
    console.error("Get Client profile error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch Client profile" });
  }
};

const getPlants = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const plants = await prisma.plant.findMany({
      where: plantAccess(organizationId), orderBy: { name: "asc" }, include: plantSummaryInclude,
    });
    return res.status(200).json({ success: true, count: plants.length, plants });
  } catch (error) {
    console.error("Get Client plants error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch plants" });
  }
};

const getPlantById = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const plant = await prisma.plant.findFirst({
      where: { id: req.params.id, ...plantAccess(organizationId) },
      include: {
        building: { include: { organization: true } }, metrics: true,
        tanks: { orderBy: { name: "asc" }, include: {
          pumps: { orderBy: { name: "asc" } },
          sensors: { orderBy: { type: "asc" }, include: { readings: { orderBy: { recordedAt: "desc" }, take: 1 } } },
        } },
        _count: { select: { tanks: true, alerts: true, tickets: true, users: true, tasks: true } },
      },
    });
    if (!plant) return res.status(404).json({ success: false, message: "Plant not found" });
    return res.status(200).json({ success: true, plant });
  } catch (error) {
    console.error("Get Client plant error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch plant" });
  }
};

const getPlantAnalytics = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const range = req.query.range || "7d";
    const sensorType = req.query.sensorType;
    if (sensorType && !sensorTypes.includes(sensorType)) return res.status(400).json({ success: false, message: "Invalid sensor type" });
    const plant = await prisma.plant.findFirst({
      where: { id: req.params.id, ...plantAccess(organizationId) }, select: { id: true, name: true, metrics: true },
    });
    if (!plant) return res.status(404).json({ success: false, message: "Plant not found" });
    const days = { "1d": 1, "7d": 7, "30d": 30, "90d": 90, "1y": 365 }[range] || 7;
    const from = new Date(Date.now() - days * 86400000);
    const to = new Date();
    const readings = await prisma.sensorReading.findMany({
      where: { recordedAt: { gte: from, lte: to }, sensor: { tank: { plantId: plant.id }, ...(sensorType && { type: sensorType }) } },
      orderBy: { recordedAt: "asc" },
      include: { sensor: { select: {
        id: true, name: true, type: true, unit: true, minimumThreshold: true, maximumThreshold: true,
        tank: { select: { id: true, name: true } },
      } } },
    });
    const values = readings.map((item) => item.value);
    const summary = values.length ? {
      count: values.length,
      average: values.reduce((sum, value) => sum + value, 0) / values.length,
      minimum: Math.min(...values), maximum: Math.max(...values),
    } : { count: 0, average: null, minimum: null, maximum: null };
    return res.status(200).json({
      success: true, plant: { id: plant.id, name: plant.name }, range, sensorType: sensorType || null,
      period: { from, to }, plantMetrics: plant.metrics, performance: { summary, chart: readings },
    });
  } catch (error) {
    console.error("Get Client analytics error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch analytics" });
  }
};

const getPlantHistory = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const plant = await prisma.plant.findFirst({ where: { id: req.params.id, ...plantAccess(organizationId) }, select: { id: true, name: true } });
    if (!plant) return res.status(404).json({ success: false, message: "Plant not found" });
    const [visits, tasks, tankerLogs, tests, tickets] = await Promise.all([
      prisma.visitReport.findMany({ where: { plantId: plant.id }, include: { engineer: { select: { id: true, name: true } } } }),
      prisma.task.findMany({ where: { plantId: plant.id }, include: { operator: { select: { id: true, name: true } } } }),
      prisma.tankerLog.findMany({ where: { plantId: plant.id }, include: { operator: { select: { id: true, name: true } } } }),
      prisma.manualTestResult.findMany({ where: { tank: { plantId: plant.id } }, include: { tank: { select: { id: true, name: true } }, engineer: { select: { id: true, name: true } }, operator: { select: { id: true, name: true } } } }),
      prisma.ticket.findMany({ where: { plantId: plant.id }, include: { assignedEngineer: { select: { id: true, name: true } } } }),
    ]);
    const events = [
      ...visits.map((x) => ({ id: x.id, type: "VISIT_REPORT", title: "Plant inspection", description: x.observation, status: x.condition, date: x.visitedAt, performedBy: x.engineer, source: x })),
      ...tasks.map((x) => ({ id: x.id, type: "TASK", title: x.title, description: x.description, status: x.status, date: x.updatedAt, performedBy: x.operator, source: x })),
      ...tankerLogs.map((x) => ({ id: x.id, type: "TANKER_LOG", title: `Tanker ${x.tankerNumber}`, description: `${x.volume} ${x.volumeUnit} - ${x.agency}`, status: "COMPLETED", date: x.loggedAt, performedBy: x.operator, source: x })),
      ...tests.map((x) => ({ id: x.id, type: "MANUAL_TEST", title: `${x.tank.name} manual test`, description: x.notes, status: x.status, date: x.testedAt, performedBy: x.engineer || x.operator, source: x })),
      ...tickets.map((x) => ({ id: x.id, type: "TICKET", title: x.title, description: x.description, status: x.status, date: x.updatedAt, performedBy: x.assignedEngineer, source: x })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
    return res.status(200).json({ success: true, plant, count: events.length, events });
  } catch (error) {
    console.error("Get Client history error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch plant history" });
  }
};

const getAlerts = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const { status, severity, plantId } = req.query;
    if (status && !["OPEN", "ACKNOWLEDGED", "RESOLVED"].includes(status)) return res.status(400).json({ success: false, message: "Invalid alert status" });
    if (severity && !["WARNING", "CRITICAL"].includes(severity)) return res.status(400).json({ success: false, message: "Invalid alert severity" });
    const alerts = await prisma.alert.findMany({
      where: { plant: plantAccess(organizationId), ...(plantId && { plantId }), ...(status && { status }), ...(severity && { severity }) },
      orderBy: { createdAt: "desc" },
      include: { plant: { select: { id: true, name: true, code: true } }, sensor: { include: { tank: { select: { id: true, name: true } } } } },
    });
    return res.status(200).json({ success: true, count: alerts.length, alerts });
  } catch (error) {
    console.error("Get Client alerts error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch alerts" });
  }
};

const getOperators = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const operators = await prisma.user.findMany({
      where: { role: "OPERATOR", plant: plantAccess(organizationId), ...(req.query.plantId && { plantId: req.query.plantId }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, phone: true, status: true, plantId: true, plant: { select: { id: true, name: true, code: true } } },
    });
    return res.status(200).json({ success: true, count: operators.length, operators });
  } catch (error) {
    console.error("Get Client operators error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch operators" });
  }
};

const createTicket = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const { title, description, priority = "MEDIUM", plantId, imageUrl, alertId } = req.body;
    if (!title?.trim() || !plantId) return res.status(400).json({ success: false, message: "title and plantId are required" });
    if (!priorities.includes(priority)) return res.status(400).json({ success: false, message: "Invalid ticket priority" });
    const plant = await prisma.plant.findFirst({ where: { id: plantId, ...plantAccess(organizationId) }, select: { id: true } });
    if (!plant) return res.status(404).json({ success: false, message: "Plant not found" });
    if (alertId) {
      const alert = await prisma.alert.findFirst({ where: { id: alertId, plantId } });
      if (!alert) return res.status(404).json({ success: false, message: "Alert not found for the selected plant" });
    }
    const ticket = await prisma.ticket.create({
      data: { title: title.trim(), description: description?.trim() || null, imageUrl: imageUrl?.trim() || null, priority, plantId, alertId: alertId || null, createdById: req.user.id },
      include: { plant: { select: { id: true, name: true, code: true } }, assignedEngineer: { select: { id: true, name: true, phone: true, status: true } } },
    });
    return res.status(201).json({ success: true, message: "Ticket created successfully", ticket });
  } catch (error) {
    console.error("Create Client ticket error:", error);
    return res.status(500).json({ success: false, message: "Failed to create ticket" });
  }
};

const getTickets = async (req, res) => {
  try {
    const { status, priority, plantId } = req.query;
    if (status && !ticketStatuses.includes(status)) return res.status(400).json({ success: false, message: "Invalid ticket status" });
    if (priority && !priorities.includes(priority)) return res.status(400).json({ success: false, message: "Invalid ticket priority" });
    const { page, limit, skip } = pagination(req.query);
    const where = { createdById: req.user.id, ...(status && { status }), ...(priority && { priority }), ...(plantId && { plantId }) };
    const [tickets, total] = await prisma.$transaction([
      prisma.ticket.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: {
        plant: { include: { building: { include: { organization: { select: { id: true, name: true } } } } } },
        alert: true, assignedEngineer: { select: { id: true, name: true, email: true, phone: true, status: true } },
      } }),
      prisma.ticket.count({ where }),
    ]);
    return res.status(200).json({ success: true, tickets, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Get Client tickets error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch tickets" });
  }
};

const getTicketById = async (req, res) => {
  try {
    const ticket = await prisma.ticket.findFirst({
      where: { id: req.params.id, createdById: req.user.id },
      include: { plant: { include: { building: { include: { organization: true } } } }, alert: true,
        assignedEngineer: { select: { id: true, name: true, email: true, phone: true, status: true } }, workReports: true },
    });
    if (!ticket) return res.status(404).json({ success: false, message: "Ticket not found" });
    return res.status(200).json({ success: true, ticket });
  } catch (error) {
    console.error("Get Client ticket error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch ticket" });
  }
};

const getManualTests = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const { page, limit, skip } = pagination(req.query);
    const where = { tank: { plant: plantAccess(organizationId) }, ...(req.query.tankId && { tankId: req.query.tankId }) };
    const [manualTestResults, total] = await prisma.$transaction([
      prisma.manualTestResult.findMany({ where, skip, take: limit, orderBy: { testedAt: "desc" }, include: {
        tank: { include: { plant: { select: { id: true, name: true, code: true } } } },
        engineer: { select: { id: true, name: true } }, operator: { select: { id: true, name: true } },
      } }),
      prisma.manualTestResult.count({ where }),
    ]);
    return res.status(200).json({ success: true, manualTestResults, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Get Client manual tests error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch manual tests" });
  }
};

const createManualTest = async (req, res) => {
  try {
    const { tankId, ph, bod, cod, doValue, tss, turbidity, temperature, status } = req.body;
    const numericFields = { ph, bod, cod, doValue, tss, turbidity, temperature };

    if (!tankId || !["GOOD", "WARNING", "CRITICAL"].includes(status)) {
      return res.status(400).json({ success: false, message: "tankId and a valid status are required" });
    }

    const values = {};
    for (const [field, value] of Object.entries(numericFields)) {
      const parsed = Number(value);
      if (value === "" || value === null || value === undefined || !Number.isFinite(parsed)) {
        return res.status(400).json({ success: false, message: `${field} must be a valid number` });
      }
      values[field] = parsed;
    }

    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const tank = await prisma.tank.findFirst({
      where: { id: tankId, plant: { building: { organizationId } } },
      select: { id: true },
    });
    if (!tank) return res.status(404).json({ success: false, message: "Tank not found" });

    const manualTestResult = await prisma.manualTestResult.create({
      data: { ...values, status, tankId },
      include: {
        tank: { include: { plant: { select: { id: true, name: true, code: true } } } },
        engineer: { select: { id: true, name: true } },
        operator: { select: { id: true, name: true } },
      },
    });
    return res.status(201).json({ success: true, message: "Manual test result saved successfully", manualTestResult });
  } catch (error) {
    console.error("Create Client manual test error:", error);
    return res.status(500).json({ success: false, message: "Failed to save manual test result" });
  }
};

const getManualTestById = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const manualTestResult = await prisma.manualTestResult.findFirst({
      where: { id: req.params.id, tank: { plant: plantAccess(organizationId) } },
      include: { tank: { include: { plant: true } }, engineer: { select: { id: true, name: true } }, operator: { select: { id: true, name: true } } },
    });
    if (!manualTestResult) return res.status(404).json({ success: false, message: "Manual test result not found" });
    return res.status(200).json({ success: true, manualTestResult });
  } catch (error) {
    console.error("Get Client manual test error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch manual test" });
  }
};

const getTankerLogs = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const { page, limit, skip } = pagination(req.query);
    const where = { plant: plantAccess(organizationId), ...(req.query.plantId && { plantId: req.query.plantId }) };
    const [tankerLogs, total] = await prisma.$transaction([
      prisma.tankerLog.findMany({ where, skip, take: limit, orderBy: { loggedAt: "desc" }, include: {
        plant: { select: { id: true, name: true, code: true, address: true, city: true, state: true } },
        operator: { select: { id: true, name: true, phone: true } },
      } }),
      prisma.tankerLog.count({ where }),
    ]);
    return res.status(200).json({ success: true, tankerLogs,
      summary: { totalTrips: total, displayedVolume: tankerLogs.reduce((sum, log) => sum + log.volume, 0) },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    console.error("Get Client tanker logs error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch tanker logs" });
  }
};

const getTankerLogById = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const tankerLog = await prisma.tankerLog.findFirst({
      where: { id: req.params.id, plant: plantAccess(organizationId) },
      include: { plant: true, operator: { select: { id: true, name: true, phone: true } } },
    });
    if (!tankerLog) return res.status(404).json({ success: false, message: "Tanker log not found" });
    return res.status(200).json({ success: true, tankerLog });
  } catch (error) {
    console.error("Get Client tanker log error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch tanker log" });
  }
};

const getTankerReceipt = async (req, res) => {
  try {
    const organizationId = requireOrganization(req, res);
    if (!organizationId) return;
    const filename = path.basename(req.params.filename);
    const receiptImageUrl = `/api/operator/tanker-receipts/${filename}`;
    const tankerLog = await prisma.tankerLog.findFirst({
      where: {
        receiptImageUrl,
        plant: plantAccess(organizationId),
      },
      select: { id: true },
    });
    const filePath = path.join(uploadDirectory, filename);
    if (!tankerLog || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Receipt image not found" });
    }
    return res.sendFile(filePath);
  } catch (error) {
    console.error("Get Client tanker receipt error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch receipt image" });
  }
};

module.exports = {
  getDashboard, getProfile, getPlants, getPlantById, getPlantAnalytics, getPlantHistory,
  getAlerts, getOperators, createTicket, getTickets, getTicketById,
  getManualTests, createManualTest, getManualTestById, getTankerLogs, getTankerLogById, getTankerReceipt,
};
