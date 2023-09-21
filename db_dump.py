import pandas as pd
from sqlalchemy import create_engine, text

DB_NAME = "digiboard"
DB_USER = "digiboardAdmin"
DB_PASSWORD = "password"
DB_HOST = "localhost"
DB_PORT = "5432"
QUERY = "SELECT * FROM board"

if __name__ == '__main__':
    pd.set_option('display.max_rows', None)
    pd.set_option('display.max_columns', None)
    pd.set_option('display.max_colwidth', None)
    pd.set_option('display.expand_frame_repr', False)

    db_engine = create_engine(f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    with db_engine.connect() as connection:
        print(pd.read_sql_query(text(QUERY), connection))
