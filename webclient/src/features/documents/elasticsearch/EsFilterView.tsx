import React, { useContext, useEffect } from "react";
import { FacetViewProps } from "@elastic/react-search-ui-views";
import { Fieldset } from "primereact/fieldset";
import { MultiSelect, MultiSelectChangeEvent } from "primereact/multiselect";
import { useDigitizationLists } from "../../../contexts/extractions/DigitizationListsContext";
import { DigitizationExtraction } from "../../../adapters/ApiDigitizationExtractions";
import { SelectItemOptionsType } from "primereact/selectitem";
import { SearchContext } from "@elastic/react-search-ui";

interface EsFilterViewProps {
    label: string;
    children: React.ReactNode;
}

const EsFilterView: React.FC<EsFilterViewProps> = ({ label, children }) => {
    return (
        <Fieldset className="es-filter-view-fieldset" legend={label} toggleable>
            {children}
        </Fieldset>
    );
};

interface EsFilterByDigitizationListProps extends FacetViewProps {}

function transformToMultiSelectOptions(
    digitizationLists: DigitizationExtraction[]
): SelectItemOptionsType {
    return digitizationLists.map((list) => ({
        label: `${list.id}: ${list.created_by}, ${list.created_at}, ${list.page_count} pages`,
        value: list.id,
    }));
}

const EsFilterByDigitizationList: React.FC<
    EsFilterByDigitizationListProps
> = () => {
    const searchDriver = useContext(SearchContext).driver;
    const { digitizationLists, numFound } = useDigitizationLists();
    const [isReady, setIsReady] = React.useState(false);
    const [selectedDigitizationLists, setSelectedDigitizationLists] =
        React.useState<number[]>([]);

    useEffect(() => {
        setIsReady(numFound > 0);
    }, [numFound]);

    if (!isReady) return null;

    const handleSelectChange = (event: MultiSelectChangeEvent) => {
        setSelectedDigitizationLists(event.value as number[]);
        searchDriver.addFilter(
            "digitization_list_id",
            event.value as number[],
            "any"
        );
        // Search here with the selected digitization lists
    };

    return (
        <EsFilterView label="Digitization List">
            <MultiSelect
                value={selectedDigitizationLists}
                options={transformToMultiSelectOptions(digitizationLists)}
                onChange={handleSelectChange}
            />
        </EsFilterView>
    );
};

const DigitizationListFacetView: React.FC<FacetViewProps> = ({
    label,
    values,
    options,
    onSelect,
    onRemove,
}) => {
    const { digitizationLists, numFound } = useDigitizationLists();
    const [selectedDigitizationLists, setSelectedDigitizationLists] =
        React.useState<number[]>([]);

    if (numFound === 0) return null;

    const handleSelectChange = (event: MultiSelectChangeEvent) => {
        console.log(values);
        console.log(options);

        const selectedValues = event.value as number[];
        selectedValues
            .filter((v) => !selectedDigitizationLists.includes(v))
            .forEach((v) => onSelect(v));
        selectedDigitizationLists
            .filter((v) => !selectedValues.includes(v))
            .forEach((v) => onRemove(v));
        setSelectedDigitizationLists(selectedValues);
    };

    return (
        <EsFilterView label={label}>
            <MultiSelect
                value={selectedDigitizationLists}
                options={transformToMultiSelectOptions(digitizationLists)}
                onChange={handleSelectChange}
                display="chip"
                // inline
            />
        </EsFilterView>
    );
};

// const EsFilterView: React.FC<EsFilterViewProps> = () => {
//     return <></>;
// };

export { EsFilterView, EsFilterByDigitizationList };
