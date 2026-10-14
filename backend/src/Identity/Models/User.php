<?php

declare(strict_types=1);

namespace Modules\Identity\Models;

use Database\Factories\UserFactory;
use Illuminate\Auth\MustVerifyEmail as MustVerifyEmailConcern;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Modules\Identity\Enums\UserRole;
use Modules\Identity\Notifications\VerifyEmailNotification;

/*
 * `MustVerifyEmail` son DOS cosas con el mismo nombre: el contrato de
 * Illuminate\Contracts y el trait de Illuminate\Auth. Por eso los dos
 * imports llevan alias.
 *
 * El contrato es lo que activa el middleware `verified`; el trait es lo
 * que trae `hasVerifiedEmail()` y `markEmailAsVerified()`.
 *
 * RF-1.3. Sin esto, `email_verified_at` es una columna que nadie lee.
 */
#[Fillable(['name', 'email', 'password', 'role'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, MustVerifyEmailConcern, Notifiable;

    /**
     * La notificacion de verificacion es la del modulo, no la de Laravel.
     *
     * Por defecto Laravel manda la suya, que habla ingles y no pasa por
     * la cola. Ver Modules\Identity\Notifications\VerifyEmailNotification.
     */
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailNotification);
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',

            /*
             * El cast `hashed` es lo que cumple RNF-03. No es
             * opcional: sin el, la contrasena se guardaria en claro y
             * un dump de la base la entrega completa.
             *
             * El algoritmo sale de config/hashing.php, que usa bcrypt
             * con BCRYPT_ROUNDS=12. Si alguna vez se cambia a argon2id
             * (mejor), se cambia ahi y no aqui.
             */
            'password' => 'hashed',

            'role' => UserRole::class,
        ];
    }

    /**
     * Get the factory that creates the model's instances.
     */
    protected static function newFactory(): UserFactory
    {
        return UserFactory::new();
    }

    /**
     * Si tiene alguno de los roles indicados. RF-1.4.
     *
     * Se llama tieneRol() y no can() a proposito: `can()` ya existe en
     * Illuminate\Foundation\Auth\User (trait Authorizable) y su firma
     * es `can($abilities, $arguments = [])`. Redefinirla con una
     * incompatible hace que el modelo ni siquiera cargue, y ademas
     * romperia los Gate de Laravel mas adelante.
     *
     * Cuando lleguen las Policies, este metodo se queda para preguntas
     * simple de rol y las autorizaciones con logica van por Gate.
     *
     * @param  iterable<UserRole|string>  $roles
     */
    public function tieneRol(iterable $roles): bool
    {
        $actual = $this->rolEfectivo();

        foreach ($roles as $rol) {
            $comparado = $rol instanceof UserRole ? $rol : UserRole::tryFrom($rol);

            // Un texto que no sea un rol conocido se ignora en vez de
            // lanzar: el middleware lo arma desde configuracion y no
            // merece un 500 si alguien escribio mal un nombre.
            if ($comparado !== null && $actual === $comparado) {
                return true;
            }
        }

        return false;
    }

    /**
     * Si puede crear publicaciones. RF-2.1.
     */
    public function isLandlord(): bool
    {
        return $this->rolEfectivo()->puedePublicar();
    }

    /**
     * Si puede entrar al panel de administracion. RF-7.1.
     */
    public function isAdmin(): bool
    {
        return $this->rolEfectivo()->puedeAdministrar();
    }

    /**
     * El rol, con el default aplicado cuando viene nulo.
     *
     * OJO: la columna se llama `role`, en ingles, y no `rol`. Leerla
     * como `$this->rol` devuelve null en silencio porque no existe
     * ningun atributo con ese nombre, y el default de abajo lo
     * convertiria en "todos son inquilinos": `isLandlord()` daria
     * false para todo el mundo, incluidos los arrendadores.
     *
     * La columna es NOT NULL con default 'tenant', asi que desde la
     * base el null no llega. Esto solo cubre una asignacion en memoria.
     *
     * No guarda el valor: mutar el modelo dentro de una consulta
     * sorprende, y el default ya se aplica al crear la cuenta.
     */
    private function rolEfectivo(): UserRole
    {
        return $this->role ?? UserRole::porDefecto();
    }
}
