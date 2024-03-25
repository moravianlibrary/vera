from sqlalchemy.orm import Session
from collections import deque
from typing import Deque, List

from extractions.preprocessor import ExtractionPreprocessor
from extractions.schemas import ExtractionCreate, ExtractionDocument
from extractions.extraction_node import ExtractionRoot, ExtractionNode


class ExtractionGenerator:
    def __init__(
        self, target_pages: int, settings: ExtractionCreate, db: Session
    ):
        self.target_pages = target_pages
        self.settings = settings
        self.db = db
        self.extraction_root: ExtractionRoot = ExtractionPreprocessor(
            settings, db
        ).generate_extraction_tree()
        self.extracted_documents: List[int] = []
        self.extracted_pages_count = 0

    def generate(self):
        while self.extraction_root.has_next():
            node = self.extraction_root.get_next()
            leaf_path: Deque[ExtractionNode] = deque()
            while not node.assignable:
                leaf_path.append(node)
                node = node.get_next()
            print(f"Extracting {node.category_id}")

            if (
                self.settings.include_categories
                and node.category_id in self.settings.include_categories
            ):
                self.extract_include_category(node.category_id)
            elif node.extract_whole:
                self.extract_whole_category(node)
            else:
                self.extract_category(node)

            print(f"Requeueing {node.category_id}")
            while leaf_path:
                prev_node = leaf_path.pop()
                prev_node.requeue(node)
                node = prev_node
            self.extraction_root.requeue(node)

        self.extracted_pages_count += self.extraction_root.extracted_pages
        self.extraction_root.switch_to_requeue()
        if (
            self.extracted_pages_count <= self.target_pages
            and self.extraction_root.has_next()
        ):
            self.generate()

    def extract_include_category(self, node: ExtractionNode):
        documents = node.documents
        node.set_extracted(documents, node.total_pages)
        for document in documents:
            self.extracted_documents.append(document.id)

    def extract_whole_category(self, node: ExtractionNode):
        upper_limit = node.get_relative_target_pages(self.target_pages) * (
            1 + self.settings.whole_categories_threshold
        )
        if node.total_pages <= upper_limit:
            documents = node.documents
            node.set_extracted(documents, node.total_pages)
            for document in documents:
                self.extracted_documents.append(document.id)

    def extract_category(self, node: ExtractionNode):
        documents = node.documents
        target_pages = node.get_relative_target_pages(self.target_pages)

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

        print(selected_documents, selected_pages_count)
        if selected_pages_count <= upper_limit:
            node.set_extracted(selected_documents, selected_pages_count)
            for document in selected_documents:
                self.extracted_documents.append(document.id)
