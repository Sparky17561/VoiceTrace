import sqlite3
import pprint

conn = sqlite3.connect('ledger.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("SELECT direction, status, COUNT(*) as cnt FROM udhari_entries GROUP BY direction, status")
for r in c.fetchall():
    print(r['direction'], r['status'], r['cnt'])

conn.close()
