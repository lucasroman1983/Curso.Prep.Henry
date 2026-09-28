/*
 * Anonimizador de actos administrativos.
 *
 * Detecta datos personales en el texto de un acto (resolución, disposición,
 * decreto, providencia, dictamen) y los reemplaza por etiquetas consistentes:
 * la misma persona recibe siempre la misma etiqueta ([PERSONA 1]) en todo el
 * texto, aunque aparezca escrita de formas distintas ("PÉREZ, Juan Carlos",
 * "Juan Carlos Pérez", "el Oficial Pérez").
 *
 * Funciona sin dependencias, en Node y en el navegador. El texto no sale de
 * la máquina donde se ejecuta.
 */
(function (raiz) {
  'use strict';

  // ---------------------------------------------------------------------
  // Utilidades
  // ---------------------------------------------------------------------

  // Límites de palabra que entienden acentos y ñ (\b de JS es solo ASCII).
  var INI = '(?<![\\p{L}\\p{N}])';
  var FIN = '(?![\\p{L}\\p{N}])';

  function normalizar(s) {
    return String(s)
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toUpperCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function soloDigitos(s) {
    return String(s).replace(/\D/g, '');
  }

  function escapar(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // "sr." -> "[sS][rR]\." : insensible a mayúsculas sin usar la bandera i,
  // que rompería \p{Lu} en los patrones de nombres.
  function ci(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      var may = c.toUpperCase();
      var min = c.toLowerCase();
      out += may !== min ? '[' + min + may + ']' : escapar(c);
    }
    return out;
  }

  var VARIANTES = {
    A: 'aáàäAÁÀÄ', E: 'eéèëEÉÈË', I: 'iíìïIÍÌÏ', O: 'oóòöOÓÒÖ',
    U: 'uúùüUÚÙÜ', N: 'nñNÑ', C: 'cçCÇ'
  };

  // Patrón literal que ignora mayúsculas, acentos y espacios/puntuación
  // intermedios: "Pérez Gómez" encuentra "PEREZ GOMEZ" y "Perez  Gómez".
  function patronLiteral(texto) {
    var partes = normalizar(texto).split(' ').filter(Boolean);
    return partes.map(function (p) {
      var out = '';
      for (var i = 0; i < p.length; i++) {
        var c = p[i];
        if (VARIANTES[c]) out += '[' + VARIANTES[c] + ']';
        else if (/\p{L}/u.test(c)) out += '[' + c.toLowerCase() + c + ']';
        else out += escapar(c);
      }
      return out;
    }).join('[\\s,.\\-]+');
  }

  // ---------------------------------------------------------------------
  // Vocabulario
  // ---------------------------------------------------------------------

  // Palabras que nunca forman parte de un nombre de persona.
  var NO_NOMBRE = new Set((
    'LEY LEYES DECRETO DECRETOS RESOLUCION RESOLUCIONES DISPOSICION DISPOSICIONES ' +
    'PROVIDENCIA DICTAMEN NOTA INFORME ANEXO EXPEDIENTE EXPEDIENTES ACTUACION ' +
    'ARTICULO ARTICULOS ART INCISO INC VISTO VISTOS CONSIDERANDO RESUELVE ' +
    'DISPONE DECRETA RESUELVO DISPONGO QUE POR PARA CON SIN SEGUN ANTE BAJO ' +
    'EL LA LOS LAS DEL AL DE Y E O U EN UN UNA SU SUS ESTE ESTA DICHO DICHA ' +
    'CIUDAD AUTONOMA BUENOS AIRES CABA GCABA GCBA GOBIERNO JEFE JEFA JEFATURA ' +
    'GABINETE MINISTERIO MINISTRO MINISTRA SECRETARIA SECRETARIO SUBSECRETARIA ' +
    'SUBSECRETARIO DIRECCION DIRECTOR DIRECTORA GENERAL GERENCIA OPERATIVA ' +
    'SUBGERENCIA DEPARTAMENTO DIVISION AREA UNIDAD OFICINA SUPERINTENDENCIA ' +
    'POLICIA POLICIAL SEGURIDAD PERSONAL RECURSOS HUMANOS ASUNTOS JURIDICOS ' +
    'LEGALES LEGAL TECNICA ADMINISTRATIVA ADMINISTRACION PUBLICA PUBLICO ' +
    'PROCURACION PROCURADOR PROCURADORA FISCALIA FISCAL JUZGADO JUEZ JUEZA ' +
    'TRIBUNAL CAMARA CORTE SUPREMA SUPERIOR JUSTICIA NACION NACIONAL ' +
    'REPUBLICA ARGENTINA ARGENTINO PROVINCIA COMUNA LEGISLATURA CONSTITUCION ' +
    'CODIGO REGIMEN DISCIPLINARIO SUMARIO SUMARIOS INSTRUCCION ESTADO ' +
    'TRANSPARENCIA CONTROL EXTERNO INTERNO AUDITORIA SINDICATURA INSTITUTO ' +
    'ESCUELA SERVICIO SERVICIOS OFICIAL OFICIALES AGENTE AGENTES SEÑOR SEÑORA ' +
    'SR SRA SRTA DR DRA LIC ING DON DOÑA SARGENTO CABO SUBOFICIAL INSPECTOR ' +
    'SUBINSPECTOR COMISARIO SUBCOMISARIO PRINCIPAL PRIMERO PRIMERA MAYOR ' +
    'AYUDANTE SUBAYUDANTE COMISARIA DNI CUIT CUIL LP LE LC LEGAJO NRO NUMERO ' +
    'BOLETIN BO ORDEN DIA MES AÑO ENERO FEBRERO MARZO ABRIL MAYO JUNIO JULIO ' +
    'AGOSTO SEPTIEMBRE SETIEMBRE OCTUBRE NOVIEMBRE DICIEMBRE LUNES MARTES ' +
    'MIERCOLES JUEVES VIERNES SABADO DOMINGO CONTRATACION LICITACION COMPRA ' +
    'COMPRAS PLIEGO EMPRESA SA SRL SAS SE UTE FIRMA CALLE AVENIDA AV DOMICILIO ' +
    'TELEFONO CORREO EMAIL CBU CVU PATENTE DOMINIO FECHA NACIMIENTO ' +
    'COMUNIQUESE PUBLIQUESE REGISTRESE ARCHIVESE NOTIFIQUESE PASE GIRESE ' +
    'CUMPLIDO OTRO OTROS OTRA OTRAS MISMO MISMA NOMBRADO NOMBRADA CITADO CITADA'
  ).split(' '));

  // Palabras de enlace admitidas dentro de un nombre ("María de los Ángeles").
  var ENLACES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y']);

  // Expresiones que suelen anteceder al nombre de una persona.
  var DISPARADORES = [
    'señor', 'señora', 'señorita', 'sr.', 'sra.', 'srta.', 'sr', 'sra',
    'don', 'doña', 'dr.', 'dra.', 'doctor', 'doctora', 'lic.', 'licenciado',
    'licenciada', 'ing.', 'ingeniero', 'ingeniera', 'agente', 'agentes',
    'oficial primero', 'oficial mayor', 'oficial ayudante', 'oficial subayudante',
    'oficial', 'sargento primero', 'sargento', 'cabo primero', 'cabo',
    'suboficial mayor', 'suboficial', 'subinspector', 'inspector',
    'subcomisario', 'comisario mayor', 'comisario general', 'comisario inspector',
    'comisario', 'principal', 'empleado', 'empleada', 'causante', 'sumariado',
    'sumariada', 'imputado', 'imputada', 'denunciante', 'denunciado',
    'denunciada', 'requirente', 'presentante', 'recurrente', 'peticionante',
    'administrado', 'administrada', 'interesado', 'interesada', 'ciudadano',
    'ciudadana', 'vecino', 'vecina', 'cónyuge', 'conyuge', 'hijo', 'hija',
    'madre', 'padre', 'derechohabiente', 'apoderado', 'apoderada',
    'letrado', 'letrada', 'testigo', 'damnificado', 'damnificada',
    'víctima', 'victima', 'menor', 'titular', 'contratado', 'contratada',
    'agente de policía', 'personal policial'
  ].sort(function (a, b) { return b.length - a.length; });

  // Una palabra de nombre: empieza en mayúscula ("Pérez", "PÉREZ", "O'Connor",
  // "Pérez-Gómez").
  var PALABRA = "\\p{Lu}[\\p{L}'’]*(?:-\\p{Lu}[\\p{L}'’]*)*";
  var SEP_NOMBRE = "(?:,?(?:[ \\t]+\\n?|\\n)[ \\t]*(?:(?:de|del|la|las|los|y)(?:[ \\t]+\\n?|\\n)[ \\t]*)*)";
  var NOMBRE = PALABRA + '(?:' + SEP_NOMBRE + PALABRA + '){0,6}';

  // Lo que puede aparecer entre el cargo y el nombre: "(LP 12.345)",
  // "LP N° 12345,", "D.N.I. 20.123.456".
  var ENTRE = '(?:[ \\t]*\\(?(?:' + ci('l.p.') + '|' + ci('lp') + '|' + ci('legajo') +
    '(?:(?:[ \\t]+\\n?|\\n)[ \\t]*' + ci('personal') + ')?)[ \\t]*(?:[nN][°ºo.]*[ \\t]*)?[\\d.]+\\)?[ \\t]*,?)?';

  // ---------------------------------------------------------------------
  // Detectores. Cada uno devuelve el tramo a reemplazar en el grupo "v";
  // el resto del patrón (rótulos como "DNI N°") queda como está.
  // ---------------------------------------------------------------------

  var N_ROT = '(?:[ \\t]*(?:[nN][°º]|[nN][rR][oO]\\.?|[nN]\\.|' + ci('número') + '|' + ci('numero') + '))?[ \\t]*:?[ \\t]*\\n?[ \\t]*';

  var DETECTORES = [
    {
      tipo: 'EMAIL',
      prioridad: 1,
      re: '(?<v>[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)+)',
      clave: function (v) { return v.toLowerCase(); }
    },
    {
      tipo: 'CUIT/CUIL',
      prioridad: 1,
      re: INI + '(?<v>(?:20|23|24|25|26|27|30|33|34)[-. ]?\\d{2}\\.?\\d{3}\\.?\\d{3}[-. ]?\\d)' + FIN,
      clave: soloDigitos
    },
    {
      tipo: 'CBU/CVU',
      prioridad: 1,
      re: INI + '(?<v>\\d{22}|\\d{8}[ -]\\d{14})' + FIN,
      clave: soloDigitos
    },
    {
      tipo: 'DNI',
      prioridad: 1,
      re: '(?:' + ci('d.n.i.') + '|' + ci('d.n.i') + '|' + ci('dni') + '|' +
        ci('documento nacional de identidad') + '|' + ci('documento') + '|' +
        ci('l.e.') + '|' + ci('l.c.') + '|' + ci('pasaporte') + ')' + N_ROT +
        '(?<v>\\d{1,2}\\.?\\d{3}\\.?\\d{3}|[A-Z]{3}\\d{6})' + FIN,
      clave: soloDigitos
    },
    {
      // Números con formato de DNI sin rótulo (20.123.456). Se excluyen
      // montos ($ 1.234.567) y cifras seguidas de "pesos".
      tipo: 'DNI',
      prioridad: 3,
      re: '(?<![$\\d.,][ \\t]?)' + INI + '(?<v>\\d{1,2}\\.\\d{3}\\.\\d{3})' + FIN +
        '(?![ \\t]*(?:' + ci('pesos') + '|,\\d))',
      clave: soloDigitos
    },
    {
      tipo: 'LEGAJO',
      prioridad: 1,
      re: '(?:' + ci('l.p.') + '|' + ci('lp') + '|' + ci('legajo personal') + '|' +
        ci('legajo') + '|' + ci('ficha') + ')' + N_ROT + '(?<v>\\d{1,3}(?:\\.?\\d{3})+|\\d{3,7})' + FIN,
      clave: soloDigitos
    },
    {
      tipo: 'TELÉFONO',
      prioridad: 1,
      re: '(?:' + ci('teléfono') + '|' + ci('telefono') + '|' + ci('tel.') + '|' + ci('tel') + '|' +
        ci('celular') + '|' + ci('cel.') + '|' + ci('cel') + '|' + ci('móvil') + '|' + ci('movil') +
        '|' + ci('whatsapp') + ')' + N_ROT +
        '(?<v>\\+?[\\d()][\\d() .-]{6,18}\\d)',
      clave: soloDigitos
    },
    {
      tipo: 'TELÉFONO',
      prioridad: 2,
      re: '(?<v>\\+54[ -]?9?[ -]?\\d{2,4}[ -]?\\d{3,4}[ -]?\\d{4})' + FIN,
      clave: soloDigitos
    },
    {
      tipo: 'DOMINIO',
      prioridad: 1,
      re: '(?:' + ci('dominio') + '|' + ci('patente') + ')' + N_ROT +
        '(?<v>[A-Z]{2}[ -]?\\d{3}[ -]?[A-Z]{2}|[A-Z]{3}[ -]?\\d{3}|\\d{3}[ -]?[A-Z]{3})' + FIN,
      clave: normalizar
    },
    {
      // Formato Mercosur sin rótulo: AB 123 CD.
      tipo: 'DOMINIO',
      prioridad: 2,
      re: INI + '(?<v>[A-Z]{2}[ -]?\\d{3}[ -]?[A-Z]{2})' + FIN,
      clave: normalizar
    },
    {
      tipo: 'FECHA DE NACIMIENTO',
      prioridad: 1,
      re: '(?:' + ci('nacido el') + '|' + ci('nacida el') + '|' + ci('nacido en fecha') + '|' +
        ci('nacida en fecha') + '|' + ci('fecha de nacimiento') + '|' + ci('f. de nac.') + '|' +
        ci('f. nac.') + ')[ \\t]*:?[ \\t]*\\n?[ \\t]*' +
        '(?<v>\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}|\\d{1,2}(?:[ \\t]+\\n?|\\n)[ \\t]*de(?:[ \\t]+\\n?|\\n)[ \\t]*\\p{L}+(?:[ \\t]+\\n?|\\n)[ \\t]*de(?:[ \\t]+\\n?|\\n)[ \\t]*\\d{4})',
      clave: normalizar
    },
    {
      tipo: 'DOMICILIO',
      prioridad: 1,
      re: '(?:' + ci('domicilio') + '(?:(?:[ \\t]+\\n?|\\n)[ \\t]*(?:' + ci('real') + '|' + ci('legal') + '|' +
        ci('constituido') + '|' + ci('particular') + '|' + ci('denunciado') + '))?|' +
        ci('domiciliado') + '|' + ci('domiciliada') + '|' + ci('reside') + '|' + ci('residente') +
        '|' + ci('con domicilio') + ')(?:(?:[ \\t]+\\n?|\\n)[ \\t]*(?:' + ci('sito') + '|' + ci('sita') + '|' +
        ci('ubicado') + '|' + ci('ubicada') + '))?(?:[ \\t]+\\n?|\\n)[ \\t]*(?:' + ci('en') + '(?:[ \\t]+\\n?|\\n)[ \\t]*)?' +
        '(?:(?:la|el)(?:[ \\t]+\\n?|\\n)[ \\t]*)?' + domicilioValor(true),
      clave: normalizar
    },
    {
      tipo: 'DOMICILIO',
      prioridad: 2,
      re: INI + '(?:' + ci('calle') + '|' + ci('avenida') + '|' + ci('av.') + '|' + ci('avda.') +
        '|' + ci('pasaje') + '|' + ci('pje.') + '|' + ci('boulevard') + '|' + ci('bv.') + '|' +
        ci('diagonal') + ')(?:[ \\t]+\\n?|\\n)[ \\t]*' + domicilioValor(false),
      clave: normalizar
    }
  ];

  function domicilioValor(conPrefijo) {
    var prefijo = conPrefijo
      ? '(?:(?:' + ci('calle') + '|' + ci('avenida') + '|' + ci('av.') + '|' + ci('avda.') +
        '|' + ci('pasaje') + '|' + ci('pje.') + '|' + ci('boulevard') + '|' + ci('bv.') +
        '|' + ci('diagonal') + ')(?:[ \\t]+\\n?|\\n)[ \\t]*)?'
      : '';
    var parte = "(?:\\p{Lu}[\\p{L}.'’]*|\\d{1,2}|de|del|la|las|los|y)";
    return '(?<v>' + prefijo + parte + '(?:(?:[ \\t]+\\n?|\\n)[ \\t]*' + parte + '){0,6}?(?:[ \\t]+\\n?|\\n)[ \\t]*' +
      '(?:[nN][°º][ \\t]*|[nN][rR][oO]\\.?[ \\t]*)?\\d{1,5}' + FIN +
      '(?:[ \\t]*,?[ \\t]*(?:' + ci('piso') + '|' + ci('p.') + ')[ \\t]*[\\p{L}\\d°º]+)?' +
      '(?:[ \\t]*,?[ \\t]*(?:' + ci('departamento') + '|' + ci('depto.') + '|' + ci('depto') +
      '|' + ci('dpto.') + '|' + ci('dto.') + '|' + ci('unidad funcional') + '|' + ci('uf') +
      ')[ \\t]*"?[\\p{L}\\d]+"?)?)';
  }

  // ---------------------------------------------------------------------
  // Nombres de personas
  // ---------------------------------------------------------------------

  var RE_PALABRA = new RegExp(PALABRA, 'gu');

  // Recorta un candidato a nombre: corta en la primera palabra que no puede
  // ser nombre y devuelve el tramo útil (o null).
  function recortarNombre(texto) {
    var palabras = [];
    var m;
    RE_PALABRA.lastIndex = 0;
    while ((m = RE_PALABRA.exec(texto))) {
      var n = normalizar(m[0]);
      if (NO_NOMBRE.has(n) || n.replace(/\s/g, '').length < 2) break;
      palabras.push({ ini: m.index, fin: m.index + m[0].length, n: n, txt: m[0] });
    }
    if (!palabras.length) return null;
    // Entre palabras consecutivas solo se admite coma/espacios/enlaces.
    var utiles = [palabras[0]];
    for (var i = 1; i < palabras.length; i++) {
      var medio = texto.slice(palabras[i - 1].fin, palabras[i].ini);
      if (!/^,?(?:[ \t]+\n?|\n)[ \t]*(?:(?:de|del|la|las|los|y)(?:[ \t]+\n?|\n)[ \t]*)*$/.test(medio)) break;
      utiles.push(palabras[i]);
    }
    var total = utiles.map(function (p) { return p.n; }).join('').length;
    if (total < 3) return null;
    return { fin: utiles[utiles.length - 1].fin, palabras: utiles };
  }

  // Separa apellido y nombres. Convenciones habituales en actos:
  // "PÉREZ, Juan Carlos", "Juan Carlos PÉREZ", "Juan Carlos Pérez".
  function partesNombre(txt, palabras) {
    var coma = txt.indexOf(',');
    var esMayus = function (p) { return p.txt === p.txt.toUpperCase() && p.txt.length > 1; };
    var apellidos, nombres;
    if (coma !== -1) {
      apellidos = palabras.filter(function (p) { return p.ini < coma; });
      nombres = palabras.filter(function (p) { return p.ini > coma; });
    } else if (palabras.some(esMayus) && !palabras.every(esMayus)) {
      apellidos = palabras.filter(esMayus);
      nombres = palabras.filter(function (p) { return !esMayus(p); });
    } else if (palabras.length === 1) {
      apellidos = palabras;
      nombres = [];
    } else {
      apellidos = palabras.slice(-1);
      nombres = palabras.slice(0, -1);
    }
    var t = function (l) { return l.map(function (p) { return p.txt; }).join(' '); };
    return { apellido: t(apellidos), nombres: t(nombres) };
  }

  function detectarNombres(texto) {
    var hallazgos = [];

    var agregar = function (ini, bruto, prioridad) {
      var r = recortarNombre(bruto);
      if (!r) return;
      var txt = bruto.slice(0, r.fin);
      hallazgos.push({
        ini: ini,
        fin: ini + r.fin,
        tipo: 'PERSONA',
        valor: txt,
        prioridad: prioridad,
        palabras: r.palabras.map(function (p) { return p.n; }),
        partes: partesNombre(txt, r.palabras)
      });
    };

    // 1) Tras un cargo o tratamiento: "al Oficial Primero LP 12345 PÉREZ, Juan".
    var disp = DISPARADORES.map(function (d) {
      return ci(d).replace(/ /g, '(?:[ \\t]+\\n?|\\n)[ \\t]*');
    }).join('|');
    var reDisp = new RegExp(INI + '(?:' + disp + ')(?:(?:[ \\t]+\\n?|\\n)[ \\t]*|(?<=\\.))' + ENTRE + '[ \\t]*(?<v>' + NOMBRE + ')', 'gdu');
    var m;
    while ((m = reDisp.exec(texto))) {
      agregar(m.indices.groups.v[0], m.groups.v, 4);
      reDisp.lastIndex = m.indices.groups.v[0];
    }

    // 2) Formato de nómina: "PÉREZ, Juan Carlos" / "PÉREZ GÓMEZ, María".
    var MAY = "\\p{Lu}[\\p{Lu}'’]+(?:-\\p{Lu}[\\p{Lu}'’]+)*";
    var CAP = "\\p{Lu}\\p{Ll}[\\p{Ll}'’]*";
    var reNomina = new RegExp(INI + '(?<v>' + MAY + '(?:(?:[ \\t]+\\n?|\\n)[ \\t]*(?:(?:DE|DEL|LA|LOS|Y)(?:[ \\t]+\\n?|\\n)[ \\t]*)*' + MAY + ')*,(?:[ \\t]+\\n?|\\n)[ \\t]*' +
      CAP + '(?:(?:[ \\t]+\\n?|\\n)[ \\t]*(?:(?:de|del|la|las|los|y)(?:[ \\t]+\\n?|\\n)[ \\t]*)*' + CAP + ')*)' + FIN, 'gdu');
    while ((m = reNomina.exec(texto))) {
      var v = m.groups.v;
      var antes = v.slice(0, v.indexOf(','));
      var bloqueado = normalizar(antes).split(' ').some(function (w) {
        return NO_NOMBRE.has(w) && !ENLACES.has(w);
      });
      if (!bloqueado) agregar(m.indices.groups.v[0], v, 5);
    }

    return hallazgos;
  }

  // Agrupa detecciones que son la misma persona: "Pérez" dentro de
  // "Juan Carlos Pérez" pertenece al mismo grupo.
  function agruparPersonas(hallazgos) {
    var grupos = [];
    hallazgos
      .slice()
      .sort(function (a, b) { return b.palabras.length - a.palabras.length; })
      .forEach(function (h) {
        var set = h.palabras.filter(function (p) { return !ENLACES.has(p); });
        var g = grupos.find(function (gr) {
          return set.every(function (p) { return gr.palabras.has(p); });
        });
        if (!g) {
          g = { palabras: new Set(set), clave: set.join(' '), partes: h.partes, valores: [] };
          grupos.push(g);
        }
        h.clave = g.clave;
        g.valores.push(h.valor);
      });
    return grupos;
  }

  // Busca en todo el texto las demás formas de cada persona detectada.
  function propagarPersonas(texto, grupos, preservados) {
    var extra = [];
    grupos.forEach(function (g) {
      var formas = new Set(g.valores);
      var ap = g.partes.apellido;
      var no = g.partes.nombres;
      if (ap && no) {
        formas.add(ap + ', ' + no);
        formas.add(no + ' ' + ap);
      }
      // El apellido solo se busca si no es una palabra común del acto.
      var palabrasAp = normalizar(ap).split(' ').filter(function (w) { return !ENLACES.has(w); });
      if (ap && palabrasAp.length && palabrasAp.every(function (w) { return w.length >= 3 && !NO_NOMBRE.has(w); })) {
        formas.add(ap);
      }
      Array.from(formas)
        .sort(function (a, b) { return b.length - a.length; })
        .forEach(function (f) {
          if (esPreservado(f, preservados)) return;
          var re = new RegExp(INI + '(?:' + patronLiteral(f) + ')' + FIN, 'gu');
          var m;
          while ((m = re.exec(texto))) {
            extra.push({
              ini: m.index, fin: m.index + m[0].length, tipo: 'PERSONA',
              valor: m[0], prioridad: 6, clave: g.clave
            });
          }
        });
    });
    return extra;
  }

  function esPreservado(valor, preservados) {
    var n = normalizar(valor);
    if (!n) return false;
    return preservados.some(function (p) {
      return p === n || (' ' + p + ' ').indexOf(' ' + n + ' ') !== -1 ||
        (' ' + n + ' ').indexOf(' ' + p + ' ') !== -1;
    });
  }

  // ---------------------------------------------------------------------
  // Motor
  // ---------------------------------------------------------------------

  var OPCIONES_POR_DEFECTO = {
    tipos: {
      PERSONA: true, DNI: true, 'CUIT/CUIL': true, LEGAJO: true, DOMICILIO: true,
      'TELÉFONO': true, EMAIL: true, 'CBU/CVU': true, DOMINIO: true,
      'FECHA DE NACIMIENTO': true
    },
    // Nombres o datos que deben quedar visibles (p. ej. funcionarios firmantes).
    preservar: [],
    // Términos que siempre se ocultan aunque no sean detectados.
    adicionales: [],
    // 'etiqueta' -> [PERSONA 1]; 'iniciales' -> J. C. P.
    modoPersona: 'etiqueta'
  };

  function iniciales(partes, valor) {
    var ap = partes && partes.apellido ? partes.apellido : valor;
    var no = partes && partes.nombres ? partes.nombres : '';
    var ini = function (s) {
      return normalizar(s).split(' ').filter(function (w) { return w && !ENLACES.has(w); })
        .map(function (w) { return w[0] + '.'; }).join(' ');
    };
    return [ini(no), ini(ap)].filter(Boolean).join(' ');
  }

  function anonimizar(texto, opciones) {
    texto = String(texto || '');
    var op = Object.assign({}, OPCIONES_POR_DEFECTO, opciones || {});
    op.tipos = Object.assign({}, OPCIONES_POR_DEFECTO.tipos, (opciones && opciones.tipos) || {});
    var preservados = (op.preservar || []).map(normalizar).filter(Boolean);

    var candidatos = [];

    // Términos adicionales indicados a mano: máxima prioridad.
    (op.adicionales || []).forEach(function (t) {
      if (!normalizar(t)) return;
      var re = new RegExp(INI + '(?:' + patronLiteral(t) + ')' + FIN, 'gu');
      var m;
      while ((m = re.exec(texto))) {
        candidatos.push({ ini: m.index, fin: m.index + m[0].length, tipo: 'RESERVADO', valor: m[0], prioridad: 0, clave: normalizar(t) });
      }
    });

    DETECTORES.forEach(function (d) {
      if (!op.tipos[d.tipo]) return;
      var re = new RegExp(d.re, 'gdu');
      var m;
      while ((m = re.exec(texto))) {
        var idx = m.indices.groups.v;
        var v = m.groups.v.replace(/[\s,.]+$/, '');
        candidatos.push({
          ini: idx[0], fin: idx[0] + v.length, tipo: d.tipo, valor: v,
          prioridad: d.prioridad, clave: d.clave(v)
        });
        if (m[0].length === 0) re.lastIndex++;
      }
    });

    var grupos = [];
    if (op.tipos.PERSONA) {
      var nombres = detectarNombres(texto).filter(function (h) { return !esPreservado(h.valor, preservados); });
      grupos = agruparPersonas(nombres);
      candidatos = candidatos.concat(nombres, propagarPersonas(texto, grupos, preservados));
    }

    candidatos = candidatos.filter(function (c) {
      return c.fin > c.ini && (c.tipo === 'RESERVADO' || !esPreservado(c.valor, preservados));
    });

    // Resolución de superposiciones: gana la prioridad más alta (número más
    // bajo) y, a igual prioridad, el tramo más largo.
    candidatos.sort(function (a, b) {
      return (a.prioridad - b.prioridad) || ((b.fin - b.ini) - (a.fin - a.ini)) || (a.ini - b.ini);
    });
    var aceptados = [];
    candidatos.forEach(function (c) {
      var choca = aceptados.some(function (a) { return c.ini < a.fin && a.ini < c.fin; });
      if (!choca) aceptados.push(c);
    });
    aceptados.sort(function (a, b) { return a.ini - b.ini; });

    // Numeración estable por orden de aparición.
    var contadores = {};
    var entidades = {};
    var partesPorClave = {};
    grupos.forEach(function (g) { partesPorClave[g.clave] = g.partes; });

    aceptados.forEach(function (c) {
      var id = c.tipo + '|' + c.clave;
      if (!entidades[id]) {
        contadores[c.tipo] = (contadores[c.tipo] || 0) + 1;
        var etiqueta = '[' + c.tipo + ' ' + contadores[c.tipo] + ']';
        if (c.tipo === 'PERSONA' && op.modoPersona === 'iniciales') {
          etiqueta = iniciales(partesPorClave[c.clave], c.valor);
        }
        entidades[id] = { tipo: c.tipo, etiqueta: etiqueta, valores: [], apariciones: 0 };
      }
      var e = entidades[id];
      e.apariciones++;
      if (e.valores.indexOf(c.valor) === -1) e.valores.push(c.valor);
      c.etiqueta = e.etiqueta;
    });

    var salida = '';
    var cursor = 0;
    aceptados.forEach(function (c) {
      salida += texto.slice(cursor, c.ini) + c.etiqueta;
      cursor = c.fin;
    });
    salida += texto.slice(cursor);

    return {
      texto: salida,
      tramos: aceptados.map(function (c) {
        return { ini: c.ini, fin: c.fin, tipo: c.tipo, valor: c.valor, etiqueta: c.etiqueta };
      }),
      entidades: Object.keys(entidades).map(function (k) { return entidades[k]; })
    };
  }

  // Tabla de correspondencias en CSV (separador ;, apto para Excel en español).
  function correspondenciasCSV(resultado) {
    var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };
    var filas = [['Etiqueta', 'Tipo', 'Valor original', 'Apariciones'].map(q).join(';')];
    resultado.entidades.forEach(function (e) {
      filas.push([e.etiqueta, e.tipo, e.valores.join(' | '), e.apariciones].map(q).join(';'));
    });
    return filas.join('\r\n');
  }

  var api = {
    anonimizar: anonimizar,
    correspondenciasCSV: correspondenciasCSV,
    normalizar: normalizar,
    OPCIONES_POR_DEFECTO: OPCIONES_POR_DEFECTO
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.Anonimizador = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
