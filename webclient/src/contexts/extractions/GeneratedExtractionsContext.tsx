import React, {
    createContext,
    useContext,
    useState,
    ReactNode,
    useEffect,
} from "react";
import ApiGeneratedExtractions, {
    GenerateExtraction,
    GeneratedExtraction,
} from "../../adapters/ApiGeneratedExtractions";
import ExtractionModel from "./GeneratedExtractionModel";
import { useToast } from "../toast/ToastContext";
import { useTranslation } from "react-i18next";

interface ExtractionsContextProps {
    loadExtractions: (offset: number, limit: number) => void;
    extractions: GeneratedExtraction[];
    numFound: number;
    defaultProps: GenerateExtraction;
    generateExtraction: (
        createProps: GenerateExtraction,
        pages_count?: number,
        quota_id?: number
    ) => void;
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
    const { t } = useTranslation();
    const showToast = useToast();

    const defaultProps: GenerateExtraction = {
        target_pages_threshold: 0.05,
        whole_categories_threshold: 0.05,
        include_categories: [],
        location_ids: [],
    };
    const loadAmount = 50;
    const [extractions, setExtractions] = useState<GeneratedExtraction[]>([]);
    const [numFound, setNumFound] = useState<number>(0);
    const [generating, setGenerating] = useState(false);

    const loadExtractions = async (offset: number, limit: number) => {
        ApiGeneratedExtractions.getExtractions(offset, limit)
            .then((response) => {
                const transformedData: GeneratedExtraction[] =
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
        createData: GenerateExtraction,
        pages_count?: number,
        quota_id?: number
    ) => {
        setGenerating(true);
        try {
            const response = await ApiGeneratedExtractions.generateExtraction(
                createData,
                pages_count,
                quota_id
            );
            setExtractions([
                new ExtractionModel(response.data),
                ...extractions,
            ]);
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

    const deleteExtraction = async (id: number) => {
        ApiGeneratedExtractions.deleteExtraction(id)
            .then(() => {
                setExtractions(
                    extractions.filter((extraction) => extraction.id !== id)
                );
            })
            .catch((error) => {
                console.error(error);
            });
    };

    useEffect(() => {
        console.log(`Fetching extractions from server.`);
        loadExtractions(0, loadAmount);
    }, []);

    const contextValue: ExtractionsContextProps = {
        loadExtractions,
        extractions,
        numFound,
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

export const useGeneratedExtractions = (): ExtractionsContextProps => {
    const context = useContext(ExtractionsContext);

    if (!context) {
        throw new Error(
            "useExtractions must be used within a ExtractionsProvider"
        );
    }

    return context;
};
