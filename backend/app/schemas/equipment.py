import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class PanelSpecs(BaseModel):
    pmax_w: float = Field(gt=0, le=1000, description="Puissance max en Watt")
    voc_v: float = Field(gt=0, le=100, description="Tension circuit ouvert")
    vmp_v: float = Field(gt=0, le=100, description="Tension au point max")
    isc_a: float = Field(gt=0, le=30, description="Courant de court-circuit")
    imp_a: float = Field(gt=0, le=30, description="Courant au point max")
    efficiency_pct: float = Field(gt=0, le=30, description="Rendement %")
    temp_coeff_pmax_pct_per_c: float = Field(description="Coeff temp Pmax (%/°C)")
    temp_coeff_voc_pct_per_c: float = Field(description="Coeff temp Voc (%/°C)")
    temp_coeff_isc_pct_per_c: float = Field(description="Coeff temp Isc (%/°C)")
    noct_c: float = Field(default=45, description="NOCT en °C")
    cells: int = Field(gt=0, description="Nombre de cellules")
    cell_type: str = Field(default="mono-PERC")
    dimensions_mm: dict = Field(description="Dimensions {length, width, height}")
    weight_kg: float = Field(gt=0)
    warranty_years: int = Field(default=25, gt=0)

    @model_validator(mode="after")
    def validate_electrical_coherence(self):
        if self.vmp_v >= self.voc_v:
            raise ValueError("Vmp doit être inférieur à Voc")
        if self.imp_a >= self.isc_a:
            raise ValueError("Imp doit être inférieur à Isc")
        return self


class InverterSpecs(BaseModel):
    # DC Input
    max_pv_power_kw: float = Field(gt=0)
    max_pv_voltage_v: float = Field(gt=0)
    startup_voltage_v: float = Field(gt=0)
    mppt_voltage_range_v: str = Field(description="Plage MPPT ex: '80-550'")
    rated_pv_voltage_v: float = Field(gt=0)
    max_input_current_a: float = Field(gt=0)
    max_short_circuit_current_a: float = Field(gt=0)
    num_mppt: int = Field(gt=0)
    strings_per_mppt: int = Field(gt=0, default=1)

    # AC Output
    rated_ac_power_kw: float = Field(gt=0)
    max_ac_apparent_kva: float = Field(gt=0)
    rated_ac_current_a: float = Field(gt=0)
    max_ac_current_a: float = Field(gt=0)
    rated_output_voltage_v: float = Field(default=230)
    rated_output_freq_hz: float = Field(default=50)
    output_freq_range_hz: str = Field(default="45-55")
    power_factor_range: str = Field(default="0.8 leading - 0.8 lagging")
    thdi_pct: float = Field(ge=0, le=10)
    dc_injection_ma: float = Field(default=10)

    # Efficiency
    max_efficiency_pct: float = Field(gt=0, le=100)
    euro_efficiency_pct: float = Field(gt=0, le=100)
    mppt_efficiency_pct: float = Field(gt=0, le=100)

    # Physical
    protection: dict | None = None
    dimensions_mm: dict = Field(description="Dimensions {width, height, depth}")
    weight_kg: float = Field(gt=0)
    ip_rating: str = Field(default="IP65")
    warranty_years: int = Field(default=10, gt=0)


class EquipmentCreate(BaseModel):
    type: str = Field(pattern=r"^(panel|inverter)$")
    manufacturer: str = Field(min_length=1, max_length=255)
    model: str = Field(min_length=1, max_length=255)
    specs: dict
    is_global: bool = False

    @model_validator(mode="after")
    def validate_specs_by_type(self):
        if self.type == "panel":
            PanelSpecs(**self.specs)
        elif self.type == "inverter":
            InverterSpecs(**self.specs)
        return self


class EquipmentUpdate(BaseModel):
    type: str | None = Field(default=None, pattern=r"^(panel|inverter)$")
    manufacturer: str | None = Field(default=None, min_length=1, max_length=255)
    model: str | None = None
    specs: dict | None = None
    is_global: bool | None = None


class EquipmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner_id: uuid.UUID | None = None
    type: str
    manufacturer: str
    model: str
    specs: dict
    is_global: bool
    created_at: datetime
    updated_at: datetime


class PaginatedEquipmentResponse(BaseModel):
    items: list[EquipmentRead]
    total: int
    page: int
    per_page: int
    pages: int
