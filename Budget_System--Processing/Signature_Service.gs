/**
 * ============================================================================
 * SIGNATURE SERVICE
 * ============================================================================
 * Manages approver and business office signatures for invoices.
 */

/**
 * Signature configuration - maps names to Drive file IDs
 * These should be PNG images with transparent backgrounds
 */
const SIGNATURE_CONFIG = {
  // Division Approvers
  'scarmichael@keswickchristian.org': {
    name: 'S. Carmichael',
    title: 'Principal, Keswick Kids',
    fileId: null // Will be populated when signatures are uploaded
  },
  'ddumais@keswickchristian.org': {
    name: 'D. Dumais',
    title: 'Principal, Lower School',
    fileId: null
  },
  'lmortimer@keswickchristian.org': {
    name: 'Lee Mortimer',
    title: 'Principal, Upper School',
    fileId: null // No signature image - will use Dancing Script font
  },

  // Business Office
  'sneel@keswickchristian.org': {
    name: 'Sherilyn Neel',
    title: 'Business Office',
    fileId: null
  },
  'bendrulat@keswickchristian.org': {
    name: 'Beth Endrulat',
    title: 'Chief Financial Officer',
    fileId: null
  },

  // Fallback
  'mtrotter@keswickchristian.org': {
    name: 'Mark Trotter',
    title: 'Administrator',
    fileId: null
  }
};

/**
 * Business Office signer by form type
 */
const FORM_BO_SIGNER = {
  'AMAZON': 'sneel@keswickchristian.org',
  'WAREHOUSE': 'sneel@keswickchristian.org',
  'CURRICULUM': 'sneel@keswickchristian.org',
  'FIELD_TRIP': 'bendrulat@keswickchristian.org',
  'ADMIN': 'bendrulat@keswickchristian.org'
};

/**
 * Gets signature info for an approver
 */
function getApproverSignatureInfo(approverEmail) {
  const sigInfo = SIGNATURE_CONFIG[approverEmail];

  if (sigInfo) {
    return {
      name: sigInfo.name,
      title: sigInfo.title,
      base64: sigInfo.fileId ? getSignatureBase64(sigInfo.fileId) : null
    };
  }

  // Fallback - extract name from email
  const namePart = approverEmail.split('@')[0];
  return {
    name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
    title: 'Approver',
    base64: null
  };
}

/**
 * Gets business office signature info for a form type
 */
function getBusinessOfficeSignatureInfo(formType) {
  const type = formType.toString().toUpperCase();
  const signerEmail = FORM_BO_SIGNER[type] || 'sneel@keswickchristian.org';
  const sigInfo = SIGNATURE_CONFIG[signerEmail];

  if (sigInfo) {
    return {
      name: sigInfo.name,
      title: sigInfo.title,
      base64: sigInfo.fileId ? getSignatureBase64(sigInfo.fileId) : null
    };
  }

  return {
    name: 'Business Office',
    title: 'Authorized Signature',
    base64: null
  };
}

/**
 * Converts a Drive file to base64
 */
function getSignatureBase64(fileId) {
  try {
    if (!fileId) return null;

    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    return base64;
  } catch (error) {
    console.error(`Error getting signature for file ${fileId}:`, error);
    return null;
  }
}

/**
 * Creates placeholder signature folder in Drive
 */
function createSignatureFolder() {
  const folderName = 'Budget_System_Signatures';

  // Check if folder exists
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    const folder = folders.next();
    console.log(`Signature folder already exists: ${folder.getId()}`);
    return folder;
  }

  // Create new folder
  const folder = DriveApp.createFolder(folderName);
  console.log(`Created signature folder: ${folder.getId()}`);

  return folder;
}

/**
 * Generates SVG-based cursive signature and saves to Drive
 * This creates a simple cursive-style signature image
 */
function generateCursiveSignature(name, folderIdOrFolder) {
  // Create SVG signature
  const svg = createCursiveSVG(name);

  // Convert SVG to blob
  const blob = Utilities.newBlob(svg, 'image/svg+xml', `${name.replace(/\s+/g, '_')}_signature.svg`);

  // Get folder
  let folder;
  if (typeof folderIdOrFolder === 'string') {
    folder = DriveApp.getFolderById(folderIdOrFolder);
  } else {
    folder = folderIdOrFolder;
  }

  // Save to Drive
  const file = folder.createFile(blob);
  console.log(`Created signature for ${name}: ${file.getId()}`);

  return {
    name: name,
    fileId: file.getId(),
    url: file.getUrl()
  };
}

/**
 * Creates a cursive-style SVG signature
 */
function createCursiveSVG(name) {
  // Simple cursive path generator
  const width = 300;
  const height = 80;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .signature {
      font-family: 'Brush Script MT', 'Segoe Script', 'Bradley Hand', cursive;
      font-size: 36px;
      fill: #1a1a1a;
    }
  </style>
  <text x="10" y="55" class="signature">${escapeXml(name)}</text>
</svg>`;
}

/**
 * Escapes XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates all required signatures
 */
function generateAllSignatures() {
  console.log('🖊️ === GENERATING ALL SIGNATURES ===');

  const folder = createSignatureFolder();
  const results = [];

  const signaturesNeeded = [
    'S. Carmichael',
    'D. Dumais',
    'Lee Mortimer',
    'Sherilyn Neel',
    'Beth Endrulat',
    'Mark Trotter'
  ];

  for (const name of signaturesNeeded) {
    try {
      const result = generateCursiveSignature(name, folder);
      results.push(result);
    } catch (error) {
      console.error(`Error generating signature for ${name}:`, error);
      results.push({ name: name, error: error.message });
    }
  }

  console.log('Signature generation complete:', results);
  return results;
}

/**
 * Updates SIGNATURE_CONFIG with actual file IDs
 * Run this after generating signatures
 */
function updateSignatureFileIds() {
  const folder = DriveApp.getFoldersByName('Budget_System_Signatures').next();
  const files = folder.getFiles();

  const fileMap = {};
  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName().replace('_signature.svg', '').replace(/_/g, ' ');
    fileMap[name.toLowerCase()] = file.getId();
  }

  console.log('Found signature files:', fileMap);

  // Log the config updates needed
  console.log('\nUpdate SIGNATURE_CONFIG with these file IDs:');
  for (const [email, config] of Object.entries(SIGNATURE_CONFIG)) {
    const nameLower = config.name.toLowerCase();
    if (fileMap[nameLower]) {
      console.log(`  '${email}': fileId: '${fileMap[nameLower]}'`);
    }
  }

  return fileMap;
}

/**
 * Test function to verify signature retrieval
 */
function testSignatureRetrieval() {
  console.log('Testing Approver Signature:');
  const approverSig = getApproverSignatureInfo('lmortimer@keswickchristian.org');
  console.log(approverSig);

  console.log('\nTesting BO Signature for Amazon:');
  const boSig = getBusinessOfficeSignatureInfo('AMAZON');
  console.log(boSig);

  console.log('\nTesting BO Signature for Admin:');
  const boSig2 = getBusinessOfficeSignatureInfo('ADMIN');
  console.log(boSig2);
}
