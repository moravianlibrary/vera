from sqlalchemy import Column, Integer, String, TIMESTAMP
from sqlalchemy import ForeignKey
from sqlalchemy import func
from sqlalchemy.orm import relationship, Session
from sqlalchemy.ext.hybrid import hybrid_property
from typing import List, Optional

from services.database import Base


class DigitizationList(Base):
    __tablename__ = "digitization_extractions"

    id = Column(Integer, primary_key=True, index=True)
    intention_id = Column(Integer, ForeignKey("intentions.id"))
    extractor = Column(String, index=True)
    extracted_at = Column(TIMESTAMP, server_default=func.now())

    documents = relationship("Document", back_populates="extraction")

    @hybrid_property
    def document_ids(self) -> List[int]:
        return [d.id for d in self.documents]

    @hybrid_property
    def extracted_pages(self) -> int:
        return sum(d.pages_count for d in self.documents)

    @classmethod
    def get_by_intention(
        cls, intention_id: int, session: Session
    ) -> List["DigitizationList"]:
        return (
            session.query(DigitizationList)
            .filter(DigitizationList.intention_id == intention_id)
            .all()
        )

    @classmethod
    def find(
        cls, session: Session, digitization_list_id: int
    ) -> Optional["DigitizationList"]:
        return session.query(cls).filter_by(id=digitization_list_id).first()

    @classmethod
    def get(
        cls, session: Session, digitization_list_id: int
    ) -> "DigitizationList":
        digitization_list = cls.find(session, digitization_list_id)
        if digitization_list is None:
            raise ValueError(
                f"Digitization list with id {digitization_list_id} not found"
            )
        return digitization_list

    @classmethod
    def all(cls, session, page=1, page_size=50):
        offset = (page - 1) * page_size
        return session.query(cls).offset(offset).limit(page_size).all()

    def save(self, session: Session) -> None:
        if self.id is None:
            session.add(self)
        session.commit()
        session.refresh(self)

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()
