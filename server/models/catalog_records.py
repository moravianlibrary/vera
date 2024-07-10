from sqlalchemy.orm import relationship
from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    TIMESTAMP,
    UniqueConstraint,
    func,
)
from services.database import Base


class CatalogRecord(Base):
    __tablename__ = "catalog_records"

    sysno = Column(String, primary_key=True)
    marc = Column(LargeBinary)

    cnb = Column(String)
    signature = Column(String)
    isxn = Column(String)

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

    record_barcodes = relationship(
        "CatalogRecordIdentifier", back_populates="catalog_record"
    )
    documents = relationship("Document", back_populates="catalog_record")


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
