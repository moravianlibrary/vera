from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, String
from services.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String)
    assignable = Column(Boolean)
    disabled = Column(Boolean)


class CategoryDistribution(Base):
    __tablename__ = "category_distributions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)
    pages_count = Column(Integer)
    disabled = Column(Boolean)


class CategoryDistributionNode(Base):
    __tablename__ = "category_distributions_nodes"

    parent_id = Column(Integer, ForeignKey('categories.id'), index=True)
    child_id = Column(Integer, ForeignKey('categories.id'), index=True)
    percentage = Column(Float)
