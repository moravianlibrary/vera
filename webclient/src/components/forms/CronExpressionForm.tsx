import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CronExpression } from "../../adapters/ApiPeriodicTasks";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";

interface CronExpressionFormProps {
    initialValue?: CronExpression;
    submitCallback: (expression: CronExpression) => void;
}

const CronExpressionForm: React.FC<CronExpressionFormProps> = ({
    initialValue,
    submitCallback,
}) => {
    const { t } = useTranslation();

    const [formData, setFormData] = useState<CronExpression>(
        initialValue || ({} as CronExpression)
    );

    const handleChange = (name: string, value: number | null) => {
        console.log(formData);

        setFormData({
            ...formData,
            [name]: value,
        });
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        submitCallback(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-column w-max gap-2">
            <CronExpressionItem
                name="minute"
                value={formData.minute || null}
                range={[0, 59]}
                onChange={(v) => handleChange("minute", v)}
            />
            <CronExpressionItem
                name="hour"
                value={formData.hour || null}
                range={[0, 23]}
                showWildcard
                onChange={(v) => handleChange("hour", v)}
            />
            <div key="day_of_week">
                <span>{t("tasks.periodic.form.cron.day_of_week")}</span>
                <Dropdown
                    options={[null, 0, 1, 2, 3, 4, 5, 6].map((v) => ({
                        label: t(`tasks.periodic.day-${v !== null ? v : "*"}`),
                        value: v || null,
                    }))}
                    value={formData.day_of_week || null}
                    onChange={(e) => handleChange("day_of_week", e.value)}
                />
            </div>
            <CronExpressionItem
                name="day_of_month"
                value={formData.day_of_month || null}
                range={[1, 31]}
                showWildcard
                onChange={(v) => handleChange("day_of_month", v)}
            />
        </form>
    );
};

interface CronExpressionItemProps {
    name: string;
    value: number | null;
    range: [number, number];
    onChange: (value: number | null) => void;
    showWildcard?: boolean;
}

const CronExpressionItem: React.FC<CronExpressionItemProps> = ({
    name,
    value,
    range,
    onChange,
    showWildcard,
}) => {
    const { t } = useTranslation();

    return (
        <div key={name}>
            <span>{t(`tasks.periodic.form.cron.${name}`)}</span>
            <div className="p-inputgroup">
                {showWildcard && (
                    <Button label="*" onClick={() => onChange(null)} />
                )}
                <InputNumber
                    value={value}
                    min={range[0]}
                    max={range[1]}
                    onChange={(e) => onChange(e.value)}
                    mode="decimal"
                    placeholder={t(
                        `tasks.periodic.form.cron.${name}-placeholder`
                    )}
                />
                <Button
                    icon="pi pi-chevron-up"
                    size="small"
                    onClick={() =>
                        onChange(Math.min(range[1], (value || 0) + 1))
                    }
                />
                <Button
                    icon="pi pi-chevron-down"
                    size="small"
                    onClick={() =>
                        onChange(Math.max(range[0], (value || 0) - 1))
                    }
                />
            </div>
        </div>
    );
};

export default CronExpressionForm;
