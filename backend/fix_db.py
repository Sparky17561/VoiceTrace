from db import engine
from sqlalchemy import text

def add_quantity():
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE session_entries ADD COLUMN quantity FLOAT"))
            conn.commit()
            print("Quantity added!")
    except Exception as e:
        print(f"Error: {e}")

add_quantity()
