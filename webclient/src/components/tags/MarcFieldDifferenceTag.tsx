import React from "react";
import { useTranslation } from "react-i18next";
import { MarcFieldDifference } from "../../adapters/ApiCatalogRecords";
import MarcFieldDifferenceTypeTag from "./MarcFieldDifferenceTypeTag";

interface MarcFieldDifferenceTagProps {
    difference: MarcFieldDifference;
}

const MarcFieldDifferenceTag: React.FC<MarcFieldDifferenceTagProps> = ({
    difference: d,
}) => {
    const { t } = useTranslation("types");

    const differenceTypeLabel = t(`marc-difference.${d.difference_type}`);
    const label = d.control_field
        ? `${differenceTypeLabel}: ${d.tag} CTL`
        : `${differenceTypeLabel}: ${d.tag} ${d.ind1 || "_"} ${
              d.ind2 || "_"
          } | ${d.subfield_differences.map((sd) => sd.code).join(", ")}`;

    return (
        <MarcFieldDifferenceTypeTag
            differenceType={d.difference_type}
            approved={d.approved_by !== undefined && d.approved_by !== null}
            value={label}
        />
    );
};

export default MarcFieldDifferenceTag;
