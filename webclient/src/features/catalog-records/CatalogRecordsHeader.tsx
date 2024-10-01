import React from "react";
import { Toolbar } from "primereact/toolbar";
import EsSearchBox from "../../components/elasticsearch/EsSearchBox";

interface CatalogRecordsHeaderProps {}

const CatalogRecordsHeader: React.FC<CatalogRecordsHeaderProps> = () => {
    return <Toolbar center={<EsSearchBox />} />;
};

export default CatalogRecordsHeader;
