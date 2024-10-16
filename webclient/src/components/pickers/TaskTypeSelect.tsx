import { useTranslation } from "react-i18next";
import { Dropdown } from "primereact/dropdown";
import React from "react";
import { TaskType } from "../../types/TaskType";

interface TaskTypeSelectProps {
    value: TaskType | null;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    options?: TaskType[];
}

const TaskTypeSelect: React.FC<TaskTypeSelectProps> = ({
    value,
    onChange,
    options,
}) => {
    const { t } = useTranslation();

    const mapToOption = (taskType: TaskType) => ({
        label: t(`enums.task-type.${taskType}`),
        value: taskType,
    });

    const handleChange = (e: { value: TaskType }) => {
        onChange({
            target: { value: e.value },
        } as React.ChangeEvent<HTMLInputElement>);
    };

    return (
        <Dropdown
            value={value}
            options={(options || Object.values(TaskType))
                .filter(
                    (t) =>
                        ![
                            TaskType.GenerateItemsPagesDataset,
                            TaskType.GenerateVolumesPagesDataset,
                        ].includes(t)
                )
                .map(mapToOption)}
            onChange={handleChange}
            placeholder={t("common.select.task-type.placeholder")}
        />
    );
};

export default TaskTypeSelect;
