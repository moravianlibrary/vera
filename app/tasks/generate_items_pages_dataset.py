from sqlalchemy.orm import Session


def GenerateItemsPagesDataset(session: Session, task_id: int):
    pass
    # from predictions.dataset_generators import ItemsDatasetGenerator
    # from services.csv_writer import CsvWriter

    # csv_writer = CsvWriter(task_id)
    # generator = ItemsDatasetGenerator(csv_writer)
    # generator.generate()
    # csv_writer.flush_to_db(db)
