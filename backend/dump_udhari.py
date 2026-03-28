import sqlite3
import pprint

conn = sqlite3.connect('ledger.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("SELECT * FROM udhari_entries")
rows = c.fetchall()
for r in rows:
    print(dict(r))

conn.close()
