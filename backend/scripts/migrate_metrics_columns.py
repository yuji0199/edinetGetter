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

    columns_to_add = [
        "net_sales FLOAT", "operating_income FLOAT", "ordinary_income FLOAT",
        "net_income FLOAT", "total_assets FLOAT", "net_assets FLOAT",
        "equity_ratio FLOAT", "roe FLOAT", "roa FLOAT",
        "operating_cf FLOAT", "investing_cf FLOAT", "financing_cf FLOAT"
    ]

    print("Adding columns...")
    for col in columns_to_add:
        try:
            cursor.execute(f"ALTER TABLE financial_documents ADD COLUMN {col};")
            print(f"Added column {col.split()[0]}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"Column {col.split()[0]} already exists, skipping.")
            else:
                raise e

    print("Backfilling data for existing records...")
    cursor.execute("SELECT id, metrics_json FROM financial_documents")
    rows = cursor.fetchall()

    metrics_fields = [
        "net_sales", "operating_income", "ordinary_income", "net_income",
        "total_assets", "net_assets", "equity_ratio", "roe", "roa",
        "operating_cf", "investing_cf", "financing_cf"
    ]

    update_count = 0
    for row_id, metrics_json in rows:
        if not metrics_json:
            continue
            
        try:
            metrics = json.loads(metrics_json)
        except json.JSONDecodeError:
            continue

        updates = []
        params = []
        for field in metrics_fields:
            val = metrics.get(field)
            if val is not None:
                updates.append(f"{field} = ?")
                params.append(val)

        if updates:
            query = f"UPDATE financial_documents SET {', '.join(updates)} WHERE id = ?"
            params.append(row_id)
            cursor.execute(query, params)
            update_count += 1

    conn.commit()
    conn.close()
    
    print(f"Migration completed successfully. Backfilled {update_count} / {len(rows)} records.")

if __name__ == "__main__":
    migrate()
