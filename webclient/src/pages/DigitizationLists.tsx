import React from "react";
import { DigitizationListsProvider } from "../contexts/DigitizationListsContext";
import WithProviders from "../components/wrappers/WithProviders";
import DataTableLayout from "../components/layouts/DataTableLayout";
import SubNavigationMenu from "../components/navigation/SubNavigationMenu";
import SubNavigationExtractions from "../components/navigation/SubNavigationExtractions";
import DigitizationListsTable from "../features/extractions/DigitizationListsTable";

const DigitizationLists: React.FC = () => {
    return (
        <WithProviders providers={[DigitizationListsProvider]}>
            <DataTableLayout
                header={
                    <SubNavigationMenu end={<SubNavigationExtractions />} />
                }
                datatable={<DigitizationListsTable />}
                paginator={<DigitizationListsTable.Paginator />}
            />
        </WithProviders>
    );
};

export default DigitizationLists;
