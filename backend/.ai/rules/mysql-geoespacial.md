# MySQL 8.4 y la columna POINT

Aplica a: `src/Properties/Queries/`, `src/Properties/Models/Property.php`,
migraciones de la tabla `properties`.

La búsqueda por radio (RF-3.3) es la parte más frágil del backend.
No es frágil por ser difícil: es frágil porque **las tres trampas de
MySQL que se listan aquí fallan en silencio**. Devuelven cero filas y
ningún error. El mapa se queda vacío y nada avisa.

Por eso las pruebas de `PropertyRadiusQueryTest` existen aunque la
consulta se entienda: si alguien reintroduce cualquiera de las tres, el
mapa se vacía y esos tests son lo único que lo dice.

---

## Trampa 1 · `ST_MakeEnvelope` no existe para SRID 4326

```sql
ERROR 3618: st_makeenvelope(POINT, POINT) has not been implemented
for geographic spatial reference systems.
```

La envoltura del radio se construye como `POLYGON` con
`ST_GeomFromText`, no con `ST_MakeEnvelope`.

## Trampa 2 · MySQL usa orden de ejes distinto en cada función

Esta es la más traicionera, porque **ninguna de las dos formas lanza
error**:

```sql
-- POINT recibe (longitud, latitud)
ST_SRID(POINT(-84.4274, 10.3236), 4326)   -- lat 10.3236, lng -84.4274

-- El WKT del POLYGON recibe (latitud, longitud), al revés
ST_GeomFromText('POLYGON((10.3236 -84.4274, ...))', 4326)
```

Invertir cualquiera de los dos devuelve cero resultados en silencio.

`(longitud, latitud)` es el orden que usan Leaflet y GeoJSON, así que
el modelo y la API usan ese. El WKT del polígono es el que va al revés,
y `envolturaRectangular()` tiene un comentario que lo dice.

**No calcules distancia en PHP.** `Property::latitude()` y
`longitude()` leen de la columna con `ST_Latitude` / `ST_Longitude` y
eso ya depende del orden correcto. Reimplementar haversine en el
cliente para "ahorrar una consulta" reintroduce exactamente esta
trampa: ya se borró una versión del frontend que lo hacía.

## Trampa 3 · El WKT crudo se interpreta como un número de SRID

```sql
WHERE ST_Contains(?, location)   -- el string POLYGON((...))

ERROR 3548: There's no spatial reference system with SRID 1498173264
```

El WKT tiene que pasar por `ST_GeomFromText(?, 4326)`. Crudo, MySQL
lo castea a entero y lo toma como SRID.

Lo mismo aplica a cualquier expresión espacial: no la pases como
parámetro ligado, ponla en el SQL.

---

## Bonus · `FORMAT(x, 'F6')` devuelve `"10"`

`FORMAT(X, D)` de MySQL exige un entero. `'F6'` se castea a `0`, así
que `FORMAT(10.314557, 'F6')` devuelve `"10"`, no `"10.314557"`.

Para redondear a 6 decimales: `CAST(ROUND(x, 6) AS CHAR)`.

---

## El índice espacial todavía no existe

```sql
ERROR 1252: All parts of a SPATIAL index must be NOT NULL
```

`location` es nullable porque RF-2.6 admite estado `borrador` y el
formulario pide el pin en el paso 6 de 6. MySQL no permite un índice
espacial sobre una columna nullable.

**Se agrega cuando publicar exija el pin** (RF-2.1). Hasta entonces:

- El filtro por radio no usa índice espacial.
- Las columnas con índice BTREE (`status`, `district`, `monthly_rent`)
  siguen sirviendo para lo que sí filtran.
- El radio está acotado a 10 km para que la envoltura no degenere en
  un table scan sobre toda la tabla.

Medido con 10 000 filas: con índice espacial se examinan 251 filas,
sin él 5 077. La diferencia es la que separa cumplir RNF-01 de no
cumplirlo.

## `location` está en `$hidden`

La columna POINT es binaria: serializarla tal cual devuelve un string
ilegible. Se expone con `PropertyResource`, que además aplica RF-2.5
(el desplazamiento del pin) a través de `PropertyLocation`.

**Nunca agregues `location` a `$visible`.** Si hace falta exponerla en
algún rol, se hace en el Resource.
