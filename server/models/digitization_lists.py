from sqlalchemy import Column, Integer, String, TIMESTAMP
from sqlalchemy import ForeignKey
from sqlalchemy import func
from sqlalchemy.orm import relationship, Session
from sqlalchemy.ext.hybrid import hybrid_property
from typing import List, Set
from .base import BaseModel
from .documents import Document
from datatypes import DigitizationState


class DigitizationList(BaseModel):
    __tablename__ = "digitization_lists"

    id = Column(Integer, primary_key=True, index=True, unique=True)
    intention_id = Column(Integer, ForeignKey("intentions.id"), nullable=False)
    created_by = Column(String, index=True, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    documents = relationship("Document", back_populates="digitization_list")

    @hybrid_property
    def document_ids(self) -> List[int]:
        return [d.id for d in self.documents]

    @hybrid_property
    def page_count(self) -> int:
        return sum(d.pages_count for d in self.documents)

    @classmethod
    def get_by_intention(
        cls, session: Session, intention_id: int
    ) -> List["DigitizationList"]:
        return (
            session.query(DigitizationList)
            .filter(DigitizationList.intention_id == intention_id)
            .all()
        )

    def add_documents(
        self,
        session: Session,
        document_ids: List[int],
        ignore_digitization_states: Set[DigitizationState],
    ) -> "DigitizationList":
        for document_id in document_ids:
            document = Document.get(session, document_id)
            document.raise_for_extractibility(ignore_digitization_states)
            document.digitization_list_id = self.id
            document.save(session)
        session.refresh(self)
        return self

    def remove_documents(
        self, session: Session, document_ids: List[int]
    ) -> "DigitizationList":
        for document_id in document_ids:
            document = Document.get(session, document_id)
            if document.digitization_list_id == self.id:
                document.digitization_list_id = None
                document.save(session)
        session.refresh(self)
        return self
