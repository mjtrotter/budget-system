#!/usr/bin/env python3
"""
Create the Hub spreadsheets for the Keswick Budget System using Google APIs.
Uses the same OAuth credentials as clasp.
"""

import json
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

def get_credentials():
    """Load clasp's OAuth token."""
    clasp_creds_path = Path.home() / '.clasprc.json'
    with open(clasp_creds_path) as f:
        clasp_data = json.load(f)
    
    token_data = clasp_data['tokens']['default']
    
    return Credentials(
        token=token_data['access_token'],
        refresh_token=token_data['refresh_token'],
        token_uri='https://oauth2.googleapis.com/token',
        client_id=token_data['client_id'],
        client_secret=token_data['client_secret']
    )

def create_spreadsheet_with_sheets(sheets_service, title, sheet_configs):
    """Create a spreadsheet with multiple sheets and headers."""
    
    # Build the spreadsheet structure
    sheets = []
    for sheet_config in sheet_configs:
        sheets.append({
            'properties': {
                'title': sheet_config['name']
            }
        })
    
    spreadsheet = {
        'properties': {
            'title': title
        },
        'sheets': sheets
    }
    
    # Create the spreadsheet
    result = sheets_service.spreadsheets().create(body=spreadsheet).execute()
    spreadsheet_id = result['spreadsheetId']
    
    # Add headers to each sheet
    for i, sheet_config in enumerate(sheet_configs):
        sheet_id = result['sheets'][i]['properties']['sheetId']
        sheet_name = sheet_config['name']
        headers = sheet_config['headers']
        
        # Write headers
        range_name = f"'{sheet_name}'!A1:{chr(64 + len(headers))}1"
        sheets_service.spreadsheets().values().update(
            spreadsheetId=spreadsheet_id,
            range=range_name,
            valueInputOption='RAW',
            body={'values': [headers]}
        ).execute()
        
        # Bold the header row
        sheets_service.spreadsheets().batchUpdate(
            spreadsheetId=spreadsheet_id,
            body={
                'requests': [{
                    'repeatCell': {
                        'range': {
                            'sheetId': sheet_id,
                            'startRowIndex': 0,
                            'endRowIndex': 1
                        },
                        'cell': {
                            'userEnteredFormat': {
                                'textFormat': {'bold': True},
                                'backgroundColor': {'red': 0.9, 'green': 0.9, 'blue': 0.9}
                            }
                        },
                        'fields': 'userEnteredFormat(textFormat,backgroundColor)'
                    }
                }, {
                    'updateSheetProperties': {
                        'properties': {
                            'sheetId': sheet_id,
                            'gridProperties': {'frozenRowCount': 1}
                        },
                        'fields': 'gridProperties.frozenRowCount'
                    }
                }]
            }
        ).execute()
    
    return spreadsheet_id

def main():
    creds = get_credentials()
    sheets_service = build('sheets', 'v4', credentials=creds)
    
    print("Creating Hub spreadsheets for Keswick Budget System...")
    print("=" * 60)
    
    # 1. Budget Hub
    budget_hub_config = [
        {
            'name': 'TransactionLedger',
            'headers': ['TransactionID', 'OrderID', 'ProcessedOn', 'Requestor', 'Approver', 
                       'Organization', 'Form', 'Amount', 'Description', 'FiscalQuarter',
                       'InvoiceGenerated', 'InvoiceID', 'InvoiceURL']
        },
        {
            'name': 'SystemLog',
            'headers': ['Timestamp', 'Action', 'User', 'Amount', 'Details', 
                       'TransactionID', 'Department', 'Status']
        },
        {
            'name': 'UserDirectory',
            'headers': ['Email', 'FirstName', 'LastName', 'Role', 'Department', 
                       'Division', 'Approver', 'BudgetAllocated', 'BudgetSpent',
                       'BudgetEncumbered', 'BudgetRemaining', 'UtilizationRate', 
                       'Active', 'LastModified']
        },
        {
            'name': 'OrganizationBudgets',
            'headers': ['Organization', 'BudgetAllocated', 'BudgetSpent', 
                       'BudgetEncumbered', 'BudgetAvailable', 'Approver', 
                       'Active', 'LastModified']
        }
    ]
    
    budget_hub_id = create_spreadsheet_with_sheets(sheets_service, 'Budget Hub', budget_hub_config)
    print(f"✅ Budget Hub created: {budget_hub_id}")
    
    # 2. Automated Hub
    automated_hub_config = [
        {
            'name': 'Amazon',
            'headers': ['Timestamp', 'EmailAddress', 'Item1Description', 'Item1AmazonURL',
                       'Item1Quantity', 'Item1UnitPrice', 'AddAnother1', 'Item2Description',
                       'Item2AmazonURL', 'Item2Quantity', 'Item2UnitPrice', 'AddAnother2',
                       'Item3Description', 'Item3AmazonURL', 'Item3Quantity', 'Item3UnitPrice',
                       'AddAnother3', 'Item4Description', 'Item4AmazonURL', 'Item4Quantity',
                       'Item4UnitPrice', 'AddAnother4', 'Item5Description', 'Item5AmazonURL',
                       'Item5Quantity', 'Item5UnitPrice', 'Empty', 'TotalCost', 'TransactionID']
        },
        {
            'name': 'Warehouse',
            'headers': ['Timestamp', 'EmailAddress', 'Item1ItemID', 'Item1Quantity',
                       'AddAnother1', 'Item2ItemID', 'Item2Quantity', 'AddAnother2',
                       'Item3ItemID', 'Item3Quantity', 'AddAnother3', 'Item4ItemID',
                       'Item4Quantity', 'AddAnother4', 'Item5ItemID', 'Item5Quantity',
                       'Empty', 'Item1Description', 'Item1Price', 'Item2Description',
                       'Item2Price', 'Item3Description', 'Item3Price', 'Item4Description',
                       'Item4Price', 'Item5Description', 'Item5Price', 'TotalCost', 'TransactionID']
        },
        {
            'name': 'AutomatedQueue',
            'headers': ['TransactionID', 'Requestor', 'RequestType', 'Department',
                       'Division', 'Amount', 'Description', 'Status', 'Requested',
                       'Approved', 'Processed', 'ResponseID']
        },
        {
            'name': 'WarehouseCatalog',
            'headers': ['StockNumber', 'ItemDescription', 'Price', 'UOM', 'Category']
        }
    ]
    
    automated_hub_id = create_spreadsheet_with_sheets(sheets_service, 'Automated Hub', automated_hub_config)
    print(f"✅ Automated Hub created: {automated_hub_id}")
    
    # 3. Manual Hub
    manual_hub_config = [
        {
            'name': 'Admin',
            'headers': ['Timestamp', 'EmailAddress', 'PurchaseDescription', 
                       'TotalCost', 'Rationale', 'UploadInvoice']
        },
        {
            'name': 'Curriculum',
            'headers': ['Timestamp', 'EmailAddress', 'CurriculumType', 
                       'ItemDetailsMethod', 'ResourceName', 'ResourceURL',
                       'ISBN', 'QuantityNeeded', 'TotalCost', 'UploadPDF']
        },
        {
            'name': 'Field Trip',
            'headers': ['Timestamp', 'EmailAddress', 'TripDestination', 
                       'TripDate', 'NumberOfStudents', 'TransportationType',
                       'TotalCost', 'UploadInvoice']
        },
        {
            'name': 'ManualQueue',
            'headers': ['TransactionID', 'Requestor', 'RequestType', 'Department',
                       'Division', 'Amount', 'Description', 'Status', 'Requested', 'Approved']
        }
    ]
    
    manual_hub_id = create_spreadsheet_with_sheets(sheets_service, 'Manual Hub', manual_hub_config)
    print(f"✅ Manual Hub created: {manual_hub_id}")
    
    print("\n" + "=" * 60)
    print("SUMMARY - New Spreadsheet IDs for CONFIG:")
    print("=" * 60)
    print(f"BUDGET_HUB_ID: '{budget_hub_id}'")
    print(f"AUTOMATED_HUB_ID: '{automated_hub_id}'")
    print(f"MANUAL_HUB_ID: '{manual_hub_id}'")
    print("=" * 60)
    
    # Save to a file for easy reference
    output = {
        'BUDGET_HUB_ID': budget_hub_id,
        'AUTOMATED_HUB_ID': automated_hub_id,
        'MANUAL_HUB_ID': manual_hub_id
    }
    
    with open('hub_ids.json', 'w') as f:
        json.dump(output, f, indent=2)
    
    print("\n✅ IDs saved to hub_ids.json")

if __name__ == '__main__':
    main()
