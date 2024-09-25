import React from "react";
import {
    Marc21Diff,
    Marc21DiffRecord,
    Marc21DiffType,
} from "../../adapters/ApiCatalogRecords";
import { Button } from "primereact/button";
import { useTranslation } from "react-i18next";

interface MarcRecordsDiffViewProps {
    record1Label: string;
    record2Label: string;
    diffRecord: Marc21DiffRecord | null;
}

const PERMANENT_LINK_MZK =
    "https://aleph.mzk.cz:443/F?func=direct&doc_number={SYSNO}&local_base={BASE}&format=001";
const PERMANENT_LINK_NKP =
    "https://aleph.nkp.cz/F/?func=direct&doc_number={SYSNO}&local_base={BASE}&format=001";

const MarcRecordsDiffView: React.FC<MarcRecordsDiffViewProps> = ({
    record1Label,
    record2Label,
    diffRecord,
}) => {
    const { t } = useTranslation();

    if (diffRecord === null) {
        return <div />;
    }

    const getIndicatorRepresentation = (indicator: string | null) => {
        return indicator !== null && indicator !== "" ? indicator : " ";
    };

    const getFieldRepresentation = (index, field, prefix, className) => {
        return (
            <tr key={`${index}_${field.tag}`} className={className}>
                <td
                    key="tag"
                    className="font-bold"
                >{`${prefix} ${field.tag}`}</td>
                <td key="indicator1">
                    {getIndicatorRepresentation(field.indicator1)}
                </td>
                <td key="indicator2">
                    {getIndicatorRepresentation(field.indicator2)}
                </td>
                <td key="data">
                    {field.control_field
                        ? field.data
                        : field.subfields.map((subfield, index) => (
                              <span key={index}>
                                  <span className="font-bold">
                                      {subfield.code}|
                                  </span>{" "}
                                  {subfield.value}
                                  {index < field.subfields.length - 1 && " "}
                              </span>
                          ))}
                </td>
            </tr>
        );
    };

    const getDiffBody = (diff: Marc21Diff, index: number) => {
        if (diff.type === Marc21DiffType.DifferentValue) {
            return (
                <tr key={`${index}_${diff.field.tag}`}>
                    <td className="font-bold text-purple-700">{`~ ${diff.field.tag}`}</td>
                    <td className="text-purple-700" colSpan={2}>
                        CTL
                    </td>
                    <td>
                        <span className="text-green-700">
                            {diff.field.data}
                        </span>
                        <span className="text-purple-700 font-bold">
                            {` ${t("catalog.record.value-differs")} `}
                        </span>
                        <span className="text-red-700">{diff.value}</span>
                    </td>
                </tr>
            );
        }
        if (diff.type === Marc21DiffType.ExtraField) {
            return getFieldRepresentation(
                index,
                diff.field,
                "+",
                "text-green-700"
            );
        }
        if (diff.type === Marc21DiffType.MissingField) {
            return getFieldRepresentation(
                index,
                diff.field,
                "-",
                "text-red-700"
            );
        }
        return getFieldRepresentation(index, diff.field, "=", "text-blue-700");
    };

    const getRecordUrl = (sysno: string) => {
        if (sysno.startsWith("MZK")) {
            const splittedSysno = sysno.split("-");
            return PERMANENT_LINK_MZK.replace(
                "{SYSNO}",
                splittedSysno[1]
            ).replace("{BASE}", splittedSysno[0]);
        }
        if (sysno.startsWith("SKC")) {
            const splittedSysno = sysno.split("-");
            return PERMANENT_LINK_NKP.replace(
                "{SYSNO}",
                splittedSysno[1]
            ).replace("{BASE}", splittedSysno[0]);
        }
        return PERMANENT_LINK_NKP.replace("{SYSNO}", sysno).replace(
            "{BASE}",
            "CNB"
        );
    };

    return (
        <div className="flex flex-column gap-1">
            <Button
                className="text-green-700"
                icon="pi pi-external-link"
                iconPos="right"
                outlined
                label={`${record1Label}: ${diffRecord.sysno1}`}
                onClick={() =>
                    window.open(getRecordUrl(diffRecord.sysno1!), "_blank")
                }
            />
            <Button
                className="text-red-700"
                icon="pi pi-external-link"
                iconPos="right"
                outlined
                label={`${record2Label}: ${diffRecord.sysno2}`}
                onClick={() =>
                    window.open(getRecordUrl(diffRecord.sysno2!), "_blank")
                }
            />
            <table className="table-auto w-full">
                <tbody>{diffRecord.diffs.map(getDiffBody)}</tbody>
            </table>
        </div>
    );
};

export default MarcRecordsDiffView;
