from repositories.group import GroupRepository
from repositories.user import UserRepository
from schemas.assignment import AssignmentChange


class GroupService:
    def __init__(
        self,
        group_repository: GroupRepository,
        user_repository: UserRepository,
    ):
        self._group_repository = group_repository
        self._user_repository = user_repository

    def change_assignment(
        self, group_id: int, group_assignment_change: AssignmentChange
    ) -> None:
        target_group = self._group_repository.get_by_id(group_id)

        user_ids = {u.id for u in target_group.users} | set(
            group_assignment_change.add.user_ids
        ) - set(group_assignment_change.remove.user_ids)

        self._group_repository.update_assingment(
            target_group.id,
            [self._user_repository.get_by_id(user_id) for user_id in user_ids],
        )
