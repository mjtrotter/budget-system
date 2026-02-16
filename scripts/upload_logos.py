#!/usr/bin/env python3
"""
Upload both logos to Google Drive:
- Wide logo (header)
- Seal logo (watermark)
"""

import json
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

    # Target folder
    folder_id = '1a6fw86-zYsTL75f4zkkgYPgh2sSxkNR5'

    # Files to upload
    logos = [
        {
            'local_path': Path.home() / 'Downloads' / 'text logo kcs.png',
            'drive_name': 'kcs_logo_wide.png',
            'description': 'Wide logo (header)'
        },
        {
            'local_path': Path.home() / 'Downloads' / 'kcs logo.jpg',
            'drive_name': 'kcs_seal.jpg',
            'description': 'Seal logo (watermark)'
        }
    ]

    results = []

    for logo in logos:
        if not logo['local_path'].exists():
            print(f"⚠️  File not found: {logo['local_path']}")
            continue

        # Check if file already exists
        query = f"name='{logo['drive_name']}' and '{folder_id}' in parents and trashed=false"
        existing = service.files().list(q=query, fields='files(id)').execute()

        if existing.get('files'):
            # Delete existing file
            service.files().delete(fileId=existing['files'][0]['id']).execute()
            print(f"🗑️  Deleted existing: {logo['drive_name']}")

        # Determine mimetype
        mimetype = 'image/png' if logo['drive_name'].endswith('.png') else 'image/jpeg'

        # Upload new file
        file_metadata = {
            'name': logo['drive_name'],
            'parents': [folder_id]
        }

        media = MediaFileUpload(str(logo['local_path']), mimetype=mimetype)

        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink'
        ).execute()

        results.append({
            'name': logo['drive_name'],
            'id': file.get('id'),
            'description': logo['description']
        })

        print(f"✅ {logo['description']}")
        print(f"   Name: {file.get('name')}")
        print(f"   ID: {file.get('id')}")
        print()

    # Summary for config
    print("=" * 50)
    print("UPDATE CONFIG with these IDs:")
    print("=" * 50)
    for r in results:
        print(f"  {r['description']}: '{r['id']}'")

if __name__ == '__main__':
    main()
