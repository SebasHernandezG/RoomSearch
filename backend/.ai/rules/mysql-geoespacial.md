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

## El índice espacial ya existe

```sql
ERROR 1252: All parts of a SPATIAL index must be NOT NULL
```

`location` **es NOT NULL** desde RF-2.1. Antes era nullable porque se
suponía que un borrador podía quedarse en el paso 1 del formulario
(DS-8) sin pin, y MySQL no permite un índice espacial sobre una columna
nullable: el índice estuvo bloqueado tres PRs por eso.

El supuesto resultó falso. RF-2.1 hace que toda publicación nueva
nazca en `pendiente`, no en `borrador`, así que el borrador sin pin
nunca llegó a existir. La migración
`2026_10_12_040000_add_owner_and_spatial_index_to_properties_table.php`
cambia la nulabilidad y agrega `spatialIndex('location')` en el mismo
paso.

Medido con 10 000 filas: con índice espacial se examinan 251 filas,
sin él 5 077.

**No vuelvas a hacer nullable `location` para admitir un borrador sin
pin.** Si aparece un estado que legitimately no tiene pin, el índice se
cae y RNF-01 se cae con él.

Dos pruebas lo vigilan, porque el fallo sería silencioso:

- `PropertyRadiusQueryTest::la_columna_location_tiene_indice_espacial`
- `PropertyRadiusQueryTest::la_columna_location_no_admite_nulos`

### La migración usa MODIFY, nunca DROP + ADD

La primera versión hacía `dropColumn('location')` y la volvía a agregar
con `nullable(false)`. MySQL ejecuta el DROP, y cuando llega al ADD
encuentra una tabla con filas y sin default:

```
ERROR 1138: Invalid use of NULL value
```

La migración se queda a medias y la tabla queda **sin la columna**, que
es peor que no haberla cambiado. Para cambiar la nulabilidad se usa
`->change()` sobre la columna existente.

Igual hay que rellenar los nulos **antes** del `change()`: MySQL no
aplica el default a las filas existentes cuando cambia la nulabilidad.

## `location` está en `$hidden`

La columna POINT es binaria: serializarla tal cual devuelve un string
ilegible. Se expone con `PropertyResource`, que además aplica RF-2.5
(el desplazamiento del pin) a través de `PropertyLocation`.

**Nunca agregues `location` a `$visible`.** Si hace falta exponerla en
algún rol, se hace en el Resource.

## `user_id` tampoco se expone

La respuesta de `PropertyResource` no lleva `user_id`. El listado
público no tiene por qué darle a un visitante el id interno de quién
publicó cada inmueble, y `PropertyController::show` tampoco.

Para comprobar de quién es una publicación, la prueba mira **la base**:

```php
$this->assertDatabaseHas('properties', ['id' => $id, 'user_id' => $arrendadora->id]);
```

El Resource sigue siendo el lugar donde se decide qué ve cada rol, así
que si algún día hay que exponerlo, se expone ahí y no en el modelo.
