import sqlite3, sys
conn = sqlite3.connect('ledger.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()

c.execute("SELECT name FROM sqlite_master WHERE type='table'")
print("TABLES:", [t[0] for t in c.fetchall()])

c.execute("""
    SELECT day_date, SUM(total_revenue), SUM(total_expense), COUNT(*) as n
    FROM audio_sessions 
    GROUP BY day_date 
    ORDER BY day_date DESC 
    LIMIT 10
""")
print("\nDAILY (audio_sessions) last 10:")
for r in c.fetchall():
    print(f"  {dict(r)}")

c.execute("""
    SELECT s.day_date, e.entry_type, e.item_name, e.value
    FROM session_entries e
    JOIN audio_sessions s ON e.session_id = s.id
    ORDER BY s.day_date DESC
    LIMIT 30
""")
print("\nENTRIES last 30:")
for r in c.fetchall():
    print(f"  {dict(r)}")

conn.close()
sys.stdout.flush()
