import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiExtractions, { Extraction } from "../../adapters/ApiExtractions";
import { useToast } from "../ToastContext";
import { useTranslation } from "react-i18next";

interface ExtractionsContextProps {
    extractions: Extraction[];
    numFound: number;
    page: number;
    setPage: (page: number) => void;
    pageSize: number;
    setPageSize: (pageSize: number) => void;
    defaultProps: Partial<Extraction>;
    generateExtraction: (createProps: Partial<Extraction>) => void;
    generating: boolean;
    deleteExtraction: (id: number) => void;
}

const ExtractionsContext = createContext<ExtractionsContextProps | undefined>(
    undefined
);

interface ExtractionsProviderProps {
    children: ReactNode;
}

export const GeneratedExtractionsProvider: React.FC<
    ExtractionsProviderProps
> = ({ children }) => {
    const api = new ApiExtractions();

    const { t } = useTranslation();
    const showToast = useToast();

    const defaultProps: Partial<Extraction> = {
        include_categories: [],
        location_ids: [],
        target_pages_threshold: 0.05,
        whole_categories_threshold: 0.05,
    };
    const [extractions, setExtractions] = useState<Extraction[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [page, setPage] = useState<number>(1);
    const [pageSize, setPageSize] = useState<number>(20);
    const [generating, setGenerating] = useState(false);

    const loadExtractions = async (offset: number, limit: number) => {
        api.getPage(offset, limit)
            .then((response) => {
                setExtractions(response.data.items);
                setNumFound(response.data.num_found);
            })
            .catch((error) => {
                console.error(`Could not receive extractions: ${error}`);
            });
    };

    const generateExtraction = async (
        extractionParams: Partial<Extraction>
    ) => {
        setGenerating(true);
        try {
            const response = await api.create(extractionParams);
            setExtractions([response.data, ...extractions]);
        } catch (error) {
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
        } finally {
            setGenerating(false);
        }
    };

    const deleteExtraction = async (extraction_id: number) => {
        api.delete(extraction_id)
            .then(() => {
                setExtractions(
                    extractions.filter(
                        (extraction) => extraction.id !== extraction_id
                    )
                );
            })
            .catch((error) => {
                console.error(error);
            });
    };

    useEffect(() => {
        console.log(`Fetching extractions from server.`);
        loadExtractions(page, pageSize);
    }, [page, pageSize]);

    const contextValue: ExtractionsContextProps = {
        extractions,
        numFound,
        page,
        setPage,
        pageSize,
        setPageSize,
        defaultProps,
        generateExtraction,
        generating,
        deleteExtraction,
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
