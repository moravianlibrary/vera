from sqlalchemy import Column, Date, Integer, String, desc
from sqlalchemy.orm import relationship, Session
from sqlalchemy.ext.hybrid import hybrid_property
from services.database import Base
from typing import List, Optional
from datetime import date

from categories.intentions import schemas
from categories.intentions.types import IntentionClassification


class Intention(Base):
    __tablename__ = "intentions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    target_page_count = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    distributions = relationship("Distribution", back_populates="intention")

    @hybrid_property
    def classification(self):
        if self.end_date < date.today():
            return IntentionClassification.Previous
        if self.start_date > date.today():
            return IntentionClassification.Upcoming
        return IntentionClassification.Current

    @classmethod
    def find(
        cls, session: Session, intention_id: int
    ) -> Optional["Intention"]:
        return session.query(cls).filter_by(id=intention_id).first()

    @classmethod
    def get(cls, session: Session, intention_id: int) -> "Intention":
        intention = cls.find(session, intention_id)
        if not intention:
            raise ValueError(f"Intention with id {intention_id} not found")
        return intention

    @classmethod
    def all(cls, session, page=1, page_size=50) -> List["Intention"]:
        offset = (page - 1) * page_size
        return (
            session.query(cls)
            .order_by(cls.end_date)
            .offset(offset)
            .limit(page_size)
            .all()
        )

    def save(self, session: Session) -> None:
        def has_conflicting_intentions() -> bool:
            query = session.query(Intention).filter(
                Intention.start_date <= self.end_date,
                Intention.end_date >= self.start_date,
            )
            if self.id is not None:
                query = query.filter(Intention.id != self.id)
            return query.count() > 0

        if has_conflicting_intentions():
            raise ValueError(
                "The time period conflicts with existing intentions."
            )
        if self.id is None:
            session.add(self)
        session.commit()

    def delete(self, session: Session) -> None:
        if self.classification == IntentionClassification.Previous:
            raise ValueError("Cannot delete previous intentions.")
        if self.classification == IntentionClassification.Current:
            raise ValueError("Cannot delete current intention.")
        session.delete(self)
        session.commit()

    @classmethod
    def find_by_start_date(
        cls, start_date: str, session: Session
    ) -> Optional["Intention"]:
        return session.query(cls).filter(cls.start_date == start_date).first()

    @classmethod
    def find_by_end_date(
        cls, end_date: str, session: Session
    ) -> Optional["Intention"]:
        return session.query(cls).filter(cls.end_date == end_date).first()

    @classmethod
    def get_current_intention(cls, session: Session) -> Optional["Intention"]:
        return (
            session.query(cls)
            .filter(
                cls.end_date >= date.today(), cls.start_date <= date.today()
            )
            .first()
        )

    @classmethod
    def ensure_intention_for_today(cls, session: Session):
        if cls.get_current_intention(session):
            return

        previous_intention = (
            session.query(cls).order_by(desc(cls.end_date)).first()
        )
        if previous_intention:
            previous_intention.end_date = date.today()
            session.commit()
            return

        cls.create(
            schemas.IntentionCreate(
                name="Initial Intention",
                target_page_count=100000,
                start_date=date(2024, 1, 1),
                end_date=date.today(),
            )
        )
