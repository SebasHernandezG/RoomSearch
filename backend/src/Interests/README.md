# Modulo Interests

Solicitudes de contacto entre un inquilino y una propiedad.

## Responsabilidad

- Modelo `Interest`: el mensaje "me interesa" de un inquilino hacia un inmueble.
- Estados: nueva, respondida, descartada.
- Respuesta del arrendador.
- Limite anti-spam por usuario.
- Notificaciones asociadas (correo, WhatsApp).

## Que NO pertenece aqui

- El aviso de WhatsApp es un enlace generado a partir del telefono del
  arrendador, que es dato de **Identity**. Este modulo no guarda el numero.
- La verificacion del arrendador y las resenas son de **Trust**.

## Estructura

```text
src/Interests/
├── Models/          Interest
└── ...
```

## Estado actual

Vacio a proposito. La migracion `interests` de la rama `Produccion` es
reutilizable (ver issue #2), pero su modelo no se copia tal cual: allí el
nombre es `Listing` y la arquitectura es otra.

## Requisitos relacionados

| Requisito | Issue |
|---|---|
| RF-5.1 Me interesa con mensaje | #24 |
| RF-5.2 Boton de WhatsApp | #25 |
| RF-5.4 Notificaciones por correo | #27 |
| RF-5.6 Limite anti-spam | #26 |
