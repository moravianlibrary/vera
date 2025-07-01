from typing import Callable

from fastapi import Depends, Request

from controllers.resources.security import DependsOnAuthenticatedUser
from schemas.authenticated_user import AuthenticatedUser


def WithLock(
    lock_name: str,
) -> Callable:
    def get_lock(
        request: Request,
        user: AuthenticatedUser = DependsOnAuthenticatedUser,
    ):
        return request.app.state.lock_manager.get_lock(lock_name, user)

    return Depends(get_lock)


WithCategoryWriteLock = WithLock("category_write")
WithPluginWriteLock = WithLock("plugin_write")
