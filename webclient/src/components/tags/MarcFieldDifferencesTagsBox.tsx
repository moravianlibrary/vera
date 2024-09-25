import React from "react";
import { MarcFieldDifference } from "../../adapters/ApiCatalogRecords";
import MarcFieldDifferenceTag from "./MarcFieldDifferenceTag";

interface MarcFieldDifferencesTagsBoxProps {
    differences: MarcFieldDifference[];
}

const MarcFieldDifferencesTagsBox: React.FC<
    MarcFieldDifferencesTagsBoxProps
> = ({ differences }) => {
    return (
        <div className="flex m-1 gap-2">
            {differences.map((difference, index) => (
                <MarcFieldDifferenceTag key={index} difference={difference} />
            ))}
        </div>
    );
};

export default MarcFieldDifferencesTagsBox;
