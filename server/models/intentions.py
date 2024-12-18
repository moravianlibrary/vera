from sqlalchemy import Column, Date, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import BaseModel


class Intention(BaseModel):
    __tablename__ = "intentions"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    name = Column(String, nullable=False)
    description = Column(String)
    target_page_count = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    distributions = relationship("Distribution", back_populates="intention")
    associated_categories = relationship(
        "IntentionCategory", back_populates="intention"
    )


class IntentionCategory(BaseModel):
    __tablename__ = "intention_categories"

    intention_id = Column(
        Integer, ForeignKey("intentions.id"), primary_key=True
    )
    category_id = Column(
        Integer, ForeignKey("categories.id"), primary_key=True
    )

    intention = relationship(
        "Intention", back_populates="associated_categories"
    )
    category = relationship("Category", back_populates="associated_intentions")
