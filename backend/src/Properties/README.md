# Modulo Properties

Alojamientos y publicaciones de inmuebles.

## Responsabilidad

- Modelo `Property`: el inmueble que un arrendador publica.
- Tipos de inmueble (apartamento, casa, habitacion, estudio).
- Precio, moneda y deposito.
- Fotografias y comodidades.
- Ubicacion geoespacial (`POINT SRID 4326`).
- Ciclo de vida de la publicacion: borrador, pendiente, activa, pausada, alquilada.

## Que NO pertenece aqui

- Cuentas de usuario y roles: viven en **Identity**.
- Solicitudes de contacto entre inquilino y arrendador: viven en **Interests**.
- Busqueda por radio y mapa: son una consulta sobre `properties`, pero la
  interfaz de mapa vive en el frontend. Si aparece logica geoespacial
  reutilizable, va en `Properties/Queries` como un scope, no en el controlador.

## Estructura

```text
src/Properties/
├── Models/          Modelos Eloquent del modulo
└── ...
```

Anadir subcarpetas solo cuando haya al menos dos archivos que lo justifiquen.

## Requisitos relacionados

| Requisito | Issue |
|---|---|
| RF-2.1 CRUD y maquina de estados | #10 |
| RF-2.2 Esquema completo del inmueble | #9 |
| RF-2.3 Galeria de fotos | #11 |
| RF-2.4 Pin en el mapa (`POINT`) | #12 |
| RF-3.3 Busqueda por radio | #16 |
