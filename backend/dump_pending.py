import sqlite3

conn = sqlite3.connect('ledger.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

with open('pending2.txt', 'w', encoding='utf-8') as f:
    c.execute("SELECT * FROM udhari_entries WHERE status='pending'")
    rows = c.fetchall()
    if not rows:
        f.write("NO PENDING UDHARI ENTRIES FOUND!\n")
    else:
        for r in rows:
            f.write(str(dict(r)) + "\n")
            
    c.execute("SELECT id, name, stall_id FROM udhari_persons")
    f.write("\nPersons:\n")
    for r in c.fetchall():
        f.write(str(dict(r)) + "\n")
        
conn.close()
