'use strict';

// Escapa una celda para CSV y neutraliza inyección de fórmulas (=, +, -, @, TAB, CR)
function csvCell(val) {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
  return (str.includes(',') || str.includes('"') || str.includes('\n'))
    ? `"${str.replace(/"/g, '""')}"`
    : str;
}

function csvRow(cells) {
  return cells.map(csvCell).join(',');
}

module.exports = { csvCell, csvRow };
