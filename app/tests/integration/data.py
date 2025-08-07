from typing import Dict, List, Type

from adapters.database import DatabaseSession
from adapters.indexer import IndexerModelType, IndexerSession
from repositories._db_repository import DatabaseEntityType
from repositories.models.category import (
    CategoryModel,
    CategoryProportionModel,
    DistributionModel,
)
from repositories.models.group import GroupModel
from repositories.models.project import ProjectModel
from repositories.models.proposal import ProposalModel
from repositories.models.user import UserModel
from schemas.category import Category


async def _index_entities(
    entities: List[DatabaseEntityType],
    indexer_model: Type[IndexerModelType],
) -> List[IndexerModelType]:
    for entity in entities:
        await indexer_model.model_validate(entity, from_attributes=True).save()


async def _persist_entities(
    entities: List[DatabaseEntityType],
    db_session: DatabaseSession,
    indexer_model: Type[IndexerModelType] | None = None,
) -> List[DatabaseEntityType]:
    db_session.add_all(entities)
    db_session.commit()

    for entity in entities:
        db_session.refresh(entity)

    if indexer_model:
        await _index_entities(entities, indexer_model)

    return entities


async def seed_test_users(db_session: DatabaseSession) -> List[UserModel]:
    return await _persist_entities(
        [
            UserModel(
                id=f"id-{i}",
                username=f"user{i}",
                email=f"user{i}@mzk.cz",
                settings=(
                    {
                        "theme": "dark",
                        "notifications": i % 2 == 0,
                        "locale": "en-US" if i % 3 == 0 else "cs-CZ",
                    }
                    if i % 3 != 1
                    else {}
                ),
            )
            for i in range(1, 11)
        ],
        db_session,
    )


async def seed_test_groups(
    users: List[UserModel], db_session: DatabaseSession
) -> List[GroupModel]:
    groups: List[GroupModel] = await _persist_entities(
        [
            GroupModel(
                id=i,
                name=f"Group {i}",
                description=f"Description for group {i}",
            )
            for i in range(1, 6)
        ],
        db_session,
    )

    # Assign users to groups
    #    Users
    # G | X | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |  10 |
    # r | 1 | X | X |   |   | X |   |   |   |   |     |
    # o | 2 |   | X |   | X |   |   |   |   |   |  X  |
    # u | 3 |   | X |   |   | X | X |   |   | X |     |
    # p | 4 |   |   |   |   |   |   |   |   |   |     |
    # s | 5 |   |   |   |   |   |   |   | X | X |  X  |
    assignments: Dict[int, List[int]] = {
        0: [0],
        1: [0, 1, 2],
        2: [],
        3: [1],
        4: [0, 2],
        5: [2],
        6: [],
        7: [4],
        8: [2, 4],
        9: [1, 4],
    }

    for user_idx, group_indices in assignments.items():
        user = users[user_idx]
        for gi in group_indices:
            groups[gi].users.append(user)

    db_session.commit()

    for group in groups:
        db_session.refresh(group)

    return groups


async def seed_test_categories(
    users: List[UserModel],
    groups: List[GroupModel],
    db_session: DatabaseSession,
) -> Dict[int, List[CategoryModel]]:
    level_1_cats: List[CategoryModel] = await _persist_entities(
        [
            CategoryModel(
                name="Category Level 1 - A",
                description="Top level category A",
                level=1,
                assignable=False,
                extract_whole=False,
                parent_id=None,
            ),
            CategoryModel(
                name="Category Level 1 - B",
                description="Top level category B",
                level=1,
                assignable=False,
                extract_whole=False,
                parent_id=None,
            ),
        ],
        db_session,
        Category,
    )

    category_A_id = level_1_cats[0].id
    category_B_id = level_1_cats[1].id

    level_2_cats: List[CategoryModel] = await _persist_entities(
        [
            CategoryModel(
                name="Category Level 2 - A1",
                description="Child of Category Level 1 - A",
                level=2,
                assignable=False,
                extract_whole=False,
                parent_id=category_A_id,
            ),
            CategoryModel(
                name="Category Level 2 - A2",
                description="Another child of Category Level 1 - A",
                level=2,
                assignable=True,
                extract_whole=False,
                parent_id=category_A_id,
            ),
            CategoryModel(
                name="Category Level 2 - B1",
                description="Child of Category Level 1 - B",
                level=2,
                assignable=False,
                extract_whole=True,
                parent_id=category_B_id,
            ),
        ],
        db_session,
        Category,
    )

    category_A1_id = level_2_cats[0].id
    category_B1_id = level_2_cats[2].id

    level_3_cats: List[CategoryModel] = await _persist_entities(
        [
            CategoryModel(
                name="Category Level 3 - A1A",
                description="Child of Category Level 2 - A1",
                level=3,
                assignable=True,
                extract_whole=True,
                parent_id=category_A1_id,
            ),
            CategoryModel(
                name="Category Level 3 - A1B",
                description="Another child of Category Level 2 - A1",
                level=3,
                assignable=True,
                extract_whole=False,
                parent_id=category_A1_id,
            ),
            CategoryModel(
                name="Category Level 3 - B1A",
                description="Child of Category Level 2 - B1",
                level=3,
                assignable=True,
                extract_whole=False,
                parent_id=category_B1_id,
            ),
        ],
        db_session,
        Category,
    )

    if groups:
        level_1_cats[0].direct_groups.append(groups[0])
        level_2_cats[1].direct_groups.extend(groups[1:3])
        level_3_cats[0].direct_groups.append(groups[0])

    if users:
        level_2_cats[0].direct_users.extend(users[:4])
        level_3_cats[0].direct_users.append(users[7])
        level_3_cats[2].direct_users.append(users[9])

    db_session.commit()

    for cat in level_1_cats + level_2_cats + level_3_cats:
        db_session.refresh(cat)

    await _index_entities(level_1_cats + level_2_cats + level_3_cats, Category)

    return {1: level_1_cats, 2: level_2_cats, 3: level_3_cats}
