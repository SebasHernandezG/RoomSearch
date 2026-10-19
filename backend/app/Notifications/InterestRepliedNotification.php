<?php

declare(strict_types=1);

namespace App\Notifications;

use App\Notifications\Concerns\Unsubscribeable;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Modules\Identity\Models\User;
use Modules\Properties\Models\Interest;

/**
 * Correo al inquilino cuando el arrendador responde o descarta su solicitud. RF-5.4.
 *
 * Va en la cola: responder una solicitud no debe esperar al SMTP.
 * Si el correo falla, la respuesta ya esta guardada y se reenvia
 * desde la cola.
 */
class InterestRepliedNotification extends Notification implements ShouldQueue
{
    use Queueable, Unsubscribeable;

    public int $tries = 3;

    public array $backoff = [60, 120, 300];

    /**
     * @param  Interest  $interes  La solicitud que recibio respuesta
     */
    public function __construct(
        public Interest $interes,
    ) {}

    /**
     * Solo correo, y solo si el interesado no dio de baja este tipo.
     * Si no hay preferencia guardada aun, asume "sí" (default al registrarse).
     *
     * @return array<int, string>
     */
    public function via(mixed $notifiable): array
    {
        if (! $notifiable instanceof User) {
            return [];
        }

        $preferencia = $notifiable->notificationPreference;

        /*
         * Sin fila de preferencias aun: default es recibir todo.
         * La fila se crea al darse de baja por primera vez o
         * cuando se agregue la gestion de preferencias en pantalla.
         */
        if ($preferencia !== null && ! $preferencia->recibeRespuestaInteres()) {
            return [];
        }

        return ['mail'];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        $inmueble = $this->interes->inmueble;
        $urlBaja = $this->unsubscribeUrl($notifiable->getKey(), 'interest_reply');

        $estado = $this->interes->status->value;
        $accion = $estado === 'respondida' ? 'te respondio' : 'descarto tu solicitud';

        return (new MailMessage)
            ->subject('El arrendador '.$accion.' sobre tu consulta')
            ->line('Hola '.$notifiable->name.', el arrendador de tu anuncio '.$accion.'.')
            ->line('Inmueble: '.$inmueble->title)
            ->line('Respuesta: '.$this->interes->reply)
            ->action('Ver mis solicitudes', config('app.url').'/mis-solicitudes')
            ->line('Este correo fue enviado por Roomies.')
            ->line('Si no queres recibir estos avisos, <a href="'.$urlBaja.'">dale de baja a las respuestas de solicitudes</a>.')
            ->line('Tambien podes gestionar todas tus notificaciones desde la plataforma.');
    }
}
