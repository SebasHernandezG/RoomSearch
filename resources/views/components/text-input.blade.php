@props(['disabled' => false])

<input @disabled($disabled) {{ $attributes->merge(['class' => 'border-[#b8c0b9] focus:border-[#8b6a16] focus:ring-[#8b6a16] shadow-sm']) }}>
