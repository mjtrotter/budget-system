import re

with open('/Users/mtrotter/budget-system/Budget_System--Processing/Invoicing_Engine.gs', 'r') as f:
    content = f.read()

# We need to find `generateSingleInvoiceHTML` and `generateBatchInvoiceHTML` and replace them.
# Let's read the file and just replace the whole functions since we need to make multiple targeted changes.

start_idx_single = content.find('function generateSingleInvoiceHTML(transaction, metadata) {')
end_idx_single = content.find('// ============================================================================\n// HELPER FUNCTIONS', start_idx_single)

start_idx_batch = content.find('function generateBatchInvoiceHTML(transactions, metadata) {')
end_idx_batch = content.find('function generateWarehouseExternalInvoiceHTML(transactions, metadata)', start_idx_batch) # Wait, is this function there? I'll check.
