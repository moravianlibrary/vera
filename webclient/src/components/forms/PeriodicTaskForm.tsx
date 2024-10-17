import React, { useState } from "react";
import { CronExpression, PeriodicTask } from "../../adapters/ApiPeriodicTasks";
import TaskTypeSelect from "../pickers/TaskTypeSelect";
import { useTranslation } from "react-i18next";
import LabeledComponent from "../LabeledComponent";
import EsQueryChips from "../elasticsearch/EsQueryChips";
import CronExpressionForm from "./CronExpressionForm";
import {
    CatalogRecordsTasks,
    DatasetTasks,
    DocumentsTasks,
    TaskType,
} from "../../types/TaskType";
import { EsQuery } from "../../adapters/ApiTasks";
import { Button } from "primereact/button";

interface PeriodicTaskFormProps {
    initialValue?: Partial<PeriodicTask>;
    submitCallback: (periodicTask: Partial<PeriodicTask>) => void;
}

const PeriodicTaskForm: React.FC<PeriodicTaskFormProps> = ({
    initialValue,
    submitCallback,
}) => {
    const { t } = useTranslation("periodic-tasks");

    const [formData, setFormData] = useState<Partial<PeriodicTask>>(
        initialValue || ({} as Partial<PeriodicTask>)
    );
    const [queryParams, setQueryParams] = useState<EsQuery | null>(
        initialValue?.query_params || null
    );

    const handleTaskTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const taskType = e.target.value as TaskType;
        if (
            DocumentsTasks.includes(taskType) &&
            (!queryParams || queryParams.index_name !== "documents")
        ) {
            setQueryParams({
                index_name: "documents",
            });
        } else if (
            CatalogRecordsTasks.includes(taskType) &&
            (!queryParams || queryParams.index_name !== "catalog_records")
        ) {
            setQueryParams({
                index_name: "catalog_records",
            });
        } else if (DatasetTasks.includes(taskType)) {
            setQueryParams(null);
        }
        setFormData({ ...formData, task_type: taskType });
    };

    const handleCronExpressionChange = (expression: CronExpression) => {
        setFormData({ ...formData, ...expression });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!formData.task_type) return;
        submitCallback({
            ...formData,
            query_params: queryParams,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-column w-max gap-2">
            <LabeledComponent label={t("form.task-type")}>
                <TaskTypeSelect
                    value={formData.task_type || null}
                    onChange={handleTaskTypeChange}
                />
            </LabeledComponent>
            {queryParams && (
                <LabeledComponent label={t("form.query")}>
                    <EsQueryChips queryParams={queryParams} />
                </LabeledComponent>
            )}
            <CronExpressionForm
                expression={formData}
                onChangeCallback={handleCronExpressionChange}
            />
            <Button type="submit" label={t("form.submit")} />
        </form>
    );
};

export default PeriodicTaskForm;
