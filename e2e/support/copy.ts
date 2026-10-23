const BRAND = "Wick & Co. Candles";

function titled(page: string): string {
  return `${page} | ${BRAND}`;
}

function itemLine(name: string, quantity: number): string {
  return `${name} \u00d7 ${String(quantity)}`;
}

export const COPY = {
  brand: BRAND,
  header: {
    nav: "Main",
    shop: "Shop",
    cart: (count: number) => `Cart (${String(count)})`,
  },
  title: {
    list: titled("Shop all candles"),
    product: (name: string) => titled(name),
    cart: titled("Your cart"),
    checkout: titled("Checkout"),
    order: (orderNumber: string) => titled(`Order ${orderNumber}`),
    notFound: titled("Page not found"),
  },
  metaDescription:
    "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
  free: "Free",
  stock: (stock: number) => {
    if (stock <= 0) {
      return "Out of stock";
    }
    if (stock <= 3) {
      return `Only ${String(stock)} left`;
    }
    return "In stock";
  },
  addToCart: "Add to cart",
  totals: {
    subtotal: "Subtotal",
    shipping: "Shipping",
    total: "Total",
  },
  list: {
    heading: "All candles",
    families: {
      legend: "Scent family",
      options: ["Floral", "Woody", "Fresh", "Gourmand", "Spicy", "Herbal"],
    },
    sort: {
      label: "Sort by",
      options: {
        "name-asc": "Name: A to Z",
        "price-asc": "Price: low to high",
        "price-desc": "Price: high to low",
      },
    },
    products: "Products",
    pagination: {
      label: "Pagination",
      previous: "Previous",
      next: "Next",
    },
    emptyPage: "This page is empty.",
    firstPage: "Go to page 1",
    noMatches: "No candles match these filters",
    clearFilters: "Clear filters",
  },
  product: {
    scentNotes: (notes: readonly string[]) =>
      `Scent notes: ${notes.join(", ")}`,
    burnTime: (hours: number) => `Burn time: ${String(hours)} hours`,
    size: (oz: number) => `Size: ${String(oz)} oz`,
    quantity: "Quantity",
  },
  cart: {
    added: (name: string) => `Added ${name} to your cart.`,
    cap: (cap: number, name: string) =>
      `You can buy at most ${String(cap)} of ${name}.`,
    heading: "Your cart",
    empty: "Your cart is empty",
    continueShopping: "Continue shopping",
    columns: ["Candle", "Price", "Quantity", "Total", "Actions"],
    quantityFor: (name: string) => `Quantity for ${name}`,
    remove: "Remove",
    removeItem: (name: string) => `Remove ${name}`,
    checkout: "Checkout",
  },
  checkout: {
    heading: "Checkout",
    legends: {
      contact: "Contact",
      shipping: "Shipping address",
      payment: "Payment",
    },
    labels: {
      email: "Email",
      fullName: "Full name",
      line1: "Address line 1",
      line2: "Address line 2 (optional)",
      city: "City",
      postalCode: "Postal code",
      country: "Country",
      cardNumber: "Card number",
      expiry: "Expiry (MM/YY)",
      cvc: "CVC",
    },
    countryPlaceholder: "Select a country",
    countries: {
      US: "United States",
      CA: "Canada",
      GB: "United Kingdom",
      DE: "Germany",
      NL: "Netherlands",
    },
    summary: "Order summary",
    summaryLine: itemLine,
    placeOrder: "Place order",
    placingOrder: "Placing order...",
    errors: {
      emailRequired: "Enter your email address",
      emailInvalid: "Enter a valid email address",
      fullNameRequired: "Enter your full name",
      line1Required: "Enter your address",
      cityRequired: "Enter your city",
      postalCodeRequired: "Enter your postal code",
      postalCodeInvalid: "Enter a valid postal code",
      countryRequired: "Select your country",
      cardNumberRequired: "Enter your card number",
      cardNumberInvalid: "Enter a valid card number",
      expiryRequired: "Enter the card expiry date",
      expiryFormat: "Enter the expiry as MM/YY",
      expiryPast: "Your card has expired",
      cvcRequired: "Enter the CVC",
      cvcInvalid: "Enter a valid 3 digit CVC",
      max100: "Use 100 characters or fewer",
      max200: "Use 200 characters or fewer",
    },
    declined: "Your card was declined.",
    outOfStock: (name: string) =>
      `${name} is no longer available in the quantity you chose. We updated your cart.`,
    priceChanged:
      "Prices changed for some items. Please review your order and place it again.",
    invalid: "Please check your details and try again.",
  },
  confirmation: {
    heading: "Thank you for your order",
    orderNumber: (orderNumber: string) => `Order number: ${orderNumber}`,
    items: "Items",
    line: itemLine,
    shippingTo: "Shipping to",
    cityLine: (city: string, postalCode: string) => `${city} ${postalCode}`,
    continueShopping: "Continue shopping",
  },
  notFound: {
    heading: "Page not found",
    text: "We couldn't find that page.",
    backToShop: "Back to shop",
  },
  error: {
    text: "Something went wrong. Please try again.",
    retry: "Try again",
  },
} as const;
