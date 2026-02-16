#!/usr/bin/env python3
"""
Quick script to upload the logo to Google Drive using the same OAuth token as clasp.
"""

import json
import os
from pathlib import Path
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

def main():
    # Load clasp's OAuth token
    clasp_creds_path = Path.home() / '.clasprc.json'
    
    with open(clasp_creds_path) as f:
        clasp_data = json.load(f)
    
    token_data = clasp_data['tokens']['default']
    
    # Create credentials from clasp token
    creds = Credentials(
        token=token_data['access_token'],
        refresh_token=token_data['refresh_token'],
        token_uri='https://oauth2.googleapis.com/token',
        client_id=token_data['client_id'],
        client_secret=token_data['client_secret']
    )
    
    # Build Drive service
    service = build('drive', 'v3', credentials=creds)
    
    # File to upload
    logo_path = Path.home() / 'Downloads' / 'kcs logo.jpg'
    folder_id = '1a6fw86-zYsTL75f4zkkgYPgh2sSxkNR5'
    
    if not logo_path.exists():
        print(f"Error: Logo file not found at {logo_path}")
        return
    
    # Upload the file
    file_metadata = {
        'name': 'kcs_logo.jpg',
        'parents': [folder_id]
    }
    
    media = MediaFileUpload(str(logo_path), mimetype='image/jpeg')
    
    file = service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id, name, webViewLink'
    ).execute()
    
    print(f"✅ Logo uploaded successfully!")
    print(f"   File ID: {file.get('id')}")
    print(f"   File Name: {file.get('name')}")
    print(f"   View Link: {file.get('webViewLink')}")

if __name__ == '__main__':
    main()
