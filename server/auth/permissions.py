from fastapi import Depends
from typing import Any

from auth.schemas import CurrentUser
from auth.permissions_validator import (
    CategoryIdAccessValidator,
    CreateCategoryAccessValidator,
    EditCategoryDistributionAccessValidator,
    PermissionsValidator,
    UpdateCategoryAccessValidator,
)
from roles.types import ActionType
from auth.types import PermissionType
from auth.schemas import Permission


EditAccessPermission = [Depends(PermissionsValidator([ActionType.EditAccess]))]

CreateCategoryPermission = [
    Depends(
        CreateCategoryAccessValidator()
        .with_access_permissions([ActionType.EditCategoriesDepartment])
        .with_override_permissions([ActionType.EditCategoriesAll])
    )
]

UpdateCategoryPermission = [
    Depends(
        UpdateCategoryAccessValidator()
        .with_access_permissions([ActionType.EditCategoriesDepartment])
        .with_override_permissions([ActionType.EditCategoriesAll])
    )
]

EditCategoryDistributionPermission = [
    Depends(
        EditCategoryDistributionAccessValidator()
        .with_access_permissions([ActionType.EditCategoriesDepartment])
        .with_override_permissions([ActionType.EditCategoriesAll])
    )
]

DeleteCategoryPermission = [
    Depends(
        CategoryIdAccessValidator()
        .with_access_permissions([ActionType.EditCategoriesDepartment])
        .with_override_permissions([ActionType.EditCategoriesAll])
    )
]

ReadCategoryPermission = [
    Depends(
        CategoryIdAccessValidator()
        .with_access_permissions([ActionType.ReadCategoriesDepartment])
        .with_override_permissions([ActionType.ReadCategoriesAll])
    )
]

ReadCategoriesPermission = [
    Depends(
        PermissionsValidator(
            [ActionType.ReadCategoriesAll, ActionType.ReadCategoriesDepartment]
        )
    )
]

# Permission = configure_permissions(get_active_user_principals)


# the exception that will be raised, if no sufficient permissions are found
# can be configured in the configure_permissions() function
permission_exception = HTTPException(
    status_code=HTTP_403_FORBIDDEN,
    detail="Insufficient permissions",
    headers={"WWW-Authenticate": "Bearer"},
)


def configure_permissions(
    active_principals_func: Any,
    permission_exception: HTTPException = permission_exception,
):
    """sets the basic configuration for the permissions system

    active_principals_func:
        a dependency that returns the principals of the current active user
    permission_exception:
        the exception used if a permission is denied

    returns: permission_dependency_factory function,
             with some parameters already provisioned
    """
    active_principals_func = Depends(active_principals_func)

    return functools.partial(
        permission_dependency_factory,
        active_principals_func=active_principals_func,
        permission_exception=permission_exception,
    )


def permission_dependency_factory(
    permission: str,
    resource: Any,
    active_principals_func: Any,
    permission_exception: HTTPException,
):
    """returns a function that acts as a dependable for checking permissions

    This is the actual function used for creating the permission dependency,
    with the help of fucntools.partial in the "configure_permissions()"
    function.

    permission:
        the permission to check
    resource:
        the resource that will be accessed
    active_principals_func (provisioned  by configure_permissions):
        a dependency that returns the principals of the current active user
    permission_exception (provisioned  by configure_permissions):
        exception if permission is denied

    returns: dependency function for "Depends()"
    """
    if callable(resource):
        dependable_resource = Depends(resource)
    else:
        dependable_resource = Depends(lambda: resource)

    # to get the caller signature right, we need to add only the resource and
    # user dependable in the definition
    # the permission itself is available through the outer function scope
    def permission_dependency(
        resource=dependable_resource, principals=active_principals_func
    ):
        if has_permission(principals, permission, resource):
            return resource
        raise permission_exception

    return Depends(permission_dependency)


def has_permission(
    user: CurrentUser, requested_permission: str, resource: Any
):
    """checks if a user has the permission for a resource

    The order of the function parameters can be remembered like "Joe eat apple"

    user_principals: the principals of a user
    requested_permission: the permission that should be checked
    resource: the object the user wants to access, must provide an ACL

    returns bool: permission granted or denied
    """
    acl = normalize_acl(resource)

    for action, principal, permissions in acl:
        if action != "allow":
            continue
        if not check_permission(principal):
            continue
        if isinstance(permissions, str):
            permissions = [permissions]
        if requested_permission in permissions:
            return True
    return False


def check_permission(user: CurrentUser, permission: Permission):
    return (
        permission.action in user.actions
        and (permission.user is None or permission.user == user.username)
        and (
            permission.department is None
            or permission.department == user.department_id
        )
    )


def normalize_acl(resource: Any):
    """returns the access controll list for a resource

    If the resource is not an acl list itself it needs to have an "__acl__"
    attribute. If the "__acl__" attribute is a callable, it will be called and
    the result of the call returned.

    An existing __acl__ attribute takes precedence before checking if it is an
    iterable.
    """
    acl = getattr(resource, "__acl__", None)
    if callable(acl):
        return acl()
    elif acl is not None:
        return acl
    elif is_like_list(resource):
        return resource
    return []


def is_like_list(something):
    """checks if something is iterable but not a string"""
    if isinstance(something, str):
        return False
    return hasattr(something, "__iter__")
