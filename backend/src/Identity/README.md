# Modulo Identity

Cuentas de usuario, roles y perfiles.

## Responsabilidad

- Modelo `User` y autenticacion.
- Roles: `tenant` (inquilino), `landlord` (arrendador), `admin` (administrador).
  El visitante no tiene cuenta: busca y ve el mapa sin registrarse (RF-1.4).
- Perfil del arrendador y perfil del inquilino.
- Verificacion de correo y recuperacion de contrasena.

## Que NO pertenece aqui

- Anuncios de inmuebles: **Properties**.
- Solicitudes de contacto: **Interests**.
- Permisos de moderacion sobre otros usuarios: el modelo de permisos vive
  aqui, pero la interfaz de moderacion es de **Admin**.

## Estructura

```text
src/Identity/
├── Models/          User
├── Enums/           UserRole
└── ...
```

## Estado actual

Vacio a proposito. El modelo `User` sigue en `app/Models/User.php` porque
moverlo requiere tocar autenticacion y las factorias de una vez. Se mueve en
un PR dedicado, con sus tests.

## Requisitos relacionados

| Requisito | Issue |
|---|---|
| RF-1.1 Registro e inicio de sesion | #3 |
| RF-1.3 Verificacion y reset | #5 |
| RF-1.4 Roles | #6 |
| RF-1.5 Perfil del arrendador | #7 |
| RF-1.6 Perfil del inquilino | #8 |
