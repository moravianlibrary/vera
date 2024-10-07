import React from "react";
import { Toolbar } from "primereact/toolbar";
import EsSearchBox from "../../components/elasticsearch/EsSearchBox";
import EsSelectionMenu from "../../components/elasticsearch/EsSelectionMenu";
import CatalogRecordsActionsMenuItems from "./CatalogRecordsActionsMenu";
import { useEsDataTable } from "../../contexts/EsDataTableContext";

interface CatalogRecordsHeaderProps {}

const CatalogRecordsHeader: React.FC<CatalogRecordsHeaderProps> = () => {
    return (
        <Toolbar
            center={<EsSearchBox />}
            end={
                <EsSelectionMenu
                    actionsMenuItems={CatalogRecordsActionsMenuItems()}
                    numSelectedLabel="catalog-records.num-selected"
                />
            }
        />
    );
};

export default CatalogRecordsHeader;
