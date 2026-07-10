const { csvCell, csvRow } = require('../../src/utils/csv');

describe('csvCell', () => {
  it('convierte null/undefined en celda vacía', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('deja un string simple sin cambios', () => {
    expect(csvCell('Bomba A')).toBe('Bomba A');
  });

  it('convierte números a string', () => {
    expect(csvCell(42)).toBe('42');
  });

  it('entre comillas dobles si el valor contiene una coma', () => {
    expect(csvCell('Rionegro, Antioquia')).toBe('"Rionegro, Antioquia"');
  });

  it('entre comillas dobles y escapa comillas internas', () => {
    expect(csvCell('Válvula "principal"')).toBe('"Válvula ""principal"""');
  });

  it('entre comillas dobles si el valor contiene un salto de línea', () => {
    expect(csvCell('línea1\nlínea2')).toBe('"línea1\nlínea2"');
  });

  it('neutraliza inyección de fórmulas CSV con prefijo =', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
  });

  it('neutraliza inyección de fórmulas con prefijo +, -, @, tab o CR', () => {
    expect(csvCell('+1234')).toBe("'+1234");
    expect(csvCell('-1234')).toBe("'-1234");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell('\tcmd')).toBe("'\tcmd");
    expect(csvCell('\rcmd')).toBe("'\rcmd");
  });
});

describe('csvRow', () => {
  it('une celdas con coma, escapando cada una', () => {
    expect(csvRow(['Equipo A', 'Juan Pérez', 5, null])).toBe('Equipo A,Juan Pérez,5,');
  });

  it('escapa correctamente cuando alguna celda tiene coma o comillas', () => {
    expect(csvRow(['Bomba, principal', 'nota "urgente"'])).toBe(
      '"Bomba, principal","nota ""urgente"""'
    );
  });
});
