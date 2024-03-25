from sqlalchemy.orm import Session
from typing import List

from extractions.preprocessor import ExtractionPreprocessor
from extractions.schemas import ExtractionCreate, ExtractionDocument
from extractions.extraction_node import ExtractionNode


class ExtractionGenerator:
    def __init__(
        self, target_pages: int, settings: ExtractionCreate, db: Session
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
            print("Generating", node.category_id)
            if (
                self.settings.include_categories
                and node.category_id in self.settings.include_categories
            ):
                self.extract_include_category(node)
            elif node.extract_whole:
                self.extract_whole_category(node)
            else:
                self.extract_category(node)

        self.extracted_pages_count = self.extraction_root.extracted_pages

        if len(leafs) == 1 and leafs[0] == self.extraction_root:
            return

        leafs = self.extraction_root.get_leafs()
        max_level = max([leaf.level for leaf in leafs]) if leafs else -1
        if (
            self.extracted_pages_count <= self.lower_limit
            and len(leafs) > 0
            and max_level >= 0
        ):
            leafs = self.extraction_root.get_leafs()
            self.extraction_root.fully_extracted_pages = 0
            self.extraction_root.propagate_documents_up(max_level)
            self.generate(leafs)
        elif max_level == -1:
            self.extraction_root.fully_extracted_pages = 0
            self.generate([self.extraction_root])

    def extract_include_category(self, node: ExtractionNode):
        documents = node.documents
        node.set_extracted(documents, node.total_pages)
        for document in documents:
            self.extracted_documents.append(document.id)

    def extract_whole_category(self, node: ExtractionNode):
        upper_limit = (
            node.get_relative_target_pages(self.relative_target_pages)
            * (1 + self.settings.whole_categories_threshold)
            + self.target_pages_window
        )
        if node.total_pages <= upper_limit:
            documents = node.documents
            node.set_extracted(documents, node.total_pages)
            for document in documents:
                self.extracted_documents.append(document.id)

    def extract_category(self, node: ExtractionNode):
        documents = node.documents
        incl = [
            doc.id for doc in documents if doc.id in self.extracted_documents
        ]
        if len(incl) > 0:
            print(node)
            print([doc.id for doc in node.documents])
            print([doc.id for doc in node.extracted_documents])
            print(self.extracted_documents)
        # if self.extraction_index == 0:
        #     target_pages = node.get_relative_target_pages(
        #         self.relative_target_pages
        #     )
        # elif node.parent_node is not None:
        #     target_pages = node.parent_node.get_relative_target_pages(
        #         self.relative_target_pages
        #     )
        # else:
        #     target_pages = self.relative_target_pages
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

        print(
            f"Category {node.category_id} target pages: {target_pages}, "
            f"upper: {upper_limit}, "
            f"pages: {[doc.pages_count for doc in node.documents]}"
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

        if selected_pages_count <= upper_limit:
            node.set_extracted(selected_documents, selected_pages_count)
            for document in selected_documents:
                self.extracted_documents.append(document.id)
