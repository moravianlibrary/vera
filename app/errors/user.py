from fastapi import HTTPException, status

from definitions.notification import NotificationType


class NotificationOwnershipError(HTTPException):
    def __init__(
        self,
        notification_type: NotificationType,
        notification_id: int,
        user_id: str,
    ):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"{notification_type.value.capitalize()} notification "
                f"with ID {notification_id} "
                f"does not belong to user {user_id}."
            ),
        )
