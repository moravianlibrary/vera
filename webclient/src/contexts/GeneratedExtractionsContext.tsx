import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
    useMemo,
} from "react";
import ApiExtractions, { Extraction } from "../adapters/ApiExtractions";
import { useToast } from "./ToastContext";
import { useTranslation } from "react-i18next";
import { useNotification } from "./NotificationContext";

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
    findExtraction: (digitization_list_id: number) => Promise<Extraction>;
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
    const api = useMemo(() => new ApiExtractions(), []);

    const { t } = useTranslation("extractions");
    const { showFailure } = useNotification();

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
                showFailure(t("actions.create.failure"));
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

    const findExtraction = async (extraction_id: number) => {
        return (await api.get(extraction_id)).data;
    };

    useEffect(() => {
        console.debug(`Fetching extractions from server.`);
        api.getPage(page, pageSize)
            .then((response) => {
                setExtractions(response.data.items);
                setNumFound(response.data.num_found);
            })
            .catch((error) => {
                console.error(`Could not receive extractions: ${error}`);
            });
    }, [page, pageSize, api]);

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
        findExtraction,
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
