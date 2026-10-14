# `docker/nginx/` — reservado

Esta carpeta esta reservada y **aun no tiene configuracion**.

## Que va a ir aqui

El frontend de produccion. `npm run build` deja los archivos estaticos
en `frontend/dist/`, y alguien tiene que servirlos. Hoy ese alguien no
existe: en desarrollo lo sirve Vite (`npm run dev`) y en produccion no
hay nada configurado.

Ademas, nginx tiene que hacer de proxy hacia el backend:

```
navegador ──> nginx ──> /            -> frontend/dist (React)
                     ──> /api/*      -> Laravel (php artisan serve o php-fpm)
```

## Por que el proxy y no CORS

El frontend ya pide rutas relativas (`/api/properties`), no una URL
absoluta. Con el proxy, el navegador nunca hace una peticion
cross-origin, y por eso no hay CORS que configurar ni depurar en dos
entornos. Ver `frontend/vite.config.js`, que hace lo mismo en
desarrollo.

## Lo que falta y ya se sabe

No es solo "falta el archivo". Estas dos cosas **dependen** de que este
servidor exista y ninguna se puede cerrar antes:

| Requisito | Por que depende de aca |
| --- | --- |
| **RNF-04 · CSP** | La cabecera `Content-Security-Policy` se pone en la respuesta **del documento HTML**. Laravel solo devuelve JSON en `/api/*`, y ahi una CSP no protege nada: las politicas se aplican a documentos, no a respuestas de XHR. |
| **RNF-06 · HTTPS** | El redireccion a HTTPS y el HSTS los emite el servidor web. |

Ademas, la CSP tiene que permitir lo que usa la pantalla de busqueda:

```
style-src   'self' https://fonts.bunny.net
font-src    'self' https://fonts.bunny.net
img-src     'self' data: https://tile.openstreetmap.org
connect-src 'self'
```

`tile.openstreetmap.org` es por donde Leaflet pide las teselas del mapa.
Si la CSP lo bloquea, el mapa abre con fondo gris y **ningun error lo
avisa**, igual que las tres trampas de MySQL de `.ai/rules`.

## Estado

| Parte | Estado |
| --- | --- |
| `docker/mysql/init/` | Hecho, con `00-init.sql` comentado de ejemplo |
| `docker/nginx/` | **Solo este README** |

Se implementa cuando se monte el despliegue. Ver RNF-06 y RNF-04 en el
tablero.
