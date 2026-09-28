#!/usr/bin/env node
/*
 * Uso:
 *   node anonimizador/cli.js acto.txt [opciones]
 *   cat acto.txt | node anonimizador/cli.js [opciones]
 *
 * Opciones:
 *   --salida archivo.txt        Guarda el texto anonimizado (por defecto, stdout).
 *   --tabla archivo.csv         Guarda la tabla de correspondencias (dato sensible).
 *   --preservar "Nombre;Otro"   Nombres o datos que deben quedar visibles.
 *   --ocultar "Término;Otro"    Términos que se ocultan siempre.
 *   --iniciales                 Reemplaza personas por iniciales (J. C. P.).
 *   --sin tipo1,tipo2           Desactiva detectores (persona, dni, cuit, legajo,
 *                               domicilio, telefono, email, cbu, dominio, nacimiento, edad).
 */
'use strict';
const fs = require('fs');
const { anonimizar, correspondenciasCSV } = require('./anonimizador');

const TIPOS = {
  persona: 'PERSONA', dni: 'DNI', cuit: 'CUIT/CUIL', cuil: 'CUIT/CUIL', legajo: 'LEGAJO',
  domicilio: 'DOMICILIO', telefono: 'TELÉFONO', email: 'EMAIL', cbu: 'CBU/CVU',
  dominio: 'DOMINIO', patente: 'DOMINIO', nacimiento: 'FECHA DE NACIMIENTO', edad: 'EDAD'
};

const args = process.argv.slice(2);
const op = { preservar: [], adicionales: [], tipos: {} };
let entrada = null;
let salida = null;
let tabla = null;
const lista = (s) => String(s || '').split(';').map((x) => x.trim()).filter(Boolean);

for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--salida') salida = args[++i];
  else if (a === '--tabla') tabla = args[++i];
  else if (a === '--preservar') op.preservar.push(...lista(args[++i]));
  else if (a === '--ocultar') op.adicionales.push(...lista(args[++i]));
  else if (a === '--iniciales') op.modoPersona = 'iniciales';
  else if (a === '--sin') {
    for (const t of String(args[++i] || '').split(',')) {
      const tipo = TIPOS[t.trim().toLowerCase()];
      if (!tipo) { console.error(`Tipo desconocido: ${t}`); process.exit(2); }
      op.tipos[tipo] = false;
    }
  } else if (a === '-h' || a === '--help') {
    console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^[\s\S]*?\* Uso:/, 'Uso:').replace(/^ \* ?/gm, ''));
    process.exit(0);
  } else entrada = a;
}

const texto = entrada ? fs.readFileSync(entrada, 'utf8') : fs.readFileSync(0, 'utf8');
const r = anonimizar(texto, op);

if (salida) fs.writeFileSync(salida, r.texto);
else process.stdout.write(r.texto);

if (tabla) fs.writeFileSync(tabla, '﻿' + correspondenciasCSV(r));

const resumen = r.entidades.reduce((acc, e) => ((acc[e.tipo] = (acc[e.tipo] || 0) + 1), acc), {});
console.error('\nDatos ocultados: ' + (Object.entries(resumen).map(([t, n]) => `${t} ${n}`).join(', ') || 'ninguno'));
console.error('Revisá el resultado antes de publicarlo: la detección es automática y puede fallar.');
