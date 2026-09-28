/*
 * Exportación del texto anonimizado a Word (.docx) sin dependencias.
 *
 * Un .docx es un ZIP con tres XML mínimos. Se arma sin compresión (método
 * "store"), que Word, LibreOffice y GDE abren sin problema.
 */
(function (raiz) {
  'use strict';

  var TABLA_CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(s) {
    return new TextEncoder().encode(s);
  }

  // ZIP sin compresión. archivos: [{ nombre, datos: Uint8Array }]
  function zip(archivos) {
    var partes = [];
    var central = [];
    var offset = 0;
    var ahora = new Date();
    var hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
    var fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();

    archivos.forEach(function (a) {
      var nombre = utf8(a.nombre);
      var crc = crc32(a.datos);
      var tam = a.datos.length;

      var local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // nombres en UTF-8
      local.setUint16(8, 0, true);
      local.setUint16(10, hora, true);
      local.setUint16(12, fecha, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, tam, true);
      local.setUint32(22, tam, true);
      local.setUint16(26, nombre.length, true);
      local.setUint16(28, 0, true);
      partes.push(new Uint8Array(local.buffer), nombre, a.datos);

      var cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint16(12, hora, true);
      cd.setUint16(14, fecha, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, tam, true);
      cd.setUint32(24, tam, true);
      cd.setUint16(28, nombre.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), nombre);

      offset += 30 + nombre.length + tam;
    });

    var tamCentral = central.reduce(function (s, p) { return s + p.length; }, 0);
    var fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true);
    fin.setUint16(8, archivos.length, true);
    fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamCentral, true);
    fin.setUint32(16, offset, true);

    var todo = partes.concat(central, [new Uint8Array(fin.buffer)]);
    var total = todo.reduce(function (s, p) { return s + p.length; }, 0);
    var out = new Uint8Array(total);
    var pos = 0;
    todo.forEach(function (p) { out.set(p, pos); pos += p.length; });
    return out;
  }

  function xml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      // Caracteres de control que invalidan el XML (salvo tab).
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }

  var ETIQUETA = /\[[^\[\]\n]{2,40} \d+\]/g;

  function runs(linea) {
    var out = '';
    var cursor = 0;
    var m;
    var run = function (t, negrita) {
      if (!t) return '';
      var partes = t.split('\t');
      return '<w:r>' + (negrita ? '<w:rPr><w:b/></w:rPr>' : '') + partes.map(function (p, i) {
        return (i ? '<w:tab/>' : '') + (p ? '<w:t xml:space="preserve">' + xml(p) + '</w:t>' : '');
      }).join('') + '</w:r>';
    };
    ETIQUETA.lastIndex = 0;
    while ((m = ETIQUETA.exec(linea))) {
      out += run(linea.slice(cursor, m.index), false) + run(m[0], true);
      cursor = m.index + m[0].length;
    }
    return out + run(linea.slice(cursor), false);
  }

  // Devuelve los bytes de un .docx con un párrafo por renglón del texto.
  // Las etiquetas ([PERSONA 1]) van en negrita para ubicarlas al revisar.
  function crearDocx(texto) {
    var cuerpo = String(texto).replace(/\r\n?/g, '\n').split('\n').map(function (l) {
      return '<w:p>' + runs(l) + '</w:p>';
    }).join('');

    var documento = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
      cuerpo +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
      '<w:pgMar w:top="1418" w:right="1418" w:bottom="1418" w:left="1701" w:header="709" w:footer="709" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>';

    var estilos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/>' +
      '<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-AR"/></w:rPr></w:rPrDefault>' +
      '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="360" w:lineRule="auto"/><w:jc w:val="both"/></w:pPr></w:pPrDefault>' +
      '</w:docDefaults></w:styles>';

    var tipos = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>';

    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';

    var relsDoc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    return zip([
      { nombre: '[Content_Types].xml', datos: utf8(tipos) },
      { nombre: '_rels/.rels', datos: utf8(rels) },
      { nombre: 'word/document.xml', datos: utf8(documento) },
      { nombre: 'word/_rels/document.xml.rels', datos: utf8(relsDoc) },
      { nombre: 'word/styles.xml', datos: utf8(estilos) }
    ]);
  }

  var api = { crearDocx: crearDocx, zip: zip, crc32: crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Exportar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
