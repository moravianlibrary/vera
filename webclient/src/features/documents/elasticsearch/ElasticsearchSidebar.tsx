import React, { useEffect, useState } from "react";
import {
    ErrorBoundary,
    Facet,
    SearchProvider,
    SearchBox,
    Results,
    PagingInfo,
    ResultsPerPage,
    Paging,
    Sorting,
    WithSearch,
} from "@elastic/react-search-ui";
import {
    BooleanFacet,
    Layout,
    SingleLinksFacet,
    SingleSelectFacet,
} from "@elastic/react-search-ui-views";
import { config, SORT_OPTIONS } from "./ElasticsearchConfig";
import DocumentsTable from "../DocumentsTable";
import { TableViewType } from "../DocumentsHeader";
import { useDocuments } from "../../../contexts/documents/DocumentsContext";

interface ElasticsearchSearchBox {
    wasSearched: any;
}

const ElasticsearchSearchBox: React.FC<ElasticsearchSearchBox> = ({
    wasSearched,
}) => {
    useEffect(() => {
        console.log("searching");
        console.log(wasSearched);
    }, [wasSearched]);

    return (
        <div>
            {wasSearched && (
                <Sorting label={"Sort by"} sortOptions={SORT_OPTIONS} />
            )}
            <Facet
                field={"title"}
                label="States"
                filterType="any"
                isFilterable={true}
            />
            <Facet
                field={"world_heritage_site"}
                label="World Heritage Site"
                view={BooleanFacet}
            />
            <Facet field="visitors" label="Visitors" view={SingleLinksFacet} />
            <Facet
                field="date_established"
                label="Date Established"
                isFilterable={true}
                filterType="any"
            />
            <Facet field="location" label="Distance" filterType="any" />
            <Facet field="acres" label="Acres" view={SingleSelectFacet} />
        </div>
    );
};

interface ElasticsearchSidebarProps {}

const ElasticsearchSidebar: React.FC<ElasticsearchSidebarProps> = () => {
    const { setIndexDocuments } = useDocuments();
    config.apiConnector.afterResponse = (response) => {
        setIndexDocuments(response.hits.map((hit) => hit._source));
    };
    return (
        <SearchProvider config={config}>
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
