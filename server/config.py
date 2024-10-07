# pragma: exclude file
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
    def VeraUrl() -> str:
        return environ.get("VERA_URL", "127.0.0.1")

    @staticproperty
    def VeraPort() -> int:
        return int(environ.get("VERA_PORT", "8000"))

    @staticproperty
    def LogLevel() -> str:
        return environ.get("LOG_LEVEL", "info")

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

    @staticproperty
    def PredictorUrl() -> str:
        return environ.get("PREDICTOR_URL", "http://localhost:5000")

    @staticproperty
    def BotName() -> str:
        return environ.get("BOT_NAME", "VeraBot")

    class Elasticsearch:
        @staticproperty
        def Url() -> str:
            return environ.get("ELASTICSEARCH_URL", "http://localhost:9200")

        @staticproperty
        def Username() -> str:
            return environ.get("ELASTICSEARCH_USERNAME", "elastic")

        @staticproperty
        def Password() -> str:
            return environ.get("ELASTICSEARCH_PASSWORD", "veraIndex")

        @staticproperty
        def CatalogRecordsQueryFields() -> List[str]:
            return environ.get(
                "CATALOG_RECORDS_QUERY_FIELDS",
                "id^3,skc_sysno,cnb_sysno,cnb,signature,isxn,barcodes,"
                "publisher",
            ).split(",")

        @staticproperty
        def CatalogRecordsQueryFuzziness() -> str:
            return environ.get("CATALOG_RECORDS_QUERY_FUZZINESS", "AUTO:4,8")

    class Postgres:
        @staticproperty
        def User() -> str:
            return environ.get("POSTGRES_USER", "veraAdmin")

        @staticproperty
        def Password() -> str:
            return environ.get("POSTGRES_PASSWORD", "password")

        @staticproperty
        def Host() -> str:
            return environ.get("POSTGRES_HOST", "localhost")

        @staticproperty
        def Port() -> str:
            return int(environ.get("POSTGRES_PORT", "5432"))

        @staticproperty
        def DatabaseName() -> str:
            return environ.get("POSTGRES_NAME", "vera")

        @staticproperty
        def PoolSize() -> int:
            return int(environ.get("POSTGRES_POOL_SIZE", "20"))

        @staticproperty
        def MaxOverflow() -> int:
            return int(environ.get("POSTGRES_MAX_OVERFLOW", "0"))

        @staticproperty
        def PoolTimeout() -> int:
            return int(environ.get("POSTGRES_POOL_TIMEOUT", "30"))

        @staticproperty
        def PoolRecycle() -> int:
            return int(environ.get("POSTGRES_POOL_RECYCLE", "1800"))
