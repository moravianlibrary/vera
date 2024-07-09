from sqlalchemy.orm import relationship
from sqlalchemy import (
    CheckConstraint,
    Column,
    Enum,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    TIMESTAMP,
    UniqueConstraint,
    func,
)

from schemas.types.catalog_types import IdentifierType
from services.database import Base


class CatalogRecord(Base):
    __tablename__ = "catalog_records"

    sysno = Column(String, primary_key=True)
    marc = Column(LargeBinary)

    skc_sysno = Column(String)  # skc = authority catalog
    skc_marc = Column(LargeBinary)
    skc_confidence = Column(
        Integer,
        CheckConstraint("skc_confidence >= 0 AND skc_confidence <= 10"),
    )

    cnb_sysno = Column(String)
    cnb_marc = Column(LargeBinary)
    cnb_confidence = Column(
        Integer,
        CheckConstraint("cnb_confidence >= 0 AND cnb_confidence <= 10"),
    )

    last_updated = Column(TIMESTAMP, server_default=func.now())

    identifiers = relationship(
        "CatalogRecordIdentifier", back_populates="catalog_record"
    )
    documents = relationship("Document", back_populates="catalog_record")


class CatalogRecordIdentifier(Base):
    __tablename__ = "catalog_record_identifiers"
    __table_args__ = (
        UniqueConstraint(
            "sysno",
            "identifier",
            "value",
            name="unique_catalog_record_identifier",
        ),
    )

    id = Column(Integer, primary_key=True)
    sysno = Column(String, ForeignKey("catalog_records.sysno"), index=True)
    identifier = Column(Enum(IdentifierType))
    value = Column(String)

    catalog_record = relationship(
        "CatalogRecord", back_populates="identifiers"
    )
