from datetime import datetime, timedelta
from enum import Enum
from typing import List

from pydantic import BaseModel


class HealthCheckTarget(str, Enum):
    Database = "Database"
    Indexer = "Indexer"
    Broker = "Broker"
    Workers = "Workers"
    IdentityProvider = "IdentityProvider"
    CatalogAdapter = "CatalogAdapter"
    DigitizationRegistryAdapter = "DigitizationRegistryAdapter"
    Plugin = "Plugin"
    System = "System"


class HealthCheckLevel(str, Enum):
    Ok = "Ok"
    Warning = "Warning"
    Critical = "Critical"


class HealthCheck(BaseModel):
    target: HealthCheckTarget
    level: HealthCheckLevel
    plugin_name: str | None = None
    details: str | None = None
    last_checked: datetime | None = None


class SystemHealth(BaseModel):
    checks: List[HealthCheck]
    status: HealthCheckLevel


class SystemMaintenanceType(str, Enum):
    RecreateIndexes = "RecreateIndexes"
    Custom = "Custom"


class SystemMaintenance(BaseModel):
    type: SystemMaintenanceType
    message: str | None = None


class SystemStatus(BaseModel):
    version: str
    uptime: timedelta
    info_message: str | None
    maintenance: List[SystemMaintenance]


class SystemSettingsEdit(BaseModel):
    pass


class SystemSettings(SystemSettingsEdit):
    pass
