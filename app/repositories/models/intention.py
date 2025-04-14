from sqlalchemy import TIMESTAMP, Boolean, Column, ForeignKey, Integer, String

from adapters.database import BaseModel


class IntentionModel(BaseModel):
    __tablename__ = "intentions"

    id = Column(Integer, primary_key=True)

    name = Column(String, unique=True, nullable=False)
    description = Column(String)

    target_page_count = Column(Integer)
    start_date = Column(TIMESTAMP)
    end_date = Column(TIMESTAMP)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)
