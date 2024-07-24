from os import environ
from datetime import tzinfo
import pytz
from typing import List
from datetime import datetime


class staticproperty(property):
    def __get__(self, owner_self, owner_cls):
        return self.fget()


class VeraConfig:
    @staticproperty
    def TimeZone() -> tzinfo:
        return pytz.timezone("UTC")

    @staticproperty
    def Timestamp() -> datetime:
        return datetime.now(tz=VeraConfig.TimeZone)

    @staticproperty
    def RequestTimeout() -> int:
        return 30

    @staticproperty
    def CatalogRecordsValidFor() -> int:
        return 86400

    @staticproperty
    def AllowCorsOrigins() -> List[str]:
        return (
            environ.get("ALLOW_ORIGINS").split(",")
            if environ.get("ALLOW_ORIGINS")
            else []
        )

    @staticproperty
    def ElasticsearchUrl() -> str:
        return environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

    @staticproperty
    def ElasticsearchUsername() -> str:
        return environ.get("ELASTICSEARCH_USERNAME", "elastic")

    @staticproperty
    def ElasticsearchPassword() -> str:
        return environ.get("ELASTICSEARCH_PASSWORD", "veraIndex")
