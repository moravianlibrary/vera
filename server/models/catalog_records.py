from typing import Optional
from pymarc import Record, MARCReader
from sqlalchemy.orm import Session, relationship
from sqlalchemy import (
    Column,
    ForeignKey,
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
        if self.marc is None:
            return None
        reader = MARCReader(self.marc)
        try:
            for record in reader:
                return record
        except Exception:
            return None
        finally:
            reader.close()

    @hybrid_property
    def skc_record(self) -> Optional[Record]:
        if self.skc_marc is None:
            return None
        reader = MARCReader(self.skc_marc)
        try:
            for record in reader:
                return record
        except Exception:
            return None
        finally:
            reader.close()

    @hybrid_property
    def cnb_record(self) -> Optional[Record]:
        if self.cnb_marc is None:
            return None
        reader = MARCReader(self.cnb_marc)
        try:
            for record in reader:
                return record
        except Exception:
            return None
        finally:
            reader.close()

    @classmethod
    def find(cls, session: Session, sysno: str) -> Optional["CatalogRecord"]:
        return session.query(cls).filter_by(sysno=sysno).first()

    def save(self, session: Session) -> "CatalogRecord":
        if self.find(session, self.sysno) is None:
            session.add(self)
        session.commit()
        session.refresh(self)
        return self

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
