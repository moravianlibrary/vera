import { Column } from "primereact/column";
import { DataTable } from "primereact/datatable";
import React from "react";
import { useTranslation } from "react-i18next";
import { useLocations } from "../../contexts/extractions/locations/LocationsContext";

interface LocationsTableProps {}

const LocationsTable: React.FC<LocationsTableProps> = () => {
    const { t } = useTranslation();
    const { locations } = useLocations();

    return (
        <div>
            <DataTable value={locations}>
                <Column header={t("Library")} field="library_name" />
                <Column header={t("Storage")} field="storage_name" />
                <Column header={t("Location")} field="name" />
                <Column header={t("Regular expression")} field="regexp" />
                <Column header={t("Description")} field="description" />
                <Column
                    header={t("Additional information")}
                    field="additional_info"
                />
            </DataTable>
        </div>
    );
};

export default LocationsTable;
