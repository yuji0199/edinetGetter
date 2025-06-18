import requests
import mysql.connector
import zipfile
import io
import os
from tqdm import tqdm
import xml.etree.ElementTree as ET

# データベース接続設定
db = mysql.connector.connect(
    host='localhost',
    user='root',
    password='root',
    database='test'
)
cursor = db.cursor()

# EDINETのAPIのURL
BASE_URL = 'https://disclosure.edinet-fsa.go.jp/api/v2'
API_KEY= '9705403c1aa64200b1c5265bdf2621d7'
KESSANTANSHIN_CODELIST= ['030000', '030001', '030002', '030003']
# 1. 提出書類一覧を取得（例：今日）
def fetch_document_list(date='2025-05-23'):
    url = f"{BASE_URL}/documents.json?date={date}&type=2&Subscription-Key={API_KEY}"
    res = requests.get(url)
    return res.json()

# 2. ZIPをダウンロードして展開
def download_and_extract_zip(doc_id):
    url = f"{BASE_URL}/documents/{doc_id}?type=1&Subscription-Key={API_KEY}"
    res = requests.get(url)
    with zipfile.ZipFile(io.BytesIO(res.content)) as z:
        for name in z.namelist():
            if name.endswith('.xbrl'):
                return z.read(name).decode('utf-8')
    return None

# 3. XBRLファイルをパース
def parse_xbrl(xbrl_content):
    ns = {'xbrli': 'http://www.xbrl.org/2003/instance'}
    root = ET.fromstring(xbrl_content)

    elements = []
    for child in root:
        tag = child.tag.split('}')[-1]
        if child.text and is_num(child.text) and child.attrib.get('contextRef'):
            elements.append({
                'element_id': tag,
                'context_ref': child.attrib.get('contextRef'),
                'unit': child.attrib.get('unitRef', ''),
                'value': child.text,
                'is_nil': child.attrib.get('{http://www.w3.org/2001/XMLSchema-instance}nil', 'false') == 'true',
            })
    return elements

# 4. データベースへ登録
def insert_data(doc, elements):

    cursor.execute("INSERT INTO Company (edinet_code, name_jp, name_en, industry, securities_code) VALUES (%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE edinet_code = VALUES(edinet_code)", 
                   (doc['edinetCode'],doc['filerName'],"","",""))
    #TODO:Companyテーブルに銘柄コードのUpdate関数を実行

    cursor.execute("INSERT INTO Filing (filing_id, edinet_code, form_code, doc_type, period_start, period_end, submitted_at) VALUES (%s,%s,%s,%s,%s,%s,%s) ON DUPLICATE KEY UPDATE edinet_code = VALUES(edinet_code)", 
                   (doc['docID'], doc['edinetCode'],doc['formCode'],doc['docTypeCode'],doc['periodStart'],doc['periodEnd'],doc['submitDateTime']))

    for e in elements:
        try:
            cursor.execute("""
                INSERT INTO FinancialValue (filing_id, element_id, context_ref, unit, value, is_nil)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (doc['docID'], e['element_id'], e['context_ref'], e['unit'], e['value'], e['is_nil']))
        except Exception as exce:
            print(f"[ERROR] params: {e['element_id']},{e['context_ref']}, {e['unit']}, {e['value']}, {e['is_nil']}")
    db.commit()

# 決算探信
def is_kessan_tanshin(form_code):
    kessan_tanshin_codes = {"030000", "030001", "030002", "030003"}
    return form_code in kessan_tanshin_codes

# 5. 全体処理
def main():
    data = fetch_document_list()
    for doc in tqdm(data.get("results", [])):
        if doc.get("formCode") in KESSANTANSHIN_CODELIST:
            doc_id = doc['docID']
            try:
                xbrl = download_and_extract_zip(doc_id)
                if xbrl:
                    elements = parse_xbrl(xbrl)
                    insert_data(doc, elements)
            except Exception as e:
                print(f"[ERROR] {doc_id}: {e}")
def is_num(s):
    try:
        float(s)
    except ValueError:
        return False
    else:
        return True
#TODO:銘柄コード更新の関数作成

if __name__ == "__main__":
    main()
