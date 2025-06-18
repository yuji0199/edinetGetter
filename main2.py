import os
import requests
import zipfile
import io
from lxml import etree
from tqdm import tqdm

EDINET_API = "https://disclosure.edinet-fsa.go.jp/api/v2"
SAVE_DIR = "./edinet_xbrl"
API_KEY= '9705403c1aa64200b1c5265bdf2621d7'
KESSANTANSHIN_CODELIST= ['030000', '030001', '030002', '030003']
# 任意の日付 (提出日)
TARGET_DATE = "2025-05-23"

# EDINET APIから書類一覧取得
def fetch_document_list(date):
    url = f"{EDINET_API}/documents.json"
    params = {
        "date": date,
        "type": 2,  # 書類情報(JSON)
        "Subscription-Key": API_KEY
    }
    res = requests.get(url, params=params)
    res.raise_for_status()
    return res.json().get("results", [])

# 決算短信（formCode: 120）だけに絞る
def filter_financial_reports(docs):

    return [
        doc for doc in docs 
        if any(x == doc.get("formCode") for x in KESSANTANSHIN_CODELIST)
    ]

# zipをDLしてXBRLを展開
def download_and_extract_xbrl(doc_id, save_dir):
    url = f"{EDINET_API}/documents/{doc_id}"
    params = {"type": 1,"Subscription-Key": API_KEY}  # zip
    res = requests.get(url, params=params)
    if res.status_code != 200:
        return None
    with zipfile.ZipFile(io.BytesIO(res.content)) as z:
        xbrl_files = [f for f in z.namelist() if f.endswith(".xbrl")]
        for xbrl_file in xbrl_files:
            z.extract(xbrl_file, path=save_dir)
            return os.path.join(save_dir, xbrl_file)
    return None
# XBRLファイルから要素を抽出
def parse_xbrl(file_path):
    ns = {'xbrli': 'http://www.xbrl.org/2003/instance'}
    tree = etree.parse(file_path)
    root = tree.getroot()
#todo 取得についてはNodeを
    def get_value(tag):
        node = root.find(f".//xbrli:{tag}", namespaces=ns)
        return node.text if node is not None else None

    return {
        "売上高": get_value("NetSalesSummaryOfBusinessResults"),
        "営業利益": get_value("OperatingIncomeSummaryOfBusinessResults"),
        "経常利益": get_value("OrdinaryIncomeSummaryOfBusinessResults"),
        "当期純利益": get_value("ProfitAttributableToOwnersOfParentSummaryOfBusinessResults")
    }

# 実行メイン
def main():
    os.makedirs(SAVE_DIR, exist_ok=True)
    docs = fetch_document_list(TARGET_DATE)
    reports = filter_financial_reports(docs)

    for report in tqdm(reports, desc="処理中"):
        doc_id = report.get("docID")
        company_name = report.get("filerName")
        xbrl_path = download_and_extract_xbrl(doc_id, SAVE_DIR)
        if xbrl_path:
            data = parse_xbrl(xbrl_path)
            print(f"[{company_name}] {data}")

if __name__ == "__main__":
    main()
