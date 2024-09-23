import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiDepartments, { Department } from "../../adapters/ApiDepartments";
import ApiUsers from "../../adapters/ApiUsers";

interface DepartmentsContextProps {
    departments: Department[];
    editingDepartments: Department[];
    users: string[];
    handleAddDepartment: () => void;
    handleEditDepartment: (department: Department) => void;
    handleCancelEdit: (department: Department) => void;
    handleAcceptEdit: (department: Department) => void;
    handleDeleteDepartment: (department: Department) => void;
}

const DepartmentsContext = createContext<DepartmentsContextProps | undefined>(
    undefined
);

interface DepartmentsProviderProps {
    children: ReactNode;
}

export const DepartmentsProvider: React.FC<DepartmentsProviderProps> = ({
    children,
}) => {
    const api = new ApiDepartments();

    const [departments, setDepartments] = useState<Department[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [editingDepartments, setEditingDepartments] = useState<Department[]>(
        []
    );
    const [users, setUsers] = useState<string[]>([]);

    const loadDepartments = async () => {
        api.getPage(1, 50)
            .then((response) => {
                setDepartments(response.data.items);
                setNumFound(response.data.num_found);
            })
            .catch((error) => {
                console.error(`Could not receive departments: ${error}`);
            });
    };

    const loadUsers = async () => {
        new ApiUsers()
            .getPage(1, 50)
            .then((response) =>
                setUsers(response.data.items.map((user) => user.username) || [])
            )
            .catch((error) => {
                console.error(`Could not receive user names: ${error}`);
            });
    };

    const handleAddDepartment = () => {
        if (
            departments.length > 0 &&
            departments[departments.length - 1].id === undefined
        ) {
            return;
        }
        // const newDepartment = Department.createEmpty();
        // setDepartments([...departments, newDepartment]);
        // setEditingDepartments([...editingDepartments, newDepartment]);
    };

    const handleEditDepartment = (department: Department) => {
        setEditingDepartments([...editingDepartments, department]);
    };

    const handleCancelEdit = (department: Department) => {
        setEditingDepartments(
            editingDepartments.filter((d) => d.id !== department.id)
        );
        if (department.id === undefined) {
            setDepartments(departments.filter((d) => d !== department));
        }
    };

    const handleAcceptEdit = (department: Department) => {
        if (department.id) {
            api.update(department.id, department)
                .then((response) => {
                    setDepartments(
                        departments.map((d) =>
                            d.id === department.id ? response.data : d
                        )
                    );
                })
                .catch((error) => {
                    console.error(`Could not update department: ${error}`);
                });
        } else {
            api.create(department)
                .then((response) => {
                    setDepartments([
                        ...departments.filter((d) => d.id !== undefined),
                        response.data,
                    ]);
                })
                .catch((error) => {
                    console.error(`Could not create department: ${error}`);
                });
        }
    };

    const handleDeleteDepartment = (department: Department) => {
        if (department.id) {
            api.delete(department.id)
                .then(() => {
                    setDepartments(
                        departments.filter((d) => d.id !== department.id)
                    );
                })
                .catch((error) => {
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
        handleDeleteDepartment,
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
        throw new Error(
            "useDepartments must be used within a DepartmentsProvider"
        );
    }

    return context;
};
