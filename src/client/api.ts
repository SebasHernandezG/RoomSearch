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
