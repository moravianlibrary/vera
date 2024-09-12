from unittest import TestCase
from vera import app
from schemas import CurrentUser
from datatypes import ActionType
from routers.utils.dependencies import get_current_user


class TestMockUser(TestCase):
    def mockTestUser(self, actions=[], department_id=1, settings={}):
        app.dependency_overrides[get_current_user] = lambda: CurrentUser(
            username="test_user",
            department_id=department_id,
            department_name="test_department",
            role_id=1,
            role_name="test_role",
            actions=actions,
            settings=settings,
        )

    def mockTestAntiUser(self, actions=[], department_id=1, settings={}):
        return self.mockTestUser(
            actions=[action for action in ActionType if action not in actions],
            department_id=department_id,
            settings=settings,
        )

    def mockTestSuperUser(self, department_id=1, settings={}):
        return self.mockTestUser(
            actions=[action for action in ActionType],
            department_id=department_id,
            settings=settings,
        )
