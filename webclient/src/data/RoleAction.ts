import { ActionType } from "../types/ActionType";
import RoleFactory from "./factories/RoleFactory";

export enum OwnershipType {
    All = "All",
    Department = "Department",
    Own = "Own"
}

export type OwnershipActionType = [ActionType, OwnershipType];

export class RoleActions {
    readDatatable: OwnershipActionType | null = null;
    editDatatable: OwnershipActionType | null = null;
    readCategories: OwnershipActionType | null = null;
    editCategories: OwnershipActionType | null = null;
    insertDatatable: ActionType | null = null;
    writeDatatable: ActionType | null = null;
    commentOnDatatable: ActionType | null = null;
    planTasks: ActionType | null = null;
    adminTasks: ActionType | null = null;
    editAccess: ActionType | null = null;
    stopEmulatingAccess: ActionType | null = null;
    extract: ActionType | null = null;
    adminExtractions: ActionType | null = null;
    adminDatabase: ActionType | null = null;

    constructor(actions: ActionType[]) {
        this.readDatatable = RoleFactory.parseReadDatatableAction(actions);
        this.editDatatable = RoleFactory.parseEditDatatableAction(actions);
        this.readCategories = RoleFactory.parseReadCategoriesAction(actions);
        this.editCategories = RoleFactory.parseEditCategoriesAction(actions);
        this.insertDatatable = actions.includes(ActionType.InsertDatatable)
            ? ActionType.InsertDatatable
            : null;
        this.writeDatatable = actions.includes(ActionType.WriteDatatable)
            ? ActionType.WriteDatatable
            : null;
        this.commentOnDatatable = actions.includes(
            ActionType.CommentOnDatatable
        )
            ? ActionType.CommentOnDatatable
            : null;
        this.planTasks = actions.includes(ActionType.PlanTasks)
            ? ActionType.PlanTasks
            : null;
        this.adminTasks = actions.includes(ActionType.AdminTasks)
            ? ActionType.AdminTasks
            : null;
        this.editAccess = actions.includes(ActionType.EditAccess)
            ? ActionType.EditAccess
            : null;
        this.stopEmulatingAccess = actions.includes(
            ActionType.StopEmulatingAccess
        )
            ? ActionType.StopEmulatingAccess
            : null;
        this.extract = actions.includes(ActionType.Extract)
            ? ActionType.Extract
            : null;
        this.adminExtractions = actions.includes(ActionType.AdminExtractions)
            ? ActionType.AdminExtractions
            : null;
        this.adminDatabase = actions.includes(ActionType.AdminDatabase)
            ? ActionType.AdminDatabase
            : null;
    }
}
