from sqlalchemy import (
    Boolean,
    Column,
    Float,
    ForeignKey,
    Integer,
    UniqueConstraint,
    PrimaryKeyConstraint,
    String,
)
from sqlalchemy.orm import relationship
from sqlalchemy.ext.hybrid import hybrid_property
from services.database import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    description = Column(String)
    parent_id = Column(
        Integer, ForeignKey("categories.id"), index=True, nullable=True
    )
    level = Column(Integer)
    assignable = Column(Boolean)
    percentage = Column(Float)
    extract_whole = Column(Boolean)
    disabled = Column(Boolean)

    __table_args__ = (UniqueConstraint("name", "parent_id"),)

    distributions = relationship("Distribution", back_populates="category")
    departments_ = relationship(
        "CategoryDepartments", back_populates="category"
    )
    documents = relationship("Document", back_populates="category")

    @hybrid_property
    def departments(self):
        return [department.department_id for department in self.departments_]


class CategoryDepartments(Base):
    __tablename__ = "category_departments"

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("category_id", "department_id"), {})

    category = relationship("Category", back_populates="departments_")
