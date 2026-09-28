// Ejecutar con: node --test anonimizador/pruebas.js
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { anonimizar, correspondenciasCSV } = require('./anonimizador');

const ejemplo = fs.readFileSync(path.join(__dirname, 'ejemplos', 'resolucion-ejemplo.txt'), 'utf8');

test('oculta los datos personales del acto de ejemplo', () => {
  const { texto } = anonimizar(ejemplo, { preservar: ['Horacio Giménez'] });
  for (const dato of ['PÉREZ', 'Pérez', 'Juan Carlos', '28.456.789', '20-28456789-3', '12.345',
    'Yrigoyen', 'FERNÁNDEZ', '31.222.333', '4567-8901', 'mfernandez@gmail.com', 'AB 123 CD',
    'Álvarez', 'RAMÍREZ', 'LP 45678', '03/04/1985', '0720123420000001234567']) {
    assert.ok(!texto.includes(dato), `quedó visible: ${dato}`);
  }
});

test('conserva normas, expedientes, montos, organismos y preservados', () => {
  const { texto } = anonimizar(ejemplo, { preservar: ['Horacio Giménez'] });
  for (const dato of ['Ley N° 5.688', 'Decreto N° 53/17', 'EX-2026-12345678-GCABA-DGSUMA',
    '$ 1.250.000', 'Dirección General de Asuntos Jurídicos', 'Horacio GIMÉNEZ', 'RESOLUCIÓN N° 1234/MSGC/2026']) {
    assert.ok(texto.includes(dato), `se ocultó: ${dato}`);
  }
});

test('la misma persona recibe la misma etiqueta en todas sus formas', () => {
  const { texto, entidades } = anonimizar(ejemplo);
  const p = entidades.find((e) => e.valores.includes('PÉREZ GÓMEZ, Juan Carlos'));
  assert.strictEqual(p.etiqueta, '[PERSONA 1]');
  assert.strictEqual(p.apariciones, 4);
  assert.match(texto, /el sumariado \[PERSONA 1\] presentó/);
});

test('modo iniciales', () => {
  const { texto } = anonimizar('La agente GONZÁLEZ, Ana María solicitó licencia.', { modoPersona: 'iniciales' });
  assert.strictEqual(texto, 'La agente A. M. G. solicitó licencia.');
});

test('términos adicionales y detectores desactivados', () => {
  const { texto } = anonimizar('El vecino de Barrio Mitre, DNI 30.111.222, reclamó.', {
    adicionales: ['Barrio Mitre'], tipos: { DNI: false }
  });
  assert.strictEqual(texto, 'El vecino de [RESERVADO 1], DNI 30.111.222, reclamó.');
});

test('no confunde fórmulas del acto con nombres', () => {
  const t = 'Publíquese en el Boletín Oficial de la Ciudad de Buenos Aires. VISTO, CONSIDERANDO, Que la ley...';
  assert.strictEqual(anonimizar(t).texto, t);
});

test('tabla de correspondencias en CSV', () => {
  const csv = correspondenciasCSV(anonimizar('El señor Juan Pérez, DNI 20.000.001.'));
  assert.match(csv, /"\[PERSONA 1\]";"PERSONA";"Juan Pérez";"1"/);
  assert.match(csv, /"\[DNI 1\]";"DNI";"20.000.001";"1"/);
});

test('tolera saltos de renglón dentro de nombres (texto extraído de PDF)', () => {
  const { texto } = anonimizar('su letrado, el Dr. Roberto Luis\nÁlvarez, ofreció al Sargento Diego\nRAMÍREZ (LP\n45678);\n\nHoracio GIMÉNEZ\nMinistro de Seguridad');
  assert.strictEqual(texto, 'su letrado, el Dr. [PERSONA 1], ofreció al Sargento [PERSONA 2] (LP\n[LEGAJO 1]);\n\nHoracio GIMÉNEZ\nMinistro de Seguridad');
});
