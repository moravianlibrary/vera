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
    target: str
    plugin_name: str | None = None
    level: HealthCheckLevel
    details: str | None = None
    last_checked: datetime | None = None


class SystemHealth(BaseModel):
    checks: List[HealthCheck]
    status: HealthCheckLevel


class SystemMaintenance(BaseModel):
    enabled: bool = False
    message: str | None = None


class SystemStatus(BaseModel):
    version: str
    uptime: timedelta
    info_message: str | None
    maintenance: SystemMaintenance
    recreating_indexes: bool | None


class SystemSettingsEdit(BaseModel):
    pass


class SystemSettings(SystemSettingsEdit):
    pass
