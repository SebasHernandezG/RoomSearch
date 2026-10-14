# El mapa y sus bucles

Aplica a: `frontend/src/components/mapa/**`,
`frontend/src/components/PantallaBusqueda.tsx`.

Este archivo existe por un bug concreto: la pantalla se quedó colgada
en un bucle de **779 peticiones seguidas** y los marcadores nunca
salieron. Dos propiedades distintas del mapa lo provocaban, y las dos
vuelven si no se recuerda.

---

## 1 · El radio lo elige la persona, nunca el zoom

El radio se **deducía del zoom** del mapa. Eso cerraba un ciclo:

```
zoom → radio → círculo → fitBounds → zoom → ...
```

Medido: 779 peticiones y la UI nunca salía de "cargando".

Ahora el radio viene del selector (`SelectorRadio`) y viaja tal cual en
la zona. `leerCentro()` lo recibe como parámetro. La única fuente de
movimiento es la persona.

**No vuelvas a deducir el radio del zoom.** Parece más natural, y es
exactamente el bucle.

## 2 · Encajar el círculo no es un movimiento de la persona

`fitBounds` dispara `moveend`, y `moveend` lo lee el padre como "la
persona movió el mapa", lo que dispara una búsqueda que vuelve a
cambiar la zona.

Por eso `ajustarVista()` marca el mapa en `ajustesEnCurso` (un
`WeakSet`, porque se llama desde dos efectos distintos y un `ref` no
llega al helper suelto) y lo desmarca en el siguiente turno.

El `setTimeout(…, 0)` no es descuido: si el círculo ya cabía,
`fitBounds` no mueve nada y no llega ningún `moveend` que limpiar. Sin
el temporal, el mapa quedaría marcado y se tragaría el siguiente
movimiento real de la persona.

## 3 · Una zona igual no dispara búsqueda

Encajar el círculo devuelve el centro al mismo sitio. `sonLaMismaZona()`
compara con **50 m de tolerancia**: por debajo se nota el temblor al
arrastrar, por encima dejas de sentir el mapa pegado al dedo.

Sin esa comparación, cada ajuste volvía a pedir datos.

## 4 · Leaflet mide el contenedor una sola vez

Leaflet mide el contenedor al crearse y nunca más. En móvil la pestaña
"Lista" oculta el mapa con `display:none`, así que se quedaba con la
medida del momento en que estaba oculto y pintaba las teselas en una
franja con el resto del mapa en blanco.

Por eso hay un `ResizeObserver` con `invalidateSize()`. **No lo
saques** aunque parezca redundante: es el caso de uso más común, no un
caso raro.

El primer `invalidateSize` va en `requestAnimationFrame` porque al
montar el layout todavía no está resuelto y medir en ese momento da el
tamaño viejo.

## 5 · La distancia la calcula el servidor

MySQL la calcula con `ST_Distance_Sphere`. En el frontend hubo una
versión con haversine que se borró: `formatDistance()` solo formatea el
número que ya viene.

Ver [mysql-geoespacial.md](../../.ai/rules/mysql-geoespacial.md).

## 6 · El permiso se pide al pulsar, nunca al montar

RF-3.4. El botón de "usar mi ubicación" **no pide nada** al cargar la
página.

No es una preferencia, es la diferencia entre que la función exista o
no para siempre. Un permiso que aparece sin que la persona haya pedido
nada se **deniega solo**, y los navegadores lo recuerdan: si la primera
petición fue inesperada, esa casilla queda bloqueada y volver a pedirlo
no vuelve a abrir el diálogo.

Por eso `navigator.geolocation` solo se toca dentro del manejador del
clic, en `frontend/src/lib/ubicacion.ts`.

## 7 · Un boton que va a fallar, no se pinta

`PUEDE_UBICAR` se evalúa **fuera del componente**, al importarlo. Si el
navegador no expone `geolocation`, el botón no existe.

Un botón que aparece y al pulsarlo dice "tu dispositivo no sabe dónde
estás" se lee como un fallo de la plataforma. Uno que nunca aparece se
lee como una función que el navegador no tiene.

## 8 · `setView` a propósito, no `ajustarVista`

Cuando la ubicación llega, el mapa se mueve con `setView`, **no** con
`ajustarVista()`.

`ajustarVista()` marca el mapa en `ajustesEnCurso` justamente para que
el `moveend` que provoca **no** dispare una búsqueda — es el guardia
anti-bucle de la regla 2.

Aquí se quiere justo lo contrario: la persona acaba de decidir buscar
en su ubicación, así que la petición tiene que salir sola, sin volver a
pulsar "Buscar en esta zona". Marcarlo como ajuste suprimiría el
`moveend` y no se buscaría nada.

## 9 · Los tres errores se dicen distinto

Permiso denegado, posición no disponible y timeout llegan todos como un
`code` numérico. El mensaje es distinto en los tres porque **la acción
es distinta**, y quien no entiende qué hacer no va a pulsar "reintentar"
con la misma fe:

| Código | Qué pasó | Qué puede hacer la persona |
| --- | --- | --- |
| 1 | El navegador no dio permiso | Cambiarlo en los permisos del sitio |
| 2 | El dispositivo no sabe dónde está | Mover el mapa a mano |
| 3 | Tardó demasiado | Reintentar, o escribir el distrito |

Ninguno dice "falló": suena a caída del servidor, y el documento pide
que la plataforma se sienta confiable. Un código desconocido cae en un
mensaje útil, porque el navegador puede inventarse códigos nuevos.

## Lo que NO se hace: reverse geocoding

RF-3.4 pide leer el distrito con Nominatim. **No se hizo, a propósito.**

Dos razones, y las dos son serias:

1. **Es enviar las coordenadas de alguien a un tercero**, sin haberle
   preguntado. La plataforma tiene la regla más estricta del proyecto
   sobre la privacidad de la ubicación: RF-2.5, que oculta el pin
   exacto si el arrendador no autoriza. Mandarla a un servicio externo
   por una etiqueta de texto contradice esa regla.

2. **Nominatim no se puede llamar bien desde el navegador.** Su política
   de uso exige un `User-Agent` identificable, y desde JavaScript no se
   puede poner uno. Google llamándolo "quedarse sin servicing".

La solución correcta es hacer el reverse geocoding **desde el backend**,
donde sí se puede poner el `User-Agent` y se pueden cachear las
respuestas. Es un endpoint aparte, con su propio límite de peticiones.

Mientras tanto, el plan B ya existe: el buscador por texto (`q`) acepta
"Ciudad Quesada" y la API lo resuelve sin geocodificar nada.

---

## Texto de cara al usuario

Todo sale de `src/lib/microcopy.ts`. No escribas strings sueltos en los
componentes. El tono es costarricense, en "vos", sin lenguaje
corporativo.

La excepción es `src/lib/ubicacion.ts`: los mensajes de error de la
geolocalizacion viven ahí y no en `microcopy.ts`, porque los tres
dependen de un `code` numérico y no se pueden escribir como
constantes sueltas.

## Hay runner: Vitest

Vitest corre desde la RF-2.1 (ver
[vitest.md](vitest.md)). Las pruebas viven **junto al codigo**, con
sufijo `.test.ts`:

```
src/components/PantallaBusqueda.test.ts     sonLaMismaZona
src/components/mapa/PropertyMap.test.ts     ajustarVista, ajustesEnCurso
src/lib/format.test.ts                      formatPrice, formatDistance
src/lib/api.test.ts                         ErrorApi, Retry-After, filtros
```

Las dos primeras existen **por este archivo**: `sonLaMismaZona()` y
`ajustarVista()` son las candidatas que aqui se nombraban como las
primeras que habia que probar, y ya lo estan. Los 779 peticiones
ahora tienen una prueba que las frena.

Para que una funcion sea testeable hay que **exportarla**. No es un
cambio de comportamiento y no ensucia la API del componente: es lo
mismo que hace el backend al dejar las reglas de dominio en el modulo
para poder probarlas sin HTTP.

## Mockear, no montar

`PropertyMap.test.ts` **no levanta Leaflet**. Usa mapas de mentira.

No es vagancia: en jsdom, Leaflet depende de medidas de capas que no
existen, y domarlas es un problema mas grande que el que se quiere
probar. `ajustarVista()` solo necesita que `fitBounds` reciba los
limites del circulo y que se pueda preguntar si el mapa esta marcado.
Nada mas.

Si alguna vez hay que probar algo que si depende del Leaflet de
verdad, ese caso pide `@vitest/browser-playwright`, no un `vi.mock`
mas grande.

---

## Conflicto sin resolver en DS-7

DS-7 pide un botón flotante "Buscar en esta zona" **después de mover el
mapa**, o sea búsqueda confirmada. RF-3.5 pide búsqueda automática con
debounce de 300 ms al mover. Las dos cosas no pueden ser verdad a la
vez.

Hoy están las dos: la búsqueda sale sola y el botón vuelve a pedir la
zona actual. El botón **no está de adorno** — es el reintento manual,
y es lo único que queda pulsable cuando la búsqueda automática se
frenó por un 429 o falló.

Hay que decidir cuál manda y ajustar el issue #51. Mientras tanto, si
cambiar el comportamiento, **no lo borres**: la primera versión del
botón solo se ocultaba a sí mismo, que es peor que no tenerlo.
