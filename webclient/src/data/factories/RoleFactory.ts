import {
    ActionScope,
    ActionType,
    Permission,
    PermissionTypes,
} from "../../types/ActionType";

class RoleFactory {
    static parseActionsToPermissions(actions: ActionType[]): Permission[] {
        return actions
            .map((action) => {
                if (action.includes("All")) {
                    return [
                        action.replace("All", "") as ActionType,
                        ActionScope.All,
                    ];
                }
                if (action.includes("Department")) {
                    return [
                        action.replace("Department", "") as ActionType,
                        ActionScope.Department,
                    ];
                }
                if (action.includes("Own")) {
                    return [
                        action.replace("Own", "") as ActionType,
                        ActionScope.Own,
                    ];
                }
                return PermissionTypes.includes(action) ? action : null;
            })
            .filter((a) => a !== null) as Permission[];
    }
}

export default RoleFactory;
