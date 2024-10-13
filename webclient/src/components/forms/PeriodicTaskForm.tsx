import React, { useState } from "react";
import { PeriodicTask } from "../../adapters/ApiPeriodicTasks";
import TaskTypeSelect from "../pickers/TaskTypeSelect";
import { useTranslation } from "react-i18next";
import LabeledComponent from "../LabeledComponent";
import EsQueryChips from "../elasticsearch/EsQueryChips";
import CronExpressionForm from "./CronExpressionForm";

interface PeriodicTaskFormProps {
    initialValue?: Partial<PeriodicTask>;
    submitCallback: (periodicTask: Partial<PeriodicTask>) => void;
}

const PeriodicTaskForm: React.FC<PeriodicTaskFormProps> = ({
    initialValue,
    submitCallback,
}) => {
    const { t } = useTranslation();

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
        <div>
            <form
                onSubmit={handleSubmit}
                className="flex flex-column w-max gap-2"
            >
                <LabeledComponent label={t("tasks.periodic.form.task-type")}>
                    <TaskTypeSelect
                        value={formData.task_type || null}
                        onChange={(e) => handleChange("task_type", e)}
                    />
                </LabeledComponent>
                {formData.query_params && (
                    <LabeledComponent label={t("tasks.periodic.form.query")}>
                        <EsQueryChips queryParams={formData.query_params} />
                    </LabeledComponent>
                )}
            </form>
            <CronExpressionForm
                initialValue={formData}
                submitCallback={submitCallback}
            />
        </div>
    );
};

export default PeriodicTaskForm;
