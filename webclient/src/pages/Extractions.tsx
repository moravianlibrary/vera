import React, { useRef, useState } from "react";
import { GeneratedExtractionsProvider } from "../contexts/GeneratedExtractionsContext";
import ExtractionsTable from "../features/extractions/ExtractionsTable";
import { useTranslation } from "react-i18next";
import { OverlayPanel } from "primereact/overlaypanel";
import { Button } from "primereact/button";
import ExtractionPropsMenu from "../features/extractions/GenerateExtractionMenu";
import { SelectButton } from "primereact/selectbutton";
import { Toolbar } from "primereact/toolbar";
import { DigitizationListsProvider } from "../contexts/DigitizationListsContext";
import DigitizationListsTable from "../features/extractions/DigitizationListsTable";
import LocationsTable from "../features/extractions/LocationsTable";
import { LocationsProvider } from "../contexts/LocationsContext";
import LocationsMenuButton from "../features/extractions/locations/LocationsMenuButton";
import WithProviders from "../components/wrappers/WithProviders";
import DataTableLayout from "../components/layouts/DataTableLayout";

const Extractions: React.FC = () => {
    const { t } = useTranslation();

    const propsMenuPanel = useRef<OverlayPanel>(null);

    const [table, setTable] = useState<number>(1);
    const tables = [
        { name: t("Generate extractions"), value: 1 },
        { name: t("Digitization lists"), value: 2 },
        { name: t("Storage locations"), value: 3 },
    ];

    const generateExtractionMenu = (
        <React.Fragment>
            <Button
                className="fixed"
                icon="pi pi-angle-down"
                label={t("Generate extraction")}
                outlined
                onClick={(e) => propsMenuPanel.current!.toggle(e)}
            />
            <OverlayPanel ref={propsMenuPanel}>
                <ExtractionPropsMenu />
            </OverlayPanel>
        </React.Fragment>
    );

    const createLocationMenu = <LocationsMenuButton />;

    const selectTableButton = (
        <SelectButton
            value={table}
            onChange={(e) => setTable(e.value ? e.value : table)}
            optionLabel="name"
            options={tables}
        />
    );

    const getTableComponent = () => {
        switch (table) {
            case 1:
                return ExtractionsTable;
            case 2:
                return DigitizationListsTable;
            case 3:
                return LocationsTable;
        }
    };

    return (
        <WithProviders
            providers={[
                DigitizationListsProvider,
                GeneratedExtractionsProvider,
                LocationsProvider,
            ]}
        >
            <DataTableLayout
                header={
                    <Toolbar
                        start={
                            table === 1
                                ? generateExtractionMenu
                                : table === 3
                                ? createLocationMenu
                                : null
                        }
                        center={selectTableButton}
                    />
                }
                datatable={
                    (table === 1 && <ExtractionsTable />) ||
                    (table === 2 && <DigitizationListsTable />) ||
                    (table === 3 && <LocationsTable />) ||
                    null
                }
                paginator={
                    (table === 1 && <ExtractionsTable.Paginator />) ||
                    (table === 2 && <DigitizationListsTable.Paginator />) ||
                    (table === 3 && <LocationsTable.Paginator />) ||
                    null
                }
            />
        </WithProviders>
    );
};

export default Extractions;
