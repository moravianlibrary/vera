from typing import Callable, List, Type

from fastapi import Depends, HTTPException, status
from pydantic import BaseModel

from adapters.indexer import IndexerQuery
from definitions.permission import (
    OwnershipPermission,
    OwnershipScope,
    PermissionType,
)
from schemas.authenticated_user import AuthenticatedUser
from schemas.common import FilterParams

from .resolvers import resolve_authenticated_user


def get_restricted_query(permission: OwnershipPermission) -> Callable:
    def _restrict_query(
        query: IndexerQuery,
        user: AuthenticatedUser = Depends(resolve_authenticated_user),
    ):
        # TODO: Apply restriction logic here
        return query

    return Depends(_restrict_query)


def get_restricted_search(permission: OwnershipPermission) -> Callable:
    def _restrict_search(
        search: IndexerQuery,
        user: AuthenticatedUser = Depends(resolve_authenticated_user),
    ):
        # TODO: Apply restriction logic here
        return search

    return Depends(_restrict_search)


def get_restricted_params(
    permission: PermissionType,
    model: Type[BaseModel],
    *,
    restricted_fields: List[str] = [],
    exception: HTTPException = HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="User does not have permission to use restricted parameters.",
    ),
) -> Callable:
    def _restrict_params(
        params: BaseModel = Depends(model),
        user: AuthenticatedUser = Depends(resolve_authenticated_user),
    ):
        if user.has_permission(permission):
            return params

        fields = restricted_fields or list(model.model_fields.keys())
        for field in fields:
            if getattr(params, field) != model.model_fields[field].default:
                raise exception
        return params

    return Depends(_restrict_params)


def get_restricted_filter_params(
    permission: OwnershipPermission,
    model: Type[FilterParams],
) -> Callable:
    def _restrict_filter_params(
        filter_params: FilterParams = Depends(model),
        user: AuthenticatedUser = Depends(resolve_authenticated_user),
    ):
        scope = user.get_scope(permission)

        if scope == OwnershipScope.Global:
            return filter_params

        if scope == OwnershipScope.Group:
            if filter_params.created_by:
                filter_params.created_by = list(
                    set(filter_params.created_by) & set(user.group_users_ids)
                ) or [user.id]
            else:
                filter_params.created_by = user.group_users_ids or [user.id]

        elif scope == OwnershipScope.User:
            filter_params.created_by = [user.id]

        return filter_params

    return Depends(_restrict_filter_params)
