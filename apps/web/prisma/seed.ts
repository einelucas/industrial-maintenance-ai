import { PrismaClient, type UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SYSTEM_USER_EMAIL } from "../src/lib/constants";
import { seedThermalScenario } from "../src/lib/thermal-simulation/seed-thermal-scenario";

// Seed técnico do domínio termográfico (GPMS 2026 / Etapa 2). Cria apenas
// estrutura, usuários de demonstração e telemetria sintética persistida pelo
// simulador determinístico — nunca `Prediction`, `ThermalIncident`, alerta de
// risco ou `WorkOrder` preditiva: esses registros só podem nascer de uma
// inferência real da IA (etapas futuras). O antigo cenário mecânico (motores,
// bombas, compressor, redutor, ventilador, caldeira e leituras de
// vibração/RPM/torque) foi removido daqui por ser incompatível com o desafio;
// os campos/rotas que ainda o utilizam (Etapa 1) permanecem intactos no
// schema, apenas não são mais alimentados por este seed.

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
  console.log("Seeding — domínio termográfico GPMS 2026 (Etapa 2)...");

  // --- Usuários de demonstração ---
  const admin = await upsertUser("Administrador Demo", "admin@pcm.local", "ADMIN", "admin123");
  const planner = await upsertUser("Planejador Demo", "planejador@pcm.local", "PLANNER", "planner123");
  const technician = await upsertUser("Técnico Demo", "tecnico@pcm.local", "TECHNICIAN", "tecnico123");
  const manager = await upsertUser("Gestor Demo", "gestor@pcm.local", "MANAGER", "gestor123");
  // Conta de sistema (desabilitada, usada apenas como autor técnico de jobs agendados).
  // Senha fixa e determinística: a conta nunca autentica (active = false).
  await upsertUser("Sistema (Agendador)", SYSTEM_USER_EMAIL, "ADMIN", `system-account-${SYSTEM_USER_EMAIL}`, false);

  // --- Faixas de risco do fluxo mecânico legado (Etapa 1) — preservadas, não fazem parte do domínio térmico ---
  await prisma.riskThresholdConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", lowMax: 0.3, moderateMax: 0.6, highMax: 0.8 },
  });

  // --- Cenário termográfico determinístico (planta + 55 pontos + séries persistidas) ---
  const scenario = await seedThermalScenario(prisma);

  console.log("Cenário termográfico persistido:");
  console.log(`  Setores: ${scenario.sectors}`);
  console.log(`  Equipamentos: ${scenario.equipments}`);
  console.log(`  Painéis elétricos: ${scenario.panels}`);
  console.log(`  Componentes monitorados: ${scenario.components}`);
  console.log(`  Pontos termográficos: ${scenario.points}`);
  console.log(`  Dispositivos virtuais: ${scenario.devices}`);
  console.log(`  Leituras inseridas nesta execução: ${scenario.readingsInserted}`);
  console.log(`  Pontos já semeados anteriormente (idempotência): ${scenario.skippedExistingPoints}`);
  console.log(`  Manifesto (ground truth, fora do runtime): ${scenario.manifestPath}`);

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
