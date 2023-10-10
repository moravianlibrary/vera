from enum import Enum


class ActionType(Enum):
    edit_user_credentials = 'edit_user_credentials'
    edit_user_enlistment = 'edit_user_enlistment'
    remove_user = 'remove_user'

    add_department = 'add_department'
    edit_department = 'edit_department'
    remove_department = 'remove_department'

    add_role = 'add_role'
    edit_role = 'edit_role'
    remove_role = 'remove_role'

    add_category = 'add_category'
    edit_category = 'edit_category'
    remove_category = 'remove_category'

    browse_records = 'browse_records'
    add_record = 'add_record'
    edit_record = 'edit_record'
    comment_on_record = 'comment_on_record'
    remove_record = 'remove_record'

    edit_comment = 'edit_comment'
    remove_comment = 'remove_comment'

    extract_records = 'extract_records'


class ActionScope(Enum):
    own = 'own'
    department = 'department'
    all = 'all'
