<?php

declare(strict_types=1);

use App\Http\Controllers\Api\AdminPropertyController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\Api\MyPropertyController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PropertyController;
use App\Http\Controllers\Api\PropertyImageController;
use Illuminate\Support\Facades\Route;

/*
 | API publica.
 |
 | Sin sesion: RF-1.4 dice que el visitante busca y ve el mapa sin crear
 | cuenta. La autenticacion entra en RF-1.1 con Sanctum y vive en un
 | grupo aparte.
 |
 | Todo lo que cuelgue de aqui lleva el techo de RNF-05. Es preferible
 | aplicarlo al grupo completo que ir poniendo middleware ruta por
 | ruta: una ruta nueva sin limite es un agujero, y es el error que
 | mas cuesta detectar.
 */

Route::middleware('throttle:api')->group(function (): void {
    Route::get('/properties', [PropertyController::class, 'index'])
        ->name('api.properties.index');

    Route::get('/properties/{property}', [PropertyController::class, 'show'])
        ->name('api.properties.show');

    /*
     | Rutas publicas de sesion.
     |
     | Registro e inicio de sesion llevan su propio limite, mas
     | estricto, dentro de LoginRequest: cinco intentos por correo y
     | treinta por IP. El general de arriba no alcanza, porque son dos
     | minutos de ventana y una contrasena se adivina con poco.
     */
    Route::post('/register', [AuthController::class, 'register'])
        ->name('api.register');

    Route::post('/login', [AuthController::class, 'login'])
        ->name('api.login');

    /*
     | Verificacion de correo. RF-1.3.
     |
     | `/email/verify/{id}/{hash}` NO lleva sesion a proposito: es la
     | URL firmada que va dentro del correo, y quien la abre es la
     | persona que recien se registro, todavia sin token. La firma
     | temporal es lo que autoriza -- sin ella, cualquiera podria
     | confirmar el correo de otra persona cambiando el id.
     |
     | `/email/verification-notification` SI lleva sesion: es la
     | persona pidiendo que se le reenvie a si misma.
     */
    Route::get('/email/verify/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware('signed')
        ->name('api.email.verify');

    Route::post('/email/verification-notification', [EmailVerificationController::class, 'resend'])
        ->middleware('auth:sanctum')
        ->name('api.email.resend');

    /*
     | Recuperacion de contrasena. RF-1.3.
     |
     | Las dos son publicas y sin sesion: quien se le olvido la
     | contrasena precisamente no puede iniciar sesion para pedirla.
     | El limite de reenvios lo pone el broker de Laravel
     | (`throttle` en config/auth.php).
     */
    Route::post('/forgot-password', [PasswordResetController::class, 'sendLink'])
        ->name('api.forgot-password');

    Route::post('/reset-password', [PasswordResetController::class, 'reset'])
        ->name('api.reset-password');
});

/*
 | Rutas que exigen token.
 |
 | El guard 'sanctum' valida la cabecera Authorization: Bearer <token>.
 | Sin token valido responde 401, y `Accept: application/json` hace
 | que la respuesta sea JSON y no HTML.
 */
Route::middleware(['throttle:api', 'auth:sanctum'])->group(function (): void {
    Route::get('/user', [AuthController::class, 'user'])
        ->name('api.user');

    Route::post('/logout', [AuthController::class, 'logout'])
        ->name('api.logout');

    /*
     | Publicaciones propias. RF-2.1.
     |
     | Viven aparte de GET /api/properties a proposito: el listado
     | publico no exige sesion y solo devuelve las activas; estas son
     | las del dueno, con todos los estados.
     */
    Route::get('/my/properties', [MyPropertyController::class, 'index'])
        ->name('api.my.properties.index');

    Route::post('/properties', [MyPropertyController::class, 'store'])
        ->name('api.properties.store');

    Route::put('/properties/{property}', [MyPropertyController::class, 'update'])
        ->name('api.properties.update');

    Route::delete('/properties/{property}', [MyPropertyController::class, 'destroy'])
        ->name('api.properties.destroy');

    Route::post('/properties/{property}/pause', [MyPropertyController::class, 'pause'])
        ->name('api.properties.pause');

    Route::post('/properties/{property}/resume', [MyPropertyController::class, 'resume'])
        ->name('api.properties.resume');

    Route::post('/properties/{property}/rented', [MyPropertyController::class, 'markRented'])
        ->name('api.properties.rented');

    /*
     | Fotografias. RF-2.3.
     |
     | Las rutas cuelgan de `properties/{property}`, no de una raiz
     | `/images`: una foto sin publicacion no existe, y el permiso se
     | revisa con `PropertyPolicy::update` sobre la publicacion, que es
     | la que tiene el dueno. Con una raiz propia habria que volver a
     | preguntar de quien es cada foto.
     */
    Route::post('/properties/{property}/images', [PropertyImageController::class, 'store'])
        ->name('api.properties.images.store');

    Route::delete('/properties/{property}/images/{imagen}', [PropertyImageController::class, 'destroy'])
        ->name('api.properties.images.destroy');

    /*
     | Moderacion. RF-7.1.
     |
     | Estas dos rutas son el unico camino por el que una publicacion
     | se vuelve visible. Sin ellas, publicar no cierra de punta a
     | punta: nadie veria nunca un inmueble nuevo.
     |
     | Y la cola de arriba es lo que las hace usables: sin una forma de
     | saber *cual* hay que moderar, aprobar y rechazar solo funcionan si
     | el administrador ya conoce el id de la publicacion.
     */
    Route::get('/admin/properties', [AdminPropertyController::class, 'index'])
        ->middleware('role:admin')
        ->name('api.admin.properties.index');

    Route::post('/properties/{property}/approve', [MyPropertyController::class, 'approve'])
        ->middleware('role:admin')
        ->name('api.properties.approve');

    Route::post('/properties/{property}/reject', [MyPropertyController::class, 'reject'])
        ->middleware('role:admin')
        ->name('api.properties.reject');
});
