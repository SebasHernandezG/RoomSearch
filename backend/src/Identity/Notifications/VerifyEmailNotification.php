<?php

declare(strict_types=1);

namespace Modules\Identity\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail as BaseVerifyEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\URL;

/**
 * El correo de "verificá tu correo". RF-1.3.
 *
 * Va en la cola, no sincrono. Registrarse tiene que responder rapido:
 * si el envio falla, la cuenta ya esta creada y la persona puede pedir
 * que se lo reenvien. Al reves --crear la cuenta dentro del envio-- un
 * SMTP lento significa una pantalla de registro colgada.
 *
 * Extiende la notificacion de Laravel en vez de reescribirla: el
 * esquema del enlace (`id` + `sha1(correo)`) y la firma temporal son lo
 * que hacen que el enlace no se pueda adivinar ni reutilizar, y esa
 * parte ya esta probada por el framework.
 */
class VerifyEmailNotification extends BaseVerifyEmail implements ShouldQueue
{
    use Queueable;

    /**
     * Cuanto vive el enlace.
     *
     * Sale de `config/auth.php`, igual que el de Laravel.
     */
    private function minutos(): int
    {
        return (int) config('auth.verification.expire', 60);
    }

    /**
     * El enlace va a la API, no a la SPA.
     *
     * La razon es que todavia no hay pantalla de verificacion en el
     * frontend, y un enlace a una ruta que no existe deja a la persona
     * con un 404 en el momento en que esta mas frustrada.
     *
     * Cuando exista esa pantalla se cambia SOLO este metodo, para que
     * apunte a `/verificar-correo?id=..&hash=..` y la SPA haga el POST
     * a `POST /api/email/verify`. Nada mas cambia: el esquema del
     * enlace y el endpoint siguen siendo los mismos.
     */
    protected function verificationUrl(mixed $notifiable): string
    {
        return URL::temporarySignedRoute(
            'api.email.verify',
            now()->addMinutes($this->minutos()),
            [
                'id' => $notifiable->getKey(),
                'hash' => sha1($notifiable->getEmailForVerification()),
            ],
        );
    }

    /**
     * @return array<int, string>
     */
    public function via(mixed $notifiable): array
    {
        return ['mail'];
    }

    /**
     * El texto va en espanol y con el tono del proyecto.
     *
     * El microfono del framework esta en ingles, asi que el mensaje le
     * llegaria a la persona con un texto que no suena a esta
     * plataforma.
     *
     * El parametro va SIN tipo a proposito: el padre lo declara sin
     * tipo, y en PHP un hijo no puede estrecharlo. Poner `string`
     * arriba es un error fatal de firma, no una warning.
     */
    protected function buildMailMessage($url): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirmá tu correo en Roomies')
            ->line('Bienvenido a Roomies. Confirmá este correo para poder publicar tu inmueble.')
            ->action('Confirmar mi correo', $url)
            ->line('El enlace vence en '.($this->minutos() > 1
                ? $this->minutos().' minutos'
                : '1 minuto').'.')
            ->line('Si no te registraste en Roomies, podés ignorar este mensaje.');
    }
}
