import {
    Button,
    EmptyState,
    EmptyStateBody,
    EmptyStateFooter,
    EmptyStateActions,
} from "@patternfly/react-core";
import SearchIcon from "@patternfly/react-icons/dist/esm/icons/search-icon";
import type { StaticUiText } from "../../models/ui/config";

interface NoMatchFoundStateProps {
    titleText: StaticUiText;
    bodyText: StaticUiText;
    clearFiltersText: StaticUiText;
    onClearFilters: () => void;
}

const NoMatchFoundState = ({
    titleText,
    bodyText,
    clearFiltersText,
    onClearFilters,
}: NoMatchFoundStateProps) => {
    return (
        <EmptyState titleText={titleText} headingLevel="h4" icon={SearchIcon}>
            <EmptyStateBody>{bodyText}</EmptyStateBody>
            <EmptyStateFooter>
                <EmptyStateActions>
                    <Button variant="link" onClick={onClearFilters}>
                        {clearFiltersText}
                    </Button>
                </EmptyStateActions>
            </EmptyStateFooter>
        </EmptyState>
    );
};

export default NoMatchFoundState;
