import { describe, expect, it } from "vitest";
import { parseCsvReadings, CsvHeaderError } from "./csv-reading-parser";

const HEADER = "codigoPonto,dataHoraMedicao,temperaturaMaximaC,temperaturaReferenciaC";

describe("parseCsvReadings", () => {
  it("aceita um CSV válido separado por vírgula", () => {
    const csv = [HEADER, "TP-001,2026-09-01T12:00:00.000Z,75.6,40"].join("\n");
    const result = parseCsvReadings(csv);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.prepared).toHaveLength(1);
    expect(result.prepared[0]).toMatchObject({ thermalPointCode: "TP-001", temperatureMaxC: 75.6, referenceTemperatureC: 40 });
  });

  it("detecta e aceita separador ponto e vírgula", () => {
    const header = "codigoPonto;dataHoraMedicao;temperaturaMaximaC";
    const csv = [header, "TP-002;2026-09-01T12:00:00.000Z;60.0"].join("\n");
    const result = parseCsvReadings(csv);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.prepared[0]?.thermalPointCode).toBe("TP-002");
  });

  it("remove o BOM UTF-8 do início do arquivo", () => {
    const csv = "﻿" + [HEADER, "TP-001,2026-09-01T12:00:00.000Z,75.6,40"].join("\n");
    const result = parseCsvReadings(csv);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.prepared).toHaveLength(1);
  });

  it("trata célula vazia como ausência, nunca como zero", () => {
    const csv = [HEADER, "TP-001,2026-09-01T12:00:00.000Z,75.6,"].join("\n");
    const result = parseCsvReadings(csv);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.prepared[0]?.referenceTemperatureC).toBeUndefined();
  });

  it("lança CsvHeaderError quando falta coluna obrigatória", () => {
    const csv = ["codigoPonto,temperaturaMaximaC", "TP-001,75.6"].join("\n");
    expect(() => parseCsvReadings(csv)).toThrow(CsvHeaderError);
  });

  it("processa o restante do arquivo mesmo com uma linha inválida no meio (importação parcial)", () => {
    const csv = [
      HEADER,
      "TP-001,2026-09-01T12:00:00.000Z,75.6,40",
      "TP-002,2026-09-01T13:00:00.000Z,NaN,40",
      "TP-003,2026-09-01T14:00:00.000Z,50.0,40",
    ].join("\n");
    const result = parseCsvReadings(csv);
    expect(result.totalDataRows).toBe(3);
    expect(result.prepared).toHaveLength(2);
    expect(result.parseErrors).toHaveLength(1);
    expect(result.parseErrors[0]?.rowNumber).toBe(3);
  });

  it("aceita colunas em ordem diferente da documentada", () => {
    const header = "temperaturaMaximaC,dataHoraMedicao,codigoPonto";
    const csv = [header, "75.6,2026-09-01T12:00:00.000Z,TP-001"].join("\n");
    const result = parseCsvReadings(csv);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.prepared[0]?.thermalPointCode).toBe("TP-001");
  });

  it("devolve vazio para um arquivo sem linhas de dados", () => {
    const result = parseCsvReadings(HEADER);
    expect(result.totalDataRows).toBe(0);
    expect(result.prepared).toHaveLength(0);
  });
});
