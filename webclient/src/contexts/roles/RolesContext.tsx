import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiRoles, { Role } from "../../adapters/ApiRoles";

interface RolesContextProps {
    roles: Role[];
}

const RolesContext = createContext<RolesContextProps | undefined>(undefined);

interface RolesProviderProps {
    children: ReactNode;
}

export const RolesProvider: React.FC<RolesProviderProps> = ({ children }) => {
    const [roles, setRoles] = useState<Role[]>([]);

    const loadRoles = async () => {
        ApiRoles.getRoles()
        .then(response => {
            const transformedData: Role[] = response.data.map(role => {
                return Object.assign({}, role) as Role;
            });
            console.log(transformedData);
            setRoles(transformedData);
        }).catch(error => {
            console.error(`Could not receive assignable roles: ${error}`);
        });
    };

    useEffect(() => {
        console.log(`Fetching roles from server.`);
        loadRoles();
    }, []);

    const contextValue: RolesContextProps = {
        roles
    };

    return (
        <RolesContext.Provider value={contextValue}>
            {children}
        </RolesContext.Provider>
    );
};

export const useAssignableRoles = (): RolesContextProps => {
    const context = useContext(RolesContext);

    if (!context) {
        throw new Error('useRoles must be used within a RolesProvider');
    }

    return context;
};
