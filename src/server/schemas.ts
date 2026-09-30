import { t } from "elysia";

const coordinateSchema = t.Object({
    lat: t.Number({ minimum: -90, maximum: 90 }),
    lng: t.Number({ minimum: -180, maximum: 180 }),
});

export const routeSchema = t.Object({
    origin: coordinateSchema,
    destination: coordinateSchema,
});

export const credentialsSchema = t.Object({
    email: t.String({ format: "email", maxLength: 255 }),
    password: t.String({ minLength: 8, maxLength: 255 }),
});

export const listingSchema = t.Object({
    type: t.Union([t.Literal("offer"), t.Literal("search")]),
    title: t.String({ minLength: 3, maxLength: 255 }),
    description: t.String({ minLength: 10, maxLength: 5000 }),
    city: t.String({ minLength: 2, maxLength: 100 }),
    zone: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    budget: t.Number({ minimum: 0, maximum: 10000000 }),
    latitude: t.Optional(t.Nullable(t.Number({ minimum: -90, maximum: 90 }))),
    longitude: t.Optional(
        t.Nullable(t.Number({ minimum: -180, maximum: 180 })),
    ),
    isActive: t.Optional(t.Boolean()),
});

export const profileSchema = t.Object({
    city: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    zone: t.Optional(t.Nullable(t.String({ maxLength: 100 }))),
    budgetMin: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
    budgetMax: t.Optional(t.Nullable(t.Number({ minimum: 0 }))),
    bio: t.Optional(t.Nullable(t.String({ maxLength: 2000 }))),
    phone: t.Optional(t.Nullable(t.String({ maxLength: 30 }))),
});
