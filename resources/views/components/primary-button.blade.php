<button {{ $attributes->merge(['type' => 'submit', 'class' => 'roomie-button']) }}>
    {{ $slot }}
</button>
