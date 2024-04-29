import React, { useRef, useState } from "react";
import { GeneratedExtractionsProvider } from "../contexts/extractions/GeneratedExtractionsContext";
import ExtractionsTable from "../features/extractions/GeneratedExtractionsTable";
import { useTranslation } from "react-i18next";
import { OverlayPanel } from "primereact/overlaypanel";
import { Button } from "primereact/button";
import ExtractionPropsMenu from "../features/extractions/GenerateExtractionMenu";
import { SelectButton } from "primereact/selectbutton";
import { Toolbar } from "primereact/toolbar";
import { DigitizationListsProvider } from "../contexts/extractions/DigitizationListsContext";
import DigitizationListsTable from "../features/extractions/DigitizationListsTable";
import LocationsTable from "../features/extractions/locations/LocationsTable";
import { LocationsProvider } from "../contexts/extractions/locations/LocationsContext";
import CreateLocationMenu from "../features/extractions/locations/CreateLocationMenu";

const Extractions: React.FC = () => {
    const { t } = useTranslation();

    const propsMenuPanel = useRef<OverlayPanel>(null);
    const createLocationMenuPanel = useRef<OverlayPanel>(null);

    const [table, setTable] = useState(1);
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

    const createLocationMenu = (
        <React.Fragment>
            <Button
                className="fixed"
                icon="pi pi-angle-down"
                label={t("Create location")}
                outlined
                onClick={(e) => createLocationMenuPanel.current!.toggle(e)}
            />
            <OverlayPanel ref={createLocationMenuPanel}>
                <CreateLocationMenu />
            </OverlayPanel>
        </React.Fragment>
    );

    const selectTableButton = (
        <SelectButton
            value={table}
            onChange={(e) => setTable(e.value ? e.value : table)}
            optionLabel="name"
            options={tables}
        />
    );

    return (
        <DigitizationListsProvider>
            <GeneratedExtractionsProvider>
                <LocationsProvider>
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
                    {table === 1 && <ExtractionsTable />}
                    {table === 2 && <DigitizationListsTable />}
                    {table === 3 && <LocationsTable />}
                </LocationsProvider>
            </GeneratedExtractionsProvider>
        </DigitizationListsProvider>
    );
};

export default Extractions;
