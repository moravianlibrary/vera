from pydantic import BaseModel, model_validator


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


class CatalogRecord(BaseModel):
    pass


class CatalogRecordDetails(BaseModel):
    pass
