import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiExtractions, {
    Extraction,
    ExtractionProps,
} from "../../adapters/ApiExtractions";
import ExtractionModel from "./ExtractionModel";
import { useToast } from "../toast/ToastContext";
import { useTranslation } from "react-i18next";

interface ExtractionsContextProps {
    extractions: Extraction[];
    numFound: number;
    defaultProps: ExtractionProps;
    generateExtraction: (
        createProps: ExtractionProps,
        pages_count?: number,
        quota_id?: number
    ) => void;
    markExtraction: (extraction_id: number) => void;
    unmarkExtraction: (extraction_id: number) => void;
}

const ExtractionsContext = createContext<ExtractionsContextProps | undefined>(
    undefined
);

interface ExtractionsProviderProps {
    children: ReactNode;
}

export const ExtractionsProvider: React.FC<ExtractionsProviderProps> = ({
    children,
}) => {
    const { t } = useTranslation();
    const showToast = useToast();

    const defaultProps: ExtractionProps = {
        target_pages_threshold: 0.05,
        whole_categories_threshold: 0.05,
        balance_total_pages: false,
        include_categories: [],
    };
    const loadAmount = 50;
    const [offset, setOffset] = useState<number>(0);
    const [extractions, setExtractions] = useState<Extraction[]>([]);
    const [numFound, setNumFound] = useState<number>(0);

    const loadExtractions = async () => {
        ApiExtractions.getExtractions(offset, loadAmount)
            .then((response) => {
                const transformedData: Extraction[] =
                    response.data.extractions.map((extraction) => {
                        return new ExtractionModel(extraction);
                    });
                setExtractions(transformedData);
                setNumFound(response.data.num_found);
            })
            .catch((error) => {
                console.error(`Could not receive extractions: ${error}`);
            });
    };

    const generateExtraction = async (
        createData: ExtractionProps,
        pages_count?: number,
        quota_id?: number
    ) => {
        console.log(createData);
        ApiExtractions.generateExtraction(createData, pages_count, quota_id)
            .then((response) => {
                setExtractions([
                    new ExtractionModel(response.data),
                    ...extractions,
                ]);
            })
            .catch((error) => {
                if (
                    error.response &&
                    error.response.status &&
                    error.response.status === 400
                ) {
                    showToast(
                        "error",
                        t("Extraction creation failed"),
                        t(error.response.data.detail)
                    );
                }
                console.error(error);
            });
    };

    const markExtraction = async (extraction_id: number) => {
        ApiExtractions.markExtracted(extraction_id)
            .then((response) => {
                setExtractions(
                    extractions.map((extraction) => {
                        if (extraction.id === extraction_id) {
                            return {
                                ...extraction,
                                marked: true,
                            };
                        }
                        return extraction;
                    })
                );
            })
            .catch((error) => {
                console.error(error);
            });
    };

    const unmarkExtraction = async (extraction_id: number) => {
        ApiExtractions.unmarkExtracted(extraction_id)
            .then((response) => {
                setExtractions(
                    extractions.map((extraction) => {
                        if (extraction.id === extraction_id) {
                            return {
                                ...extraction,
                                marked: false,
                            };
                        }
                        return extraction;
                    })
                );
            })
            .catch((error) => {
                console.error(error);
            });
    };

    useEffect(() => {
        console.log(`Fetching extractions from server.`);
        loadExtractions();
    }, []);

    const contextValue: ExtractionsContextProps = {
        extractions,
        numFound,
        defaultProps,
        generateExtraction,
        markExtraction,
        unmarkExtraction,
    };

    return (
        <ExtractionsContext.Provider value={contextValue}>
            {children}
        </ExtractionsContext.Provider>
    );
};

export const useExtractions = (): ExtractionsContextProps => {
    const context = useContext(ExtractionsContext);

    if (!context) {
        throw new Error(
            "useExtractions must be used within a ExtractionsProvider"
        );
    }

    return context;
};
