<?php

use App\Http\Controllers\InterestController;
use App\Http\Controllers\ListingController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::get('/', fn () => redirect()->route('listings.index'));
Route::middleware('auth')->group(function () {
    Route::get('my-listings', [ListingController::class, 'mine'])->name('listings.mine');
    Route::get('my-interests', [InterestController::class, 'index'])->name('interests.index');
    Route::put('interests/{interest}', [InterestController::class, 'update'])->middleware('throttle:30,1')->name('interests.update');
    Route::resource('listings', ListingController::class)->except(['index', 'show']);
    Route::post('listings/{listing}/interests', [InterestController::class, 'store'])->middleware('throttle:10,1')->name('listings.interests.store');
    Route::get('my-roommate-profile', [ProfileController::class, 'roommateEdit'])->name('roommate-profile.edit');
    Route::put('my-roommate-profile', [ProfileController::class, 'roommateUpdate'])->name('roommate-profile.update');
});

Route::resource('listings', ListingController::class)->only(['index', 'show']);

Route::get('/dashboard', function () {
    return redirect()->route('listings.mine');
})->middleware('auth')->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
