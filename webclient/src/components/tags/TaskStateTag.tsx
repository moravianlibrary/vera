import { useTranslation } from "react-i18next";
import { TaskState } from "../../types/TaskState";
import { Tag } from "primereact/tag";

interface TaskStateTagProps {
    state: TaskState;
    errorCount?: number;
}

export const TaskStateTag: React.FC<TaskStateTagProps> = ({
    state,
    errorCount,
}) => {
    const { t } = useTranslation("types");

    const value =
        state === TaskState.Finished && errorCount > 0
            ? t("task-state.FinishedWithErrors")
            : t(`task-state.${state}`);

    const severity = (() => {
        switch (state) {
            case TaskState.Planned:
                return null;
            case TaskState.Running:
                return "info";
            case TaskState.Finished:
                return errorCount && errorCount > 0 ? "warning" : "success";
            case TaskState.Failed:
                return "danger";
            case TaskState.Killed:
                return "danger";
            default:
                return null;
        }
    })();

    return <Tag value={value} severity={severity}></Tag>;
};
