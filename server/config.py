from datetime import tzinfo
import pytz


class VeraConfig:
    @staticmethod
    @property
    def TimeZone() -> tzinfo:
        return pytz.timezone("UTC")
