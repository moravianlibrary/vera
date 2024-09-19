import React from "react";
import { FacetViewProps } from "@elastic/react-search-ui-views";
import { Fieldset } from "primereact/fieldset";

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

interface EsFilterByDigitizationListProps {}

const EsFilterByDigitizationList: React.FC<
    EsFilterByDigitizationListProps
> = () => {
    return (
        <EsFilterView label="Digitization List">
            <div></div>
        </EsFilterView>
    );
};

// const EsFilterView: React.FC<EsFilterViewProps> = () => {
//     return <></>;
// };

export { EsFilterView, EsFilterByDigitizationList };
