import React from "react";
import { ExtractionsProvider } from "../contexts/extractions/ExtractionsContext";
import ExtractionsTable from "../features/extractions/ExtractionsTable";
import ExtractionsHeader from "../features/extractions/ExtractionsHeader";

const Extractions: React.FC = () => {
    return (
        <ExtractionsProvider>
            <ExtractionsHeader />
            <ExtractionsTable />
        </ExtractionsProvider>
    );
};

export default Extractions;
