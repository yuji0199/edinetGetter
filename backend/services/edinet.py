import os
import requests
from datetime import date
from pydantic import BaseModel
from typing import List, Optional

EDINET_API_URL = "https://disclosure.edinet-fsa.go.jp/api/v2/documents.json"
EDINET_DOC_URL = "https://disclosure.edinet-fsa.go.jp/api/v2/documents/"

class EdinetDocumentInfo(BaseModel):
    docID: str
    secCode: Optional[str] = None
    filerName: Optional[str] = None
    docDescription: Optional[str] = None
    submitDateTime: Optional[str] = None
    docTypeCode: Optional[str] = None

class EdinetClient:
    def __init__(self):
        # Users must provide their own subscription key via .env if EDINET mandates it
        self.subscription_key = os.getenv("EDINET_API_KEY", "")

    def get_document_list(self, target_date: date) -> List[EdinetDocumentInfo]:
        """
        Fetches the list of submitted documents for a specific date.
        type=2 retrieves all metadata.
        """
        params = {
            "date": target_date.strftime("%Y-%m-%d"),
            "type": 2
        }
        if self.subscription_key:
            params["Subscription-Key"] = self.subscription_key

        response = requests.get(EDINET_API_URL, params=params)
        response.raise_for_status()
        data = response.json()

        results = []
        if data.get("results"):
            for item in data["results"]:
                # Filter for ordinary financial reports (有価証券報告書, 四半期報告書, 半期報告書)
                # docTypeCode: 120 (有価証券報告書), 130 (半期報告書), 140 (四半期報告書), 150 (臨時報告書)
                # Confirmation letters and other non-financial docs should be skipped.
                doc_type_code = item.get("docTypeCode")
                if doc_type_code not in ["120", "130", "140", "150"]:
                    continue
                    
                d = EdinetDocumentInfo(
                    docID=item.get("docID"),
                    secCode=item.get("secCode"),
                    filerName=item.get("filerName"),
                    docDescription=item.get("docDescription"),
                    submitDateTime=item.get("submitDateTime"),
                    docTypeCode=doc_type_code
                )
                results.append(d)
        return results

    def download_document_zip(self, doc_id: str, download_dir: str = "/tmp") -> str:
        """
        Downloads a document ZIP file containing XBRL data.
        type=1 downloads the ZIP file containing XBRL data.
        """
        url = f"{EDINET_DOC_URL}{doc_id}"
        params = {"type": 1}
        if self.subscription_key:
            params["Subscription-Key"] = self.subscription_key

        response = requests.get(url, params=params, stream=True)
        response.raise_for_status()

        filepath = os.path.join(download_dir, f"{doc_id}.zip")
        with open(filepath, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return filepath

# Singleton instance
edinet_client = EdinetClient()
