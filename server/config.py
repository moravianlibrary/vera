from datetime import tzinfo
import pytz


class VeraConfig:
    @staticmethod
    @property
    def TimeZone() -> tzinfo:
        return pytz.timezone("UTC")

    @staticmethod
    @property
    def RequestTimeout() -> int:
        return 30

    @staticmethod
    @property
    def CatalogRecordsValidFor() -> int:
        return 86400
