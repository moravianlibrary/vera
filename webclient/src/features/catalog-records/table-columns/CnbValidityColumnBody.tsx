import { CatalogRecord } from "../../../adapters/ApiCatalogRecords";
import CnbRecordFlag from "../../../types/CnbRecordFlag";
import CnbRecordFlagTag from "../../../components/tags/CnbRecordFlagTag";
import MarcFieldDifferenceTag from "../../../components/tags/MarcFieldDifferenceTag";

const CnbValidityColumnBody = (catalogRecord: CatalogRecord) => {
    const cnbRecordFlags = catalogRecord.cnb_record_flags.filter(
        (f): f is CnbRecordFlag =>
            Object.values(CnbRecordFlag).includes(f as CnbRecordFlag)
    );

    return (
        <div className="flex flex-wrap gap-2">
            {cnbRecordFlags.map((flag, index) => (
                <CnbRecordFlagTag key={index} value={flag} />
            ))}
            {catalogRecord.cnb_difference
                .sort((a, b) => a.tag.localeCompare(b.tag))
                .map((difference, index) => (
                    <MarcFieldDifferenceTag
                        key={index}
                        difference={difference}
                    />
                ))}
        </div>
    );
};

export default CnbValidityColumnBody;
