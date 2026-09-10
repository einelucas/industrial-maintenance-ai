import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/db/client";
import { sensorDeviceRepository, type SensorDeviceFilters } from "@/features/sensor-devices/repositories/sensor-device.repository";
import {
  sensorDeviceProvisionSchema,
  type SensorDeviceProvisionInput,
} from "@/features/sensor-devices/schemas/sensor-device.schema";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

/**
 * Gera uma credencial criptograficamente forte (32 bytes de `crypto.randomBytes`,
 * nunca `Math.random()`) e devolve o par texto puro/hash. O texto puro só
 * pode ser retornado UMA VEZ, no momento da criação — nunca persistido, nunca
 * logado, nunca registrado em auditoria.
 */
function generateApiKey() {
  const plaintext = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

async function assertThermalPointActive(thermalPointId: string) {
  const point = await prisma.thermalPoint.findUnique({ where: { id: thermalPointId } });
  if (!point) throw new ValidationError("Ponto termográfico não encontrado.", { thermalPointId: ["Ponto inválido."] });
  if (!point.active) {
    throw new ValidationError("Não é possível provisionar um dispositivo para um ponto inativo.", {
      thermalPointId: ["Ponto inativo."],
    });
  }
  return point;
}

function parseInput(input: unknown): SensorDeviceProvisionInput {
  const parsed = sensorDeviceProvisionSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Dados do dispositivo inválidos.", parsed.error.flatten().fieldErrors);
  }
  return parsed.data;
}

export const sensorDeviceService = {
  listFiltered: (filters: SensorDeviceFilters) => sensorDeviceRepository.findFiltered(filters),

  async getOrThrow(id: string) {
    const device = await sensorDeviceRepository.findById(id);
    if (!device) throw new NotFoundError("Dispositivo", id);
    return device;
  },

  /**
   * Provisiona um dispositivo administrável e retorna a credencial em texto
   * puro APENAS nesta resposta — o chamador (action) é responsável por
   * exibi-la uma única vez e nunca gravá-la em log/auditoria.
   */
  async provision(input: unknown) {
    const data = parseInput(input);

    const existing = await sensorDeviceRepository.findBySerialNumber(data.serialNumber);
    if (existing) throw new ConflictError(`Já existe um dispositivo com o número de série "${data.serialNumber}".`);

    await assertThermalPointActive(data.thermalPointId);

    const { plaintext, hash } = generateApiKey();

    const device = await sensorDeviceRepository.create({
      serialNumber: data.serialNumber,
      name: data.name,
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      firmwareVersion: data.firmwareVersion || null,
      thermalPointId: data.thermalPointId,
      apiKeyHash: hash,
      status: "PROVISIONING",
      credentialRotatedAt: new Date(),
    });

    return { device, apiKey: plaintext };
  },

  /** Revoga a credencial atual — estado DISABLED, `disabledAt` preenchido. Não é reversível por reativação simples. */
  async revoke(id: string) {
    await this.getOrThrow(id);
    return sensorDeviceRepository.update(id, { status: "DISABLED", disabledAt: new Date() });
  },

  /**
   * Política de reativação: um dispositivo revogado só volta a operar
   * gerando uma credencial NOVA (nunca reaproveitando o hash antigo, que
   * pode ter sido comprometido) — por isso "reativar" aqui é sinônimo de
   * reprovisionar.
   */
  async reprovision(id: string) {
    await this.getOrThrow(id);
    const { plaintext, hash } = generateApiKey();
    const device = await sensorDeviceRepository.update(id, {
      apiKeyHash: hash,
      status: "PROVISIONING",
      disabledAt: null,
      credentialVersion: { increment: 1 },
      credentialRotatedAt: new Date(),
      consecutiveAuthFailures: 0,
      lastAuthFailureAt: null,
    });
    return { device, apiKey: plaintext };
  },

  async setMaintenance(id: string, maintenance: boolean) {
    const device = await this.getOrThrow(id);
    if (device.status === "DISABLED") throw new ValidationError("Dispositivo revogado deve ser reprovisionado antes de mudar de estado.");
    return sensorDeviceRepository.update(id, { status: maintenance ? "MAINTENANCE" : "PROVISIONING" });
  },

  /**
   * Função de domínio pura e testável (preparada para a Etapa 9): um
   * dispositivo só está autorizado a enviar telemetria para o
   * `thermalPointId` ao qual foi provisionado — nunca para outro ponto,
   * mesmo com uma credencial válida — e apenas enquanto seu status não for
   * `DISABLED` (credencial revogada) nem `MAINTENANCE` (fora de operação
   * deliberadamente). `PROVISIONING`, `ONLINE`, `OFFLINE` e `DEGRADED`
   * continuam autorizados: um dispositivo recém-provisionado precisa poder
   * autenticar a primeira vez para sair de `PROVISIONING`.
   */
  isAuthorizedForPoint(device: { thermalPointId: string; status: string }, requestedThermalPointId: string): boolean {
    if (device.thermalPointId !== requestedThermalPointId) return false;
    return device.status !== "DISABLED" && device.status !== "MAINTENANCE";
  },
};
