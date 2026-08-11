import { PrismaClient, type UserRole, type EquipmentCriticality, type WorkOrderType, type WorkOrderPriority, type RiskLevel } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SYSTEM_USER_EMAIL } from "../src/lib/constants";

const prisma = new PrismaClient();

async function upsertUser(name: string, email: string, role: UserRole, password: string, active = true) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { name, email, role, passwordHash, active },
  });
}

async function main() {
  console.log("Seeding — dados fictícios de demonstração...");

  // --- Usuários (seção 34) ---
  const admin = await upsertUser("Administrador Demo", "admin@pcm.local", "ADMIN", "admin123");
  const planner = await upsertUser("Planejador Demo", "planejador@pcm.local", "PLANNER", "planner123");
  const technician = await upsertUser("Técnico Demo", "tecnico@pcm.local", "TECHNICIAN", "tecnico123");
  const manager = await upsertUser("Gestor Demo", "gestor@pcm.local", "MANAGER", "gestor123");
  await upsertUser("Sistema (Agendador)", SYSTEM_USER_EMAIL, "ADMIN", Math.random().toString(36), false);

  // --- Faixas de risco (valores padrão, iguais ao RISK_THRESHOLDS hardcoded do FastAPI) ---
  await prisma.riskThresholdConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", lowMax: 0.3, moderateMax: 0.6, highMax: 0.8 },
  });

  // --- Setores ---
  const sectorNames = ["Utilidades", "Produção", "Moagem", "Caldeira", "Expedição"];
  const sectors = [];
  for (const name of sectorNames) {
    const sector = await prisma.sector.upsert({
      where: { id: `seed-sector-${name}` },
      update: {},
      create: { id: `seed-sector-${name}`, name, description: `Setor de ${name} (dado fictício de demonstração).` },
    });
    sectors.push(sector);
  }

  // --- Equipamentos (fictícios) ---
  const equipmentSeeds: {
    tag: string; name: string; category: string; criticality: EquipmentCriticality; sectorIndex: number;
  }[] = [
    { tag: "MTR-001", name: "Motor de Indução 50cv", category: "Motor", criticality: "HIGH", sectorIndex: 1 },
    { tag: "MTR-002", name: "Motor de Indução 100cv", category: "Motor", criticality: "CRITICAL", sectorIndex: 2 },
    { tag: "BMB-001", name: "Bomba Centrífuga A", category: "Bomba", criticality: "MEDIUM", sectorIndex: 0 },
    { tag: "BMB-002", name: "Bomba Centrífuga B", category: "Bomba", criticality: "HIGH", sectorIndex: 0 },
    { tag: "CMP-001", name: "Compressor de Ar Parafuso", category: "Compressor", criticality: "CRITICAL", sectorIndex: 0 },
    { tag: "RED-001", name: "Redutor de Velocidade", category: "Redutor", criticality: "MEDIUM", sectorIndex: 2 },
    { tag: "VNT-001", name: "Ventilador Industrial", category: "Ventilador", criticality: "LOW", sectorIndex: 3 },
    { tag: "CLD-001", name: "Caldeira Aquatubular", category: "Caldeira", criticality: "CRITICAL", sectorIndex: 3 },
    { tag: "MTR-003", name: "Motor de Esteira Transportadora", category: "Motor", criticality: "MEDIUM", sectorIndex: 4 },
    { tag: "BMB-003", name: "Bomba de Alimentação", category: "Bomba", criticality: "HIGH", sectorIndex: 3 },
  ];

  const equipments = [];
  for (const seed of equipmentSeeds) {
    const equipment = await prisma.equipment.upsert({
      where: { tag: seed.tag },
      update: {},
      create: {
        tag: seed.tag,
        name: seed.name,
        category: seed.category,
        criticality: seed.criticality,
        status: "OPERATIONAL",
        manufacturer: "Fabricante Fictício Ltda.",
        model: `MOD-${seed.tag}`,
        location: sectors[seed.sectorIndex]!.name,
        sectorId: sectors[seed.sectorIndex]!.id,
        installationDate: new Date(2020, seed.sectorIndex, 1),
      },
    });
    equipments.push(equipment);
  }

  // --- Ordens de serviço (15 no total, variadas) ---
  const woTypes: WorkOrderType[] = ["CORRECTIVE", "PREVENTIVE", "PREDICTIVE", "INSPECTION", "IMPROVEMENT"];
  const woPriorities: WorkOrderPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  const woStatuses = ["OPEN", "PLANNED", "IN_PROGRESS", "COMPLETED", "COMPLETED", "CANCELED"] as const;

  for (let i = 0; i < 15; i++) {
    const equipment = equipments[i % equipments.length]!;
    const type = woTypes[i % woTypes.length]!;
    const priority = woPriorities[i % woPriorities.length]!;
    const status = woStatuses[i % woStatuses.length];
    const number = `OS-${new Date().getFullYear()}-${String(i + 1).padStart(4, "0")}`;

    const scheduledStart = new Date();
    scheduledStart.setDate(scheduledStart.getDate() - 20 + i * 2);
    const scheduledEnd = new Date(scheduledStart);
    scheduledEnd.setDate(scheduledEnd.getDate() + 2);

    const isCompleted = status === "COMPLETED";

    const existing = await prisma.workOrder.findUnique({ where: { number } });
    if (existing) continue;

    await prisma.workOrder.create({
      data: {
        number,
        title: `${type === "CORRECTIVE" ? "Reparo" : type === "PREVENTIVE" ? "Manutenção preventiva" : type === "PREDICTIVE" ? "Investigação preditiva" : type === "INSPECTION" ? "Inspeção de rotina" : "Melhoria"} — ${equipment.tag}`,
        description: "Ordem de serviço fictícia gerada pelo seed de demonstração.",
        type,
        priority,
        status,
        equipmentId: equipment.id,
        createdById: planner.id,
        assignedUserId: technician.id,
        scheduledStart,
        scheduledEnd,
        actualStart: isCompleted ? scheduledStart : undefined,
        actualEnd: isCompleted ? scheduledEnd : undefined,
        estimatedHours: 4,
        actualHours: isCompleted ? 4.5 : undefined,
        history: {
          create: {
            userId: planner.id,
            action: "CREATED",
            newStatus: "OPEN",
            description: "OS criada pelo seed.",
          },
        },
      },
    });
  }

  // --- Planos preventivos (4) ---
  const planSeeds = [
    { name: "Lubrificação mensal", equipment: equipments[0]!, frequencyType: "MONTHLY" as const },
    { name: "Inspeção trimestral de vibração", equipment: equipments[1]!, frequencyType: "QUARTERLY" as const },
    { name: "Troca de filtros do compressor", equipment: equipments[4]!, frequencyType: "SEMIANNUAL" as const },
    { name: "Verificação de segurança da caldeira", equipment: equipments[7]!, frequencyType: "MONTHLY" as const },
  ];

  for (const seed of planSeeds) {
    const next = new Date();
    next.setDate(next.getDate() + 15);

    const existing = await prisma.maintenancePlan.findFirst({ where: { name: seed.name, equipmentId: seed.equipment.id } });
    if (existing) continue;

    await prisma.maintenancePlan.create({
      data: {
        name: seed.name,
        description: "Plano preventivo fictício de demonstração.",
        equipmentId: seed.equipment.id,
        frequencyType: seed.frequencyType,
        frequencyValue: 1,
        nextExecution: next,
        estimatedHours: 3,
        defaultAssigneeId: technician.id,
        checklistItems: {
          create: [
            { description: "Verificar temperatura de operação", order: 0 },
            { description: "Verificar vazamentos", order: 1 },
            { description: "Registrar leitura de vibração", order: 2 },
          ],
        },
      },
    });
  }

  // --- Leituras históricas + Predições (fallback DEMO, sem chamar o FastAPI) + Alertas ---
  const riskProfiles: { level: RiskLevel; probability: number }[] = [
    { level: "LOW", probability: 0.12 },
    { level: "MODERATE", probability: 0.45 },
    { level: "HIGH", probability: 0.68 },
    { level: "CRITICAL", probability: 0.87 },
  ];

  for (let i = 0; i < equipments.length; i++) {
    const equipment = equipments[i]!;
    const profile = riskProfiles[i % riskProfiles.length]!;

    for (let day = 5; day >= 0; day--) {
      const measuredAt = new Date();
      measuredAt.setDate(measuredAt.getDate() - day);

      const reading = await prisma.sensorReading.create({
        data: {
          equipmentId: equipment.id,
          temperature: 40 + profile.probability * 50 + Math.random() * 5,
          vibration: 1 + profile.probability * 8 + Math.random(),
          pressure: 3 + profile.probability * 6 + Math.random(),
          rpm: 1400 + profile.probability * 600,
          current: 10 + profile.probability * 15,
          torque: 20 + profile.probability * 40,
          operatingHours: 500 + day * 100,
          measuredAt,
          source: "SIMULATOR",
        },
      });

      const jitter = (Math.random() - 0.5) * 0.05;
      const probability = Math.min(0.98, Math.max(0.02, profile.probability + jitter));

      const prediction = await prisma.prediction.create({
        data: {
          equipmentId: equipment.id,
          failureProbability: Math.round(probability * 1000) / 1000,
          riskLevel: profile.level,
          predictedClass: probability >= 0.5 ? 1 : 0,
          modelVersion: "seed-demo-0.0.0",
          inputSnapshot: { sensorReadingId: reading.id },
          featuresUsed: ["temperature", "vibration", "pressure", "rpm", "current", "operatingHours"],
          createdAt: measuredAt,
        },
      });

      if (day === 0 && (profile.level === "HIGH" || profile.level === "CRITICAL")) {
        const existingAlert = await prisma.alert.findUnique({ where: { predictionId: prediction.id } });
        if (!existingAlert) {
          await prisma.alert.create({
            data: {
              equipmentId: equipment.id,
              predictionId: prediction.id,
              type: "PREDICTIVE_RISK",
              severity: profile.level,
              status: "OPEN",
              title: `Risco ${profile.level === "CRITICAL" ? "crítico" : "elevado"} de falha detectado`,
              description: `Probabilidade de falha: ${(probability * 100).toFixed(1)}%. Dado fictício de demonstração.`,
            },
          });
        }
      }
    }
  }

  console.log("Seed concluído com sucesso.");
  console.log("Usuários de demonstração:");
  console.log(`  ADMIN:      ${admin.email} / admin123`);
  console.log(`  PLANNER:    ${planner.email} / planner123`);
  console.log(`  TECHNICIAN: ${technician.email} / tecnico123`);
  console.log(`  MANAGER:    ${manager.email} / gestor123`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
