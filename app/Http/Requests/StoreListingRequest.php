<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StoreListingRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return $this->route('listing')
            ? $this->user()?->can('update', $this->route('listing')) ?? false
            : $this->user() !== null;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', 'in:offer,search'],
            'title' => ['required', 'string', 'max:120'],
            'description' => ['required', 'string', 'max:2000'],
            'city' => ['required', 'string', 'max:100'],
            'zone' => ['nullable', 'string', 'max:100'],
            'budget' => ['required', 'integer', 'min:1', 'max:10000000'],
            'contact_method' => ['required', 'in:interest'],
            'is_active' => ['sometimes', 'boolean'],
            'photos' => ['nullable', 'array', 'max:6'],
            'photos.*' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:1024'],
            'remove_photos' => ['sometimes', 'boolean'],
        ];
    }
}
