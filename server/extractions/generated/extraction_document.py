from models import Document


class ExtractionDocument:
    def __init__(self, document: Document):
        self.id = document.id
        self.manual_pages_count = None
        self.catalog_pages_count = document.pages_count
        self.predicted_pages_count = document.pages_count_predicted

    @property
    def pages_count(self):
        return (
            self.manual_pages_count
            or self.catalog_pages_count
            or self.predicted_pages_count
            or 0
        )

    def __repr__(self) -> str:
        return (
            f"ExtractionDocument(id={self.id}, pages_count={self.pages_count})"
        )
