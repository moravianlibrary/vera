from adapters.database import AssociationTable

project_category_association = AssociationTable(
    "project", "category", right_fk="categories.id"
)
