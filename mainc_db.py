import sys
import pandas as pd
import json
import openpyxl
from sqlalchemy import create_engine, text
from PyQt5.QtWidgets import QApplication, QMainWindow, QTextEdit, QPushButton, QVBoxLayout, QWidget, QFileDialog, QMessageBox
from PyQt5.QtCore import QTimer, QDateTime
from openpyxl import Workbook

GET_ACTIVE_RECORDS_STATEMENT = text("""SELECT * FROM board 
        WHERE extraction_time IS NULL AND category = :category""")
SET_EXTRACTED_STATEMENT = text("""UPDATE board SET extraction_user = :extraction_user 
        WHERE sysno = :sysno 
        AND (volume_number = :volume_number OR :volume_number IS NULL)
        AND (item_number = :item_number OR :item_number IS NULL)""")

DB_NAME = "digiboard"
DB_USER = "digiboardAdmin"
DB_PASSWORD = "password"
DB_HOST = "localhost"
DB_PORT = "5432"

ACTIVE_USER = "test_user"

class ExcelExporterApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.init_ui()
        
        self.code_executed = False
        
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.run_code)
        self.timer.start(2000)
        
        self.all_extracted_units = pd.DataFrame()

        self.db_engine = self.init_db_engine()
        self.active_user = ACTIVE_USER

    def init_ui(self):
        self.setWindowTitle("Excel Exporter")
        self.setGeometry(100, 100, 800, 600)

        self.central_widget = QWidget(self)
        self.setCentralWidget(self.central_widget)

        self.layout = QVBoxLayout()

        self.text_edit = QTextEdit(self)
        self.layout.addWidget(self.text_edit)

        self.export_button = QPushButton("Export to Excel", self)
        self.export_button.clicked.connect(self.export_to_excel)
        self.layout.addWidget(self.export_button)
        self.export_button.setEnabled(False)

        self.confirm_button = QPushButton("Confirm and Move Units", self)
        self.confirm_button.clicked.connect(self.move_units)
        self.layout.addWidget(self.confirm_button)

        self.central_widget.setLayout(self.layout)

    def init_db_engine(self):
        return create_engine(f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

    def get_category(self, category_name: str):
        with self.db_engine.connect() as connection:
            params = {
                'category': category_name
            }
            return pd.read_sql_query(GET_ACTIVE_RECORDS_STATEMENT, connection, params=params)
    
    def set_extracted(self, sysno: str, volume_number: str, item_number: str):
        with self.db_engine.connect() as connection:
            params = {
                'extraction_user': self.active_user,
                'sysno': sysno,
                'volume_number': volume_number,
                'item_number': item_number
            }
            connection.execute(SET_EXTRACTED_STATEMENT, **params)

    def run_code(self):
        self.code_executed = True
        self.timer.stop()

        with open("output.json", "r") as config_file:
            self.config = json.load(config_file)  

        target_pages = float(self.config[0]["main_number"])

        output_text = []

        for item in self.config[1:]:
            category_name = item["name"].lower()
            category_proportion = float(item["overall_percentage"].strip('%')) / 100

            df_category = self.get_category(category_name)
            if df_category is not None and not df_category.empty:

                total_extracted_pages = 0
                extracted_rows = []

                for index, row in df_category.iterrows():
                    pages = row["pages_count"]
                    if total_extracted_pages + pages <= target_pages * category_proportion:
                        extracted_rows.append(row)
                        total_extracted_pages += pages

                print_columns = ['title', 'sysno', 'volume_number', 'item_number', 'pages_count']
                extracted_data = pd.DataFrame(extracted_rows, columns=print_columns)
                output_text.append(f"Extracted from '{category_name.capitalize()}' sheet:\n")
                output_text.append(extracted_data.to_string(index=False))
                
                self.all_extracted_units = pd.concat([self.all_extracted_units, extracted_data], ignore_index=True)
            elif df_category.empty:
                output_text.append(f"Category '{category_name}' has all documents extracted.\n")
            else:
                output_text.append(f"Category '{category_name}' not found in db.\n")
        
        self.text_edit.setPlainText('\n'.join(output_text))

    def move_units(self):
        for _, row in self.all_extracted_units.iterrows():
            self.set_extracted(row['sysno'], row['volume_number'], row['item_number'])

    def export_to_excel(self):
        
        save_path, _ = QFileDialog.getSaveFileName(self, "Save Excel File", "", "Excel Files (*.xlsx)")

        if save_path:
            with pd.ExcelWriter(save_path, engine='openpyxl') as writer:
                
                output = self.text_edit.toPlainText()
                lines = output.split('\n')
                lines = [line.strip() for line in lines if line.strip()]
                sheet = writer.book.create_sheet(title="Extracted Data", index=0)
                for i, line in enumerate(lines, start=1):
                    sheet.cell(row=i, column=1, value=line)


if __name__ == '__main__':
    app = QApplication(sys.argv)
    excel_app = ExcelExporterApp()
    excel_app.show()
    sys.exit(app.exec_())
