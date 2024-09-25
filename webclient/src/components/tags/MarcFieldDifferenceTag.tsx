import React from "react";
import { useTranslation } from "react-i18next";
import { MarcFieldDifference } from "../../adapters/ApiCatalogRecords";
import { Tag } from "primereact/tag";

interface MarcFieldDifferenceTagProps {
    difference: MarcFieldDifference;
}

const MarcFieldDifferenceTag: React.FC<MarcFieldDifferenceTagProps> = ({
    difference: d,
}) => {
    const { t } = useTranslation();

    const differenceTypeLabel = t(
        `catalog-records.table.difference.${d.difference_type}`
    );
    const label = d.control_field
        ? `${differenceTypeLabel}: ${d.tag} CTL`
        : `${differenceTypeLabel}: ${d.tag} ${d.ind1 || "_"} ${
              d.ind2 || "_"
          } | ${d.subfield_differences.map((sd) => sd.code).join(", ")}`;

    return (
        <Tag
            className={`tag-marc-difference-${d.difference_type.toLocaleLowerCase()}`}
            value={label}
        />
    );
};

export default MarcFieldDifferenceTag;
