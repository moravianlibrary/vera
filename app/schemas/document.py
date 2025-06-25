from pydantic import BaseModel, model_validator


class DocumentsSyncParams(BaseModel):
    catalog_record: bool = False
    digitization_state: bool = False
    properties: bool = False

    @model_validator(mode="after")
    def validate(cls, model: "DocumentsSyncParams") -> "DocumentsSyncParams":
        if not any(
            [
                model.catalog_record,
                model.digitization_state,
                model.properties,
            ]
        ):
            raise ValueError("At least one sync parameter must be enabled.")
        return model


class Document(BaseModel):
    pass
