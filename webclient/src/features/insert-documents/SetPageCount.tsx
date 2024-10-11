import { Fieldset } from "primereact/fieldset";
import React, { useState } from "react";
import { useInsertDocuments } from "../../contexts/insert-documents/InsertDocumentsContext";
import { InputNumber } from "primereact/inputnumber";
import { Button } from "primereact/button";
import { Inplace, InplaceContent, InplaceDisplay } from "primereact/inplace";
import { useTranslation } from "react-i18next";
import { getResultDetail } from "./InsertDocumentsFunctions";
import { Divider } from "primereact/divider";

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
                    {withoutPageCount.map((index) => (
                        <div className="flex gap-1">
                            <div key={index} className="flex flex-column w-min">
                                <span
                                    style={{
                                        maxWidth: "40ch",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {responses.Success[index].document!.title}
                                </span>
                                <span>
                                    {getResultDetail(
                                        responses.Success[index].document!
                                    )}
                                </span>
                            </div>
                            <InputNumber
                                className="w-8rem"
                                autoFocus
                                // value={pagesCount}
                                // onChange={(e) => setPagesCount(e.value)}
                                // onKeyDown={handleKeyPress}
                                min={1}
                                max={100000}
                                maxFractionDigits={0}
                            />
                        </div>
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
