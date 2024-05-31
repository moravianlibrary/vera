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
from sqlalchemy.orm import Mapped, relationship, Session, Query
from sqlalchemy.ext.hybrid import hybrid_property
from services.database import Base
from categories.categories import schemas
from typing import List, Optional, Tuple
from documents.models import Document
from collections import deque
from categories.intentions.models import Intention
from services.exceptions import (
    CategoryNotFoundException,
    CategoryInDistributionDeletionException,
    NonEmptyCategoryDeletionException,
    DistributionExcesiveSubcategoriesException,
    DistributionMissingSubcategoriesException,
    DistributionNotFoundException,
    MaximumCategoryLevelException,
    UniqueCategoryNameViolationException,
)
from categories.intentions.types import IntentionClassification


MAX_CATEGORY_LEVEL = 3


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
    extract_whole = Column(Boolean)
    disabled = Column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("name", "parent_id"),)

    sub_categories: Mapped[List["Category"]] = relationship(
        back_populates="parent_category", lazy="joined", join_depth=3
    )
    parent_category: Mapped[Optional["Category"]] = relationship(
        remote_side=[id]
    )

    distributions: Mapped[List["Distribution"]] = relationship(
        back_populates="category"
    )
    category_departments: Mapped[List["CategoryDepartments"]] = relationship(
        back_populates="category"
    )
    documents: Mapped[List["Document"]] = relationship(
        back_populates="category"
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
        return [
            department.department_id
            for department in self.parent_category.category_departments
        ].extend(self.parent_category.departments)

    @hybrid_property
    def total_pages(self) -> int:
        return sum(document.pages_count for document in self.documents) + sum(
            sub_category.total_pages for sub_category in self.sub_categories
        )

    @hybrid_property
    def total_documents(self) -> int:
        return len(self.documents) + sum(
            sub_category.total_documents
            for sub_category in self.sub_categories
        )

    @hybrid_property
    def documents_with_pages(self) -> int:
        return sum(
            1 for document in self.documents if not document.pages_count
        ) + sum(
            sub_category.documents_with_pages
            for sub_category in self.sub_categories
        )

    @hybrid_property
    def documents_without_cnb(self) -> int:
        return sum(
            1 for document in self.documents if not document.pages_count
        ) + sum(
            sub_category.documents_without_cnb
            for sub_category in self.sub_categories
        )

    @hybrid_property
    def extractable_pages(self) -> int:
        return sum(
            document.pages_count
            for document in self.documents
            if document.is_extractable
        ) + sum(
            sub_category.extractable_pages
            for sub_category in self.sub_categories
        )

    @hybrid_property
    def extractable_documents(self) -> int:
        return sum(
            1 for document in self.documents if document.is_extractable
        ) + sum(
            sub_category.extractable_documents
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
                if document.extraction_id in digitization_ids
            ),
            sum(
                1
                for document in self.documents
                if document.extraction_id in digitization_ids
            ),
        )

    def find_distribution(self, intention_id: int) -> Optional["Distribution"]:
        distributions = [
            d for d in self.distributions if d.intention_id == intention_id
        ]
        return distributions[0] if distributions else None

    @classmethod
    def find(cls, category_id: int, session: Session) -> Optional["Category"]:
        return session.query(cls).filter_by(id=category_id).first()

    @classmethod
    def get(cls, category_id: int, session: Session) -> "Category":
        category = cls.find(category_id, session)
        if not category:
            raise CategoryNotFoundException(category_id)
        return category

    @classmethod
    def get_root_categories(cls, session: Session) -> List["Category"]:
        return session.query(cls).filter(cls.level == 0).all()

    @classmethod
    def find_by_name_and_parent_id(
        cls, name: str, parent_id: Optional[int], session: Session
    ) -> Optional["Category"]:
        return (
            session.query(cls)
            .filter_by(name=name, parent_id=parent_id)
            .first()
        )

    @classmethod
    def create_root_category(
        cls, category: schemas.CategoryCreate, session: Session
    ) -> "Category":
        if cls.find_by_name_and_parent_id(category.name, None, session):
            raise UniqueCategoryNameViolationException()

        db_category = cls(
            name=category.name,
            description=category.description,
            parent_id=None,
            level=0,
            assignable=category.assignable,
            extract_whole=category.extract_whole,
            disabled=category.disabled,
        )
        session.add(db_category)
        session.commit()
        session.refresh(db_category)
        return db_category

    @classmethod
    def create_sub_category(
        cls, parent_id: int, category: schemas.CategoryCreate, session: Session
    ) -> "Category":
        parent_category = cls.get(parent_id, session)

        if parent_category.level == MAX_CATEGORY_LEVEL:
            raise MaximumCategoryLevelException()

        if cls.find_by_name_and_parent_id(
            category.name, parent_category.id, session
        ):
            raise UniqueCategoryNameViolationException()

        db_category = cls(
            name=category.name,
            description=category.description,
            parent_id=parent_category.id,
            level=parent_category.level + 1,
            assignable=category.assignable,
            extract_whole=category.extract_whole,
            disabled=category.disabled,
        )
        session.add(db_category)
        session.commit()
        session.refresh(db_category)
        return db_category

    @classmethod
    def update(
        cls,
        category_id: int,
        category: schemas.CategoryCreate,
        session: Session,
    ) -> "Category":
        db_category = cls.get(category_id, session)

        if (
            db_category.name != category.name
            and cls.find_by_name_and_parent_id(
                category.name, db_category.parent_id, session
            )
        ):
            raise UniqueCategoryNameViolationException()

        db_category.name = category.name
        db_category.description = category.description
        db_category.assignable = category.assignable
        db_category.extract_whole = category.extract_whole
        db_category.disabled = category.disabled
        session.commit()
        session.refresh(db_category)
        return db_category

    @classmethod
    def delete(cls, category_id: int, session: Session) -> "Category":
        category = cls.get(category_id, session)
        if category.total_pages > 0:
            raise NonEmptyCategoryDeletionException()
        if category.distributions:
            raise CategoryInDistributionDeletionException()

        categories = deque([category])
        while categories:
            current_category = categories.popleft()
            for department in current_category.departments:
                CategoryDepartments.unset(
                    current_category.id, department, session
                )
            categories.extend(current_category.sub_categories)
            session.delete(current_category)

        session.commit()
        return category

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


class CategoryDepartments(Base):
    __tablename__ = "category_departments"

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    department_id = Column(Integer, ForeignKey("departments.id"), index=True)

    __table_args__ = (PrimaryKeyConstraint("category_id", "department_id"), {})

    category = relationship("Category", back_populates="category_departments")

    @classmethod
    def find(cls, category_id: int, department_id: int, session: Session):
        return (
            session.query(cls)
            .filter_by(category_id=category_id, department_id=department_id)
            .first()
        )

    @classmethod
    def set(cls, category_id: int, department_id: int, session: Session):
        if cls.find(category_id, department_id, session):
            return
        session.add(cls(category_id=category_id, department_id=department_id))
        session.commit()

    @classmethod
    def unset(cls, category_id: int, department_id: int, session: Session):
        category_department = cls.find(category_id, department_id, session)
        if category_department:
            session.delete(category_department)
            session.commit()


class Distribution(Base):
    __tablename__ = "distributions"

    intention_id = Column(Integer, ForeignKey("intentions.id"), index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), index=True)
    percentage = Column(Float, nullable=True)

    __table_args__ = (UniqueConstraint("intention_id", "category_id"),)
    __table_args__ = (PrimaryKeyConstraint("intention_id", "category_id"),)

    intention: Mapped[Intention] = relationship(back_populates="distributions")
    category: Mapped["Category"] = relationship(back_populates="distributions")

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

    @hybrid_property
    def pages_needed_to_meet_intention(self):
        if self.intention.classification == IntentionClassification.Previous:
            return 0

        pages_needed = int(
            (self.overall_percentage * self.intention.target_page_count) / 100
        )

        if self.intention.classification == IntentionClassification.Upcoming:
            return pages_needed + self.previous_pages_needed

        return pages_needed - self.category.extractable_pages

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
        cls, intention_id: int, category_id: int, session: Session
    ) -> "Distribution":
        return (
            session.query(cls)
            .filter_by(intention_id=intention_id, category_id=category_id)
            .first()
        )

    @classmethod
    def get(
        cls, intention_id: int, category_id: int, session: Session
    ) -> "Distribution":
        distribution = cls.find(intention_id, category_id, session)
        if not distribution:
            raise DistributionNotFoundException(intention_id, category_id)
        return distribution

    @classmethod
    def set(
        cls,
        intention_id: int,
        distribution: schemas.DistributionCreate,
        session: Session,
    ) -> "Distribution":
        db_distribution = cls.find(
            intention_id, distribution.category_id, session
        )
        if not db_distribution:
            distribution = cls(
                intention_id=intention_id,
                category_id=distribution.category_id,
                percentage=distribution.percentage,
            )
            session.add(distribution)
        else:
            db_distribution.percentage = distribution.percentage

        session.commit()
        return distribution

    @classmethod
    def set_distribution_from_list(
        cls,
        parent_id: Optional[int],
        intention_id: int,
        distribution_list: List[schemas.DistributionCreate],
        session: Session,
    ):
        parent_sub_categories = {
            category.id
            for category in (
                Category.get(parent_id, session).sub_categories
                if parent_id
                else Category.get_root_categories(session)
            )
        }
        sub_categories = {
            distribution.category_id for distribution in distribution_list
        }

        if parent_sub_categories - sub_categories:
            raise DistributionMissingSubcategoriesException()
        if sub_categories - parent_sub_categories:
            raise DistributionExcesiveSubcategoriesException()

        return [
            Distribution.set(intention_id, distribution, session)
            for distribution in distribution_list
        ]

    @classmethod
    def delete_from_intention(
        cls, intention_id: int, category_id: int, session: Session
    ) -> List["Distribution"]:
        distribution = cls.get(intention_id, category_id, session)
        if distribution.percentage != 0 and distribution.percentage != 100:
            raise ValueError("Distribution must be empty")
        category = Category.get(category_id, session)

        categories = deque([category])
        distributions = []
        while categories:
            category = categories.popleft()
            categories.extend(category.sub_categories)
            distribution = cls.find(intention_id, category.id, session)
            if distribution:
                # Prevent lazy load
                distribution.pages_needed_to_meet_intention
                session.delete(distribution)
                distributions.append(distribution)

        session.commit()
        return distributions

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
