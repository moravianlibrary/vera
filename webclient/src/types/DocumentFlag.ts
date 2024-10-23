enum DocumentFlag {
    IsExtractable = "IsExtractable",
    AlreadyExtracted = "AlreadyExtracted",
    IsNotExtractable = "IsNotExtractable",
    InvalidMainRecord = "InvalidMainRecord",
    InvalidCnb = "InvalidCnb",
    MissingPageCount = "MissingPageCount",
}

const Order = Object.values(DocumentFlag);
const orderBy = (a: DocumentFlag, b: DocumentFlag): number =>
    Order.indexOf(a) - Order.indexOf(b);

export default DocumentFlag;
export { orderBy };
