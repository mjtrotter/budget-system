#!/usr/bin/env python3
"""
Copy Google Forms from mjtrotter6@gmail.com to invoicing@keswickchristian.org

This script copies the 5 budget request forms to the new account.
Prerequisites:
- Forms must be shared with the invoicing account (at least Viewer access)
- Run from a directory with clasp credentials for invoicing@keswickchristian.org
"""

import subprocess
import json
import os

# Original Form IDs from mjtrotter6@gmail.com account
ORIGINAL_FORMS = {
    'AMAZON': '1NqsPZeptLKTf8aKbRH9E6_pnB79DJnBs9tdUP0A2HKY',
    'WAREHOUSE': '19G0wER7rh4sdswQD4vZbRxPnIc1DJpqw0j7dCLpn0YY',
    'FIELD_TRIP': '1akolIQr412xmroEdChLkoO4frTCa8SitbP7-DlO-HrI',
    'CURRICULUM': '1D2zRvTi2KZsGCHKGwnGFF2z0HWF-KGOcf6N2qKRIwmE',
    'ADMIN': '1K4AMJU75COtJfub4BbrRaRJJUgfNPvCh6vszvxiKTtg'
}

# New names for the copied forms
NEW_NAMES = {
    'AMAZON': 'Amazon Request Form',
    'WAREHOUSE': 'Warehouse Request Form',
    'FIELD_TRIP': 'Field Trip Request Form',
    'CURRICULUM': 'Curriculum Request Form',
    'ADMIN': 'Admin Request Form'
}

def run_gdrive_copy(file_id, new_name):
    """
    Use gdrive or gcloud to copy a file.
    Alternative: Use clasp's authenticated session.
    """
    # Try using curl with OAuth token from clasp
    clasp_creds_path = os.path.expanduser('~/.clasprc.json')
    
    if not os.path.exists(clasp_creds_path):
        print(f"Error: clasp credentials not found at {clasp_creds_path}")
        return None
    
    with open(clasp_creds_path, 'r') as f:
        creds = json.load(f)
    
    # Try different credential structures
    access_token = None
    if 'tokens' in creds and 'default' in creds['tokens']:
        access_token = creds['tokens']['default'].get('access_token')
    elif 'token' in creds:
        access_token = creds['token'].get('access_token')
    
    if not access_token:
        print("Error: No access token found in clasp credentials")
        print("Try running: clasp login")
        return None

    
    # Google Drive API copy endpoint
    copy_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/copy"
    
    # Prepare the request
    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json'
    }
    
    body = json.dumps({
        'name': new_name
    })
    
    # Use curl to make the request
    cmd = [
        'curl', '-s', '-X', 'POST',
        copy_url,
        '-H', f'Authorization: Bearer {access_token}',
        '-H', 'Content-Type: application/json',
        '-d', body
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error copying {new_name}: {result.stderr}")
        return None
    
    try:
        response = json.loads(result.stdout)
        if 'id' in response:
            return response['id']
        else:
            print(f"Error response: {response}")
            return None
    except json.JSONDecodeError:
        print(f"Invalid response: {result.stdout}")
        return None


def main():
    print("=" * 60)
    print("BUDGET SYSTEM FORMS COPY SCRIPT")
    print("=" * 60)
    print()
    print("This script will copy the 5 budget request forms from")
    print("mjtrotter6@gmail.com to invoicing@keswickchristian.org")
    print()
    print("IMPORTANT: Before running, make sure the original forms are")
    print("shared with invoicing@keswickchristian.org (at least Viewer)")
    print()
    
    new_form_ids = {}
    
    for form_type, original_id in ORIGINAL_FORMS.items():
        new_name = NEW_NAMES[form_type]
        print(f"\nCopying {form_type}...")
        print(f"  Original ID: {original_id}")
        
        new_id = run_gdrive_copy(original_id, new_name)
        
        if new_id:
            new_form_ids[form_type] = new_id
            print(f"  ✓ New ID: {new_id}")
        else:
            print(f"  ✗ FAILED - see error above")
    
    print("\n" + "=" * 60)
    print("RESULTS")
    print("=" * 60)
    
    if new_form_ids:
        print("\nSuccessfully copied forms:")
        for form_type, new_id in new_form_ids.items():
            print(f"  {form_type}: {new_id}")
        
        print("\n\nUpdate the CONFIG.FORMS in Main.gs with these new IDs:")
        print("-" * 40)
        print("FORMS: {")
        for form_type, new_id in new_form_ids.items():
            comma = ',' if form_type != list(new_form_ids.keys())[-1] else ''
            print(f"  {form_type}: '{new_id}'{comma}")
        print("}")
        print("-" * 40)
    else:
        print("\nNo forms were copied successfully.")
        print("\nTroubleshooting:")
        print("1. Share each original form with invoicing@keswickchristian.org")
        print("2. Run 'clasp login' to refresh authentication")
        print("3. Ensure the Google Drive API is enabled")
    
    return new_form_ids


if __name__ == '__main__':
    main()
