import React, { useState } from "react";
import { PeriodicTask } from "../../adapters/ApiPeriodicTasks";
import TaskTypeSelect from "../pickers/TaskTypeSelect";

interface PeriodicTaskFormProps {
    initialValue?: Partial<PeriodicTask>;
    submitCallback: (periodicTask: Partial<PeriodicTask>) => void;
}

const PeriodicTaskForm: React.FC<PeriodicTaskFormProps> = ({
    initialValue,
    submitCallback,
}) => {
    const [formData, setFormData] = useState<Partial<PeriodicTask>>(
        initialValue || ({} as Partial<PeriodicTask>)
    );

    const handleChange = (
        name: string,
        e: React.ChangeEvent<HTMLInputElement>
    ) => {
        setFormData({ ...formData, [name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        submitCallback(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-column w-max gap-2">
            <TaskTypeSelect
                value={formData.task_type || null}
                onChange={(e) => handleChange("task_type", e)}
            />
        </form>
    );
};

export default PeriodicTaskForm;
