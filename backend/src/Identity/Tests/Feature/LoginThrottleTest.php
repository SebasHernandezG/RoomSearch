<?php

declare(strict_types=1);

namespace Modules\Identity\Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Modules\Identity\Models\User;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

/**
 * El limite de intentos al iniciar sesion. RNF-05.
 *
 * Cuenta FALLIDOS, no intentos: el limite solo sube cuando la
 * contrasena esta mal, y se borra en cuanto alguien entra bien. Si
 * contara todos los intentos, alguien que se equivoca cinco veces y
 * despues entra bien quedaria frenado igual.
 */
class LoginThrottleTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'una-frase-larga';

    private const INTENTOS = 5;

    #[Test]
    public function cinco_intentos_fallidos_y_al_sesto_ya_no_pasa(): void
    {
        User::factory()->create([
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        for ($i = 1; $i <= self::INTENTOS; $i++) {
            $this->postJson('/api/login', [
                'email' => 'ana@prueba.test',
                'password' => 'incorrecta',
            ])->assertStatus(422);
        }

        $this->postJson('/api/login', [
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ])->assertStatus(429);
    }

    /**
     * Aunque la contrasena este bien, el sexto intento se frena. Si no,
     * el limite no serviria de nada: un atacante solo tendria que
     * adivinar la ultima.
     */
    #[Test]
    public function el_freno_aplica_tambien_con_la_contrasena_correcta(): void
    {
        User::factory()->create([
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        for ($i = 0; $i < self::INTENTOS; $i++) {
            $this->postJson('/api/login', ['email' => 'ana@prueba.test', 'password' => 'incorrecta']);
        }

        $this->postJson('/api/login', [
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ])->assertStatus(429);
    }

    #[Test]
    public function el_429_dice_cuanto_falta_esperar(): void
    {
        User::factory()->create([
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        for ($i = 0; $i < self::INTENTOS; $i++) {
            $this->postJson('/api/login', ['email' => 'ana@prueba.test', 'password' => 'incorrecta']);
        }

        $respuesta = $this->postJson('/api/login', [
            'email' => 'ana@prueba.test',
            'password' => 'incorrecta',
        ])->assertStatus(429);

        $this->assertNotNull($respuesta->headers->get('Retry-After'));
    }

    /**
     * Entrar bien borra el contador.
     */
    #[Test]
    public function entrar_bien_limpia_el_contador(): void
    {
        User::factory()->create([
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ]);

        for ($i = 0; $i < self::INTENTOS - 1; $i++) {
            $this->postJson('/api/login', ['email' => 'ana@prueba.test', 'password' => 'incorrecta']);
        }

        $this->postJson('/api/login', [
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ])->assertOk();

        // El contador quedo en cero, asi que hay margen de nuevo.
        $this->postJson('/api/login', [
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ])->assertOk();
    }

    /**
     * El limite es por correo. Fallar contra una cuenta no frena a
     * nadie mas: seria el denial of service mas facil del mundo.
     */
    #[Test]
    public function el_limite_es_por_correo_y_no_afecta_a_otros(): void
    {
        User::factory()->create(['email' => 'ana@prueba.test', 'password' => self::PASSWORD]);
        User::factory()->create(['email' => 'bruno@prueba.test', 'password' => self::PASSWORD]);

        for ($i = 0; $i < self::INTENTOS; $i++) {
            $this->postJson('/api/login', ['email' => 'ana@prueba.test', 'password' => 'incorrecta']);
        }

        $this->postJson('/api/login', ['email' => 'ana@prueba.test', 'password' => self::PASSWORD])
            ->assertStatus(429);

        $this->postJson('/api/login', ['email' => 'bruno@prueba.test', 'password' => self::PASSWORD])
            ->assertOk();
    }

    /**
     * El limite por IP es lo que de verdad detiene a quien va probando
     * correos distintos.
     *
     * Con solo el limite por correo, un atacante tendria cinco intentos
     * libres por cada direccion que se invente, y la plataforma entera
     * es adivinable.
     */
    #[Test]
    public function probar_muchos_correos_desde_una_ip_tambien_se_frena(): void
    {
        $correos = [
            'uno@prueba.test', 'dos@prueba.test', 'tres@prueba.test',
            'cuatro@prueba.test', 'cinco@prueba.test', 'seis@prueba.test',
            'siete@prueba.test', 'ocho@prueba.test', 'nueve@prueba.test',
            'diez@prueba.test', 'once@prueba.test', 'doce@prueba.test',
            'trece@prueba.test', 'catorce@prueba.test', 'quince@prueba.test',
            'dieciseis@prueba.test', 'diecisiete@prueba.test', 'dieciocho@prueba.test',
            'diecinueve@prueba.test', 'veinte@prueba.test', 'veintiuno@prueba.test',
            'veintidos@prueba.test', 'veintitres@prueba.test', 'veinticuatro@prueba.test',
            'veinticinco@prueba.test', 'veintiseis@prueba.test', 'veintisiete@prueba.test',
            'veintiocho@prueba.test', 'veintinueve@prueba.test', 'treinta@prueba.test',
            'treinta-y-uno@prueba.test',
        ];

        $ultimo = null;

        // 31 correos distintos con contrasena mala: el limite por
        // correo nunca se completa, pero el de IP si.
        foreach ($correos as $correo) {
            $ultimo = $this->postJson('/api/login', [
                'email' => $correo,
                'password' => 'incorrecta',
            ]);

            if ($ultimo->status() === 429) {
                break;
            }
        }

        $this->assertSame(429, $ultimo->status(), 'El limite por IP tiene que frenar antes');
    }

    /**
     * Los tokens que nacen al registrarse no cuentan como intentos: se
     * crea la cuenta y ya venia un token, no hubo adivinacion.
     */
    #[Test]
    public function registrarse_no_gasta_intentos(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Ana Prueba',
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ])->assertOk();

        $this->postJson('/api/login', [
            'email' => 'ana@prueba.test',
            'password' => self::PASSWORD,
        ])->assertOk();
    }

    /**
     * El token se guarda hasheado, no en claro.
     *
     * Si alguien lee la base de datos, con el token en claro podria
     * hacerse pasar por cualquier persona. Sanctum 4 lo hashea siempre.
     */
    #[Test]
    public function el_token_se_guarda_hasheado(): void
    {
        $usuario = User::factory()->create();

        $token = $usuario->createToken('app')->plainTextToken;

        $guardado = DB::table('personal_access_tokens')->value('token');

        $this->assertNotSame($token, $guardado);
        $this->assertStringNotContainsString($token, (string) $guardado);
    }
}
