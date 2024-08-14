from typing import Optional, List
from pymarc import Record
from sqlalchemy.orm import Session, relationship
from sqlalchemy import (
    Column,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    TIMESTAMP,
    UniqueConstraint,
    JSON,
    func,
)
from sqlalchemy.ext.hybrid import hybrid_property
from services.database import Base
from datatypes import IdentifierType
from .base import BaseMixin
from services.marc_records_comparator import MarcFieldDifferenceType
from .utils.parsers import marc_binary_to_record
from services.exceptions import CatalogRecordFieldDifferenceWrongSysnoException


class CatalogRecord(Base, BaseMixin):
    __tablename__ = "catalog_records"

    sysno = Column(String, primary_key=True)
    marc = Column(LargeBinary)

    cnb = Column(String)
    signature = Column(String)
    isxn = Column(String)

    skc_sysno = Column(String)
    skc_marc = Column(LargeBinary)
    skc_diff = Column(JSON)

    cnb_sysno = Column(String)
    cnb_marc = Column(LargeBinary)
    cnb_diff = Column(JSON)

    last_updated = Column(TIMESTAMP, server_default=func.now())

    record_barcodes = relationship(
        "CatalogRecordBarcode", back_populates="catalog_record"
    )
    documents = relationship("Document", back_populates="catalog_record")

    @hybrid_property
    def main_record(self) -> Optional[Record]:
        return marc_binary_to_record(self.marc)

    @hybrid_property
    def skc_record(self) -> Optional[Record]:
        return marc_binary_to_record(self.skc_marc)

    @hybrid_property
    def cnb_record(self) -> Optional[Record]:
        return marc_binary_to_record(self.cnb_marc)

    @hybrid_property
    def document_ids(self) -> List[int]:
        return [d.id for d in self.documents]

    @classmethod
    def find(cls, session: Session, sysno: str) -> Optional["CatalogRecord"]:
        return session.query(cls).filter_by(sysno=sysno).first()

    @classmethod
    def find_by_identifier(
        cls, session, identifier_type: IdentifierType, value: str
    ) -> Optional["CatalogRecord"]:
        if identifier_type == IdentifierType.Sysno:
            return cls.find(session, value)
        if identifier_type == IdentifierType.Cnb:
            return session.query(cls).filter_by(cnb=value).first()
        if identifier_type == IdentifierType.Signature:
            return session.query(cls).filter_by(signature=value).first()
        if identifier_type == IdentifierType.Isxn:
            return session.query(cls).filter_by(isxn=value).first()
        return (
            session.query(cls)
            .join(CatalogRecordBarcode)
            .filter(CatalogRecordBarcode.barcode == value)
            .first()
        )

    def save(self, session: Session) -> "CatalogRecord":
        if self.find(session, self.sysno) is None:
            session.add(self)
        session.commit()
        session.refresh(self)
        return self

    def approve_difference(
        self, session: Session, difference_id: int, approved_by: str
    ) -> "CatalogRecord":
        difference = CatalogRecordFieldDifference.get(session, difference_id)
        if difference.sysno != self.sysno:
            raise CatalogRecordFieldDifferenceWrongSysnoException(
                self.sysno, difference_id
            )

        difference.approved_by = approved_by
        difference.approved_at = func.now()
        session.commit()
        session.refresh(self)
        return self


class CatalogRecordBarcode(Base):
    __tablename__ = "catalog_record_barcode"
    __table_args__ = (
        UniqueConstraint(
            "sysno",
            "barcode",
            name="unique_catalog_record_barcode",
        ),
    )

    sysno = Column(
        String, ForeignKey("catalog_records.sysno"), primary_key=True
    )
    barcode = Column(String, primary_key=True)

    catalog_record = relationship(
        "CatalogRecord", back_populates="record_barcodes"
    )

    def save(self, session: Session) -> None:
        session.commit()

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()


class CatalogRecordFieldDifference(Base, BaseMixin):
    __tablename__ = "catalog_record_field_differences"

    id = Column(Integer, primary_key=True)
    sysno = Column(String, ForeignKey("catalog_records.sysno"), index=True)
    tag = Column(String, index=True, nullable=False)
    indicator1 = Column(String, index=True)
    indicator2 = Column(String, index=True)
    difference_type = Column(Enum(MarcFieldDifferenceType))
    value = Column(String)
    different_to = Column(String)

    approved_by = Column(String)
    approved_at = Column(TIMESTAMP)

    catalog_record = relationship(
        "CatalogRecord", back_populates="field_differences"
    )
