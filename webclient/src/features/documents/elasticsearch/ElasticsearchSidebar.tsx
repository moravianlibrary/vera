import React, { useEffect, useState } from "react";
import {
    ErrorBoundary,
    Facet,
    SearchProvider,
    SearchBox,
    Sorting,
    WithSearch,
} from "@elastic/react-search-ui";
import { Layout, FacetViewProps } from "@elastic/react-search-ui-views";
import { esConfig, SORT_OPTIONS } from "./ElasticsearchConfig";
import { useDocuments } from "../../../contexts/documents/DocumentsContext";
import { Checkbox, CheckboxChangeEvent } from "primereact/checkbox";
import { Fieldset } from "primereact/fieldset";
import {
    FacetValue,
    FieldValue,
    FilterValue,
    QueryConfig,
    RequestState,
} from "@elastic/search-ui";
import DigitizationStateTag from "../../../components/tags/DigitizationStateTag";
import { DigitizationState } from "../../../types/DigitizationState";
import { SearchRequest } from "@elastic/search-ui-elasticsearch-connector";

interface ElasticsearchSearchBox {
    wasSearched: any;
}

interface CustomFacetViewProps extends FacetViewProps {
    onDisplayValue: (value: FieldValue) => React.ReactNode;
}

const CustomFacetView: React.FC<CustomFacetViewProps> = ({
    label,
    options,
    onChange,
    onRemove,
    onDisplayValue,
}) => {
    const handleChange = (e: CheckboxChangeEvent, value: FieldValue) => {
        if (e.target.checked) {
            onChange(value);
        } else {
            onRemove(value);
        }
    };

    return (
        <Fieldset className="es-facet-view-fieldset" legend={label} toggleable>
            {options.map((option) => (
                <div
                    key={option.value as string}
                    className={
                        option.selected
                            ? "es-facet-value es-active-facet-value"
                            : "es-facet-value"
                    }
                >
                    <div className="es-checkbox">
                        <Checkbox
                            className={`es-${option.value}-checkbox`}
                            inputId={`es-${label}-${option.value}-checkbox`}
                            value={option.value}
                            checked={option.selected || false}
                            onChange={(e) =>
                                handleChange(e, option.value as FieldValue)
                            }
                        />
                        {onDisplayValue(option.value as FieldValue)}
                    </div>
                    <span>{option.count}</span>
                </div>
            ))}
        </Fieldset>
    );
};

const ListFacetView: React.FC<FacetViewProps> = (props) => {
    const getCheckboxLabel = (value: FieldValue) => {
        return (
            <label htmlFor={`es-${props.label}-${value}-checkbox`}>
                {value as FieldValue}
            </label>
        );
    };

    return <CustomFacetView {...props} onDisplayValue={getCheckboxLabel} />;
};

const BooleanFacetView: React.FC<FacetViewProps> = (props) => {
    return (
        <ListFacetView
            {...props}
            options={props.options.sort((a, b) =>
                (a.value as string) === "true" ? -1 : 1
            )}
        />
    );
};

const DigitizationStateFacetView: React.FC<FacetViewProps> = (props) => {
    return (
        <CustomFacetView
            {...props}
            onDisplayValue={(value) => (
                <DigitizationStateTag state={value as DigitizationState} />
            )}
        />
    );
};

const ElasticsearchSearchBox: React.FC<ElasticsearchSearchBox> = ({
    wasSearched,
}) => {
    return (
        <div
            className="surface-50 border-right-1 border-200"
            style={{
                height: "calc(100vh - 180px)",
                overflowY: "auto",
            }}
        >
            {wasSearched && (
                <Sorting label={"Sort by"} sortOptions={SORT_OPTIONS} />
            )}
            <Facet
                field={"has_valid_main_record"}
                label="Has valid main record"
                view={BooleanFacetView}
            />
            <Facet
                field={"has_valid_cnb"}
                label="Has valid CNB"
                view={BooleanFacetView}
            />
            {/* <Facet field="material_type" label="Material Type" /> */}
            {/* <Facet field="issuance_type" label="Issuance Type" /> */}
            <Facet
                field="digitization_state"
                label="Digitization State"
                view={DigitizationStateFacetView}
            />
            <Facet field="added_by" label="Added By" view={ListFacetView} />
            {/* <Facet field="volume_number" label="Volume" view={ListFacetView} /> */}
            <Facet
                field="is_in_digitization_list"
                label="Is In Digitization List"
                view={BooleanFacetView}
            />
        </div>
    );
};

interface ElasticsearchSidebarProps {}

const ElasticsearchSidebar: React.FC<ElasticsearchSidebarProps> = () => {
    const { setIndexDocuments, setNumFound, page, pageSize } = useDocuments();

    // esConfig.apiConnector.afterResponse = (response) => {
    //     setIndexDocuments(response.hits.map((hit) => hit._source));
    //     setNumFound(response.total.value);
    // };

    useEffect(() => {
        esConfig.apiConnector.onSearch(
            {
                // ...esConfig.apiConnector.state,
                current: page,
                resultsPerPage: pageSize,
            },
            esConfig.searchQuery
        );
    }, [page, pageSize]);

    return (
        <SearchProvider config={esConfig}>
            <WithSearch
                mapContextToProps={({ wasSearched }) => ({
                    wasSearched,
                })}
            >
                {({ wasSearched }) => {
                    return (
                        <ErrorBoundary>
                            <ElasticsearchSearchBox wasSearched={wasSearched} />
                        </ErrorBoundary>
                    );
                    return (
                        <div className="App">
                            <ErrorBoundary>
                                <Layout
                                    header={
                                        <SearchBox
                                            autocompleteMinimumCharacters={3}
                                            autocompleteResults={{
                                                linkTarget: "_blank",
                                                sectionTitle: "Results",
                                                titleField: "title",
                                                urlField: "nps_link",
                                                shouldTrackClickThrough: true,
                                                clickThroughTags: ["test"],
                                            }}
                                            autocompleteSuggestions={true}
                                            debounceLength={0}
                                        />
                                    }
                                    sideContent={<div></div>}
                                />
                            </ErrorBoundary>
                        </div>
                    );
                }}
            </WithSearch>
        </SearchProvider>
    );
};

export default ElasticsearchSidebar;
