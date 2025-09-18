import { Badge, Label, Level, LevelItem } from "@patternfly/react-core";
import type { EsTermsBucket } from "../../models/es";
import { CheckCircleIcon, ResourcesEmptyIcon } from "@patternfly/react-icons";

interface EsTermsFilterLabelProps {
    bucket: EsTermsBucket;
    selected: boolean;
    onClick: () => void;
    renderBucketKey?: (key: string) => React.ReactNode;
}

const EsTermsFilterLabel = ({
    bucket,
    selected,
    onClick,
    renderBucketKey,
}: EsTermsFilterLabelProps) => {
    return (
        <Label
            key={bucket.key}
            variant="outline"
            color={selected ? "blue" : "grey"}
            icon={
                selected ? (
                    <CheckCircleIcon color="blue" />
                ) : (
                    <ResourcesEmptyIcon color="grey" />
                )
            }
            isClickable
            onClick={onClick}
        >
            <Level hasGutter>
                <LevelItem>
                    {renderBucketKey
                        ? renderBucketKey(bucket.key.toString())
                        : bucket.key}
                </LevelItem>
                <LevelItem>
                    <Badge isRead>{bucket.doc_count}</Badge>
                </LevelItem>
            </Level>
        </Label>
    );
};

export default EsTermsFilterLabel;
