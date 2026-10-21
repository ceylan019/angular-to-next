import type {
  Order,
  PlaceOrderInput,
  ProductDetail,
  ProductPage,
} from "@/lib/backend/schemas";

export const lavenderDusk: ProductDetail = {
  id: 7,
  slug: "lavender-dusk",
  name: "Lavender Dusk",
  family: "floral",
  priceCents: 1615,
  stock: 12,
  imageUrl: "/images/lavender-dusk.jpg",
  summary: "Soft lavender with a warm vanilla base.",
  description: "A calming candle poured in small batches.",
  scentNotes: ["lavender", "vanilla", "amber"],
  burnTimeHours: 45,
  sizeOz: 8,
};

export const productPage: ProductPage = {
  items: [
    {
      id: lavenderDusk.id,
      slug: lavenderDusk.slug,
      name: lavenderDusk.name,
      family: lavenderDusk.family,
      priceCents: lavenderDusk.priceCents,
      stock: lavenderDusk.stock,
      imageUrl: lavenderDusk.imageUrl,
    },
  ],
  page: 1,
  pageSize: 12,
  totalItems: 1,
  totalPages: 1,
};

export const sampleOrder: Order = {
  orderNumber: "WC-AB12CD",
  email: "ada@example.com",
  shipping: {
    fullName: "Ada Lovelace",
    line1: "1 Analytical Way",
    line2: null,
    city: "London",
    postalCode: "N1 9GU",
    country: "GB",
  },
  lines: [
    {
      productId: 7,
      name: "Lavender Dusk",
      quantity: 2,
      unitPriceCents: 1615,
      lineTotalCents: 3230,
    },
  ],
  subtotalCents: 3230,
  shippingCents: 595,
  totalCents: 3825,
  createdAt: "2026-10-21T09:30:00.000Z",
};

export const placeOrderInput: PlaceOrderInput = {
  contact: { email: "ada@example.com" },
  shipping: {
    fullName: "Ada Lovelace",
    line1: "1 Analytical Way",
    city: "London",
    postalCode: "N1 9GU",
    country: "GB",
  },
  payment: {
    cardNumber: "4242424242424242",
    expiry: "12/30",
    cvc: "123",
  },
  lines: [{ productId: 7, quantity: 2, unitPriceCents: 1615 }],
};
