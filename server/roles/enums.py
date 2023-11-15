from enum import Enum


class ActionType(Enum):
    read_datatable_own = 'read_datatable_own'
    read_datatable_department = 'read_datatable_department'
    read_datatable_all = 'read_datatable_all'
    edit_datatable_own = 'edit_datatable_own'
    edit_datatable_department = 'edit_datatable_department'
    edit_datatable_all = 'edit_datatable_all'
    write_datatable = 'write_datatable'
    comment_on_datatable = 'comment_on_datatable'
    edit_access = 'edit_access'
    edit_categories = 'edit_categories'
    extract = 'extract'
