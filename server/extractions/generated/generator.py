from sqlalchemy.orm import Session
from typing import List, Tuple

from extractions.generated.preprocessor import ExtractionPreprocessor
from extractions.generated.schemas import (
    ExtractionDocument,
    GenerateExtraction,
)
from extractions.generated.extraction_node import ExtractionNode


class ExtractionGenerator:
    def __init__(
        self, target_pages: int, settings: GenerateExtraction, db: Session
    ):
        self.target_pages = target_pages
        self.lower_limit = target_pages * (1 - settings.target_pages_threshold)
        self.settings = settings
        self.db = db
        self.extraction_root: ExtractionNode = ExtractionPreprocessor(
            settings, db
        ).generate_extraction_tree()
        self.extracted_documents: List[int] = []
        self.extracted_pages_count = 0
        self.target_pages_window = 0

    @property
    def relative_target_pages(self) -> int:
        return (
            self.target_pages - self.extracted_pages_count
        ) - self.extraction_root.fully_extracted_pages

    def generate(self, leafs: List[ExtractionNode] = None):
        leafs = self.extraction_root.get_leafs() if leafs is None else leafs
        if len(leafs) == 0:
            return

        leafs.sort()
        for node in leafs:
            self.extract_from_node(node)
            if self.extraction_root.extracted_pages >= self.target_pages:
                break

        self.extracted_pages_count = self.extraction_root.extracted_pages
        self.extraction_root.fully_extracted_pages = 0

        if len(leafs) == 1 and leafs[0] == self.extraction_root:
            return

        leafs = self.extraction_root.get_leafs()
        max_level = max([leaf.level for leaf in leafs]) if leafs else -1
        if (
            self.extracted_pages_count <= self.lower_limit
            and len(leafs) > 0
            and max_level >= 0
        ):
            self.extraction_root.propagate_documents_up(max_level)
            self.generate(self.extraction_root.get_leafs())
        elif max_level == -1:
            self.generate([self.extraction_root])

    def extract_from_node(self, node: ExtractionNode):
        documents, pages_count = self.generate_extraction_for_node(node)
        node.set_extracted(documents, pages_count)
        for document in documents:
            self.extracted_documents.append(document.id)

    def generate_extraction_for_node(
        self, node: ExtractionNode
    ) -> Tuple[List[ExtractionDocument], int]:
        # if (
        #     self.settings.include_categories
        #     and node.category_id in self.settings.include_categories
        # ):
        #     return self.extract_include_category(node)
        # elif node.extract_whole:
        if node.extract_whole:
            return self.extract_whole_category(node)
        return self.extract_category(node)

    def extract_include_category(
        self, node: ExtractionNode
    ) -> Tuple[List[ExtractionDocument], int]:
        return node.documents, node.total_pages

    def extract_whole_category(self, node: ExtractionNode):
        upper_limit = node.get_relative_target_pages(
            self.relative_target_pages
        ) * (1 + self.settings.whole_categories_threshold)
        return (
            (node.documents, node.total_pages)
            if node.total_pages <= upper_limit
            else ([], 0)
        )

    def extract_category(self, node: ExtractionNode):
        documents = node.documents
        target_pages = node.get_relative_target_pages(
            self.relative_target_pages
        )

        n = len(documents)
        # page_size = int(target_pages * self.settings.target_pages_threshold)
        page_size = int(target_pages)

        lower_limit = target_pages
        upper_limit = int(
            target_pages * (1 + self.settings.target_pages_threshold)
        )

        dp = [[0] * (page_size + 1) for _ in range(n + 1)]
        selected_docs = [[False] * (page_size + 1) for _ in range(n + 1)]

        def get_scaled_pages_count(index: int) -> int:
            scaled_pages_count = int(
                documents[index].pages_count
                # * self.settings.target_pages_threshold
            )
            return scaled_pages_count if scaled_pages_count > 0 else 1

        for count in range(page_size + 1):
            dp[n][count] = count

        for i in range(n - 1, -1, -1):
            for curr_sum in range(page_size, -1, -1):
                next_sum = curr_sum + get_scaled_pages_count(i)
                pick = dp[i + 1][next_sum] if next_sum <= page_size else 0
                leave = dp[i + 1][curr_sum]

                if pick >= leave:
                    dp[i][curr_sum] = pick
                    selected_docs[i][curr_sum] = True
                else:
                    dp[i][curr_sum] = leave

        selected_documents: List[ExtractionDocument] = []
        selected_pages_count = 0
        i, j = 0, 0
        while i < n:
            if selected_docs[i][j]:
                j += get_scaled_pages_count(i)
                if j > upper_limit:
                    break
                selected_documents.append(documents[i])
                selected_pages_count += documents[i].pages_count
                if j > lower_limit:
                    break
            i += 1

        return (
            (selected_documents, selected_pages_count)
            if selected_pages_count <= upper_limit
            else ([], 0)
        )
