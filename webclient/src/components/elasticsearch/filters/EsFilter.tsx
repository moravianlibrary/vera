import React from "react";
import { Fieldset } from "primereact/fieldset";

interface EsFilterProps {
    label: string;
    children: React.ReactNode;
}

const EsFilter: React.FC<EsFilterProps> = ({ label, children }) => {
    return (
        <Fieldset className="es-filter-view-fieldset" legend={label} toggleable>
            {children}
        </Fieldset>
    );
};

export default EsFilter;
export type { EsFilterProps };
