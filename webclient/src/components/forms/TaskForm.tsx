import { useTranslation } from "react-i18next";
import { ManagementTasks, TaskType } from "../../types/TaskType";
import { useState } from "react";
import TaskTypeSelect from "../selects/TaskTypeSelect";
import LabeledComponent from "../wrappers/LabeledComponent";
import { Button } from "primereact/button";
import { useTasks } from "../../contexts/TasksContext";

interface TaskFormProps {
    submitCallback: (taskType: TaskType) => void;
    options?: TaskType[];
}

const TaskForm: React.FC<TaskFormProps> & {
    Start: React.FC;
} = ({ submitCallback, options }) => {
    const { t } = useTranslation("tasks");

    const [taskType, setTaskType] = useState<TaskType | null>(null);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        submitCallback(taskType);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-column w-max gap-2">
            <LabeledComponent label={t("form.task-type")}>
                <TaskTypeSelect
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as TaskType)}
                    options={options}
                />
            </LabeledComponent>
            <Button
                type="submit"
                disabled={!taskType}
                label={t("form.submit")}
            />
        </form>
    );
};

const Start: React.FC = () => {
    const { startTask } = useTasks();

    return <TaskForm submitCallback={startTask} options={ManagementTasks} />;
};

TaskForm.Start = Start;

export default TaskForm;
