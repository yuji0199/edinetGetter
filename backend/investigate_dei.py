import os
import sys
from datetime import date

# Add parent directory to sys.path to import backend modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.edinet import edinet_client
from bs4 import BeautifulSoup
import zipfile
import shutil

def inspect_doc(doc_id):
    print(f"--- Inspecting {doc_id} ---")
    zip_path = edinet_client.download_document_zip(doc_id)
    
    # Check if the downloaded file is actually a zip
    with open(zip_path, 'rb') as f:
        header = f.read(4)
        if header != b'PK\x03\x04':
            print(f"Error: {doc_id} is not a valid zip file. First bytes: {header}")
            f.seek(0)
            print(f"Content: {f.read(100)}")
            os.remove(zip_path)
            return found_tags

    temp_dir = zip_path.replace(".zip", "_inspect")
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
        
    public_doc_dir = os.path.join(temp_dir, "XBRL", "PublicDoc")
    found_tags = {}
    
    interesting_tags = [
        "jpdei_cor:CurrentPeriodEndDateDEI",
        "jpdei_cor:CurrentFiscalYearEndDateDEI",
        "jpdei_cor:FilingDateDEI",
        "jpcrp_cor:CurrentPeriodEndDateDEI",
        "jpcrp_cor:CurrentFiscalYearEndDateDEI"
    ]
    
    if os.path.exists(public_doc_dir):
        for filename in os.listdir(public_doc_dir):
            if filename.endswith(".htm") or filename.endswith(".xbrl"):
                filepath = os.path.join(public_doc_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    soup = BeautifulSoup(content, "lxml-xml")
                    
                    for tag in interesting_tags:
                        el = soup.find(tag)
                        if not el:
                            # Try ix:nonNumeric
                            el = soup.find("ix:nonNumeric", {"name": tag})
                        
                        if el:
                            found_tags[tag] = el.text
    
    shutil.rmtree(temp_dir, ignore_errors=True)
    os.remove(zip_path)
    return found_tags

if __name__ == "__main__":
    docs = ["S100VF3U", "S100VFIF", "S100VFIG"]
    for doc in docs:
        tags = inspect_doc(doc)
        print(f"Found tags: {tags}")
