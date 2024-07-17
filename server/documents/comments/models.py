from sqlalchemy import (
    Column,
    ForeignKey,
    Integer,
    String,
    Text,
    TIMESTAMP,
    func,
)

from services.database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(
        Integer, ForeignKey("documents.id", ondelete="CASCADE"), index=True
    )
    username = Column(String, index=True)
    text = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())
    edited_at = Column(TIMESTAMP)
