from sqlalchemy import (
    Column,
    Float,
    ForeignKey,
    Integer,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from services.database import Base


class Distribution(Base):
    __tablename__ = "distributions"

    intention_id = Column(Integer, ForeignKey("intentions.id"), index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)

    parent_category_id = Column(
        Integer, ForeignKey("categories.id"), index=True, nullable=True
    )
    percentage = Column(Float)

    __table_args__ = (UniqueConstraint("intention_id", "category_id"),)

    intention = relationship("Intention", back_populates="distributions")
    category = relationship("Category", back_populates="distributions")
