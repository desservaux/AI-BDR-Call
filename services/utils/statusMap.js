/**
 * Map a call row to the enhanced status used by the UI.
 * Prefer backend-computed call_result, then fallback to status.
 * @param {Object} call - call row
 * @returns {string} enhanced status string
 */
function mapCallStatus(call) {
  return (call && (call.call_result || call.status)) || 'unknown';
}

module.exports = { mapCallStatus };

