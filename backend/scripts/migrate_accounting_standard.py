import sqlite3
import json
import shutil
import os
import sys

db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "edinet.db")
backup_path = db_path + ".bak"

def migrate():
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        sys.exit(1)

    print(f"Creating backup at {backup_path}...")
    shutil.copy2(db_path, backup_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("Adding accounting_standard column...")
    try:
        cursor.execute("ALTER TABLE financial_documents ADD COLUMN accounting_standard VARCHAR(50);")
        print("Added column accounting_standard")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column accounting_standard already exists, skipping.")
        else:
            raise e

    print("Backfilling data for existing records...")
    cursor.execute("SELECT id, metrics_json FROM financial_documents")
    rows = cursor.fetchall()

    update_count = 0
    for row_id, metrics_json in rows:
        if not metrics_json:
            continue
            
        try:
            metrics = json.loads(metrics_json)
        except json.JSONDecodeError:
            continue

        std = metrics.get("accounting_standard")
        if not std:
            # default to J-GAAP for existing records without specified standard yet since they were already parsed
            std = "J-GAAP"
            
        cursor.execute("UPDATE financial_documents SET accounting_standard = ? WHERE id = ?", (std, row_id))
        update_count += 1

    conn.commit()
    conn.close()
    
    print(f"Migration completed successfully. Backfilled {update_count} / {len(rows)} records.")

if __name__ == "__main__":
    migrate()
