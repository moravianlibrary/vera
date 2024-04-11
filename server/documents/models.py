from sqlalchemy import (
    Column,
    Enum,
    ForeignKey,
    Integer,
    JSON,
    String,
    TIMESTAMP,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY

from services.database import Base
from catalogs.enums import DigitizationState, MaterialType, IssuanceType


class Document(Base):
    __tablename__ = "documents"
    __table_args__ = (UniqueConstraint("sysno", "volume", "barcode"),)

    id = Column(Integer, primary_key=True, index=True)
    sysno = Column(String, index=True, nullable=False)
    volume = Column(String)
    barcode = Column(String)

    category_id = Column(Integer, ForeignKey("categories.id"), index=True)

    cnb = Column(String)
    isbn_issn = Column(String)
    signature = Column(String)

    material_type = Column(Enum(MaterialType))
    issuance_type = Column(Enum(IssuanceType))
    title = Column(String)
    digitization_state = Column(Enum(DigitizationState))

    year = Column(String)
    bundle = Column(String)

    pages_count = Column(Integer)
    pages_count_predicted = Column(Integer)
    pages_count_manual = Column(Integer)

    size = Column(String)
    locationUri = Column(String)

    publisher = Column(String)
    publishing_place = Column(String)
    publishing_year = Column(String)
    languages = Column(ARRAY(String))

    frequencies = Column(JSON)

    dedicated_scanner = Column(String)

    created_at = Column(TIMESTAMP, server_default=func.now())
    creator = Column(String, index=True)

    extraction_id = Column(
        Integer, ForeignKey("digitization_extractions.id"), index=True
    )
