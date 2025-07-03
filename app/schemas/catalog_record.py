from datetime import datetime
from typing import List

from pydantic import BaseModel, model_validator

from adapters.indexer import (
    AdditionalPropertiesModel,
    EnumList,
    IndexerModel,
    IndexerNestedModel,
)
from definitions.catalog_record import CatalogRecordStatus
from definitions.identifier import IdentifierType


class CatalogRecordsSyncParams(BaseModel):
    from_catalog: bool = False
    properties: bool = False

    @model_validator(mode="after")
    def validate(
        cls, model: "CatalogRecordsSyncParams"
    ) -> "CatalogRecordsSyncParams":
        if not any([model.from_catalog, model.properties]):
            raise ValueError("At least one sync parameter must be enabled.")
        return model


class CatalogRecordIdentifier(IndexerNestedModel):
    identifier_type: IdentifierType
    identifier_value: str


class CatalogRecordValidity(IndexerNestedModel):
    plugin_instance_id: int
    key: str
    valid: bool | None


class CatalogRecordAdditionalProperties(AdditionalPropertiesModel):
    pass


class CatalogRecord(IndexerModel):
    class ESConfig:
        index = "catalog_records"

    id: str

    base: str
    system_number: str

    identifiers: List[CatalogRecordIdentifier]
    title: str | None

    set_valid: bool | None
    validity_source: List[CatalogRecordValidity] | None
    is_valid: bool

    current_status: EnumList[CatalogRecordStatus]

    additional_properties: CatalogRecordAdditionalProperties | None


class CatalogRecordStatusLog(BaseModel):
    status: CatalogRecordStatus
    updated_by: str
    updated_at: datetime


class CatalogRecordDetails(BaseModel):
    id: str

    marc: bytes
    status_log: List[CatalogRecordStatusLog]
