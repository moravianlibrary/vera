import { CatalogRecord } from "../../../adapters/ApiCatalogRecords";
import MarcFieldDifferenceTag from "../../../components/tags/MarcFieldDifferenceTag";
import SkcRecordFlag from "../../../types/SkcRecordFlag";
import SkcRecordFlagTag from "../../../components/tags/SkcRecordFlagTag";

const SkcValidityColumnBody = (catalogRecord: CatalogRecord) => {
    const skcRecordFlags = catalogRecord.skc_record_flags.filter(
        (f): f is SkcRecordFlag =>
            Object.values(SkcRecordFlag).includes(f as SkcRecordFlag)
    );

    return (
        <div className="flex flex-wrap gap-2">
            {skcRecordFlags.map((flag, index) => (
                <SkcRecordFlagTag key={index} value={flag} />
            ))}
            {catalogRecord.skc_difference
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

export default SkcValidityColumnBody;
