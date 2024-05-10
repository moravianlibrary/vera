from sqlalchemy.orm import Session


# TODO:
# def get_errors_distribution(task_id: int, db: Session):


def generate_volumes_pages_dataset(task_id: int, owner: str, db: Session):
    from predictions.dataset_generators import VolumesDatasetGenerator
    from services.csv_writer import CsvWriter

    csv_writer = CsvWriter(task_id)
    generator = VolumesDatasetGenerator(csv_writer)
    generator.generate()
    csv_writer.flush_to_db(db)


def generate_items_pages_dataset(task_id: int, owner: str, db: Session):
    from predictions.dataset_generators import ItemsDatasetGenerator
    from services.csv_writer import CsvWriter

    csv_writer = CsvWriter(task_id)
    generator = ItemsDatasetGenerator(csv_writer)
    generator.generate()
    csv_writer.flush_to_db(db)
