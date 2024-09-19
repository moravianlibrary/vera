import React, { useEffect, useState } from "react";
import { FacetViewProps } from "@elastic/react-search-ui-views";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { Fieldset } from "primereact/fieldset";
import { FieldValue } from "@elastic/search-ui";
import DigitizationStateTag from "../../../components/tags/DigitizationStateTag";
import { DigitizationState } from "../../../types/DigitizationState";
import { EsFilterView } from "./EsFilterView";
import { useDigitizationLists } from "../../../contexts/extractions/DigitizationListsContext";

interface CustomFacetViewProps extends FacetViewProps {
    onDisplayValue: (value: FieldValue) => React.ReactNode;
}

const CustomFacetView: React.FC<CustomFacetViewProps> = ({
    label,
    options,
    onSelect,
    onRemove,
    onDisplayValue,
}) => {
    const [selectedValues, setSelectedValues] = useState<FieldValue[]>([]);

    useEffect(() => {
        const valuesToRemove = selectedValues.filter(
            (v) => !options.some((o) => o.value === v)
        );

        if (valuesToRemove.length === 0) return;

        valuesToRemove.forEach((v) => onRemove(v));
        setSelectedValues((prevSelectedValues) =>
            prevSelectedValues.filter((v) => !valuesToRemove.includes(v))
        );
    }, [options]);

    const handleChange = (e: CheckboxChangeEvent, value: FieldValue) => {
        if (e.target.checked) {
            onSelect(value);
            setSelectedValues([...selectedValues, value]);
        } else {
            onRemove(value);
            setSelectedValues(selectedValues.filter((v) => v !== value));
        }
    };

    return (
        <EsFilterView label={label}>
            {options.map((option) => (
                <div
                    key={option.value as string}
                    className={
                        option.selected
                            ? "es-facet-value es-active-facet-value"
                            : "es-facet-value"
                    }
                >
                    <div className="es-checkbox">
                        <Checkbox
                            className={`es-${option.value}-checkbox`}
                            inputId={`es-${label}-${option.value}-checkbox`}
                            value={option.value}
                            checked={option.selected || false}
                            onChange={(e) =>
                                handleChange(e, option.value as FieldValue)
                            }
                        />
                        {onDisplayValue(option.value as FieldValue)}
                    </div>
                    <span>{option.count}</span>
                </div>
            ))}
        </EsFilterView>
    );
};

const ListFacetView: React.FC<FacetViewProps> = (props) => {
    const getCheckboxLabel = (value: FieldValue) => {
        return (
            <label htmlFor={`es-${props.label}-${value}-checkbox`}>
                {value as FieldValue}
            </label>
        );
    };

    return <CustomFacetView {...props} onDisplayValue={getCheckboxLabel} />;
};

const BooleanFacetView: React.FC<FacetViewProps> = (props) => {
    const getCheckboxLabel = (value: FieldValue) => {
        return (
            <label htmlFor={`es-${props.label}-${value}-checkbox`}>
                {value ? "Yes" : "No"}
            </label>
        );
    };

    return (
        <CustomFacetView
            {...props}
            options={props.options.sort((a, b) => (a.value ? -1 : 1))}
            onDisplayValue={getCheckboxLabel}
        />
    );
};

const DigitizationStateFacetView: React.FC<FacetViewProps> = (props) => {
    return (
        <CustomFacetView
            {...props}
            onDisplayValue={(value) => (
                <DigitizationStateTag state={value as DigitizationState} />
            )}
        />
    );
};

interface DigitizationListCheckboxLabelProps {
    label: string;
    value: FieldValue;
}

const DigitizationListCheckboxLabel: React.FC<
    DigitizationListCheckboxLabelProps
> = ({ label, value }) => {
    const { findDigitizationList } = useDigitizationLists();

    const [valueLabel, setValueLabel] = useState<string>(`${value}`);

    useEffect(() => {
        const fetchLabel = async () => {
            try {
                const list = await findDigitizationList(value as number);
                setValueLabel(`${value}: ${list?.extractor}`);
            } catch (error) {
                setValueLabel(`${value}: [Error fetching list]`);
            }
        };

        fetchLabel();
    }, [value]);

    return (
        <label htmlFor={`es-${label}-${value}-checkbox`}>{valueLabel}</label>
    );
};

const DigitizationListFacetView: React.FC<FacetViewProps> = (props) => {
    return (
        <CustomFacetView
            {...props}
            onDisplayValue={(value) => (
                <DigitizationListCheckboxLabel
                    label={props.label}
                    value={value}
                />
            )}
        />
    );
};

export {
    ListFacetView,
    BooleanFacetView,
    DigitizationStateFacetView,
    DigitizationListFacetView,
};
