import sys
import pandas as pd
import json
import openpyxl
from sqlalchemy import create_engine
from PyQt5.QtWidgets import QApplication, QMainWindow, QTextEdit, QPushButton, QVBoxLayout, QWidget, QFileDialog, QMessageBox
from PyQt5.QtCore import QTimer, QDateTime
from openpyxl import Workbook

DB_NAME = "digiboard"
DB_USER = "digiboardAdmin"
DB_PASSWORD = "LLJEbPghsa342Drh"
DB_HOST = "localhost"
DB_PORT = "5432"

class ExcelExporterApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.init_ui()
        
        self.code_executed = False
        
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.run_code)
        self.timer.start(2000)
        
        self.all_extracted_units = pd.DataFrame()

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

    def init_db(self):
        return create_engine(f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

    def get_category(self, category_name: str):
        try:
            connection = self.init_db()


            query = f"SELECT * FROM board WHERE category = {category_name}"
            df = pd.read_sql_query(query, connection)

            connection.close()

            return df
        except Exception as e:
            print(f"Error: {e}")

    def run_code(self):
        
        excel_file = "list.xlsx"
        with pd.ExcelFile(excel_file) as xls:
            sheet_names = xls.sheet_names

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
            if df_category and not df_category.empty:

                total_extracted_pages = 0
                extracted_rows = []

                for index, row in df_category.iterrows():
                    pages = row["pages"]
                    if total_extracted_pages + pages <= target_pages * category_proportion:
                        extracted_rows.append(row)
                        total_extracted_pages += pages

                extracted_data = pd.DataFrame(extracted_rows, columns=df_category.columns)
                output_text.append(f"Extracted from '{category_name.capitalize()}' sheet:\n")
                output_text.append(extracted_data.to_string(index=False))

                
                self.all_extracted_units = pd.concat([self.all_extracted_units, extracted_data], ignore_index=True)
            else:
                output_text.append(f"Category '{category_name}' not found in db.\n")
        
        self.text_edit.setPlainText('\n'.join(output_text))

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

    def move_units(self):
        
        excel_file = "list.xlsx"
        current_date = QDateTime.currentDateTime().toString("yyyy-MM-dd")
        sheet_name = f"Extracted Units - {current_date}"
        self.export_button.setEnabled(True)

        with pd.ExcelFile(excel_file) as xls:
            
            existing_wb = openpyxl.load_workbook(excel_file)
            
            if sheet_name not in existing_wb.sheetnames:
                new_sheet = existing_wb.create_sheet(title=sheet_name)

                
                for idx, row in self.all_extracted_units.iterrows():
                    values = row.tolist()
                    new_sheet.append(values)

                
                if 'Sheet' in existing_wb.sheetnames:
                    sheet = existing_wb['Sheet']
                    existing_wb.remove(sheet)

                
                existing_wb.save(excel_file)

                QMessageBox.information(self, "Units Moved", f"Extracted units moved to '{sheet_name}' sheet.")
            else:
                QMessageBox.warning(self, "Sheet Exists", f"The sheet '{sheet_name}' already exists. Units were not moved.")



if __name__ == '__main__':
    app = QApplication(sys.argv)
    excel_app = ExcelExporterApp()
    excel_app.show()
    sys.exit(app.exec_())
