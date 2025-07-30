from adapters.database import AssociationTable

category_user_association = AssociationTable(
    "category", "user", left_fk="categories.id"
)

group_user_association = AssociationTable("group", "user")


project_user_association = AssociationTable("project", "user")
