import React from "react";
import { useTranslation } from "react-i18next";
import { Tag } from "primereact/tag";
import { MaterialType } from "../../types/MaterialType";

interface MaterialTypeTagProps {
    materialType: MaterialType;
}

const MaterialTypeTag: React.FC<MaterialTypeTagProps> = ({ materialType }) => {
    const { t } = useTranslation("types");

    switch (materialType) {
        case MaterialType.ContinuingResource:
            return (
                <Tag
                    value={t(`document-type.periodical`)}
                    className="tag dt-periodical-tag"
                />
            );
        case MaterialType.Book:
            return (
                <Tag
                    value={t(`document-type.monograph`)}
                    className="tag dt-monograph-tag"
                />
            );
        case MaterialType.Graphic:
            return (
                <Tag
                    value={t(`document-type.graphic`)}
                    className="tag dt-graphic-tag"
                />
            );
        case MaterialType.Map:
            return (
                <Tag
                    value={t(`document-type.map`)}
                    className="tag dt-map-tag"
                />
            );
        case MaterialType.Music:
            return (
                <Tag
                    value={t(`document-type.music`)}
                    className="tag dt-music-tag"
                />
            );
        case MaterialType.Other:
            return (
                <Tag
                    value={t(`document-type.other`)}
                    className="tag dt-other-tag"
                />
            );
    }
};

const valueToMaterialTypeTag = (value: string) => {
    return <MaterialTypeTag materialType={value as MaterialType} />;
};

export default MaterialTypeTag;
export { valueToMaterialTypeTag };
