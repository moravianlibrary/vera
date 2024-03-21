from sqlalchemy.orm import Session
from queue import Queue

from extractions.preprocessor import ExtractionPreprocessor
from extractions.schemas import ExtractionCreate
from extractions.extraction_node import ExtractionRoot, ExtractionNode


class ExtractionGenerator:
    def __init__(
        self, target_pages: int, settings: ExtractionCreate, db: Session
    ):
        self.extraction_root: ExtractionRoot = ExtractionPreprocessor(
            settings, db
        ).generate_extraction_tree(target_pages, db)
        self.settings = settings
        self.db = db

    def generate(self):
        while self.extraction_root.has_next():
            leaf_path: Queue[ExtractionNode] = Queue()
            node = self.extraction_root.get_next()
            while not node.assignable:
                leaf_path.put(node)
                node = self.extraction_root.get_next()

            if (
                self.settings.include_categories
                and node.category_id in self.settings.include_categories
            ):
                self.extract_include_category(node.category_id)
            elif node.extract_whole:
                self.extract_whole_category(node)
            else:
                self.extract_category(node)

            while not leaf_path.empty():
                prev_node = leaf_path.get()
                prev_node.requeue(node)
                node = prev_node
            self.extraction_root.requeue(node)

    def extract_include_category(self, node: ExtractionNode):
        node.set_extracted(node.documents, node.total_pages)

    def extract_whole_category(self, node: ExtractionNode):
        upper_limit = node.target_pages * (
            1 + self.settings.whole_categories_threshold
        )
        if node.total_pages <= upper_limit:
            node.set_extracted(node.documents, node.total_pages)

    def extract_category(self, node: ExtractionNode):
        pass
