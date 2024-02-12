import React from "react";
import { ExtractionsProvider } from "../contexts/extractions/ExtractionsContext";
import ExtractionsTable from "../features/extractions/ExtractionsTable";

const Extractions: React.FC = () => {
    return (
        <ExtractionsProvider>
            <ExtractionsTable />
        </ExtractionsProvider>
    );
};

export default Extractions;
