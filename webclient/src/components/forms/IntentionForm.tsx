import React, { useState } from "react";
import { InputText } from "primereact/inputtext";
import { IntentionCreate } from "../../adapters/ApiCategories";
import LabeledComponent from "../wrappers/LabeledComponent";
import { useTranslation } from "react-i18next";
import IntentionFactory from "../../data/factories/IntentionFactory";
import { Button } from "primereact/button";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";

interface IntentionFormProps {
    intention: IntentionCreate;
    onSubmit: (intention: IntentionCreate) => void;
    onAbort: () => void;
}

const IntentionForm: React.FC<IntentionFormProps> = ({
    intention,
    onSubmit,
    onAbort,
}) => {
    const { t } = useTranslation("intentions");

    const [name, setName] = useState<string>(intention.name);
    const [description, setDescription] = useState<string | null>(
        intention.description
    );
    const [targetPageCount, setTargetPageCount] = useState<number>(
        intention.target_page_count
    );
    const [dateRange, setDateRange] = useState<Date[]>([
        new Date(intention.start_date),
        new Date(intention.end_date),
    ]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(
            IntentionFactory.create(
                name,
                description,
                targetPageCount,
                dateRange
            )
        );
    };

    return (
        <form
            onSubmit={handleSubmit}
            onAbort={onAbort}
            className="flex flex-column w-max gap-2"
        >
            <LabeledComponent
                label={t("form.label.name")}
                className="justify-content-between"
            >
                <InputText
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </LabeledComponent>
            <LabeledComponent
                label={t("form.label.description")}
                className="justify-content-between"
            >
                <InputText
                    value={description ?? ""}
                    onChange={(e) => setDescription(e.target.value)}
                />
            </LabeledComponent>
            <LabeledComponent
                label={t("form.label.target-page-count")}
                className="justify-content-between"
            >
                <InputNumber
                    value={targetPageCount}
                    onChange={(e) => setTargetPageCount(e.value ?? 0)}
                />
            </LabeledComponent>
            <LabeledComponent
                label={t("form.label.date-range")}
                className="justify-content-between"
            >
                <Calendar
                    value={dateRange}
                    dateFormat="dd.mm.yy"
                    selectionMode="range"
                    readOnlyInput
                    onChange={(e) => setDateRange(e.value as Date[])}
                />
            </LabeledComponent>
            <Button type="submit" label={t("submit", { ns: "app" })} />
        </form>
    );
};

export default IntentionForm;
