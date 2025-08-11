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

from .additional_properties import AdditionalDetails, AdditionalProperties


# --------------------
# - Query Parameters -
# --------------------
class CatalogRecordsSyncParams(BaseModel):
    from_catalog: bool = False
    properties: bool = False


class MarkInReviewParams(BaseModel):
    in_review: bool = True
    message: str | None = None


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


class CatalogRecordAdditionalDetails(AdditionalDetails):
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
        for ap in data.properties:
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


# --------------------
# - Indexer Entities -
# --------------------
class CatalogRecordIdentifier(IndexerNestedModel):
    identifier_type: IdentifierType
    identifier_value: keyword


class CatalogRecordAdditionalProperties(AdditionalProperties):
    pass


class CatalogRecordHit(IndexerModel):
    base: keyword
    system_number: keyword

    material_type: keyword | None = None
    title: text | None = None
    subtitle: text | None = None
    identifiers: List[CatalogRecordIdentifier]

    force_valid: boolean
    is_valid: boolean | None = None

    current_status: EnumList[CatalogRecordStatus]

    properties: CatalogRecordAdditionalProperties | None

    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, CatalogRecordModel):
            return data

        marc_record = MarcRecord.from_mrc(data.marc)

        # Collect identifiers from the MARC record
        identifiers: List[CatalogRecordIdentifier] = []

        def _append_identifier(identifier_type: IdentifierType, value: str):
            identifiers.append(
                CatalogRecordIdentifier(
                    identifier_type=identifier_type, identifier_value=value
                )
            )

        def _extend_identifiers(
            identifier_type: IdentifierType, field_values: List[str]
        ):
            identifiers.extend(
                CatalogRecordIdentifier(
                    identifier_type=IdentifierType(identifier_type),
                    identifier_value=field_value,
                )
                for field_value in field_values
            )

        for issue in marc_record.issues.all():
            _append_identifier(IdentifierType.Barcode, issue.barcode)
            _extend_identifiers(
                IdentifierType.Signature, issue.local("signature")
            )

        for identifier, values in [
            (
                IdentifierType.Signature,
                marc_record.local_fields("signature", "active"),
            ),
            (IdentifierType.ISXN, marc_record.numbers_and_codes.isxn.active),
            (IdentifierType.NBN, marc_record.numbers_and_codes.nbn.active),
        ]:
            _extend_identifiers(identifier, values)

        # Collect properties
        properties = {}
        for ap in data.properties:
            plugin_type = ap.plugin_instance.plugin.type
            if plugin_type != PluginType.CatalogRecordProperty:
                continue

            instance = plugin_registry.catalog_record_property(
                ap.plugin_instance.id
            )

            properties[instance.config.property_name] = (
                instance.plugin.detailed_data_type.model_validate(
                    ap.search_data
                )
                if ap.search_data
                else None
            )

        return {
            "id": data.id,
            "base": data.base,
            "system_number": data.system_number,
            "material_type": data.material_type,
            "title": marc_record.title_related.title_statement.title,
            "subtitle": marc_record.title_related.title_statement.subtitle,
            "identifiers": identifiers,
            "force_valid": data.force_valid,
            "is_valid": data.is_valid or data.force_valid,
            "current_status": data.current_status,
            "properties": properties,
            "updated_at": data.updated_at,
        }


class CatalogRecord(CatalogRecordHit):
    class ESConfig:
        index = "catalog_records"
        id_field = "id"

    id: keyword


# -------------
# - Task Data -
# -------------
class CatalogRecordForceValidityData(BaseModel):
    validity: bool
