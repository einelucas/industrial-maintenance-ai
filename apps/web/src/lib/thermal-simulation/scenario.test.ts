import { describe, expect, it } from "vitest";
import { buildDemoScenario, buildReservedScenarioManifest, DEMO_IDENTITY_SEED, DEMO_SERIES_SEED } from "./scenario";
import { buildPlantBlueprint } from "./plant-blueprint";
import { SAMPLES_PER_POINT } from "./thermal-series";

describe("buildPlantBlueprint", () => {
  it("gera exatamente 55 pontos termográficos", () => {
    const blueprint = buildPlantBlueprint(DEMO_IDENTITY_SEED);
    expect(blueprint.points).toHaveLength(55);
  });

  it("gera exatamente 19 pontos marcados como originalmente anormais", () => {
    const blueprint = buildPlantBlueprint(DEMO_IDENTITY_SEED);
    expect(blueprint.points.filter((p) => p.initiallyAnomalous)).toHaveLength(19);
  });

  it("gera códigos TP-001 a TP-055 únicos e sequenciais", () => {
    const blueprint = buildPlantBlueprint(DEMO_IDENTITY_SEED);
    const codes = blueprint.points.map((p) => p.code);
    expect(new Set(codes).size).toBe(55);
    expect(codes[0]).toBe("TP-001");
    expect(codes[54]).toBe("TP-055");
    for (let i = 1; i <= 55; i++) {
      expect(codes).toContain(`TP-${String(i).padStart(3, "0")}`);
    }
  });

  it("cria mais de 20 centrífugas", () => {
    const blueprint = buildPlantBlueprint(DEMO_IDENTITY_SEED);
    const centrifugas = blueprint.equipments.filter((e) => e.category === "CENTRIFUGA");
    expect(centrifugas.length).toBeGreaterThan(20);
  });

  it("cria autoclaves, estufas e câmaras frias", () => {
    const blueprint = buildPlantBlueprint(DEMO_IDENTITY_SEED);
    expect(blueprint.equipments.some((e) => e.category === "AUTOCLAVE")).toBe(true);
    expect(blueprint.equipments.some((e) => e.category === "ESTUFA")).toBe(true);
    expect(blueprint.equipments.some((e) => e.category === "CAMARA_FRIA")).toBe(true);
  });

  it("todo ponto referencia um componente existente, e todo componente um painel existente", () => {
    const blueprint = buildPlantBlueprint(DEMO_IDENTITY_SEED);
    const componentTags = new Set(blueprint.components.map((c) => c.tag));
    const panelTags = new Set(blueprint.panels.map((p) => p.tag));
    for (const point of blueprint.points) {
      expect(componentTags.has(point.componentTag)).toBe(true);
    }
    for (const component of blueprint.components) {
      expect(panelTags.has(component.panelTag)).toBe(true);
    }
  });

  it("marca exatamente um ponto como caso crítico oficial, e ele está entre os anômalos", () => {
    const blueprint = buildPlantBlueprint(DEMO_IDENTITY_SEED);
    const critical = blueprint.points.filter((p) => p.isOfficialCriticalCase);
    expect(critical).toHaveLength(1);
    expect(critical[0]!.initiallyAnomalous).toBe(true);
    expect(blueprint.officialCriticalPointCode).toBe(critical[0]!.code);
  });

  it("é determinístico: duas chamadas com o mesmo seed produzem o mesmo blueprint", () => {
    const a = buildPlantBlueprint(DEMO_IDENTITY_SEED);
    const b = buildPlantBlueprint(DEMO_IDENTITY_SEED);
    expect(a).toEqual(b);
  });
});

describe("buildDemoScenario — séries temporais", () => {
  it("gera SAMPLES_PER_POINT leituras persistidas por ponto, em ordem cronológica", () => {
    const scenario = buildDemoScenario();
    for (const point of scenario.blueprint.points) {
      const series = scenario.seriesByPointCode.get(point.code)!;
      expect(series.persisted).toHaveLength(SAMPLES_PER_POINT);
      for (let i = 1; i < series.persisted.length; i++) {
        expect(series.persisted[i]!.measuredAt.getTime()).toBeGreaterThan(series.persisted[i - 1]!.measuredAt.getTime());
        expect(series.persisted[i]!.sequence).toBe(series.persisted[i - 1]!.sequence + 1);
      }
    }
  });

  it("o caso crítico oficial alcança exatamente 75.6 °C no pico", () => {
    const scenario = buildDemoScenario();
    const series = scenario.seriesByPointCode.get(scenario.blueprint.officialCriticalPointCode)!;
    const peak = series.persisted[series.persisted.length - 1]!;
    expect(peak.temperatureMaxC).toBe(75.6);
  });

  it("a referência do caso crítico é exatamente 40.0 °C", () => {
    const scenario = buildDemoScenario();
    const series = scenario.seriesByPointCode.get(scenario.blueprint.officialCriticalPointCode)!;
    const peak = series.persisted[series.persisted.length - 1]!;
    expect(peak.referenceTemperatureC).toBe(40.0);
  });

  it("o deltaT calculado do caso crítico é exatamente 35.6 °C", () => {
    const scenario = buildDemoScenario();
    const series = scenario.seriesByPointCode.get(scenario.blueprint.officialCriticalPointCode)!;
    const peak = series.persisted[series.persisted.length - 1]!;
    expect(peak.deltaTC).toBeCloseTo(35.6, 5);
  });

  it("o pico do caso crítico é o resultado de uma evolução plausível, não de uma leitura isolada", () => {
    const scenario = buildDemoScenario();
    const series = scenario.seriesByPointCode.get(scenario.blueprint.officialCriticalPointCode)!;
    const firstReading = series.persisted[0]!;
    const midReading = series.persisted[Math.floor(series.persisted.length / 2)]!;
    const peak = series.persisted[series.persisted.length - 1]!;
    expect(firstReading.temperatureMaxC).toBeLessThan(midReading.temperatureMaxC);
    expect(midReading.temperatureMaxC).toBeLessThan(peak.temperatureMaxC);
  });

  it("mantém uma fase de normalização reservada apenas para o caso crítico, separada da série persistida", () => {
    const scenario = buildDemoScenario();
    for (const point of scenario.blueprint.points) {
      const series = scenario.seriesByPointCode.get(point.code)!;
      if (point.isOfficialCriticalCase) {
        expect(series.reservedPostAction).toBeDefined();
        expect(series.reservedPostAction!.length).toBeGreaterThan(0);
        expect(series.reservedPostAction![0]!.temperatureMaxC).toBeLessThan(75.6);
      } else {
        expect(series.reservedPostAction).toBeUndefined();
      }
    }
  });

  it("pontos não marcados como anômalos não desenvolvem degradação progressiva", () => {
    const scenario = buildDemoScenario();
    const normalPoint = scenario.blueprint.points.find((p) => !p.initiallyAnomalous)!;
    const series = scenario.seriesByPointCode.get(normalPoint.code)!;
    const first = series.persisted[0]!.temperatureMaxC;
    const last = series.persisted[series.persisted.length - 1]!.temperatureMaxC;
    expect(Math.abs(last - first)).toBeLessThan(8);
  });

  it("é determinístico: duas chamadas com os mesmos seeds produzem séries idênticas", () => {
    const a = buildDemoScenario(DEMO_IDENTITY_SEED, DEMO_SERIES_SEED);
    const b = buildDemoScenario(DEMO_IDENTITY_SEED, DEMO_SERIES_SEED);
    expect([...a.seriesByPointCode.entries()]).toEqual([...b.seriesByPointCode.entries()]);
  });

  it("seeds diferentes produzem cenários diferentes (a seed realmente controla o resultado)", () => {
    const a = buildDemoScenario(DEMO_IDENTITY_SEED, DEMO_SERIES_SEED);
    const b = buildDemoScenario(DEMO_IDENTITY_SEED, DEMO_SERIES_SEED + 1);
    const aValues = a.seriesByPointCode.get("TP-001")!.persisted.map((r) => r.temperatureMaxC);
    const bValues = b.seriesByPointCode.get("TP-001")!.persisted.map((r) => r.temperatureMaxC);
    // Comparar a série inteira em vez de uma única leitura: arredondamento a
    // 0.1 °C pode coincidir isoladamente em um índice sem que as séries sejam
    // de fato iguais.
    expect(aValues).not.toEqual(bValues);
  });
});

describe("buildReservedScenarioManifest", () => {
  it("registra seed, versão, período e o caso crítico esperado", () => {
    const scenario = buildDemoScenario();
    const manifest = buildReservedScenarioManifest(scenario);

    expect(manifest.generatedFrom.identitySeed).toBe(DEMO_IDENTITY_SEED);
    expect(manifest.generatedFrom.seriesSeed).toBe(DEMO_SERIES_SEED);
    expect(manifest.totalPoints).toBe(55);
    expect(manifest.initiallyAnomalousCount).toBe(19);
    expect(manifest.officialCriticalCase.peak.temperatureMaxC).toBe(75.6);
    expect(manifest.officialCriticalCase.peak.referenceTemperatureC).toBe(40.0);
    expect(manifest.officialCriticalCase.peak.deltaTC).toBeCloseTo(35.6, 5);
    expect(manifest.officialCriticalCase.reservedPostAction.readings.length).toBeGreaterThan(0);
    expect(manifest.trainingUsage).toMatch(/reservado/i);
  });

  it("é determinístico e serializável em JSON", () => {
    const scenario = buildDemoScenario();
    const manifest = buildReservedScenarioManifest(scenario);
    const serialized = JSON.parse(JSON.stringify(manifest));
    expect(serialized.totalPoints).toBe(55);
  });
});
