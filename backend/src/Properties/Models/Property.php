<?php

declare(strict_types=1);

namespace Modules\Properties\Models;

use Database\Factories\PropertyFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;
use Modules\Identity\Models\User;
use Modules\Properties\Enums\Amenity;
use Modules\Properties\Enums\Currency;
use Modules\Properties\Enums\PropertyStatus;
use Modules\Properties\Enums\PropertyType;
use Modules\Properties\Queries\PropertyRadiusQuery;
use Modules\Properties\Support\PropertyLocation;

/**
 * Un inmueble publicado por un arrendador.
 *
 * @see PropertyRadiusQuery  busqueda por radio
 */
class Property extends Model
{
    /** @use HasFactory<PropertyFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'title',
        'description',
        'type',
        'monthly_rent',
        'currency',
        'deposit',
        'bedrooms',
        'bathrooms',
        'parking_spaces',
        'furnished',
        'pets_allowed',
        'includes_water',
        'includes_electricity',
        'includes_internet',
        'available_from',
        'rules',
        'status',
        'address_reference',
        'district',
        'neighborhood',
        'show_exact_location',
    ];

    /**
     * La columna POINT es binaria: serializarla tal cual devuelve un
     * string ilegible y la API lo devolveria crudo al cliente.
     *
     * Exponerla se hace con una API Resource explicita en RF-2.1,
     * que decide que campos ve cada rol (y aplica RF-2.5, que oculta
     * la ubicacion exacta si el arrendador no autoriza).
     *
     * @var list<string>
     */
    protected $hidden = [
        'location',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => PropertyType::class,
            'currency' => Currency::class,
            'status' => PropertyStatus::class,
            'furnished' => 'boolean',
            'pets_allowed' => 'boolean',
            'includes_water' => 'boolean',
            'includes_electricity' => 'boolean',
            'includes_internet' => 'boolean',
            'show_exact_location' => 'boolean',
            'available_from' => 'date',
            'monthly_rent' => 'integer',
            'deposit' => 'integer',
            'bedrooms' => 'integer',
            'bathrooms' => 'integer',
            'parking_spaces' => 'integer',
        ];
    }

    /**
     * Get the factory that creates the model's instances.
     */
    protected static function newFactory(): PropertyFactory
    {
        return PropertyFactory::new();
    }

    /**
     * Only the states that belong in the public listing.
     *
     * @param  Builder<Property>  $query
     */
    public function scopePubliclyVisible(Builder $query): void
    {
        $query->where('status', PropertyStatus::Activa->value);
    }

    /**
     * Asigna el pin.
     *
     * MySQL exige el orden (longitud, latitud) en POINT() para SRID
     * 4326, que es el mismo que usan Leaflet y GeoJSON. Invertirlo no
     * lanza error: coloca el punto en el hemisferio equivocado.
     */
    public function placePin(float $latitude, float $longitude): static
    {
        $this->attributes['location'] = DB::raw(
            sprintf('ST_SRID(POINT(%F, %F), 4326)', $longitude, $latitude)
        );

        return $this;
    }

    /**
     * El dueno de la publicacion. RF-2.1.
     *
     * Puede ser null en dos casos, y ninguno es el normal: una fila
     * anterior a esta columna, y una cuenta borrada (la FK es SET
     * NULL a proposito). Por eso es nullable y no una FK NOT NULL.
     */
    public function dueno(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Las solicitudes de "Me interesa" sobre este inmueble. RF-5.1.
     *
     * El inverso de `Interest::inmueble()`.
     *
     * `user_id` en la FK y no `dueno_id`: en `interests` la columna
     * es la del interesado, y las dos relaciones de `Property` --la
     * del dueno y esta-- no pueden mirar la misma columna.
     */
    public function intereses(): HasMany
    {
        return $this->hasMany(Interest::class, 'property_id');
    }

    /**
     * Las fotos de este inmueble. RF-2.3.
     *
     * El orden va en la relacion y no en cada consulta porque la
     * galeria se lee siempre igual -- principal primero y luego por
     * puesto-- y por escrito en cinco sitios distintos termine
     *iefsiendo el principal primero en cuatro y el puesto primero en
     * uno.
     */
    public function imagenes(): HasMany
    {
        return $this->hasMany(PropertyImage::class, 'property_id')
            ->orderByDesc('is_primary')
            ->orderBy('position');
    }

    /**
     * Las amenidades de este inmueble. RF-2.2.
     *
     * Many-to-many a traves de `property_amenities`.
     */
    public function amenities(): BelongsToMany
    {
        return $this->belongsToMany(Amenity::class, 'property_amenities');
    }

    /**
     * Latitud del pin, leida de la columna POINT.
     */
    public function latitude(): ?float
    {
        $value = $this->newQuery()
            ->whereKey($this->getKey())
            ->selectRaw('ST_Latitude(location) AS latitude')
            ->value('latitude');

        return $value === null ? null : (float) $value;
    }

    /**
     * Longitud del pin, leida de la columna POINT.
     */
    public function longitude(): ?float
    {
        $value = $this->newQuery()
            ->whereKey($this->getKey())
            ->selectRaw('ST_Longitude(location) AS longitude')
            ->value('longitude');

        return $value === null ? null : (float) $value;
    }

    /**
     * El punto que se revela al publico. RF-2.5.
     *
     * Se prefieren los valores que ya trajo la consulta. PropertyRadiusQuery
     * los selecciona de paso, y sin esto un listado de 24 inmuebles
     * hacia 48 consultas extra solo para leer coordenadas.
     */
    public function ubicacionPublica(): PropertyLocation
    {
        return PropertyLocation::desdePunto(
            $this->getAttribute('latitud') ?? $this->latitude(),
            $this->getAttribute('longitud') ?? $this->longitude(),
            $this->show_exact_location,
        );
    }
}
