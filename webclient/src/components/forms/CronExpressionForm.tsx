import React from "react";
import { useTranslation } from "react-i18next";
import { CronExpression } from "../../adapters/ApiPeriodicTasks";
import { InputNumber } from "primereact/inputnumber";
import { Dropdown } from "primereact/dropdown";
import { Button } from "primereact/button";
import LabeledComponent from "../LabeledComponent";

interface CronExpressionFormProps {
    expression: CronExpression;
    onChangeCallback: (expression: CronExpression) => void;
}

const CronExpressionForm: React.FC<CronExpressionFormProps> = ({
    expression,
    onChangeCallback,
}) => {
    const { t } = useTranslation("periodic-tasks");

    const handleChange = (name: string, value: number | null) => {
        onChangeCallback({
            ...expression,
            [name]: value,
        });
    };

    return (
        <div className="flex flex-column w-max gap-2">
            <CronExpressionItem
                name="hour"
                value={expression.hour === undefined ? null : expression.hour}
                range={[0, 23]}
                showWildcard
                onChange={(v) => handleChange("hour", v)}
            />
            <CronExpressionItem
                name="minute"
                value={expression.minute || 0}
                range={[0, 59]}
                onChange={(v) => handleChange("minute", v === null ? 0 : v)}
            />
            <LabeledComponent label={t("form.cron.day_of_week")}>
                <Dropdown
                    options={[-1, 0, 1, 2, 3, 4, 5, 6].map((v) => ({
                        label: t(`values.day_of_week.${v === -1 ? "*" : v}`),
                        value: v,
                    }))}
                    value={
                        expression.day_of_week === undefined
                            ? -1
                            : expression.day_of_week
                    }
                    onChange={(e) => handleChange("day_of_week", e.value)}
                />
            </LabeledComponent>
            <CronExpressionItem
                name="day_of_month"
                value={expression.day_of_month || null}
                range={[1, 31]}
                showWildcard
                onChange={(v) => handleChange("day_of_month", v)}
            />
        </div>
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
    const { t } = useTranslation("periodic-tasks");

    return (
        <LabeledComponent key={name} label={t(`form.cron.${name}`)} column>
            <div className="p-inputgroup">
                {showWildcard && (
                    <Button
                        type="button"
                        label={t(`form.cron.${name}-wildcard`)}
                        className={
                            value === null
                                ? "bg-yellow-500 border-yellow-600"
                                : ""
                        }
                        onClick={() => onChange(null)}
                    />
                )}
                <InputNumber
                    key={name}
                    value={value}
                    min={range[0]}
                    max={range[1]}
                    onChange={(e) => onChange(e.value)}
                    mode="decimal"
                    placeholder={t(`form.cron.${name}-placeholder`)}
                />
                <Button
                    type="button"
                    icon="pi pi-chevron-up"
                    size="small"
                    onClick={() =>
                        onChange(
                            value === null
                                ? range[0]
                                : Math.min(range[1], value + 1)
                        )
                    }
                />
                <Button
                    type="button"
                    icon="pi pi-chevron-down"
                    size="small"
                    onClick={() =>
                        onChange(
                            value === null
                                ? null
                                : Math.max(range[0], value - 1)
                        )
                    }
                />
            </div>
        </LabeledComponent>
    );
};

export default CronExpressionForm;
