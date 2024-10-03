import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiRoles, { Role } from "../../adapters/ApiRoles";

interface RolesContextProps {
    roles: Role[];
    editingRoles: Role[];
    handleAddRole: () => void;
    handleEditRole: (role: Role) => void;
    handleCancelEdit: (role: Role) => void;
    handleAcceptEdit: (role: Role) => void;
    handleDeleteRole: (role: Role) => void;
}

const RolesContext = createContext<RolesContextProps | undefined>(undefined);

interface RolesProviderProps {
    children: ReactNode;
}

export const RolesProvider: React.FC<RolesProviderProps> = ({ children }) => {
    const api = new ApiRoles();

    const [rolesData, setRolesData] = useState<Role[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [editingRoles, setEditingRoles] = useState<Role[]>([]);

    const loadRoles = async () => {
        api.getPage(1, 50)
            .then((response) => {
                setRolesData(response.data as any as Role[]);
            })
            .catch((error) => {
                console.error(`Could not receive assignable roles: ${error}`);
            });
    };

    const handleAddRole = () => {
        if (roles[roles.length - 1].id === undefined) {
            return;
        }
        // TODO: Implement role creation
        // const newRole = Role.createEmpty();
        // const newRole = {};
        // setRoles([...roles, newRole]);
        // handleEditRole(newRole);
    };

    const handleEditRole = (role: Role) => {
        if (role.name !== "Admin") {
            setEditingRoles([...editingRoles, role]);
        }
    };

    const handleCancelEdit = (role: Role) => {
        setEditingRoles(editingRoles.filter((er) => er !== role));
        if (role.id === undefined) {
            setRoles(roles.filter((r) => r !== role));
        }
    };

    const handleAcceptEdit = (role: Role) => {
        if (role.id) {
            api.update(role.id, role)
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
            api.create(role)
                .then((response) => {
                    setRolesData([...rolesData, response.data]);
                })
                .catch((error) => {
                    console.error(error);
                });
        }
    };

    const handleDeleteRole = (role: Role) => {
        api.delete(role.id!)
            .then((response) => {
                setRolesData(rolesData.filter((data) => data.id !== role.id));
            })
            .catch((error) => {
                console.error(error);
            });
    };

    useEffect(() => {
        setRoles(rolesData);
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
