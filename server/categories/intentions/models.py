from sqlalchemy import Column, Date, Integer, String
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import relationship, Session
from services.database import Base
from typing import List, Optional

from categories.intentions import schemas


class Intention(Base):
    __tablename__ = "intentions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    target_page_count = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    # distributions = relationship("Distribution", back_populates="intention")

    @classmethod
    def get(cls, intention_id: int, session: Session) -> "Intention":
        intention = session.query(cls).filter_by(id=intention_id).first()
        if not intention:
            raise ValueError("Intention not found")
        return intention

    @classmethod
    def create(
        cls, intention: schemas.IntentionCreate, session: Session
    ) -> "Intention":
        # Check if the time period is unique
        # and does not collide with existing intentions
        conflicting_intentions = (
            session.query(cls)
            .filter(
                cls.start_date <= intention.end_date,
                cls.end_date >= intention.start_date,
            )
            .all()
        )

        if conflicting_intentions:
            raise ValueError(
                "The time period conflicts with existing intentions."
            )

        # Create the intention
        db_intention = cls(
            name=intention.name,
            description=intention.description,
            target_page_count=intention.target_page_count,
            start_date=intention.start_date,
            end_date=intention.end_date,
        )
        session.add(intention)

        try:
            session.commit()
            return db_intention
        except IntegrityError:
            session.rollback()
            raise ValueError(
                "Failed to create intention due to integrity violation."
            )

    @classmethod
    def update(
        cls,
        intention_id: int,
        intention: schemas.IntentionCreate,
        session: Session,
    ) -> "Intention":
        db_intention = cls.get(intention_id, session)

        # Check if the time period is unique
        # and does not collide with existing intentions
        conflicting_intentions = (
            session.query(cls)
            .filter(
                cls.id != intention_id,
                cls.start_date <= intention.end_date,
                cls.end_date >= intention.start_date,
            )
            .all()
        )

        if conflicting_intentions:
            raise ValueError(
                "The time period conflicts with existing intentions."
            )

        # Update the intention
        db_intention.name = intention.name
        db_intention.description = intention.description
        db_intention.target_page_count = intention.target_page_count
        db_intention.start_date = intention.start_date
        db_intention.end_date = intention.end_date

        try:
            session.commit()
            return db_intention
        except IntegrityError:
            session.rollback()
            raise ValueError(
                "Failed to update intention due to integrity violation."
            )

    @classmethod
    def delete(cls, intention_id: int, session: Session) -> "Intention":
        intention = cls.get(intention_id, session)
        session.delete(intention)
        session.commit()
        return intention

    @classmethod
    def get_all(cls, session: Session) -> List["Intention"]:
        return session.query(cls).all()

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
                cls.end_date >= Date.today(), cls.start_date <= Date.today()
            )
            .first()
        )
