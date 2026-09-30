<?php

namespace App\Models;

use Database\Factories\ListingFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Listing extends Model
{
    /** @use HasFactory<ListingFactory> */
    use HasFactory;

    protected $fillable = ['type', 'title', 'description', 'city', 'zone', 'budget', 'contact_method', 'is_active', 'photos'];

    protected function casts(): array
    {
        return ['budget' => 'integer', 'is_active' => 'boolean', 'photos' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function interests(): HasMany
    {
        return $this->hasMany(Interest::class);
    }
}
