import { sensorReadingRepository } from "@/features/sensor-readings/repositories/sensor-reading.repository";
import { sensorReadingSchema } from "@/features/sensor-readings/schemas/sensor-reading.schema";
import { sensorReadingCsvRowSchema, type SensorReadingCsvImportResult } from "@/features/sensor-readings/schemas/sensor-reading-csv-row.schema";
import { predictionService } from "@/features/predictions/services/prediction.service";
import { ValidationError } from "@/lib/errors";
import { assertMechanicalWorkflowAvailable } from "@/features/predictions/services/legacy-mechanical-gate";

export const sensorReadingService = {
  /**
   * Registra a medição e, em seguida, dispara a predição (seções 19-22).
   * Se a IA estiver indisponível, a leitura permanece salva (nunca perdemos
   * o dado do PCM tradicional) e o erro de integração é repropagado para a
   * UI informar que o serviço preditivo está indisponível (seção 38).
   */
  async recordAndPredict(input: unknown) {
    assertMechanicalWorkflowAvailable();
    const parsed = sensorReadingSchema.safeParse(input);
    if (!parsed.success) {
      throw new ValidationError("Dados da medição inválidos.", parsed.error.flatten().fieldErrors);
    }

    const reading = await sensorReadingRepository.create({
      equipment: { connect: { id: parsed.data.equipmentId } },
      temperature: parsed.data.temperature,
      vibration: parsed.data.vibration,
      pressure: parsed.data.pressure,
      rpm: parsed.data.rpm,
      current: parsed.data.current,
      torque: parsed.data.torque,
      operatingHours: parsed.data.operatingHours,
      airTemperature: parsed.data.airTemperature,
      processTemperature: parsed.data.processTemperature,
      toolWear: parsed.data.toolWear,
      rotationalSpeed: parsed.data.rotationalSpeed,
      source: parsed.data.source,
    });

    const prediction = await predictionService.runPredictionForReading(reading);
    return { reading, prediction };
  },

  /**
   * Importação em lote via CSV (upload de leituras históricas). Ao contrário
   * de `recordAndPredict`, NÃO dispara predição por linha — um backfill de
   * centenas de leituras não deve gerar centenas de chamadas ao serviço de
   * IA nem inundar Predictions/Alerts. Linhas inválidas são reportadas sem
   * derrubar o restante do lote.
   */
  async importCsv(equipmentId: string, rows: unknown[]): Promise<SensorReadingCsvImportResult> {
    assertMechanicalWorkflowAvailable();
    const validRows: { measuredAt: Date; temperature?: number; vibration?: number; pressure?: number; rpm?: number; current?: number; torque?: number; operatingHours?: number }[] = [];
    const errors: { row: number; message: string }[] = [];

    rows.forEach((row, index) => {
      const parsed = sensorReadingCsvRowSchema.safeParse(row);
      if (!parsed.success) {
        errors.push({ row: index + 2, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
        return;
      }
      validRows.push(parsed.data);
    });

    if (validRows.length > 0) {
      await sensorReadingRepository.createManyForEquipment(equipmentId, validRows);
    }

    return { imported: validRows.length, errors };
  },
};
