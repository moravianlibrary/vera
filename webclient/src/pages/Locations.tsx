import React from "react";
import { LocationsProvider } from "../contexts/LocationsContext";
import WithProviders from "../components/wrappers/WithProviders";
import DataTableLayout from "../components/layouts/DataTableLayout";
import SubNavigationMenu from "../components/SubNavigationMenu";
import SubNavigationExtractions from "../components/navigation/SubNavigationExtractions";
import LocationsTable from "../features/extractions/LocationsTable";
import LocationsMenuButton from "../features/extractions/locations/LocationsMenuButton";

const Locations: React.FC = () => {
    return (
        <WithProviders providers={[LocationsProvider]}>
            <DataTableLayout
                header={
                    <SubNavigationMenu
                        start={<LocationsMenuButton />}
                        end={<SubNavigationExtractions />}
                    />
                }
                datatable={<LocationsTable />}
                paginator={<LocationsTable.Paginator />}
            />
        </WithProviders>
    );
};

export default Locations;
