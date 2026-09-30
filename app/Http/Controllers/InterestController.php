<?php

namespace App\Http\Controllers;

use App\Http\Requests\ReplyInterestRequest;
use App\Http\Requests\StoreInterestRequest;
use App\Models\Interest;
use App\Models\Listing;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class InterestController extends Controller
{
    public function index(Request $request): View
    {
        $received = Interest::query()->with(['listing', 'user'])
            ->whereHas('listing', fn (Builder $query) => $query->whereBelongsTo($request->user()))
            ->latest()->paginate(10, ['*'], 'received_page')->withQueryString();
        $sent = $request->user()->interests()->with('listing.user')
            ->latest()->paginate(10, ['*'], 'sent_page')->withQueryString();

        return view('interests.index', compact('received', 'sent'));
    }

    public function update(ReplyInterestRequest $request, Interest $interest): RedirectResponse
    {
        $interest->update([...$request->validated(), 'replied_at' => now()]);

        return redirect()->route('interests.index')->with('status', 'Respuesta guardada. La persona puede leerla en Mis solicitudes.');
    }

    public function store(StoreInterestRequest $request, Listing $listing): RedirectResponse
    {
        abort_unless($listing->is_active, 404);
        abort_if($request->user()->is($listing->user), 422, 'No puedes mostrar interés en tu propia publicación.');

        $interest = $request->user()->interests()->whereBelongsTo($listing)->first();
        if (! $interest) {
            $interest = new Interest($request->validated());
            $interest->listing()->associate($listing);
            $interest->user()->associate($request->user());
            $interest->save();
        }

        return redirect()->route('interests.index')->with('status', 'Tu solicitud está guardada. Aquí podrás consultar la respuesta.');
    }
}
