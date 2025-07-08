from datetime import datetime
from typing import Any, List

from marcdantic import MarcRecord
from pydantic import BaseModel, model_validator
from vera_plugins.definitions.plugin_types import PluginType

from adapters.indexer import (
    AdditionalPropertiesModel,
    EnumList,
    IndexerModel,
    IndexerNestedModel,
)
from definitions.catalog_record import CatalogRecordStatus
from definitions.identifier import IdentifierType
from repositories.models.catalog_record import CatalogRecordModel


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

    title: str | None
    subtitle: str | None
    identifiers: List[CatalogRecordIdentifier]

    validity_sources: List[CatalogRecordValidity] | None
    force_valid: bool
    is_valid: bool | None

    current_status: EnumList[CatalogRecordStatus]

    additional_properties: CatalogRecordAdditionalProperties | None

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

        # Collect validity sources from additional properties
        # TODO: do this on sql level
        # TODO: Add catalog record validity plugin type
        validity_sources = [
            ap
            for ap in data.additional_properties
            if ap.plugin_instance.plugin.type
            == PluginType.CatalogRecordValidity
        ]

        # Determine if the record is valid
        is_valid = data.force_valid or (
            all(vs.is_valid or vs.is_valid is None for vs in validity_sources)
        )

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

        return {
            "id": data.id,
            "base": data.base,
            "system_number": data.system_number,
            "title": marc_record.title_related.title_statement.title,
            "subtitle": marc_record.title_related.title_statement.subtitle,
            "identifiers": identifiers,
            "validity_sources": validity_sources,
            "force_valid": data.force_valid,
            "is_valid": is_valid,
            "current_status": current_status,
            "additional_properties": [
                ap
                for ap in data.additional_properties
                if ap.plugin_instance.plugin.type
                == PluginType.CatalogRecordProperty
            ],
        }


class CatalogRecordStatusLog(BaseModel):
    status: CatalogRecordStatus
    updated_by: str
    updated_at: datetime


class CatalogRecordAdditionalDetails(BaseModel):
    pass


class CatalogRecordDetails(BaseModel):
    id: str

    marc: MarcRecord
    status_log: List[CatalogRecordStatusLog]
    additional_details: CatalogRecordAdditionalDetails | None

    @model_validator(mode="before")
    @classmethod
    def from_model(cls, data: Any) -> Any:
        if not isinstance(data, CatalogRecordModel):
            return data

        return {
            "id": data.id,
            "marc": MarcRecord.from_mrc(data.marc),
            "status_log": data.status_log,
            "additional_details": [
                ap.detailed_data
                for ap in data.additional_properties
                if ap.plugin_instance.plugin.type
                == PluginType.CatalogRecordProperty
            ],
        }
