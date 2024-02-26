import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiDepartments, { Department } from "../../adapters/ApiDepartments";
import { DepartmentModel } from "./DepartmentModel";
import ApiUser from "../../adapters/ApiUser";

interface DepartmentsContextProps {
    departments: DepartmentModel[];
    editingDepartments: DepartmentModel[];
    users: string[];
    handleAddDepartment: () => void;
    handleEditDepartment: (department: DepartmentModel) => void;
    handleCancelEdit: (department: DepartmentModel) => void;
    handleAcceptEdit: (department: DepartmentModel) => void;
    handleDeleteDepartment: (department: DepartmentModel) => void;
}

const DepartmentsContext = createContext<DepartmentsContextProps | undefined>(undefined);

interface DepartmentsProviderProps {
    children: ReactNode;
}

export const DepartmentsProvider: React.FC<DepartmentsProviderProps> = ({ children }) => {
    const [departments, setDepartments] = useState<DepartmentModel[]>([]);
    const [editingDepartments, setEditingDepartments] = useState<DepartmentModel[]>([]);
    const [users, setUsers] = useState<string[]>([]);

    const loadDepartments = async () => {
        ApiDepartments.getDepartments()
        .then(response => {
            const transformedData: DepartmentModel[] = response.data.map(department => {
                return new DepartmentModel(department);
            });
            setDepartments(transformedData);
        }).catch(error => {
            console.error(`Could not receive departments: ${error}`);
        });
    };

    const loadUsers = async () => {
        ApiUser.getUsers()
        .then(response => {
            const transformedData: string[] = response.data.map(user => {
                return user.username;
            });
            setUsers(transformedData);
        }).catch(error => {
            console.error(`Could not receive user names: ${error}`);
        });
    };

    const handleAddDepartment = () => {
        if (departments.length > 0 && departments[departments.length - 1].id === undefined) {
            return;
        }
        const newDepartment = DepartmentModel.createEmpty();
        setDepartments([...departments, newDepartment]);
        setEditingDepartments([...editingDepartments, newDepartment]);
    }

    const handleEditDepartment = (department: DepartmentModel) => {
        setEditingDepartments([...editingDepartments, department]);
    };

    const handleCancelEdit = (department: DepartmentModel) => {
        setEditingDepartments(editingDepartments.filter(d => d.id !== department.id));
        if (department.id === undefined) {
            setDepartments(departments.filter(d => d !== department));
        }
    };

    const handleAcceptEdit = (department: DepartmentModel) => {
        console.log(editingDepartments.filter(d => d.id === department.id)[0]);
        console.log(departments.filter(d => d.id === department.id)[0]);
        if (department.id) {
            ApiDepartments.updateDepartment(department)
            .then((response) => {
                setDepartments(departments.map(d => d.id === department.id ? new DepartmentModel(response.data) : d));
            }).catch(error => {
                console.error(`Could not update department: ${error}`);
            });
        } else {
            ApiDepartments.createDepartment(department)
            .then((response) => {
                setDepartments([...(departments.filter(d => d.id !== undefined)), new DepartmentModel(response.data)]);
            }).catch(error => {
                console.error(`Could not create department: ${error}`);
            });
        }
    };

    const handleDeleteDepartment = (department: DepartmentModel) => {
        if (department.id) {
            ApiDepartments.deleteDepartment(department.id)
            .then(() => {
                setDepartments(departments.filter(d => d.id !== department.id));
            }).catch(error => {
                console.error(`Could not delete department: ${error}`);
            });
        }
    };

    useEffect(() => {
        console.log(`Fetching departments from server.`);
        loadDepartments();
        loadUsers();
    }, []);

    const contextValue: DepartmentsContextProps = {
        departments,
        editingDepartments,
        users,
        handleAddDepartment,
        handleEditDepartment,
        handleCancelEdit,
        handleAcceptEdit,
        handleDeleteDepartment
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
