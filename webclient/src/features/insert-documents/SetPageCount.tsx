import { Fieldset } from "primereact/fieldset";
import React, { useState } from "react";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";
import { Inplace, InplaceContent, InplaceDisplay } from "primereact/inplace";
import { useTranslation } from "react-i18next";
import { getResultDetail } from "./InsertDocumentsFunctions";
import { Divider } from "primereact/divider";
import { CatalogDocumentResponse } from "../../adapters/ApiDocuments";
import SetDocumentPageCountForm from "../../components/forms/SetDocumentPageCountForm";

interface AddDocumentsSetPageCountProps {}

const AddDocumentsSetPageCount: React.FC<
    AddDocumentsSetPageCountProps
> = ({}) => {
    const { t } = useTranslation();
    const { responses, withoutPageCount, handleSetPagesCount } =
        useInsertDocuments();

    return (
        <Inplace>
            <InplaceDisplay>
                <span>{t("documents.add.results.show-set-page-count")}</span>
            </InplaceDisplay>
            <InplaceContent>
                <div className="flex flex-column gap-1">
                    {withoutPageCount
                        .map((index) => responses[index].document)
                        .map((document) => (
                            <SetDocumentPageCountForm
                                attributes={{
                                    ...document!,
                                    ...document!.issues[0],
                                }}
                                setPageCountCallback={(pageCount) =>
                                    handleSetPagesCount(
                                        document!.issues[0],
                                        pageCount
                                    )
                                }
                            />
                        ))}
                    <Button
                        label={t("documents.add.results.accept-set-page-count")}
                    />
                </div>
            </InplaceContent>
        </Inplace>
    );
};

export default AddDocumentsSetPageCount;
