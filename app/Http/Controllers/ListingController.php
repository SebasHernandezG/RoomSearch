<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreListingRequest;
use App\Models\Listing;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Throwable;

class ListingController extends Controller
{
    public function mine(Request $request): View
    {
        $listings = $request->user()->listings()->withCount('interests')->latest()->paginate(12);

        return view('listings.mine', compact('listings'));
    }

    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): View
    {
        $request->validate([
            'city' => ['nullable', 'string', 'max:100'],
            'type' => ['nullable', 'in:offer,search'],
        ]);
        $listings = Listing::query()->with('user')->where('is_active', true)
            ->when($request->filled('city'), fn ($query) => $query->where(fn ($query) => $query
                ->where('city', 'like', '%'.$request->string('city')->trim().'%')
                ->orWhere('zone', 'like', '%'.$request->string('city')->trim().'%')))
            ->when($request->filled('type'), fn ($query) => $query->where('type', $request->string('type')))
            ->latest()->paginate(12)->withQueryString();

        return view('listings.index', compact('listings'));
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(): View
    {
        return view('listings.create');
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreListingRequest $request): RedirectResponse
    {
        $listing = new Listing;
        $listing->user()->associate($request->user());
        $this->saveListing($request, $listing);

        return redirect()->route('listings.show', $listing)->with('status', 'Publicación creada.');
    }

    /**
     * Display the specified resource.
     */
    public function show(Request $request, Listing $listing): View
    {
        abort_unless($listing->is_active || $request->user()?->id === $listing->user_id, 404);
        $listing->load('user.profile');
        $interest = $request->user()?->interests()->whereBelongsTo($listing)->first();

        return view('listings.show', compact('listing', 'interest'));
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(Listing $listing): View
    {
        Gate::authorize('update', $listing);

        return view('listings.edit', compact('listing'));
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(StoreListingRequest $request, Listing $listing): RedirectResponse
    {
        Gate::authorize('update', $listing);
        $this->saveListing($request, $listing);

        return redirect()->route('listings.show', $listing)->with('status', 'Publicación actualizada.');
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(Listing $listing): RedirectResponse
    {
        Gate::authorize('delete', $listing);
        $listing->delete();
        Storage::disk('public')->delete($listing->photos ?? []);

        return redirect()->route('listings.index')->with('status', 'Publicación eliminada.');
    }

    private function saveListing(StoreListingRequest $request, Listing $listing): void
    {
        $oldPhotos = $listing->photos ?? [];
        $newPhotos = [];
        $replacePhotos = $request->hasFile('photos') || $request->boolean('remove_photos');

        try {
            foreach ($request->file('photos', []) as $photo) {
                $path = $photo->store('listings', 'public');
                if ($path === false) {
                    throw ValidationException::withMessages(['photos' => 'No se pudieron guardar las fotos. Inténtalo de nuevo.']);
                }
                $newPhotos[] = $path;
            }

            $listing->fill($request->safe()->except(['photos', 'remove_photos']));
            if ($replacePhotos) {
                $listing->photos = $newPhotos;
            }
            $listing->save();
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($newPhotos);
            throw $exception;
        }

        if ($replacePhotos) {
            Storage::disk('public')->delete($oldPhotos);
        }
    }
}
