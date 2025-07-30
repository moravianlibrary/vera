from adapters.database import AssociationTable

category_group_association = AssociationTable(
    "category", "group", left_fk="categories.id"
)

project_group_association = AssociationTable("project", "group")
