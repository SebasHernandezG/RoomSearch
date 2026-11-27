import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

let configured = false;

export function hasValidGoogleMapsBrowserKey(
    key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
) {
    return /^AIza[\w-]{35}$/.test(key ?? "");
}

function configure() {
    if (configured) return;
    setOptions({
        key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
        v: "weekly",
        language: "es",
        region: "CR",
    });
    configured = true;
}

export function loadMapsLibrary() {
    configure();
    return importLibrary("maps");
}

export function loadMarkerLibrary() {
    configure();
    return importLibrary("marker");
}

export function loadRoutesLibrary() {
    configure();
    return importLibrary("routes");
}
