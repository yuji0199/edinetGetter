import os
import sys
import json
import sqlite3

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_fast_heuristic_fix():
    conn = sqlite3.connect(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'edinet.db'))
    cursor = conn.cursor()

    cursor.execute('SELECT id, securities_code FROM stocks')
    stocks = cursor.fetchall()

    fixed_count = 0
    remains = 0

    for stock in stocks:
        stock_id = stock[0]
        cursor.execute('SELECT id, metrics_json FROM financial_documents WHERE stock_id = ?', (stock_id,))
        docs = cursor.fetchall()
        
        max_sales = 0
        suspicious_docs = []
        
        for d in docs:
            if not d[1]: continue
            metrics = json.loads(d[1])
            sales = metrics.get('net_sales')
            if sales is not None:
                if sales >= 100_000_000:
                    if sales > max_sales:
                        max_sales = sales
                else:
                    suspicious_docs.append((d[0], metrics))
                    
        if suspicious_docs:
            if max_sales == 0:
                # Cannot heuristically fix
                remains += len(suspicious_docs)
            else:
                for doc_id, metrics in suspicious_docs:
                    sales = metrics.get('net_sales')
                    if sales is None: continue
                    
                    multiplier = None
                    if max_sales / 20 <= sales * 1_000_000 <= max_sales * 20:
                        multiplier = 1_000_000
                    elif max_sales / 20 <= sales * 1_000 <= max_sales * 20:
                        multiplier = 1_000
                        
                    if multiplier:
                        # Apply multiplier to all financial metrics
                        for key in ['net_sales', 'operating_income', 'ordinary_income', 'net_income', 'total_assets', 'net_assets', 'operating_cf', 'investing_cf', 'financing_cf']:
                            if metrics.get(key) is not None:
                                metrics[key] = metrics[key] * multiplier
                                
                        cursor.execute('UPDATE financial_documents SET metrics_json = ? WHERE id = ?', (json.dumps(metrics), doc_id))
                        fixed_count += 1
                    else:
                        remains += 1

    conn.commit()
    conn.close()
    print(f'HEURISTIC_FIXED={fixed_count}')
    print(f'REMAINING={remains}')

if __name__ == "__main__":
    run_fast_heuristic_fix()
