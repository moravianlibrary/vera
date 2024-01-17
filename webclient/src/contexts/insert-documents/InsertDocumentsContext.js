import { createContext, useContext, useState } from "react";
import { IdentifierType } from "../../types/IdentifierType";
import { useTranslation } from "react-i18next";

const InsertDocumentsContext = createContext();

export const InsertDocumentsProvider = ({ children }) => {
    const { t } = useTranslation();
    const identifiers = [
        {
            value: IdentifierType.Sysno,
            label: t(IdentifierType.Sysno.toLowerCase())
        }, {
            value: IdentifierType.Barcode,
            label: t(IdentifierType.Barcode.toLowerCase())
    }];
    const [identifier, setIdentifier] = useState(identifiers[0]);
    
    const [results, setResults] = useState([]);

    return (
        <InsertDocumentsContext.Provider value={{
            identifiers, identifier, setIdentifier,
            results
        }}>
            {children}
        </InsertDocumentsContext.Provider>
    );
};

export const useInsertDocuments = () => {
    const context = useContext(InsertDocumentsContext);
    if (!context) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};

