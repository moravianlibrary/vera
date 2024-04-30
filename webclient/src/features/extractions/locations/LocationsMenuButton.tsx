import React, { useRef, useState } from "react";
import CreateLocationMenu from "./CreateLocationMenu";
import { OverlayPanel } from "primereact/overlaypanel";
import { useTranslation } from "react-i18next";
import { SplitButton } from "primereact/splitbutton";
import TabSeparatedInput from "../../../components/TabSeparatedInput";

const LocationsMenuButton = () => {
    const { t } = useTranslation();

    const createLocationMenuPanel = useRef<OverlayPanel>(null);

    const [tabSeparatedInputVisible, setTabSeparatedInputVisible] =
        useState<boolean>(false);
    const [tabSeparatedValues, setTabSeparatedValues] = useState<string[]>([]);

    const items = [
        {
            label: t("Insert using tab separated text input"),
            icon: "pi pi-clipboard",
            command: () => setTabSeparatedInputVisible(true),
        },
    ];

    const valuesMappers = [
        {
            label: t("Library"),
            singleColumn: true,
        },
        {
            label: t("Storage"),
            singleColumn: true,
        },
        {
            label: t("Location name"),
            singleColumn: true,
        },
    ];

    return (
        <React.Fragment>
            <SplitButton
                className="fixed"
                icon="pi pi-angle-down"
                dropdownIcon="pi pi-ellipsis-v"
                label={t("Create location")}
                outlined
                model={items}
                onClick={(e) => createLocationMenuPanel.current!.toggle(e)}
            />
            <OverlayPanel ref={createLocationMenuPanel}>
                <CreateLocationMenu />
            </OverlayPanel>
            <TabSeparatedInput
                visible={tabSeparatedInputVisible}
                onHide={() => setTabSeparatedInputVisible(false)}
                valueMappers={valuesMappers}
                onSubmit={setTabSeparatedValues}
            />
        </React.Fragment>
    );
};

export default LocationsMenuButton;
