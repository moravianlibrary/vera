from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, \
    PrimaryKeyConstraint, String
from services.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String)
    level = Column(Integer)
    assignable = Column(Boolean)
    percentage = Column(Float)
    disabled = Column(Boolean)


class CategoryDepartments(Base):
    __tablename__ = "category_departments"

    category_id = Column(Integer, ForeignKey('categories.id'), index=True)
    department_id = Column(Integer, ForeignKey('departments.id'), index=True)

    __table_args__ = (PrimaryKeyConstraint(
        'category_id', 'department_id'), {})


class CategoryNode(Base):
    __tablename__ = "category_nodes"

    parent_id = Column(Integer, ForeignKey('categories.id'), index=True)
    child_id = Column(Integer, ForeignKey('categories.id'), index=True)

    __table_args__ = (PrimaryKeyConstraint('parent_id', 'child_id'), {})
