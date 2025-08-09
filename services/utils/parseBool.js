/**
 * Parse a string/boolean/undefined to boolean or undefined
 * - 'true'/'1'/true => true
 * - 'false'/'0'/false => false
 * - else => undefined
 */
function parseBool(value) {
  if (value === true || value === 'true' || value === '1' || value === 1) return true;
  if (value === false || value === 'false' || value === '0' || value === 0) return false;
  return undefined;
}

module.exports = { parseBool };

