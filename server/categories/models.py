# class Category(Base):
#     __tablename__ = "categories"

#     id = Column(Integer, primary_key=True, index=True)
#     name = Column(String)
#     description = Column(String)
#     parent_id = Column(
#         Integer, ForeignKey("categories.id"), index=True, nullable=True
#     )
#     level = Column(Integer)
#     assignable = Column(Boolean)
#     percentage = Column(Float)
#     extract_whole = Column(Boolean)
#     disabled = Column(Boolean)

#     __table_args__ = (UniqueConstraint("name", "parent_id"),)

#     departments_ = relationship(
#         "CategoryDepartments", back_populates="category"
#     )
#     documents = relationship("Document", back_populates="category")

#     @hybrid_property
#     def departments(self):
#         return [department.department_id for department in self.departments_]
