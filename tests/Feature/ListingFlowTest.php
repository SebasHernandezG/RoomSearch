<?php

namespace Tests\Feature;

use App\Models\Listing;
use App\Models\User;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Tests\TestCase;

class ListingFlowTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_guest_can_browse_active_listings(): void
    {
        $listing = Listing::factory()->create(['title' => 'Habitación cerca del centro']);

        $this->get(route('listings.index'))->assertSee($listing->title);
    }

    public function test_authenticated_user_can_create_a_listing(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('listings.store'), [
            'type' => 'offer', 'title' => 'Cuarto luminoso', 'description' => 'Incluye servicios.',
            'city' => 'San José', 'zone' => 'Escalante', 'budget' => 450, 'contact_method' => 'interest',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('listings', ['user_id' => $user->id, 'title' => 'Cuarto luminoso', 'budget' => 450]);
    }

    public function test_user_cannot_update_another_users_listing(): void
    {
        $listing = Listing::factory()->create();

        $this->actingAs(User::factory()->create())->put(route('listings.update', $listing), [
            'type' => 'offer', 'title' => 'Cambio', 'description' => 'Cambio', 'city' => 'San José', 'budget' => 500, 'contact_method' => 'interest',
        ])->assertForbidden();

        $this->assertSame($listing->title, $listing->fresh()->title);
    }

    public function test_listing_requires_a_city_and_budget(): void
    {
        $this->actingAs(User::factory()->create())->post(route('listings.store'), [])->assertSessionHasErrors(['city', 'budget']);
    }
}
