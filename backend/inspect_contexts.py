import sys
import os
import zipfile
import shutil
from bs4 import BeautifulSoup

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from services.edinet import edinet_client

def inspect_context(doc_id):
    zip_path = edinet_client.download_document_zip(doc_id)
    temp_dir = zip_path.replace(".zip", "_inspect")
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
        
    public_doc_dir = os.path.join(temp_dir, "XBRL", "PublicDoc")
    found_info = []
    
    if os.path.exists(public_doc_dir):
        for filename in os.listdir(public_doc_dir):
            if filename.endswith(".htm") or filename.endswith(".xbrl"):
                filepath = os.path.join(public_doc_dir, filename)
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    soup = BeautifulSoup(content, "lxml-xml")
                    
                    # 1. Dump contexts
                    context_dates = {}
                    for ctx in soup.find_all("xbrli:context"):
                        ctx_id = ctx.get("id")
                        start_date = ctx.find("xbrli:startDate")
                        end_date = ctx.find("xbrli:endDate")
                        instant = ctx.find("xbrli:instant")
                        
                        if start_date and end_date:
                            context_dates[ctx_id] = {"start": start_date.text, "end": end_date.text}
                        elif instant:
                            context_dates[ctx_id] = {"start": None, "end": instant.text}

                    # 2. Extract DEI
                    dei_tags = [
                        "jpdei_cor:CurrentPeriodEndDateDEI",
                        "jpdei_cor:CurrentFiscalYearEndDateDEI",
                        "jpdei_cor:CurrentFiscalYearStartDateDEI"
                    ]
                    
                    for tag in dei_tags:
                        elements = soup.find_all("ix:nonNumeric", {"name": tag})
                        if not elements:
                            elements = soup.find_all(tag)
                        
                        for el in elements:
                            val = el.text.strip()
                            ctx_id = el.get("contextRef", "")
                            ctx_info = context_dates.get(ctx_id, {})
                            found_info.append({
                                "tag": tag,
                                "value": val,
                                "contextRef": ctx_id,
                                "contextStart": ctx_info.get("start"),
                                "contextEnd": ctx_info.get("end")
                            })
                            
                    # 3. Check what context metric usages have
                    net_sales = soup.find_all("ix:nonFraction", {"name": "jppfs_cor:NetSales"})
                    for el in net_sales:
                        ctx_id = el.get("contextRef", "")
                        ctx_info = context_dates.get(ctx_id, {})
                        found_info.append({
                            "tag": "jppfs_cor:NetSales",
                            "value": el.text.strip(),
                            "contextRef": ctx_id,
                            "contextStart": ctx_info.get("start"),
                            "contextEnd": ctx_info.get("end")
                        })
                    
    shutil.rmtree(temp_dir, ignore_errors=True)
    os.remove(zip_path)
    
    print(f"Results for {doc_id}:")
    for info in found_info:
        print(info)

if __name__ == "__main__":
    inspect_context("S100VFPA")
