from sqlalchemy.orm import Session

from adapters.elasticsearch import EsSession


class DistributionService:
    def __init__(self, db_session: Session, es_session: EsSession):
        pass
