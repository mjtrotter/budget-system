/**
 * ============================================================================
 * INVOICE STORAGE & ORGANIZATION
 * ============================================================================
 * Manages Drive folder structure and invoice PDF storage.
 *
 * Folder Structure:
 * /Budget_System_Invoices/
 *   FY2024-25/
 *     Q1/
 *       Amazon/
 *         US/
 *         LS/
 *         KK/
 *       Warehouse/
 *         US/
 *         LS/
 *         KK/
 *       Field_Trip/
 *         US/
 *         LS/
 *         KK/
 *       Curriculum/
 *         Math/
 *         Science/
 *         English/
 *         (etc by department)
 *       Admin/
 *     Q2/
 *     Q3/
 *     Q4/
 */

const INVOICE_ROOT_FOLDER_NAME = 'Budget_System_Invoices';

/**
 * Gets or creates the root invoice folder
 */
function getInvoiceRootFolder() {
  const folders = DriveApp.getFoldersByName(INVOICE_ROOT_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(INVOICE_ROOT_FOLDER_NAME);
}

/**
 * Gets the current fiscal year string (e.g., "FY2024-25")
 * Fiscal year starts July 1
 */
function getCurrentFiscalYear() {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();

  // If before July, we're in the prior FY
  if (month < 6) { // June or earlier
    return `FY${year - 1}-${String(year).slice(-2)}`;
  }
  return `FY${year}-${String(year + 1).slice(-2)}`;
}

/**
 * Gets the current fiscal quarter (Q1-Q4)
 * Q1: Jul-Sep, Q2: Oct-Dec, Q3: Jan-Mar, Q4: Apr-Jun
 */
function getCurrentFiscalQuarter() {
  const month = new Date().getMonth();
  if (month >= 6 && month <= 8) return 'Q1';  // Jul-Sep
  if (month >= 9 && month <= 11) return 'Q2'; // Oct-Dec
  if (month >= 0 && month <= 2) return 'Q3';  // Jan-Mar
  return 'Q4'; // Apr-Jun
}

/**
 * Gets or creates a folder by path (creates intermediate folders as needed)
 */
function getOrCreateFolderPath(parentFolder, pathParts) {
  let currentFolder = parentFolder;

  for (const part of pathParts) {
    const folders = currentFolder.getFoldersByName(part);
    if (folders.hasNext()) {
      currentFolder = folders.next();
    } else {
      currentFolder = currentFolder.createFolder(part);
      console.log(`Created folder: ${part}`);
    }
  }

  return currentFolder;
}

/**
 * Gets the appropriate storage folder for an invoice
 * @param {string} formType - AMAZON, WAREHOUSE, FIELD_TRIP, CURRICULUM, ADMIN
 * @param {string} division - US, LS, KK, AD
 * @param {string} department - For curriculum, the department name
 * @param {string} fiscalYear - Optional, defaults to current
 * @param {string} fiscalQuarter - Optional, defaults to current
 */
function getInvoiceStorageFolder(formType, division, department, fiscalYear, fiscalQuarter) {
  const rootFolder = getInvoiceRootFolder();
  const fy = fiscalYear || getCurrentFiscalYear();
  const fq = fiscalQuarter || getCurrentFiscalQuarter();

  // Build path based on form type
  const pathParts = [fy, fq];

  // Normalize form type
  const type = formType.toUpperCase().replace(/\s+/g, '_');

  switch (type) {
    case 'AMAZON':
    case 'WAREHOUSE':
    case 'FIELD_TRIP':
      pathParts.push(type);
      // These are organized by division
      if (division && division !== 'AD') {
        pathParts.push(division.toUpperCase());
      }
      break;

    case 'CURRICULUM':
      pathParts.push('Curriculum');
      // Organized by department
      if (department) {
        pathParts.push(department);
      }
      break;

    case 'ADMIN':
      pathParts.push('Admin');
      // Admin is just Admin folder, no subdivision
      break;

    default:
      pathParts.push('Other');
  }

  return getOrCreateFolderPath(rootFolder, pathParts);
}

/**
 * Stores an invoice PDF in the appropriate folder
 * @returns {Object} { fileId, fileUrl, folderPath }
 */
function storeInvoicePDF(pdfBlob, invoiceId, formType, division, department) {
  const folder = getInvoiceStorageFolder(formType, division, department);

  // Set filename
  const filename = `${invoiceId}.pdf`;

  // Check if file already exists (update) or create new
  const existingFiles = folder.getFilesByName(filename);
  let file;

  if (existingFiles.hasNext()) {
    // Replace existing file
    const existing = existingFiles.next();
    existing.setTrashed(true);
    file = folder.createFile(pdfBlob.setName(filename));
    console.log(`Replaced existing invoice: ${filename}`);
  } else {
    file = folder.createFile(pdfBlob.setName(filename));
    console.log(`Created new invoice: ${filename}`);
  }

  // Build folder path for logging
  const folderPath = [];
  let parent = folder;
  while (parent && parent.getName() !== INVOICE_ROOT_FOLDER_NAME) {
    folderPath.unshift(parent.getName());
    const parents = parent.getParents();
    parent = parents.hasNext() ? parents.next() : null;
  }

  return {
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    folderPath: `${INVOICE_ROOT_FOLDER_NAME}/${folderPath.join('/')}`
  };
}

/**
 * Creates the full folder structure for a fiscal year
 */
function createFiscalYearFolderStructure(fiscalYear) {
  console.log(`📁 === CREATING FOLDER STRUCTURE FOR ${fiscalYear} ===`);

  const rootFolder = getInvoiceRootFolder();
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const divisions = ['US', 'LS', 'KK'];
  const formTypes = ['Amazon', 'Warehouse', 'Field_Trip'];

  // Curriculum departments (customize as needed)
  const departments = [
    'Math', 'Science', 'English', 'History', 'Foreign Language',
    'Bible', 'Art', 'Music', 'PE', 'Technology', 'Library',
    'Elementary', 'PreK', 'Kindergarten', 'Other'
  ];

  let foldersCreated = 0;

  for (const quarter of quarters) {
    // Create quarter folder
    const quarterPath = [fiscalYear, quarter];
    getOrCreateFolderPath(rootFolder, quarterPath);

    // Amazon, Warehouse, Field Trip - by division
    for (const formType of formTypes) {
      getOrCreateFolderPath(rootFolder, [...quarterPath, formType]);
      for (const division of divisions) {
        getOrCreateFolderPath(rootFolder, [...quarterPath, formType, division]);
        foldersCreated++;
      }
    }

    // Curriculum - by department
    getOrCreateFolderPath(rootFolder, [...quarterPath, 'Curriculum']);
    for (const dept of departments) {
      getOrCreateFolderPath(rootFolder, [...quarterPath, 'Curriculum', dept]);
      foldersCreated++;
    }

    // Admin - single folder
    getOrCreateFolderPath(rootFolder, [...quarterPath, 'Admin']);
    foldersCreated++;
  }

  console.log(`✅ Created/verified ${foldersCreated} folders for ${fiscalYear}`);
  return { fiscalYear, foldersCreated };
}

/**
 * Initializes folder structure for current fiscal year
 */
function initializeCurrentYearFolders() {
  const fy = getCurrentFiscalYear();
  return createFiscalYearFolderStructure(fy);
}

/**
 * Lists all invoices in a specific folder
 */
function listInvoicesInFolder(formType, division, department, fiscalYear, fiscalQuarter) {
  const folder = getInvoiceStorageFolder(formType, division, department, fiscalYear, fiscalQuarter);
  const files = folder.getFiles();

  const invoices = [];
  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() === 'application/pdf') {
      invoices.push({
        name: file.getName(),
        id: file.getId(),
        url: file.getUrl(),
        created: file.getDateCreated(),
        size: file.getSize()
      });
    }
  }

  return invoices;
}

/**
 * Gets invoice storage statistics
 */
function getInvoiceStorageStats() {
  const rootFolder = getInvoiceRootFolder();

  let totalFiles = 0;
  let totalSize = 0;
  const byFiscalYear = {};

  function countFolder(folder, fyName) {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.getMimeType() === 'application/pdf') {
        totalFiles++;
        totalSize += file.getSize();
        byFiscalYear[fyName] = (byFiscalYear[fyName] || 0) + 1;
      }
    }

    const subFolders = folder.getFolders();
    while (subFolders.hasNext()) {
      countFolder(subFolders.next(), fyName);
    }
  }

  const fyFolders = rootFolder.getFolders();
  while (fyFolders.hasNext()) {
    const fyFolder = fyFolders.next();
    const fyName = fyFolder.getName();
    countFolder(fyFolder, fyName);
  }

  return {
    totalInvoices: totalFiles,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
    byFiscalYear: byFiscalYear,
    rootFolderId: rootFolder.getId(),
    rootFolderUrl: rootFolder.getUrl()
  };
}

/**
 * Test function
 */
function testInvoiceStorage() {
  console.log('Current FY:', getCurrentFiscalYear());
  console.log('Current Quarter:', getCurrentFiscalQuarter());

  // Test folder paths
  const amazonFolder = getInvoiceStorageFolder('AMAZON', 'US');
  console.log('Amazon US folder:', amazonFolder.getName());

  const currFolder = getInvoiceStorageFolder('CURRICULUM', 'US', 'Math');
  console.log('Curriculum Math folder:', currFolder.getName());

  const adminFolder = getInvoiceStorageFolder('ADMIN', 'AD');
  console.log('Admin folder:', adminFolder.getName());
}
