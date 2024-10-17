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
        <div className="flex flex-wrap gap-2">
            {differences.sort((a, b) => a.tag.localeCompare(b.tag)).map((difference, index) => (
                <MarcFieldDifferenceTag key={index} difference={difference} />
            ))}
        </div>
    );
};

export default MarcFieldDifferencesTagsBox;
