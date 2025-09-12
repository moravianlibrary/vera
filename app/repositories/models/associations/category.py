from adapters.database import AssociationTable

proposal_category_association = AssociationTable(
    "proposal", "category", right_fk="categories.id"
)
