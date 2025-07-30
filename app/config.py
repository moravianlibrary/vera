# pragma: exclude file
from datetime import datetime, tzinfo
from typing import List

import pytz
from pydantic import AnyUrl, BaseModel, Field


class CorsConfig(BaseModel):
    allow_origins: List[str] = Field(["*"], env="ALLOW_ORIGINS")
    allow_credentials: bool = Field(True, env="ALLOW_CREDENTIALS")
    allow_methods: List[str] = Field(["*"], env="ALLOW_METHODS")
    allow_headers: List[str] = Field(["*"], env="ALLOW_HEADERS")


class PostgresConfig(BaseModel):
    host: AnyUrl = Field("localhost", env="POSTGRES_HOST")
    port: int = Field(5432, env="POSTGRES_PORT")
    database_name: str = Field("qr", env="POSTGRES_DB")
    user: str = Field("qrAdmin", env="POSTGRES_USER")
    password: str = Field("POSTGRES_PASSWORD", env="POSTGRES_PASSWORD")

    pool_size: int = Field(20, env="POSTGRES_POOL_SIZE")
    max_overflow: int = Field(0, env="POSTGRES_MAX_OVERFLOW")
    pool_timeout: int = Field(30, env="POSTGRES_POOL_TIMEOUT")
    pool_recycle: int = Field(1800, env="POSTGRES_POOL_RECYCLE")


class ElasticsearchConfig(BaseModel):
    url: AnyUrl = Field("http://localhost:9200", env="ELASTICSEARCH_URL")
    username: str = Field("elastic", env="ELASTICSEARCH_USERNAME")
    password: str = Field("veraIndex", env="ELASTICSEARCH_PASSWORD")


class BrokerConfig(BaseModel):
    host: AnyUrl = Field("localhost", env="BROKER_HOST")
    port: int = Field(6379, env="BROKER_PORT")

    @property
    def url(self) -> str:
        return f"redis://{self.host}:{self.port}/0"


class VeraConfig(BaseModel):
    vera_url: AnyUrl = Field("127.0.0.1", env="VERA_URL")
    vera_port: int = Field(8000, env="VERA_PORT")
    cors: CorsConfig = CorsConfig()

    _timezone: str = Field("Europe/Prague", env="TIMEZONE")
    log_level: str = Field("info", env="LOG_LEVEL")

    postgres: PostgresConfig = PostgresConfig()
    elasticsearch: ElasticsearchConfig = ElasticsearchConfig()
    broker: BrokerConfig = BrokerConfig()

    bot_name: str = Field("VeraBot", env="BOT_NAME")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def timezone(self) -> tzinfo:
        return pytz.timezone(self._timezone)

    @property
    def timestamp(self) -> datetime:
        return datetime.now(tz=self.timezone)


config = VeraConfig()
