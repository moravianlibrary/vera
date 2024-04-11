from categories.schemas import CategoryNode


class ExtractionCategoryNode(CategoryNode):
    extracted_pages_count: int
    extracted_documents_count: int
