# Anonimizador de actos administrativos

Reemplaza los datos personales de un acto (resolución, disposición, decreto,
providencia, dictamen) por etiquetas consistentes. La misma persona recibe la
misma etiqueta en todo el texto aunque aparezca escrita de formas distintas:
`PÉREZ GÓMEZ, Juan Carlos`, `el sumariado Pérez Gómez` y `el Oficial Pérez Gómez`
pasan a ser `[PERSONA 1]`.

Todo corre localmente. No usa servicios externos ni dependencias.

## Qué detecta

| Tipo | Ejemplos |
|---|---|
| Personas | Tras cargo o tratamiento (`Sr.`, `Dra.`, `agente`, `Oficial Primero`, `Comisario`, `sumariado`, `denunciante`, `letrado`, `testigo`…) y en formato nómina `APELLIDO, Nombre`. Después busca el resto de las apariciones (apellido solo, orden inverso). |
| DNI / documentos | `D.N.I. N° 28.456.789`, `DNI 31222333`, números sueltos con formato `20.123.456` (excluye montos con `$` o seguidos de `pesos`). |
| CUIT / CUIL | `20-28456789-3`, `27284567893` |
| Legajo | `LP 12.345`, `Legajo Personal N° 45678` |
| Domicilios | `domicilio real en la calle Hipólito Yrigoyen 1234, piso 3, depto. B`, `Av. Rivadavia N° 5000` |
| Teléfonos | Con rótulo (`tel.`, `celular`…) o con `+54` |
| Correos, CBU/CVU, dominios de vehículos, fechas de nacimiento | |

No toca números de expediente (`EX-…`, `IF-…`), normas, montos, fechas del acto ni organismos.

## Uso

**Navegador:** abrir `index.html`. Pegar el texto, ajustar qué ocultar, copiar el resultado.

**Línea de comandos:**

```bash
node anonimizador/cli.js acto.txt --salida acto-anon.txt --tabla correspondencias.csv \
  --preservar "Horacio Giménez" --ocultar "Barrio Mitre"
```

Opciones: `--iniciales` (J. C. P. G. en lugar de `[PERSONA 1]`), `--sin dni,domicilio` para desactivar detectores.

**Como módulo:**

```js
const { anonimizar } = require('./anonimizador/anonimizador');
const { texto, entidades } = anonimizar(acto, { preservar: ['Horacio Giménez'] });
```

## Límites

- Un nombre sin cargo, tratamiento ni formato `APELLIDO, Nombre` delante puede pasar sin detectar. Para eso está `preservar` / `adicionales` (en la web: "Dejar visibles" / "Ocultar además").
- Los funcionarios firmantes se detectan si llevan tratamiento (`Dr.`). Si deben quedar visibles, cargarlos en "Dejar visibles".
- La tabla de correspondencias contiene los datos originales: no se adjunta al acto publicado.
- Revisar siempre el resultado antes de publicarlo.

## Pruebas

```bash
node --test anonimizador/pruebas.js
```
