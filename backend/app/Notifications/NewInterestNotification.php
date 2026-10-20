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
use Modules\Properties\Models\Property;

/**
 * Correo al arrendador cuando llega una solicitud nueva de "Me interesa". RF-5.4.
 *
 * Va en la cola: crear una solicitud no debe esperar al SMTP.
 * Si el correo falla, la solicitud ya esta guardada y se puede
 * reenviar desde la cola.
 */
class NewInterestNotification extends Notification implements ShouldQueue
{
    use Queueable, Unsubscribeable;

    /**
     * Cuantos reintentos antes de marcar como fallido.
     */
    public int $tries = 3;

    /**
     * Backoff entre reintentos: 60s, 120s, 300s.
     */
    public array $backoff = [60, 120, 300];

    /**
     * @param  Interest  $interes  La solicitud que llego
     * @param  Property  $inmueble  El inmueble al que se interesaron
     */
    public function __construct(
        public Interest $interes,
        public Property $inmueble,
    ) {}

    /**
     * Solo correo, y solo si el arrendador no dio de baja este tipo.
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
        if ($preferencia !== null && ! $preferencia->recibeInteresNuevo()) {
            return [];
        }

        return ['mail'];
    }

    /**
     * El enlace de baja se incluye en el correo, no en el enlace de accion.
     * El enlace de accion lleva a la bandeja del arrendador.
     */
    public function toMail(mixed $notifiable): MailMessage
    {
        $interesado = $this->interes->interesado;
        $urlBaja = $this->unsubscribeUrl($notifiable->getKey(), 'interest_new');

        return (new MailMessage)
            ->subject('Nueva solicitud de Me interesa en '.$this->inmueble->title)
            ->line('Hola '.$notifiable->name.', te escribieron sobre tu anuncio.')
            ->line('**'.$interesado->name.'** dice: '.$this->interes->message)
            ->line('Inmueble: '.$this->inmueble->title)
            ->action('Ver bandeja de solicitudes', config('app.url').'/mis-inmuebles')
            ->line('Este correo fue enviado por Roomies.')
            ->line('Si no queres recibir estos avisos, <a href="'.$urlBaja.'">dale de baja a las solicitudes nuevas</a>.')
            ->line('Tambien podes gestionar todas tus notificaciones desde la plataforma.');
    }
}
