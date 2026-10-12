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

---

## Texto de cara al usuario

Todo sale de `src/lib/microcopy.ts`. No escribas strings sueltos en los
componentes. El tono es costarricense, en "vos", sin lenguaje
corporativo.

## Lo que NO hay

**No hay runner de pruebas en el frontend.** El bucle de 779
peticiones lo cazó una persona leyendo el log del servidor. No lo
detectó ninguna prueba, porque no hay ninguna.

`sonLaMismaZona()` y `ajustarVista()` son funciones puras y fáciles de
probar: son las primeras candidatas cuando se agregue Vitest.

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
