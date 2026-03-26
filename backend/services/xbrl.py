import os
import zipfile
import re
from bs4 import BeautifulSoup
from typing import Dict, Any

class XBRLParser:
    def parse_zip(self, zip_filepath: str) -> Dict[str, Any]:
        """
        Extracts the zip file in a temporary folder, finds the main XBRL file, 
        and extracts key metrics.
        """
        temp_dir = zip_filepath.replace(".zip", "_extracted")
        with zipfile.ZipFile(zip_filepath, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # In EDINET, PublicDoc folder contains the main inline XBRL (.htm) or XBRL files
        public_doc_dir = os.path.join(temp_dir, "XBRL", "PublicDoc")
        
        target_files = []
        if os.path.exists(public_doc_dir):
            for filename in os.listdir(public_doc_dir):
                if filename.endswith(".htm") or filename.endswith(".xbrl"):
                    target_files.append(os.path.join(public_doc_dir, filename))
        
        metrics = {}
        if target_files:
            metrics = self._parse_files(target_files)
        
        # Clean up extracted files
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        return metrics

    def _parse_files(self, filepaths: list[str]) -> Dict[str, Any]:
        """
        A simplified parser to extract common financial metrics across multiple related files.
        """
        metrics = {}
        
        # We need a combined soup or to iterate. Since each file might be large, it's safer to parse one by one.
        metrics = {}

        # Define targets: dictionary_key -> list of possible tags (in order of preference)
        targets = {
            "net_sales": ["jppfs_cor:NetSales", "ifrs-full:Revenue", "jpcrp_cor:NetSalesSummaryOfBusinessResults", "jpcrp_cor:OperatingRevenueSummaryOfBusinessResults"], 
            "operating_income": ["jppfs_cor:OperatingIncome", "ifrs-full:OperatingProfitLoss", "jpcrp_cor:OperatingIncomeLossSummaryOfBusinessResults"], 
            "ordinary_income": ["jppfs_cor:OrdinaryIncome", "jpcrp_cor:OrdinaryIncomeLossSummaryOfBusinessResults", "ifrs-full:ProfitBeforeTax"], 
            "net_income": ["jppfs_cor:ProfitLoss", "ifrs-full:ProfitLoss", "jpcrp_cor:ProfitLossAttributableToOwnersOfParentSummaryOfBusinessResults"], 
            "total_assets": ["jppfs_cor:Assets", "ifrs-full:Assets", "jpcrp_cor:TotalAssetsSummaryOfBusinessResults"], 
            "net_assets": ["jppfs_cor:NetAssets", "ifrs-full:Equity", "jpcrp_cor:NetAssetsSummaryOfBusinessResults"], 
            "operating_cf": ["jppfs_cor:NetCashProvidedByUsedInOperatingActivities", "ifrs-full:CashFlowsFromUsedInOperatingActivities", "jpcrp_cor:NetCashProvidedByUsedInOperatingActivitiesSummaryOfBusinessResults"], 
            "investing_cf": ["jppfs_cor:NetCashProvidedByUsedInInvestmentActivities", "ifrs-full:CashFlowsFromUsedInInvestingActivities", "jpcrp_cor:NetCashProvidedByUsedInInvestmentActivitiesSummaryOfBusinessResults"], 
            "financing_cf": ["jppfs_cor:NetCashProvidedByUsedInFinancingActivities", "ifrs-full:CashFlowsFromUsedInFinancingActivities", "jpcrp_cor:NetCashProvidedByUsedInFinancingActivitiesSummaryOfBusinessResults"],
            "dividends_paid": ["jppfs_cor:DividendsPaidCashFlowStatement", "ifrs-full:DividendsPaidClassifiedAsOperatingActivities", "ifrs-full:DividendsPaidClassifiedAsFinancingActivities"],
            "eps": ["jppfs_cor:BasicEarningsLossPerShare", "ifrs-full:BasicEarningsLossPerShare", "jpcrp_cor:BasicEarningsLossPerShareSummaryOfBusinessResults"],
            "bps": ["jppfs_cor:NetAssetsPerShare", "jpcrp_cor:NetAssetsPerShareSummaryOfBusinessResults"]
        }

        # To prevent scanning too many files unnecessarily, check missing metrics
        context_dates = {}
        for filepath in filepaths:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            soup = BeautifulSoup(content, "lxml-xml")
            
            # 1. Extract context dates
            for context in soup.find_all("xbrli:context"):
                ctx_id = context.get("id")
                if not ctx_id:
                    continue
                
                period = context.find("xbrli:period")
                if not period:
                    continue
                
                start_date = period.find("xbrli:startDate")
                end_date = period.find("xbrli:endDate")
                instant = period.find("xbrli:instant")
                
                if start_date and end_date:
                    context_dates[ctx_id] = {"start": start_date.text, "end": end_date.text}
                elif instant:
                    context_dates[ctx_id] = {"start": None, "end": instant.text}

            # 2. Extract metrics
            for key, tags in targets.items():
                if key in metrics:
                    continue # Already found the best value for this metric
                    
                elements = []
                for tag in tags:
                    elements.extend(soup.find_all("ix:nonFraction", {"name": tag}))
                    if not elements:
                        elements.extend(soup.find_all(tag))
                    
                    if elements:
                        break # Stop looking if we found elements for this key
                
                # Find the best value among the elements found for this metric
                candidate_values = []
                for el in elements:
                    context_ref = el.get("contextRef", "")
                    val_str = el.text.replace(",", "").strip()
                    
                    try:
                        val = float(val_str)
                        if "Prior" in context_ref:
                            continue
                            
                        score = 0
                        if "CurrentYear" in context_ref:
                            score += 10
                        if "NonConsolidated" in context_ref:
                            score -= 5
                            
                        candidate_values.append({"value": val, "score": score, "ctx": context_ref})
                    except ValueError:
                        continue
                        
                if candidate_values:
                    # Sort by highest score, then by highest absolute numerical value
                    candidate_values.sort(key=lambda x: (x["score"], abs(x["value"])), reverse=True)
                    best = candidate_values[0]
                    metrics[key] = best["value"]
                    
                    # Store dates if this is a primary metric (NetSales or NetIncome)
                    if key in ["net_sales", "net_income"] and "period_end" not in metrics:
                        ctx = best["ctx"]
                        if ctx in context_dates:
                            metrics["period_start"] = context_dates[ctx]["start"]
                            metrics["period_end"] = context_dates[ctx]["end"]
                    
        # Calculate derived metrics
        if metrics.get("net_assets") and metrics["net_assets"] > 0 and metrics.get("net_income") is not None:
            metrics["roe"] = (metrics["net_income"] / metrics["net_assets"]) * 100
            
        if metrics.get("total_assets") and metrics["total_assets"] > 0:
            if metrics.get("net_income") is not None:
                metrics["roa"] = (metrics["net_income"] / metrics["total_assets"]) * 100
            if metrics.get("net_assets") is not None:
                metrics["equity_ratio"] = (metrics["net_assets"] / metrics["total_assets"]) * 100
                
        if metrics.get("net_sales") and metrics["net_sales"] > 0 and metrics.get("operating_income") is not None:
            metrics["operating_margin"] = (metrics["operating_income"] / metrics["net_sales"]) * 100

        return metrics

# Singleton instance
xbrl_parser = XBRLParser()
