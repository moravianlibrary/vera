from typing import Any, Dict, Optional

from pydantic import BaseModel
from pydantic.fields import FieldInfo

from adapters.indexer import IndexerNestedModel


class AdditionalPropertiesModel(IndexerNestedModel):
    @classmethod
    def add_fields(cls, **field_definitions: Any):
        new_fields: Dict[str, FieldInfo] = {}
        new_annotations: Dict[str, Optional[type]] = {}

        for f_name, f_def in field_definitions.items():
            if isinstance(f_def, tuple):
                if len(f_def) != 2:
                    raise TypeError(
                        f"Field definition for '{f_name}' must be "
                        "a tuple of (type, default), e.g., `str, 'hello'`. "
                        "Tuples as default values "
                        "are not supported in this format."
                    )
                f_annotation, f_value = f_def
            else:
                f_annotation, f_value = None, f_def

            if f_annotation:
                new_annotations[f_name] = f_annotation

            new_fields[f_name] = FieldInfo(
                annotation=f_annotation, default=f_value
            )

        cls.model_fields.update(new_fields)
        cls.model_rebuild(force=True)


class AdditionalDetailsModel(BaseModel):
    """Base model for dynamically adding additional details fields."""

    @classmethod
    def add_fields(cls, **field_definitions: Any):
        """Dynamically add fields to the model."""
        new_fields: Dict[str, FieldInfo] = {}
        new_annotations: Dict[str, Optional[type]] = {}

        for f_name, f_def in field_definitions.items():
            if isinstance(f_def, tuple):
                if len(f_def) != 2:
                    raise TypeError(
                        f"Field definition for '{f_name}' must be "
                        "a tuple of (type, default), e.g., `(str, 'hello')`. "
                        "Tuples as default values are not supported here."
                    )
                f_annotation, f_value = f_def
            else:
                f_annotation, f_value = None, f_def

            if f_annotation:
                new_annotations[f_name] = f_annotation

            new_fields[f_name] = FieldInfo(
                annotation=f_annotation, default=f_value
            )

        cls.model_fields.update(new_fields)
        cls.model_rebuild(force=True)
