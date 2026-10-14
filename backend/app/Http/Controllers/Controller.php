<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

abstract class Controller
{
    /*
     * Da $this->authorize(), que es como se aplican las Policies.
     *
     * Va en el controlador base y no en cada controlador porque
     * forgetting en uno significa que todas las autorizaciones de ese
     * controlador pasan en silencio. Un authorize() que no existe no
     * da error: simplemente no protege nada.
     */
    use AuthorizesRequests;
}
