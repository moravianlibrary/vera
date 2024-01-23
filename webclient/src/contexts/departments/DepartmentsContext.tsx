import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiDepartments, { Department } from "../../adapters/ApiDepartments";

interface DepartmentsContextProps {
    departments: Department[];
}

const DepartmentsContext = createContext<DepartmentsContextProps | undefined>(undefined);

interface DepartmentsProviderProps {
    children: ReactNode;
}

export const DepartmentsProvider: React.FC<DepartmentsProviderProps> = ({ children }) => {
    const [departments, setDepartments] = useState<Department[]>([]);

    const loadDepartments = async () => {
        ApiDepartments.getDepartments()
        .then(response => {
            const transformedData: Department[] = response.data.map(department => {
                return Object.assign({}, department) as Department;
            });
            setDepartments(transformedData);
        }).catch(error => {
            console.error(`Could not receive assignable departments: ${error}`);
        });
    };

    useEffect(() => {
        console.log(`Fetching departments from server.`);
        loadDepartments();
    }, []);

    const contextValue: DepartmentsContextProps = {
        departments
    };

    return (
        <DepartmentsContext.Provider value={contextValue}>
            {children}
        </DepartmentsContext.Provider>
    );
};

export const useDepartments = (): DepartmentsContextProps => {
    const context = useContext(DepartmentsContext);

    if (!context) {
        throw new Error('useDepartments must be used within a DepartmentsProvider');
    }

    return context;
};
