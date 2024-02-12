import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import ApiExtractions, { Extraction } from "../../adapters/ApiExtractions";
import ExtractionModel from "./ExtractionModel";

interface ExtractionsContextProps {
    extractions: Extraction[];
    numFound: number;
}

const ExtractionsContext = createContext<ExtractionsContextProps | undefined>(undefined);

interface ExtractionsProviderProps {
    children: ReactNode;
}

export const ExtractionsProvider: React.FC<ExtractionsProviderProps> = ({ children }) => {
    const loadAmount = 50;
    const [offset, setOffset] = useState<number>(0);
    const [extractions, setExtractions] = useState<Extraction[]>([]);
    const [numFound, setNumFound] = useState<number>(0);

    const loadExtractions = async () => {
        ApiExtractions.getExtractions(offset, loadAmount)
        .then(response => {
            const transformedData: Extraction[] = response.data.extractions.map(extraction => {
                return new ExtractionModel(extraction);
            });
            setExtractions(transformedData);
            setNumFound(response.data.num_found);
        }).catch(error => {
            console.error(`Could not receive extractions: ${error}`);
        });
    };

    useEffect(() => {
        console.log(`Fetching extractions from server.`);
        loadExtractions();
    }, []);

    const contextValue: ExtractionsContextProps = {
        extractions,
        numFound
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
        throw new Error('useExtractions must be used within a ExtractionsProvider');
    }

    return context;
};
