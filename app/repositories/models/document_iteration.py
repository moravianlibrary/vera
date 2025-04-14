from sqlalchemy import Boolean, Column, ForeignKey, Integer
from sqlalchemy.orm import relationship

from adapters.database import BaseModel

from .mixins import CreatedAuditMixin


class DocumentIterationModel(BaseModel, CreatedAuditMixin):
    __tablename__ = "document_iterations"

    id = Column(Integer, primary_key=True, autoincrement=True)

    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    iteration = Column(Integer, nullable=False)

    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    priority = Column(Integer, default=3, nullable=False)
    digitization_list_id = Column(Integer, nullable=True)

    is_archived = Column(Boolean, default=False, nullable=False)

    document = relationship("DocumentModel", backref="iterations")
    category = relationship("CategoryModel", backref="document_iterations")
