from typing import List, Optional, Tuple

from datatypes import IntentionClassification
from sqlalchemy import (
    Column,
    Float,
    ForeignKey,
    PrimaryKeyConstraint,
    String,
    UniqueConstraint,
    bool,
    func,
    int,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, Query, Session, relationship

from services.exceptions import (
    CategoryInDistributionDeletionException,
    EditingPreviousDistributionForbiddenException,
    MaximumCategoryLevelException,
    NonEmptyCategoryDeletionException,
    UniqueCategoryNameViolationException,
)

from .base import BaseModel
from .documents import Document
from .intentions import Intention

MAX_CATEGORY_LEVEL = 3


class CategoryModel(BaseModel):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    name = Column(String, nullable=False)
    description = Column(String)
    parent_id = Column(
        int, ForeignKey("categories.id"), index=True, nullable=True
    )
    level = Column(Integer, default=0, nullable=False)
    assignable = Column(Boolean, default=False, nullable=False)
    extract_whole = Column(Boolean)
    disabled = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("name", "parent_id"),)

    sub_categories: Mapped[List["Category"]] = relationship(
        "Category",
        back_populates="parent_category",
        lazy="joined",
        join_depth=3,
        cascade="all,delete",
    )
    parent_category: Mapped[Optional["Category"]] = relationship(
        "Category", remote_side=[id]
    )

    distributions: Mapped[List["Distribution"]] = relationship(
        "Distribution",
        back_populates="category",
        cascade="all,delete",
    )
    category_departments: Mapped[List["CategoryDepartments"]] = relationship(
        "CategoryDepartments",
        back_populates="category",
        cascade="all,delete",
    )
    documents: Mapped[List["Document"]] = relationship(
        "Document", back_populates="category"
    )

    @hybrid_property
    def departments(self):
        return [
            department.department_id
            for department in self.category_departments
        ]

    @hybrid_property
    def predecessors_departments(self):
        if self.parent_category is None:
            return []
        departments_ids = [
            department.department_id
            for department in self.parent_category.category_departments
        ]
        departments_ids.extend(self.parent_category.predecessors_departments)
        return departments_ids

    def total_pages(self, db_session: Session) -> int:
        return (
            db_session.query(func.sum(Document.pages_count))
            .filter(Document.category_id == self.id)
            .scalar()
            or 0
        ) + sum(
            sub_category.total_pages(db_session)
            for sub_category in self.sub_categories
        )

    @hybrid_property
    def total_documents(self) -> int:
        return len(self.documents) + sum(
            sub_category.total_documents
            for sub_category in self.sub_categories
        )

    def extractable_pages(self, db_session: Session) -> int:
        return (
            db_session.query(func.sum(Document.pages_count))
            .filter(Document.category_id == self.id, Document.is_extractable)
            .scalar()
            or 0
        ) + sum(
            sub_category.extractable_pages(db_session)
            for sub_category in self.sub_categories
        )

    def extractable_documents(self, db_session: Session) -> int:
        return (
            db_session.query(func.count(Document.id))
            .filter(Document.category_id == self.id, Document.is_extractable)
            .scalar()
            or 0
        ) + sum(
            sub_category.extractable_documents(db_session)
            for sub_category in self.sub_categories
        )

    def generate_extraction_report(
        self, extracted_ids: List[int]
    ) -> Tuple[int, int]:
        return (
            sum(
                document.pages_count
                for document in self.documents
                if document.id in extracted_ids
            ),
            sum(
                1
                for document in self.documents
                if document.id in extracted_ids
            ),
        )

    def generate_digitization_report(
        self, digitization_ids: List[int]
    ) -> Tuple[int, int]:
        return (
            sum(
                document.pages_count
                for document in self.documents
                if document.digitization_list_id in digitization_ids
            ),
            sum(
                1
                for document in self.documents
                if document.digitization_list_id in digitization_ids
            ),
        )

    def find_distribution(self, intention_id: int) -> Optional["Distribution"]:
        distributions = [
            d for d in self.distributions if d.intention_id == intention_id
        ]
        return distributions[0] if distributions else None

    @classmethod
    def get_root_categories(cls, session: Session) -> List["Category"]:
        return session.query(cls).filter(cls.level == 0).all()

    @classmethod
    def find_by_name_and_parent_id(
        cls, session: Session, name: str, parent_id: Optional[int]
    ) -> Optional["Category"]:
        return (
            session.query(cls)
            .filter_by(name=name, parent_id=parent_id)
            .first()
        )

    def validate_before_save(self, session: Session) -> "Category":
        if self.parent_id:
            level = Category.get(session, self.parent_id).level + 1
            if level > MAX_CATEGORY_LEVEL:
                raise MaximumCategoryLevelException()
            self.level = level
        else:
            self.level = 0

        same_category = Category.find_by_name_and_parent_id(
            session, self.name, self.parent_id
        )
        if same_category is not None and same_category.id != self.id:
            raise Exception(
                "Category does not have unique name amongst its siblings"
            )

    def validate_before_delete(self, session: Session) -> "Category":
        if self.total_pages(session) > 0:
            raise NonEmptyCategoryDeletionException()
        if (
            sum(distribution.percentage for distribution in self.distributions)
            > 0
        ):
            raise CategoryInDistributionDeletionException()

    @classmethod
    def get_categories(cls, session: Session) -> List["Category"]:
        return session.query(Category).filter(Category.level == 0).all()

    @classmethod
    def get_department_categories(
        cls, department_id: int, session: Session
    ) -> Query:
        return (
            session.query(Category)
            .join(CategoryDepartments)
            .filter(CategoryDepartments.department_id == department_id)
        )

    @classmethod
    def get_department_intention_categories(
        cls, department_id: int, intention_id: int, session: Session
    ) -> List[Tuple["Category", "Distribution"]]:
        return (
            session.query(Category, Distribution)
            .join(Category.distributions)
            .join(CategoryDepartments)
            .filter(CategoryDepartments.department_id == department_id)
            .filter(Distribution.intention_id == intention_id)
            .all()
        )

    @classmethod
    def is_assigned_to_department(
        cls, category_id: int, department_id: int, session: Session
    ) -> bool:
        return (
            session.query(CategoryDepartments)
            .filter_by(category_id=category_id, department_id=department_id)
            .first()
        )

    def save_departments(self, session: Session, department_ids: List[int]):
        for category_department in self.departments:
            category_department.delete(session)
        for department_id in department_ids:
            CategoryDepartments(
                category_id=self.id, department_id=department_id
            ).save(session)


class CategoryDepartments(BaseModel):
    __tablename__ = "category_departments"

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("category_id", "department_id"), {})

    category = relationship("Category", back_populates="category_departments")
    department = relationship("Department", back_populates="categories")

    @classmethod
    def find(
        cls, session: Session, category_id: int, department_id: int
    ) -> Optional["Category"]:
        return (
            session.query(cls)
            .filter_by(category_id=category_id, department_id=department_id)
            .first()
        )

    def is_persisted(self, session: Session) -> bool:
        return (
            CategoryDepartments.find(
                session, self.category_id, self.department_id
            )
            is not None
        )


class Distribution(BaseModel):
    __tablename__ = "distributions"

    intention_id = Column(Integer, ForeignKey("intentions.id"), index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    percentage = Column(Float, nullable=True)

    __table_args__ = (UniqueConstraint("intention_id", "category_id"),)
    __table_args__ = (PrimaryKeyConstraint("intention_id", "category_id"),)

    intention: Mapped[Intention] = relationship(
        "Intention", back_populates="distributions"
    )
    category: Mapped["Category"] = relationship(
        "Category", back_populates="distributions"
    )
    # sub_distributions = relationship(
    #     "Distribution",
    #     secondary="categories",
    #     primaryjoin="Distribution.category_id == Category.id",
    #     secondaryjoin="Category.parent_id == Distribution.category_id",
    #     cascade="all,delete",
    # )

    @hybrid_property
    def overall_percentage(self) -> float:
        if self.category.level == 0:
            return self.percentage
        distribution = self.category.parent_category.find_distribution(
            self.intention_id
        )
        return round(
            (
                distribution.overall_percentage * (self.percentage / 100)
                if distribution
                else 0
            ),
            2,
        )

    def pages_needed_to_meet_intention(self, db_session: Session) -> int:
        if self.intention.classification == IntentionClassification.Previous:
            return 0

        pages_needed = int(
            (self.overall_percentage * self.intention.target_page_count) / 100
        )

        if self.intention.classification == IntentionClassification.Upcoming:
            return pages_needed + self.previous_pages_needed

        return pages_needed - self.category.extractable_pages(db_session)

    @hybrid_property
    def previous_pages_needed(self) -> int:
        session = Session.object_session(self)
        if session is None:
            return 0
        previous_distribution = (
            session.query(Distribution)
            .join(Intention)
            .filter(Distribution.category_id == self.category_id)
            .filter(Intention.end_date < self.intention.end_date)
            .order_by(Intention.end_date.desc())
            .first()
        )

        return (
            previous_distribution.pages_needed_to_meet_intention
            if previous_distribution
            else -self.category.extractable_pages
        )

    @classmethod
    def find(
        cls, session: Session, intention_category_id: Tuple[int, int]
    ) -> "Distribution":
        return (
            session.query(cls)
            .filter_by(
                intention_id=intention_category_id[0],
                category_id=intention_category_id[1],
            )
            .first()
        )

    def save(self, session: Session) -> "Distribution":
        merged_instance = session.merge(self)
        session.commit()
        session.refresh(merged_instance)
        return merged_instance

    def validate_before_delete(self, session: Session) -> "Distribution":
        if self.intention.classification == IntentionClassification.Previous:
            raise EditingPreviousDistributionForbiddenException()
        if self.percentage != 0 and self.percentage != 100:
            raise ValueError("Distribution must be empty")

    @classmethod
    def copy_distributions(
        cls,
        source_intention_id: int,
        target_intention_id: int,
        session: Session,
    ):
        source_distributions = (
            session.query(Distribution)
            .filter_by(intention_id=source_intention_id)
            .all()
        )
        return [
            cls.set(target_intention_id, distribution, session)
            for distribution in source_distributions
        ]
