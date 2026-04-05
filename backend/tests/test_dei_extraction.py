import sys
import os
from bs4 import BeautifulSoup

# Add parent directory of 'tests' (which is 'backend') to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.xbrl import xbrl_parser

def test_dei_extraction():
    print("--- Testing DEI Tag Extraction ---")
    
    # Mock XBRL content with DEI tags
    mock_xbrl = """<?xml version="1.0" encoding="UTF-8"?>
    <xbrli:xbrl xmlns:jpdei_cor="http://disclosure.fsa.go.jp/taxonomy/jpdei/2013-08-31/jpdei_cor"
                xmlns:xbrli="http://www.xbrl.org/2003/instance"
                xmlns:ix="http://www.xbrl.org/2008/inlineXBRL">
        
        <xbrli:context id="CurrentYearDuration">
            <xbrli:entity>
                <xbrli:identifier scheme="http://disclosure.edinet-fsa.go.jp">E01234</xbrli:identifier>
            </xbrli:entity>
            <xbrli:period>
                <xbrli:startDate>2023-04-01</xbrli:startDate>
                <xbrli:endDate>2024-03-31</xbrli:endDate>
            </xbrli:period>
        </xbrli:context>

        <!-- DEI Tag: CurrentPeriodEndDateDEI -->
        <ix:nonNumeric name="jpdei_cor:CurrentPeriodEndDateDEI" contextRef="CurrentYearDuration">2024-03-31</ix:nonNumeric>
        
        <!-- Metric: NetSales -->
        <ix:nonFraction name="jppfs_cor:NetSales" contextRef="CurrentYearDuration" unitRef="JPY" decimals="-6">5000000000</ix:nonFraction>
    </xbrli:xbrl>
    """
    
    # Create a temporary file and zip it for parse_zip or just test _parse_files
    test_filepath = "test_dei_mock.xbrl"
    with open(test_filepath, "w", encoding="utf-8") as f:
        f.write(mock_xbrl)
    
    try:
        # Test the core _parse_files logic
        metrics = xbrl_parser._parse_files([test_filepath])
        
        print(f"Extracted Metrics: {metrics}")
        
        if metrics.get("period_end") == "2024-03-31":
            print("SUCCESS: period_end extracted correctly from DEI tag.")
        else:
            print(f"FAILURE: Expected 2024-03-31 but got {metrics.get('period_end')}")
            
        if metrics.get("period_start") == "2023-04-01":
            print("SUCCESS: period_start extracted correctly via contextRef.")
    
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        if os.path.exists(test_filepath):
            os.remove(test_filepath)

if __name__ == "__main__":
    test_dei_extraction()
