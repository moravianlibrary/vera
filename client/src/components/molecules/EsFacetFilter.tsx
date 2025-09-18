import { Flex, FlexItem } from "@patternfly/react-core";
import type { EsTermsBucket, EsTermsFilterConfig } from "../../models/es";
import EsTermsFilterLabel from "../atoms/EsTermsFilterLabel";

interface EsTermsFilterProps {
    key?: string;
    config: EsTermsFilterConfig;
    buckets: EsTermsBucket[];
    selected: string[];
    onToggle: (bucketKey: string) => void;
    onSearch?: (query: string) => void;
}

const EsTermsFilter = ({
    key,
    buckets,
    config,
    selected,
    onToggle,
    onSearch,
}: EsTermsFilterProps) => {
    return (
        <Flex
            key={key}
            direction={{ default: "row" }}
            wrap="wrap"
            gap={{ default: "gapMd" }}
        >
            {buckets.map((bucket) => (
                <FlexItem key={bucket.key}>
                    <EsTermsFilterLabel
                        bucket={bucket}
                        selected={selected.includes(bucket.key.toString())}
                        onClick={() => onToggle(bucket.key.toString())}
                        renderBucketKey={config.renderBucketKey}
                    />
                </FlexItem>
            ))}
        </Flex>
    );
};

export default EsTermsFilter;
