import sqlite3

conn = sqlite3.connect("soc.db")

cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER,
    severity TEXT,
    description TEXT
)
""")

conn.commit()
conn.close()

print("Database created successfully")