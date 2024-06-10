import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiRoles, { Role } from "../../adapters/ApiRoles";
import { RoleModel } from "../user/RoleModel";

interface RolesContextProps {
    roles: RoleModel[];
    editingRoles: RoleModel[];
    handleAddRole: () => void;
    handleEditRole: (role: RoleModel) => void;
    handleCancelEdit: (role: RoleModel) => void;
    handleAcceptEdit: (role: RoleModel) => void;
    handleDeleteRole: (role: RoleModel) => void;
}

const RolesContext = createContext<RolesContextProps | undefined>(undefined);

interface RolesProviderProps {
    children: ReactNode;
}

export const RolesProvider: React.FC<RolesProviderProps> = ({ children }) => {
    const [rolesData, setRolesData] = useState<Role[]>([]);
    const [roles, setRoles] = useState<RoleModel[]>([]);
    const [editingRoles, setEditingRoles] = useState<RoleModel[]>([]);

    const loadRoles = async () => {
        ApiRoles.getRoles()
            .then((response) => {
                const transformedData: Role[] = response.data.map((role) => {
                    return Object.assign({}, role) as Role;
                });
                setRolesData(transformedData);
            })
            .catch((error) => {
                console.error(`Could not receive assignable roles: ${error}`);
            });
    };

    const handleAddRole = () => {
        if (roles[roles.length - 1].id === undefined) {
            return;
        }
        const newRole = RoleModel.createEmpty();
        setRoles([...roles, newRole]);
        handleEditRole(newRole);
    };

    const handleEditRole = (role: RoleModel) => {
        if (role.name !== "Admin") {
            setEditingRoles([...editingRoles, role]);
        }
    };

    const handleCancelEdit = (role: RoleModel) => {
        setEditingRoles(editingRoles.filter((er) => er !== role));
        if (role.id === undefined) {
            setRoles(roles.filter((r) => r !== role));
        }
    };

    const handleAcceptEdit = (role: RoleModel) => {
        if (role.id) {
            ApiRoles.updateRole(role)
                .then((response) => {
                    setRolesData(
                        rolesData.map((data) =>
                            data.id === role.id ? response.data : data
                        )
                    );
                })
                .catch((error) => {
                    console.error(error);
                });
        } else {
            ApiRoles.createRole(role)
                .then((response) => {
                    setRolesData([...rolesData, response.data]);
                })
                .catch((error) => {
                    console.error(error);
                });
        }
    };

    const handleDeleteRole = (role: RoleModel) => {
        ApiRoles.deleteRole(role.id!)
            .then((response) => {
                setRolesData(rolesData.filter((data) => data.id !== role.id));
            })
            .catch((error) => {
                console.error(error);
            });
    };

    useEffect(() => {
        setRoles(rolesData.map((data) => new RoleModel(data)));
    }, [rolesData]);

    useEffect(() => {
        console.log(`Fetching roles from server.`);
        loadRoles();
    }, []);

    const contextValue: RolesContextProps = {
        roles,
        editingRoles,
        handleAddRole,
        handleEditRole,
        handleCancelEdit,
        handleAcceptEdit,
        handleDeleteRole,
    };

    return (
        <RolesContext.Provider value={contextValue}>
            {children}
        </RolesContext.Provider>
    );
};

export const useRoles = (): RolesContextProps => {
    const context = useContext(RolesContext);

    if (!context) {
        throw new Error("useRoles must be used within a RolesProvider");
    }

    return context;
};
