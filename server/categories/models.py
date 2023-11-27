from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, \
    PrimaryKeyConstraint, String
from services.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String)
    assignable = Column(Boolean)
    percentage = Column(Float)
    disabled = Column(Boolean)


class CategoryAssignment(Base):
    __tablename__ = "category_assignments"

    category_id = Column(Integer, ForeignKey('categories.id'), index=True)
    department_id = Column(Integer, ForeignKey('departments.id'), index=True)
    role_id = Column(Integer, ForeignKey('roles.id'), index=True)

    __table_args__ = (PrimaryKeyConstraint(
        'category_id', 'department_id', 'role_id'), {})


class CategoryDistribution(Base):
    __tablename__ = "category_distributions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)
    pages_count = Column(Integer)
    active = Column(Boolean)
    disabled = Column(Boolean)


class CategoryDistributionNode(Base):
    __tablename__ = "category_distributions_nodes"

    parent_id = Column(Integer, ForeignKey('categories.id'), index=True)
    child_id = Column(Integer, ForeignKey('categories.id'), index=True)

    __table_args__ = (PrimaryKeyConstraint('parent_id', 'child_id'), {})
