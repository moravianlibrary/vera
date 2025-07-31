from adapters.database import AssociationTable

project_category_association = AssociationTable(
    "project", "category", right_fk="categories.id"
)
proposal_category_association = AssociationTable(
    "proposal", "category", right_fk="categories.id"
)
