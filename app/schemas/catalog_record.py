from datetime import datetime
from typing import Any, List

from esorm.fields import boolean, keyword, text
from marcdantic import MarcRecord
from pydantic import BaseModel, model_validator
from vera_plugins.definitions.plugin_types import PluginType
from vera_plugins.schemas import CatalogRecordValidityConfig

from adapters.indexer import EnumList, IndexerModel, IndexerNestedModel
from adapters.plugin_registry import plugin_registry
from definitions.catalog_record import CatalogRecordStatus
from definitions.identifier import IdentifierType
from repositories.models.catalog_record import (
    CatalogRecordModel,
    CatalogRecordPropertyModel,
)

from .additional_properties import (
    AdditionalDetailsModel,
    AdditionalPropertiesModel,
)


# --------------------
# - Query Parameters -
# --------------------
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


# --------------------
# - Indexer Entities -
# --------------------
class CatalogRecordIdentifier(IndexerNestedModel):
    identifier_type: IdentifierType
    identifier_value: text


class CatalogRecordAdditionalProperties(AdditionalPropertiesModel):
    pass


class CatalogRecord(IndexerModel):
    class ESConfig:
        index = "catalog_records"

    id: keyword

    base: keyword
    system_number: text

    title: text | None
    subtitle: text | None
    identifiers: List[CatalogRecordIdentifier]

    force_valid: boolean
    is_valid: boolean | None

    current_status: EnumList[CatalogRecordStatus]

    additional_properties: CatalogRecordAdditionalProperties | None

    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, CatalogRecordModel):
            return data

        marc_record = MarcRecord.from_mrc(data.marc)

        # Collect identifiers from the MARC record
        identifiers: List[CatalogRecordIdentifier] = []

        def _append_identifier(
            identifier_type: IdentifierType, field_value: str
        ):
            identifiers.append(
                CatalogRecordIdentifier(
                    identifier_type=IdentifierType(identifier_type),
                    identifier_value=field_value,
                )
            )

        for issue in marc_record.issues:
            _append_identifier(IdentifierType.Barcode, issue.barcode)
            if issue.local.signature:
                _append_identifier(
                    IdentifierType.Signature, issue.local.signature
                )
        for value in marc_record.local.signature:
            _append_identifier(IdentifierType.Signature, value)
        for field in marc_record.numbers_and_codes.isxn:
            _append_identifier(IdentifierType.ISXN, field.active)
        for field in marc_record.numbers_and_codes.nbn:
            _append_identifier(IdentifierType.NBN, field.active)

        # Resolve validity
        is_valid = data.is_valid or data.force_valid

        # Determine the current status of the record
        current_status = [
            status
            for status, condition in [
                (CatalogRecordStatus.Synced, not data.is_unreachable),
                (CatalogRecordStatus.Unreachable, data.is_unreachable),
                (
                    CatalogRecordStatus.DeletedInCatalog,
                    data.is_deleted_in_catalog,
                ),
                (CatalogRecordStatus.Valid, is_valid),
                (CatalogRecordStatus.Invalid, not is_valid),
                (CatalogRecordStatus.ForceValid, data.force_valid),
                (CatalogRecordStatus.Archived, data.is_archived),
                (CatalogRecordStatus.MarkInReview, data.is_in_review),
            ]
            if condition
        ]

        # Collect validity sources and additional properties
        additional_properties = {}

        for ap in data.additional_properties:
            instance, config = plugin_registry.catalog_record_property(
                ap.plugin_instance.id
            )
            additional_properties[config.property_name] = (
                instance.detailed_data_type.model_validate(ap.search_data)
                if ap.search_data
                else None
            )

        return {
            "id": data.id,
            "base": data.base,
            "system_number": data.system_number,
            "title": marc_record.title_related.title_statement.title,
            "subtitle": marc_record.title_related.title_statement.subtitle,
            "identifiers": identifiers,
            "force_valid": data.force_valid,
            "is_valid": is_valid,
            "current_status": current_status,
            "additional_properties": additional_properties,
        }


# -----------------
# - API Responses -
# -----------------
class CatalogRecordValidity(IndexerNestedModel):
    plugin_instance_id: int
    key: str
    valid: bool | None
    reason: str | None

    @classmethod
    def load(
        cls,
        instance_id: int,
        config: CatalogRecordValidityConfig,
        model: CatalogRecordPropertyModel | None,
    ) -> "CatalogRecordValidity":
        return cls(
            plugin_instance_id=instance_id,
            key=config.property_name,
            valid=(
                model.detailed_data.get("valid")
                if model.detailed_data
                else None
            ),
            reason=(
                model.detailed_data.get("reason")
                if model.detailed_data
                else None
            ),
        )


class CatalogRecordAdditionalDetails(AdditionalDetailsModel):
    pass


class CatalogRecordStatusLog(BaseModel):
    status: CatalogRecordStatus
    message: str | None
    created_by: str
    created_at: datetime


class CatalogRecordDetails(BaseModel):
    id: str

    marc: MarcRecord

    validity_sources: List[CatalogRecordValidity]
    additional_details: CatalogRecordAdditionalDetails | None

    status_log: List[CatalogRecordStatusLog]

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, CatalogRecordModel):
            return data

        validity_sources = []
        additional_details = {}
        for ap in data.additional_properties:
            plugin_type = ap.plugin_instance.plugin.type

            if plugin_type == PluginType.CatalogRecordValidity:
                validity_sources.append(
                    CatalogRecordValidity.load(
                        ap.plugin_instance.id,
                        plugin_registry.catalog_record_validity(
                            ap.plugin_instance.id
                        ).config,
                        ap,
                    )
                )

            else:
                instance = plugin_registry.catalog_record_property(
                    ap.plugin_instance.id
                )
                additional_details[instance.config.property_name] = (
                    instance.plugin.detailed_data_type.model_validate(
                        ap.detailed_data
                    )
                    if ap.detailed_data
                    else None
                )

        return {
            "id": data.id,
            "marc": MarcRecord.from_mrc(data.marc),
            "validity_sources": validity_sources,
            "additional_details": (
                additional_details if additional_details else None
            ),
            "status_log": data.status_log,
        }
