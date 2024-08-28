from typing import Optional, List
from pymarc import Record
from sqlalchemy.orm import Session, relationship
from sqlalchemy import (
    Boolean,
    Column,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    TIMESTAMP,
    func,
)
from sqlalchemy.ext.hybrid import hybrid_property
from services.database import Base
from datatypes import IdentifierType, CatalogSource, CZECH_LANGUAGE
from .base import BaseMixin
from services.marc_comparator import MarcFieldDifferenceType
from .utils.parsers import marc_binary_to_record
from exceptions import FieldDifferenceAlreadyApprovedException


class CatalogRecord(Base, BaseMixin):
    __tablename__ = "catalog_records"

    sysno = Column(String, primary_key=True)
    marc = Column(LargeBinary)

    cnb = Column(String)
    language = Column(String, nullable=False, default=CZECH_LANGUAGE)
    signature = Column(String)
    isxn = Column(String)

    skc_sysno = Column(String)
    skc_marc = Column(LargeBinary)

    cnb_sysno = Column(String)
    cnb_marc = Column(LargeBinary)

    last_updated = Column(TIMESTAMP, server_default=func.now())

    record_barcodes = relationship(
        "CatalogRecordBarcode", back_populates="catalog_record"
    )
    field_differences = relationship(
        "CatalogRecordFieldDifference", back_populates="catalog_record"
    )
    skc_difference = relationship(
        "CatalogRecordFieldDifference",
        primaryjoin=(
            "and_("
            "CatalogRecord.sysno == CatalogRecordFieldDifference.sysno, "
            "CatalogRecordFieldDifference.source == 'SKC',"
            "CatalogRecordFieldDifference.deleted == False"
            ")"
        ),
        back_populates="catalog_record",
        viewonly=True,
    )
    cnb_difference = relationship(
        "CatalogRecordFieldDifference",
        primaryjoin=(
            "and_("
            "CatalogRecord.sysno == CatalogRecordFieldDifference.sysno, "
            "CatalogRecordFieldDifference.source == 'CNB', "
            "CatalogRecordFieldDifference.deleted == False"
            ")"
        ),
        back_populates="catalog_record",
        viewonly=True,
    )
    documents = relationship("Document", back_populates="catalog_record")

    @hybrid_property
    def main_record(self) -> Record:
        return marc_binary_to_record(self.marc)

    @hybrid_property
    def skc_record(self) -> Optional[Record]:
        return marc_binary_to_record(self.skc_marc)

    @hybrid_property
    def cnb_record(self) -> Optional[Record]:
        return marc_binary_to_record(self.cnb_marc)

    @hybrid_property
    def has_valid_main_record(self) -> bool:
        return all(
            difference.approved_by is not None
            for difference in self.skc_difference
        )

    @hybrid_property
    def has_valid_cnb(self) -> bool:
        return (
            self.language == CZECH_LANGUAGE
            and self.cnb_record is not None
            and all(
                difference.approved_by is not None
                for difference in self.cnb_difference
            )
        ) or (
            self.language != CZECH_LANGUAGE and len(self.cnb_difference) == 0
        )

    @hybrid_property
    def document_ids(self) -> List[int]:
        return [d.id for d in self.documents]

    @classmethod
    def find(cls, session: Session, sysno: str) -> Optional["CatalogRecord"]:
        return session.query(cls).filter_by(sysno=sysno).first()

    @classmethod
    def find_by_identifier(
        cls, session: Session, identifier_type: IdentifierType, value: str
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


class CatalogRecordBarcode(Base):
    __tablename__ = "catalog_record_barcode"

    sysno = Column(
        String, ForeignKey("catalog_records.sysno"), primary_key=True
    )
    barcode = Column(String, primary_key=True)

    catalog_record = relationship(
        "CatalogRecord", back_populates="record_barcodes"
    )

    def save(self, session: Session) -> "CatalogRecordBarcode":
        merged_instance = session.merge(self)
        session.commit()
        session.refresh(merged_instance)
        return merged_instance

    def delete(self, session: Session) -> None:
        session.delete(self)
        session.commit()


class CatalogRecordFieldDifference(Base, BaseMixin):
    __tablename__ = "catalog_record_field_differences"

    id = Column(Integer, primary_key=True)

    sysno = Column(String, ForeignKey("catalog_records.sysno"), index=True)
    source = Column(Enum(CatalogSource), index=True, nullable=False)
    tag = Column(String, index=True, nullable=False)
    indicator1 = Column(String, index=True)
    indicator2 = Column(String, index=True)

    difference_type = Column(Enum(MarcFieldDifferenceType))

    approved_by = Column(String)
    approved_at = Column(TIMESTAMP)
    deleted = Column(Boolean, server_default="false")

    catalog_record = relationship(
        "CatalogRecord", back_populates="field_differences"
    )
    subfield_differences = relationship(
        "CatalogRecordSubfieldDifference",
        back_populates="field_difference",
        cascade="all, delete-orphan",
    )

    @hybrid_property
    def control_field(self) -> bool:
        return self.tag < "010" and self.tag.isdigit()

    @hybrid_property
    def is_skc_difference(self) -> bool:
        return self.source == CatalogSource.SKC

    @hybrid_property
    def is_cnb_difference(self) -> bool:
        return self.source == CatalogSource.CNB

    def delete(self, session: Session) -> "CatalogRecordFieldDifference":
        if self.approved_by is not None:
            self.deleted = True
            session.commit()
            session.refresh(self)
        else:
            session.delete(self)
            session.commit()
        return self

    def approve(
        self, session: Session, approved_by: str
    ) -> "CatalogRecordFieldDifference":
        if self.approved_by is not None:
            raise FieldDifferenceAlreadyApprovedException(self.id)

        self.approved_by = approved_by
        self.approved_at = func.now()

        session.commit()
        session.refresh(self)
        return self


class CatalogRecordSubfieldDifference(Base, BaseMixin):
    __tablename__ = "catalog_record_subfield_differences"

    id = Column(Integer, primary_key=True)

    field_difference_id = Column(
        Integer, ForeignKey("catalog_record_field_differences.id"), index=True
    )

    code = Column(String, index=True)
    value = Column(String)
    different_to = Column(String)
    differs = Column(Boolean)

    field_difference = relationship(
        "CatalogRecordFieldDifference",
        back_populates="subfield_differences",
    )
