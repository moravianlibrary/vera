from sqlalchemy.orm import relationship
from sqlalchemy import (
    CheckConstraint,
    Column,
    Integer,
    LargeBinary,
    String,
    TIMESTAMP,
    func,
)

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

    documents = relationship("Document", back_populates="catalog_record")
