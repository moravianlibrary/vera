from sqlalchemy.orm import Session


def GenerateVolumesPagesDataset(session: Session, task_id: int):
    pass
    # from predictions.dataset_generators import VolumesDatasetGenerator
    # from services.csv_writer import CsvWriter

    # csv_writer = CsvWriter(task_id)
    # generator = VolumesDatasetGenerator(csv_writer)
    # generator.generate()
    # csv_writer.flush_to_db(session)
