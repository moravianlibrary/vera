import { Dropdown } from "primereact/dropdown";
import React from "react";
import { SortByProps, useSortBy } from "react-instantsearch";

interface EsSortByProps extends SortByProps {}

const EsSortBy: React.FC<EsSortByProps> = (props) => {
    const { canRefine, options, currentRefinement, refine } = useSortBy(props);

    if (!canRefine) return null;

    const getValue = () => {
        return (
            options.find((o) => o.value === currentRefinement)?.value ||
            options[0].value
        );
    };

    return (
        <Dropdown
            value={getValue()}
            options={options}
            onChange={(e) => refine(e.value)}
        />
    );
};

export default EsSortBy;
