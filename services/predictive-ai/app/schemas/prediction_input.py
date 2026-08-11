from pydantic import BaseModel, Field, field_validator


class RiskThresholds(BaseModel):
    """Faixas de risco configuráveis via UI (seção 23) — enviadas pelo
    Next.js a cada chamada, já que este serviço não tem acesso a banco de
    dados algum. Quando ausentes, `classify_risk` usa RISK_THRESHOLDS
    hardcoded como fallback."""

    low_max: float = Field(..., alias="lowMax", gt=0, lt=1)
    moderate_max: float = Field(..., alias="moderateMax", gt=0, lt=1)
    high_max: float = Field(..., alias="highMax", gt=0, lt=1)

    model_config = {"populate_by_name": True}


class PredictionInput(BaseModel):
    """Entrada para o endpoint de predição de falha.

    Nem toda medição é obrigatória: cada equipamento pode ter um conjunto
    diferente de sensores disponíveis (ver seção 7 do escopo). O Predictor
    decide internamente como lidar com valores ausentes.
    """

    equipment_id: str = Field(..., alias="equipmentId", min_length=1)

    air_temperature: float | None = Field(default=None, alias="airTemperature")
    process_temperature: float | None = Field(default=None, alias="processTemperature")
    temperature: float | None = Field(default=None, alias="temperature")
    rotational_speed: float | None = Field(default=None, alias="rotationalSpeed")
    rpm: float | None = Field(default=None, alias="rpm")
    torque: float | None = Field(default=None, alias="torque")
    tool_wear: float | None = Field(default=None, alias="toolWear")
    vibration: float | None = Field(default=None, alias="vibration")
    pressure: float | None = Field(default=None, alias="pressure")
    current: float | None = Field(default=None, alias="current")
    operating_hours: float | None = Field(default=None, alias="operatingHours")

    thresholds: RiskThresholds | None = Field(default=None, alias="thresholds")

    model_config = {"populate_by_name": True}

    @field_validator(
        "air_temperature",
        "process_temperature",
        "temperature",
        "rotational_speed",
        "rpm",
        "torque",
        "tool_wear",
        "vibration",
        "pressure",
        "current",
        "operating_hours",
    )
    @classmethod
    def must_not_be_negative(cls, value: float | None) -> float | None:
        if value is not None and value < 0:
            raise ValueError("Medições de sensor não podem ser negativas.")
        return value

    def has_any_feature(self) -> bool:
        feature_values = self.model_dump(exclude={"equipment_id", "thresholds"}).values()
        return any(value is not None for value in feature_values)
