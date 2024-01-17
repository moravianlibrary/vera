import { createContext, useContext, useEffect, useState } from "react";
import { IdentifierType } from "../../types/IdentifierType";
import { useTranslation } from "react-i18next";
import { useAssignableCategories } from "../categories/CategoriesContext";
import { fi } from "date-fns/locale";
import ApiDocuments from "../../adapters/ApiDocuments";
import CreateResult from "../../documents/models/CreateResult";
import { DocumentCreationStatus } from "../../types/DocumentCreationStatus";

const InsertDocumentsContext = createContext();

export const InsertDocumentsProvider = ({ children }) => {
    const { t } = useTranslation();
    const { fetchCategories } = useAssignableCategories();

    // First step variables
    const identifiers = [
        {
            value: IdentifierType.Sysno,
            label: t(IdentifierType.Sysno.toLowerCase())
        }, {
            value: IdentifierType.Barcode,
            label: t(IdentifierType.Barcode.toLowerCase())
    }];
    const [identifier, setIdentifier] = useState(identifiers[0]);
    const [categories, setCategories] = useState([]);
    const [category, setCategory] = useState(null);

    // Second step variables
    const [value, setValue] = useState("");
    const [filePath, setFilePath] = useState(null);
    
    // Third step variables
    const [chooseIssuesDocuments, setChooseIssuesDocuments] = useState([]);
    const [creatingIssues, setCreatingIssues] = useState([]);
    const [createdIssues, setCreatedIssues] = useState([]);

    // Fourth step variables
    const [results, setResults] = useState([]);

    // First step functions
    const setIdentifierByValue = (value) => {
        const filteredIdentifiers = identifiers.filter(i => i.value === value);
        if (filteredIdentifiers.length === 1) {
            setIdentifier(filteredIdentifiers[0]);
        }
    };

    // Second step functions
    const acceptInput = async () => {
        ApiDocuments.insertDocument({identifier_type: identifier.value, value: value}, category ? category.id : null, false)
        .then(response => {
            if (response.data.create_result === CreateResult.MULTIPLE_ISSUE_CHOICES) {
                setChooseIssuesDocuments([response.data]);
                setResults([]);
            } else {
                setChooseIssuesDocuments([]);
                setResults([response.data]);
            }
            setValue("");
        }).catch(error => {
            console.error(`Error while inserting document: ${error}`);
        });
        // const result = await dataService.insertDocument(identifier, values.value, category, false);
        // if (result.create_result === CreateResult.MULTIPLE_ISSUE_CHOICES) {
        //     dataService.setMultiIssueDocuments([result]);
        //     // .filter(result => result.create_result === CreateResult.MULTIPLE_ISSUE_CHOICES);
        //     setActiveIndex(2);
        // } else {
        //     showResults([result]);
        //     setActiveIndex(3);
        //     const hasSuccesfulInsert = result.create_result === CreateResult.SUCCESS;
        //     if (hasSuccesfulInsert && props.onInsert) {
        //         props.onInsert();
        //     }
        // }
    };

    // Third step functions
    const createIssue = async (index, issue) => {
        setCreatingIssues(prevCreatingIssues => [...prevCreatingIssues, issue]);

        ApiDocuments.insertDocument({identifier_type: IdentifierType.Barcode, value: issue.barcode}, category, false)
        .then(response => {
            if (response.data.create_result !== DocumentCreationStatus.Success) {
                console.error('Could not create given issue. This code should be unreachable.');;
            }
            setCreatingIssues(prevCreatingIssues => prevCreatingIssues.filter(i => i.barcode !== issue.barcode));
            setCreatedIssues(prevCreatedIssues => [...prevCreatedIssues, issue]);
            setResults(prevResults => [...prevResults, response.data]);
            // console.log(response.data);
            // setChooseIssuesDocuments(prevChooseIssuesDocuments => {
            //     prevChooseIssuesDocuments.map((chooseIssuesDocument, i) => {
            //         if (i !== index) {
            //             return chooseIssuesDocument;
            //         }
            //         console.log(chooseIssuesDocument);
            //         return {
            //             ...chooseIssuesDocument,
            //             catalog_document: {
            //                 ...chooseIssuesDocument.catalog_document,
            //                 issues: chooseIssuesDocument.catalog_document.issues.map(prevIssue => {
            //                     if (prevIssue.barcode === issue.barcode) {
            //                         return {
            //                             ...prevIssue,
            //                             already_exists: response.data.create_result === DocumentCreationStatus.Success
            //                         }
            //                     }
            //                     return prevIssue;
            //                 })
            //             }
            //         };
            //     });
            // });
        }).catch(error => {
            console.error(`Error while inserting document: ${error}`);
        });
    //         setCreateIssue(null);
    //         const prevCreatingIssues = creatingIssues;
    //         setCreatingIssues([...prevCreatingIssues, barcode]);

    //         const result = await dataService.insertDocument(Identifier.BARCODE, barcode, category, false);
    //         setCreatingIssues(creatingIssues.filter(b => b !== barcode));

    //         if (result.create_result === CreateResult.SUCCESS) {
    //             setCreatedIssues([...createdIssues, barcode]);
    //             if (props.onInsert) {
    //                 props.onInsert();
    //             }
    //         }
    //     };

    };

    const fetchData = async () => {
        const fetchedCategories = await fetchCategories();
        setCategories(fetchedCategories);
    };

    useEffect(() => {
        fetchData();
    }, [fetchCategories]);

    return (
        <InsertDocumentsContext.Provider value={{
            identifiers, identifier, setIdentifier: setIdentifierByValue,
            categories, category, setCategory,
            value, setValue, acceptInput,
            chooseIssuesDocuments, createIssue, creatingIssues, createdIssues,
            results
        }}>
            {children}
        </InsertDocumentsContext.Provider>
    );
};

export const useInsertDocuments = () => {
    const context = useContext(InsertDocumentsContext);
    if (!context) {
        throw new Error('useInsertDocuments must be used within a InsertDocumentsProvider');
    }
    return context;
};

