@props(['active'])

@php
$classes = ($active ?? false)
            ? 'block w-full border-l-2 border-[#8b6a16] bg-[#edf0ea] px-3 py-2 text-start text-base font-semibold text-[#18211f] focus:outline-none transition duration-150 ease-in-out'
            : 'block w-full border-l-2 border-transparent px-3 py-2 text-start text-base font-semibold text-[#5a625f] hover:bg-[#edf0ea] hover:text-[#18211f] focus:outline-none transition duration-150 ease-in-out';
@endphp

<a {{ $attributes->merge(['class' => $classes]) }}>
    {{ $slot }}
</a>
