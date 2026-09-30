<?php

namespace Tests\Feature;

use App\Models\Interest;
use App\Models\Listing;
use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\LazilyRefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class RoomSearchJourneyTest extends TestCase
{
    use LazilyRefreshDatabase;

    public function test_two_users_can_publish_contact_and_read_a_private_reply(): void
    {
        Storage::fake('public');
        $owner = User::factory()->create();
        $seeker = User::factory()->create();

        $this->actingAs($owner)->get(route('listings.create'))->assertSee('Publicar anuncio');
        $this->post(route('listings.store'), [
            ...$this->listingData(),
            'photos' => [UploadedFile::fake()->image('room.jpg')],
        ])->assertSessionHasNoErrors()->assertRedirect();

        $listing = $owner->listings()->sole();
        Storage::disk('public')->assertExists($listing->photos[0]);
        $this->get(route('listings.mine'))->assertSee('Cuarto con jardín');
        $this->actingAs($seeker)->get(route('listings.index'))->assertSee('Cuarto con jardín');
        $this->get(route('listings.show', $listing))->assertSee(Storage::disk('public')->url($listing->photos[0]));
        $this->post(route('listings.interests.store', $listing), [
            'message' => '¿Podemos coordinar una visita?',
            'user_id' => $owner->id,
            'reply' => 'Respuesta falsificada',
        ])->assertRedirect(route('interests.index'));

        $interest = Interest::query()->sole();
        $this->assertSame($seeker->id, $interest->user_id);
        $this->assertNull($interest->reply);
        $this->actingAs($owner)->get(route('interests.index'))->assertSee('¿Podemos coordinar una visita?');
        $this->put(route('interests.update', $interest), ['reply' => 'Sí, el sábado por la mañana.'])
            ->assertRedirect(route('interests.index'));
        $this->assertDatabaseHas('interests', ['id' => $interest->id, 'reply' => 'Sí, el sábado por la mañana.']);
        $this->actingAs($seeker)->get(route('interests.index'))->assertSee('Sí, el sábado por la mañana.');
    }

    public function test_strangers_cannot_read_or_reply_to_private_requests(): void
    {
        $interest = Interest::factory()->create(['message' => 'Mensaje privado único']);
        $stranger = User::factory()->create();

        $this->actingAs($stranger)->get(route('interests.index'))->assertDontSee('Mensaje privado único');
        $this->put(route('interests.update', $interest), ['reply' => 'Intrusión'])->assertForbidden();
        $this->assertNull($interest->fresh()->reply);
        $this->actingAs($interest->user)->put(route('interests.update', $interest), ['reply' => 'Otra intrusión'])->assertForbidden();
    }

    public function test_repeated_contact_preserves_the_original_request(): void
    {
        $interest = Interest::factory()->create(['message' => 'Mensaje original']);

        $this->actingAs($interest->user)->post(route('listings.interests.store', $interest->listing), ['message' => 'Duplicado'])
            ->assertRedirect(route('interests.index'));

        $this->assertDatabaseCount('interests', 1);
        $this->assertSame('Mensaje original', $interest->fresh()->message);
    }

    public function test_inactive_listings_are_hidden_and_cannot_receive_requests(): void
    {
        $listing = Listing::factory()->create(['is_active' => false]);

        $this->get(route('listings.show', $listing))->assertNotFound();
        $this->get(route('listings.index'))->assertDontSee($listing->title);
        $this->actingAs(User::factory()->create())->post(route('listings.interests.store', $listing), ['message' => 'Hola'])->assertNotFound();
        $this->assertDatabaseCount('interests', 0);
        $this->actingAs($listing->user)->get(route('listings.show', $listing))->assertSee($listing->title);
    }

    public function test_owner_cannot_contact_their_own_listing_and_messages_are_required(): void
    {
        $listing = Listing::factory()->create();

        $this->actingAs($listing->user)->post(route('listings.interests.store', $listing), ['message' => 'Hola'])->assertUnprocessable();
        $this->actingAs(User::factory()->create())->post(route('listings.interests.store', $listing), ['message' => ''])->assertSessionHasErrors('message');
        $this->assertDatabaseCount('interests', 0);
    }

    public function test_private_pages_require_login(): void
    {
        $interest = Interest::factory()->create();

        $this->get(route('listings.mine'))->assertRedirect(route('login'));
        $this->get(route('interests.index'))->assertRedirect(route('login'));
        $this->post(route('listings.interests.store', $interest->listing), ['message' => 'Hola'])->assertRedirect(route('login'));
        $this->put(route('interests.update', $interest), ['reply' => 'Hola'])->assertRedirect(route('login'));
        $this->assertNull($interest->fresh()->reply);
    }

    public function test_photos_can_be_replaced_removed_and_deleted_with_the_listing(): void
    {
        Storage::fake('public');
        $oldPhoto = UploadedFile::fake()->image('old.jpg')->store('listings', 'public');
        $listing = Listing::factory()->create(['photos' => [$oldPhoto]]);

        $this->actingAs($listing->user)->put(route('listings.update', $listing), [
            ...$this->listingData(), 'photos' => [UploadedFile::fake()->image('new.jpg')],
        ])->assertSessionHasNoErrors()->assertRedirect();

        Storage::disk('public')->assertMissing($oldPhoto);
        $newPhoto = $listing->fresh()->photos[0];
        Storage::disk('public')->assertExists($newPhoto);
        $this->put(route('listings.update', $listing), $this->listingData())->assertRedirect();
        $this->assertSame([$newPhoto], $listing->fresh()->photos);
        $this->put(route('listings.update', $listing), [...$this->listingData(), 'remove_photos' => '1'])->assertRedirect();
        Storage::disk('public')->assertMissing($newPhoto);
        $this->assertSame([], $listing->fresh()->photos);
        $this->delete(route('listings.destroy', $listing))->assertRedirect(route('listings.index'));
        $this->assertModelMissing($listing);
    }

    public function test_invalid_photos_are_rejected_without_creating_a_listing(): void
    {
        Storage::fake('public');

        $this->actingAs(User::factory()->create())->post(route('listings.store'), [
            ...$this->listingData(), 'photos' => [UploadedFile::fake()->create('script.php', 1, 'text/plain')],
        ])->assertSessionHasErrors('photos.0');

        $this->assertDatabaseCount('listings', 0);
        Storage::disk('public')->assertDirectoryEmpty('listings');
    }

    public function test_only_owners_can_manage_their_listings(): void
    {
        Storage::fake('public');
        $listing = Listing::factory()->create();

        $this->actingAs(User::factory()->create())->get(route('listings.mine'))->assertDontSee($listing->title);
        $this->get(route('listings.edit', $listing))->assertForbidden();
        $this->put(route('listings.update', $listing), [...$this->listingData(), 'photos' => [UploadedFile::fake()->image('room.jpg')]])->assertForbidden();
        $this->delete(route('listings.destroy', $listing))->assertForbidden();
        $this->assertModelExists($listing);
        Storage::disk('public')->assertDirectoryEmpty('listings');
    }

    public function test_replies_are_validated_and_user_content_is_escaped(): void
    {
        $interest = Interest::factory()->create(['message' => '<script>alert(1)</script>']);

        $this->actingAs($interest->listing->user)->put(route('interests.update', $interest), ['reply' => ''])->assertSessionHasErrors('reply');
        $this->assertNull($interest->fresh()->reply);
        $this->get(route('interests.index'))->assertSee('<script>alert(1)</script>')->assertDontSee('<script>alert(1)</script>', false);
    }

    public function test_search_matches_zones_and_respects_listing_type(): void
    {
        $matching = Listing::factory()->create(['zone' => 'Escalante', 'type' => 'offer']);
        $other = Listing::factory()->create(['zone' => 'Escalante', 'type' => 'search']);

        $this->get(route('listings.index', ['city' => 'Escalan', 'type' => 'offer']))
            ->assertSee($matching->title)->assertDontSee($other->title);
    }

    public function test_photo_count_and_size_limits_preserve_existing_photos(): void
    {
        Storage::fake('public');
        $photo = UploadedFile::fake()->image('original.jpg')->store('listings', 'public');
        $listing = Listing::factory()->create(['photos' => [$photo]]);

        $this->actingAs($listing->user)->put(route('listings.update', $listing), [
            ...$this->listingData(), 'photos' => [UploadedFile::fake()->image('large.jpg')->size(1025)],
        ])->assertSessionHasErrors('photos.0');
        $this->put(route('listings.update', $listing), [
            ...$this->listingData(), 'photos' => array_map(fn (int $index) => UploadedFile::fake()->image('room'.$index.'.jpg'), range(1, 7)),
        ])->assertSessionHasErrors('photos');

        $this->assertSame([$photo], $listing->fresh()->photos);
        Storage::disk('public')->assertExists($photo);
    }

    public function test_owner_can_pause_and_republish_a_listing(): void
    {
        $listing = Listing::factory()->create();

        $this->actingAs($listing->user)->put(route('listings.update', $listing), [...$this->listingData(), 'is_active' => '0'])->assertRedirect();
        $this->assertFalse($listing->fresh()->is_active);
        $this->put(route('listings.update', $listing), [...$this->listingData(), 'is_active' => '1'])->assertRedirect();
        $this->assertTrue($listing->fresh()->is_active);
    }

    public function test_deleting_a_listing_removes_its_photos_and_requests(): void
    {
        Storage::fake('public');
        $photo = UploadedFile::fake()->image('room.jpg')->store('listings', 'public');
        $listing = Listing::factory()->create(['photos' => [$photo]]);
        $interest = Interest::factory()->for($listing)->create();

        $this->actingAs($listing->user)->delete(route('listings.destroy', $listing))->assertRedirect(route('listings.index'));

        $this->assertModelMissing($listing);
        $this->assertModelMissing($interest);
        Storage::disk('public')->assertMissing($photo);
    }

    public function test_registration_sends_a_verification_notification(): void
    {
        Notification::fake();

        $this->post(route('register'), [
            'name' => 'Ana', 'email' => 'ana@example.com',
            'password' => 'password', 'password_confirmation' => 'password',
        ])->assertRedirect(route('dashboard', absolute: false));

        $user = User::query()->sole();
        Notification::assertSentTo($user, VerifyEmail::class);
        $this->assertFalse($user->hasVerifiedEmail());
        $this->assertAuthenticatedAs($user);
    }

    public function test_account_deletion_removes_uploaded_photos(): void
    {
        Storage::fake('public');
        $photo = UploadedFile::fake()->image('room.jpg')->store('listings', 'public');
        $listing = Listing::factory()->create(['photos' => [$photo]]);

        $this->actingAs($listing->user)->delete(route('profile.destroy'), ['password' => 'password'])->assertRedirect('/');

        $this->assertModelMissing($listing);
        Storage::disk('public')->assertMissing($photo);
    }

    /** @return array<string, string|int> */
    private function listingData(): array
    {
        return [
            'type' => 'offer', 'title' => 'Cuarto con jardín', 'description' => 'Incluye agua e internet.',
            'city' => 'San José', 'zone' => 'Escalante', 'budget' => 450, 'contact_method' => 'interest',
        ];
    }
}
