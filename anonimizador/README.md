# Anonimizador de actos administrativos

Reemplaza los datos personales de un acto (resolución, disposición, decreto,
providencia, dictamen) por etiquetas consistentes. La misma persona recibe la
misma etiqueta en todo el texto aunque aparezca escrita de formas distintas:
`PÉREZ GÓMEZ, Juan Carlos`, `el sumariado Pérez Gómez` y `el Oficial Pérez Gómez`
pasan a ser `[PERSONA 1]`.

## Uso en las máquinas del trabajo

La herramienta completa es **un solo archivo**: [`dist/anonimizador-actos.html`](dist/anonimizador-actos.html) (2 MB).

1. Copiar el archivo a la computadora (escritorio, carpeta personal o unidad de red).
2. Abrirlo con doble clic. Se abre en **Chrome o Edge** (versión 90 o posterior; si el navegador es más viejo, la página lo avisa).
3. Cargar el acto en el recuadro **Cargar acto administrativo**, arrastrándolo o eligiéndolo.

No requiere instalar nada, ni permisos de administrador, ni conexión a internet. El archivo del acto se procesa dentro del navegador y no se envía a ningún servidor: la página no hace ningún pedido de red.

### Formatos de entrada

- **PDF con texto** (los que exporta GDE). Los renglones de cada párrafo se vuelven a unir. Un PDF escaneado no tiene texto: hay que pasarlo por OCR antes.
- **Word .docx**. Un `.doc` antiguo hay que guardarlo antes como `.docx` o PDF.
- **.txt**, o pegar el texto directamente.

### Flujo de trabajo

1. Cargar el acto. El resultado aparece a la derecha, con cada dato oculto marcado.
2. **Revisar.** Si algo no debía ocultarse (p. ej. el funcionario firmante), hacer clic en su etiqueta: queda visible en todo el acto. Si algo quedó sin ocultar, seleccionarlo en el original y tocar **Ocultar selección**.
3. **Descargar Word** (Arial 11, justificado, etiquetas en negrita para ubicarlas) o **Copiar** para pegar en GDE.
4. Opcional: **Descargar tabla (Excel)** con la correspondencia etiqueta → dato original. Contiene los datos reales: no va con el acto publicado.

Las listas "Dejar visibles" y "Ocultar además" y los tipos elegidos se recuerdan en ese navegador para el próximo acto.

## Qué detecta

| Tipo | Ejemplos |
|---|---|
| Personas | Tras cargo o tratamiento (`Sr.`, `Dra.`, `agente`, `Oficial Primero`, `Comisario`, `sumariado`, `denunciante`, `letrado`, `testigo`…) y en formato nómina `APELLIDO, Nombre`. Después busca el resto de las apariciones (apellido solo, orden inverso, sin importar acentos ni mayúsculas). |
| DNI / documentos | `D.N.I. N° 28.456.789`, `DNI 31222333`, números sueltos con formato `20.123.456` (excluye montos con `$` o seguidos de `pesos`). |
| CUIT / CUIL | `20-28456789-3`, `27284567893` |
| Legajo | `LP 12.345`, `Legajo Personal N° 45678` |
| Domicilios | `domicilio real en la calle Hipólito Yrigoyen 1234, piso 3, depto. B`, `Av. Rivadavia N° 5000` |
| Teléfonos | Con rótulo (`tel.`, `celular`…) o con `+54` |
| Edad | `de 41 años de edad`, `edad: 41 años` |
| Correos, CBU/CVU, dominios de vehículos, fechas de nacimiento | |

No toca números de expediente (`EX-…`, `IF-…`), normas, montos, fechas del acto ni organismos.

## Límites

- Un nombre sin cargo, tratamiento ni formato `APELLIDO, Nombre` delante puede pasar sin detectar. Para eso está **Ocultar selección**.
- Revisar siempre el resultado antes de publicarlo o incorporarlo a un expediente.

## Para desarrollo

```
anonimizador/
├── anonimizador.js   motor de detección (Node y navegador, sin dependencias)
├── exportar.js       generación del .docx (sin dependencias)
├── index.html        interfaz; carga vendor/ bajo demanda
├── vendor/           PDF.js y mammoth.js (ver vendor/LICENCIAS.md)
├── build.js          arma dist/anonimizador-actos.html con todo incluido
├── cli.js            uso por línea de comandos (texto plano)
└── pruebas.js
```

```bash
node --test anonimizador/pruebas.js    # pruebas
node anonimizador/build.js             # regenerar el archivo único tras cualquier cambio
node anonimizador/cli.js acto.txt --salida acto-anon.txt --tabla correspondencias.csv \
  --preservar "Horacio Giménez" --ocultar "Barrio Mitre" [--iniciales] [--sin dni,domicilio]
```

Como módulo:

```js
const { anonimizar } = require('./anonimizador/anonimizador');
const { texto, entidades } = anonimizar(acto, { preservar: ['Horacio Giménez'] });
```
