import React from "react";
import { GeneratedExtractionsProvider } from "../contexts/GeneratedExtractionsContext";
import ExtractionsTable from "../features/extractions/ExtractionsTable";
import { useTranslation } from "react-i18next";
import ExtractionPropsMenu from "../features/extractions/GenerateExtractionMenu";
import WithProviders from "../components/wrappers/WithProviders";
import DataTableLayout from "../components/layouts/DataTableLayout";
import SubNavigationMenu from "../components/navigation/SubNavigationMenu";
import OverlayFormLayout from "../components/layouts/OverlayFormLayout";
import SubNavigationExtractions from "../components/navigation/SubNavigationExtractions";
import { LocationsProvider } from "../contexts/LocationsContext";

const Extractions: React.FC = () => {
    const { t } = useTranslation("extractions");

    return (
        <WithProviders
            providers={[GeneratedExtractionsProvider, LocationsProvider]}
        >
            <DataTableLayout
                header={
                    <SubNavigationMenu
                        start={
                            <OverlayFormLayout
                                buttonProps={{
                                    label: t("actions.create.label"),
                                }}
                                form={<ExtractionPropsMenu />}
                            />
                        }
                        end={<SubNavigationExtractions />}
                    />
                }
                datatable={<ExtractionsTable />}
                paginator={<ExtractionsTable.Paginator />}
            />
        </WithProviders>
    );
};

export default Extractions;
