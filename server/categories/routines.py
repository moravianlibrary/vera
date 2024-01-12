from sqlalchemy.orm import Session

from categories import crud, schemas


def get_category_subtree(category: schemas.Category,
                         db: Session):
    return schemas.CategoryNode(
        id=category.id,
        name=category.name,
        description=category.description,
        parent_id=category.parent_id,
        level=category.level,
        assignable=category.assignable,
        percentage=category.percentage,
        disabled=category.disabled,
        departments=crud.get_category_departments(category.id, db),
        children=[get_category_subtree(child, db)
                  for child in crud.get_children_categories(category.id, db)],
        count_pages=crud.get_pages_count(category.id, db),
        count_documents_with_pages=(
            crud.get_documents_count(category.id, True, db)),
        count_documents=crud.get_documents_count(category.id, False, db)
    )


def get_category_descriptor(id: int, db: Session):
    category = crud.get_category(id, db)
    if category:
        return schemas.CategoryDescriptor(
            id=category.id,
            name=category.name,
            description=category.description,
            parent_category=(get_category_descriptor(category.parent_id, db)
                             if category.parent_id else None),
        )
    return None


def get_assignable_categories(db: Session):
    categories = crud.get_assignable_categories(db)
    return [schemas.CategoryDescriptor(
        id=category.id,
        name=category.name,
        description=category.description,
        parent_category=get_category_descriptor(category.parent_id, db),
        ) for category in categories]
