export type User = { id: number; name: string; email: string };
export type Listing = {
    id: number;
    ownerId: number;
    ownerName: string;
    type: "offer" | "search";
    title: string;
    description: string;
    city: string;
    zone: string | null;
    budget: number;
    latitude: number | null;
    longitude: number | null;
    isActive: boolean;
    photos: string[];
    createdAt: string;
};

export class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
    ) {
        super(message);
    }
}

const googleAuthErrors: Record<string, string> = {
    cancelled: "El inicio de sesión con Google fue cancelado.",
    existing_account: "Ese correo ya tiene una cuenta. Ingresa con tu contraseña.",
    failed: "Google rechazó el inicio de sesión. Revisa el secreto y la URI autorizada.",
    invalid_state: "La sesión de Google venció. Intenta iniciar sesión nuevamente.",
    not_configured: "El acceso con Google todavía no está configurado.",
    unavailable: "Google no está disponible en este momento. Intenta nuevamente.",
    unverified: "Google no confirmó que ese correo esté verificado.",
};

export function googleAuthErrorMessage(code: string | null): string {
    if (!code) {
        return "";
    }

    return googleAuthErrors[code] ?? "No fue posible iniciar sesión con Google.";
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`/api${path}`, {
        credentials: "include",
        ...options,
        headers: options?.body
            ? { "Content-Type": "application/json", ...options.headers }
            : options?.headers,
    });
    const data = await response.json();
    if (!response.ok)
        throw new ApiError(
            data.message ?? "No fue posible completar la solicitud.",
            response.status,
        );
    return data as T;
}
