from sqlalchemy.orm import Session
from io import StringIO
import csv
from typing import List, Union

from models import TaskDataset


class CsvWriter:
    def __init__(self, task_id: str):
        self.lines = []
        self.task_id = task_id

    def write(self, line: List[Union[str, int, float]]):
        self.lines.append(line)

    def flush_to_db(self, session: Session):
        TaskDataset(
            task_id=self.task_id, data=self._convert_to_csv_text()
        ).save(session),

    def _convert_to_csv_text(self) -> str:
        output = StringIO()
        writer = csv.writer(output)
        writer.writerows(self.lines)
        csv_text = output.getvalue()
        output.close()
        return csv_text
