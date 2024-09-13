from sqlalchemy import Column, Date, Integer, String, desc
from sqlalchemy.orm import relationship, Session, Query
from sqlalchemy.ext.hybrid import hybrid_property
from typing import Optional
from datetime import date
from datatypes import IntentionClassification
from .base import BaseModel


class Intention(BaseModel):
    __tablename__ = "intentions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String)
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
    def query_base(cls, session) -> Query:
        return session.query(cls).order_by(cls.end_date)

    def validate_before_save(self, session: Session) -> None:
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

    def validate_before_delete(self, session: Session) -> None:
        if self.classification == IntentionClassification.Previous:
            raise ValueError("Cannot delete previous intentions.")
        if self.classification == IntentionClassification.Current:
            raise ValueError("Cannot delete current intention.")

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

        Intention(
            name="Initial Intention",
            target_page_count=100000,
            start_date=date(2024, 1, 1),
            end_date=date.today(),
        ).save()
