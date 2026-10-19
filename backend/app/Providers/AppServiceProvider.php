<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Modules\Properties\Models\Interest;
use Modules\Properties\Models\InterestPolicy;
use Modules\Properties\Models\Property;
use Modules\Properties\Models\PropertyPolicy;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->limitarLecturasPublicas();

        /*
         * La politica de inmueble vive en Modules\Properties\Models, no
         * en App\Policies. Laravel la buscaria en App\Policies por
         * convencion de nombre y no la encontraria: sin esto TODAS las
         * autorizaciones pasan, silenciosamente.
         */
        Gate::policy(Property::class, PropertyPolicy::class);

        /*
         * La de las solicitudes. Va registrada a mano y no por
         * convencion porque la clase esta junto al modelo y no en
         * `app/Policies`, y porque el metodo se llama `responder` y
         * no `update`: se nombra segun lo que hace, no segun el verbo
         * HTTP.
         */
        Gate::policy(Interest::class, InterestPolicy::class);
    }

    /**
     * Techo de peticiones para la API publica. RNF-05.
     *
     * El listado es la operacion mas cara del sistema: cada peticion
     * evalua ST_Distance_Sphere sobre una columna POINT que todavia no
     * tiene indice espacial. Sin limite, eso es exactamente lo que un
     * crawler repetiria en bucle.
     *
     * El numero esta calculado contra el frontend mas rapido que hay,
     * no contra lo que parece comodo para un humano. El mapa dispara
     * su busqueda con un debounce de 300 ms, asi que arrastrar sin
     * parar no genera ni una peticion; 120 por minuto son dos por
     * segundo sostenidas, de sobra para quien navega y va cambiando
     * filtros.
     *
     * El limite no busca impedir el scraping, sino encarecerlo y
     * hacerlo detectable. Con 120/min, sacar las diez mil propiedades
     * de una tabla grande lleva mas de hora y media y deja rastro.
     */
    private function limitarLecturasPublicas(): void
    {
        RateLimiter::for('api', function (Request $request): Limit {
            return Limit::perMinute(120)->by($this->claveDeCliente($request));
        });
    }

    /**
     * Identifica al cliente para el contador.
     *
     * Por IP, que es lo unico disponible sin sesion. El problema es
     * que detras de un proxy todas las peticiones llegan con la misma
     * IP, y entonces el techo seria global: 120 por minuto para todo
     * el mundo junto.
     *
     * Por eso hay que configurar TRUSTED_PROXIES. Sin eso, en
     * produccion el rate limiting no protege y ademas molesta.
     */
    private function claveDeCliente(Request $request): string
    {
        return $request->user()?->getAuthIdentifier()
            ? 'user:'.$request->user()->getAuthIdentifier()
            : 'ip:'.$request->ip();
    }
}
