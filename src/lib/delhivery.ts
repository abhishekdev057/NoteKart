import type { Order } from "./types";

export type DelhiveryServiceability = {
  pincode: string;
  serviceable: boolean;
  prepaid: boolean;
  cod: boolean;
  mock?: boolean;
  message: string;
};

type AddressParts = {
  address: string;
  city: string;
  state: string;
  pincode: string;
};

function getDelhiveryToken() {
  return process.env.DELHIVERY_API_TOKEN || "";
}

export function getDelhiveryBaseUrl() {
  return process.env.DELHIVERY_ENV === "production" ? "https://track.delhivery.com" : "https://staging-express.delhivery.com";
}

export function extractPincode(value: string) {
  return value.match(/\b\d{6}\b/g)?.at(-1) ?? "";
}

function normalizeFlag(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  return ["y", "yes", "true", "1"].includes(text);
}

function serviceabilityFromPayload(pincode: string, payload: Record<string, unknown>): DelhiveryServiceability {
  const deliveryCodes = Array.isArray(payload.delivery_codes) ? payload.delivery_codes : [];
  const match = deliveryCodes.find((entry) => {
    const postalCode = (entry as Record<string, unknown>)?.postal_code as Record<string, unknown> | undefined;
    return String(postalCode?.pin ?? postalCode?.pincode ?? "") === pincode;
  }) as Record<string, unknown> | undefined;

  const postalCode = match?.postal_code as Record<string, unknown> | undefined;
  const prepaid = normalizeFlag(postalCode?.pre_paid ?? postalCode?.prepaid ?? postalCode?.pickup);
  const cod = normalizeFlag(postalCode?.cod);
  const serviceable = Boolean(match && prepaid);

  return {
    pincode,
    serviceable,
    prepaid,
    cod,
    message: serviceable
      ? "Good news, Delhivery can deliver prepaid orders to this area."
      : "Your area is not serviceable by Delhivery right now. Please try another pincode.",
  };
}

export async function checkDelhiveryServiceability(pincode: string): Promise<DelhiveryServiceability> {
  const clean = pincode.replace(/\D/g, "").slice(0, 6);
  if (clean.length !== 6) {
    return {
      pincode: clean,
      serviceable: false,
      prepaid: false,
      cod: false,
      message: "Enter a valid 6 digit pincode.",
    };
  }

  const token = getDelhiveryToken();
  if (!token) {
    return {
      pincode: clean,
      serviceable: true,
      prepaid: true,
      cod: false,
      mock: true,
      message: "Delhivery token is not configured, so this area is allowed in demo mode.",
    };
  }

  const url = new URL("/c/api/pin-codes/json/", getDelhiveryBaseUrl());
  url.searchParams.set("filter_codes", clean);

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    return {
      pincode: clean,
      serviceable: false,
      prepaid: false,
      cod: false,
      message: typeof data?.message === "string" ? data.message : "Could not check delivery serviceability.",
    };
  }

  return serviceabilityFromPayload(clean, data);
}

export function parseOrderAddress(address: string): AddressParts {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const pincode = extractPincode(address);
  const state = parts.at(-2) ?? "Rajasthan";
  const city = parts.at(-3) ?? "Nawalgarh";
  const mainAddress = parts.slice(0, Math.max(1, parts.length - 3)).join(", ") || address;
  return { address: mainAddress, city, state, pincode };
}

function extractWaybill(payload: Record<string, unknown>) {
  const packages = Array.isArray(payload.packages) ? payload.packages : [];
  const firstPackage = packages[0] as Record<string, unknown> | undefined;
  return String(
    firstPackage?.waybill ??
      firstPackage?.wbn ??
      payload.waybill ??
      payload.wbn ??
      payload.upload_wbn ??
      "",
  );
}

export async function createDelhiveryShipment(order: Order) {
  const token = getDelhiveryToken();
  const { address, city, state, pincode } = parseOrderAddress(order.address);
  const serviceability = await checkDelhiveryServiceability(pincode);
  if (!serviceability.serviceable) {
    return { ok: false, serviceability, error: serviceability.message };
  }

  if (!token) {
    const mockWaybill = `DLV-${order.id.slice(0, 8).toUpperCase()}`;
    return {
      ok: true,
      mock: true,
      waybill: mockWaybill,
      message: "Demo Delhivery shipment assigned. Configure DELHIVERY_API_TOKEN for live AWB creation.",
    };
  }

  const shipment: Record<string, unknown> = {
    order: order.id,
    name: order.customerName,
    add: address,
    pin: pincode,
    city,
    state,
    country: "India",
    phone: order.mobile,
    payment_mode: "Pre-paid",
    products_desc: order.items.map((item) => `${item.quantity} x ${item.name}`).join(", ").slice(0, 250),
    quantity: Math.max(1, order.items.reduce((sum, item) => sum + item.quantity, 0)),
    total_amount: order.amount,
    cod_amount: 0,
    shipping_mode: process.env.DELHIVERY_SHIPPING_MODE || "Surface",
    weight: Number(process.env.DELHIVERY_DEFAULT_WEIGHT_GRAMS || 500),
  };

  if (process.env.DELHIVERY_SELLER_GST_TIN) shipment.seller_gst_tin = process.env.DELHIVERY_SELLER_GST_TIN;
  if (process.env.DELHIVERY_HSN_CODE) shipment.hsn_code = process.env.DELHIVERY_HSN_CODE;

  const payload = {
    shipments: [shipment],
    pickup_location: {
      name: process.env.DELHIVERY_PICKUP_LOCATION || "NoteKart",
    },
  };

  const body = new URLSearchParams();
  body.set("format", "json");
  body.set("data", JSON.stringify(payload));

  const response = await fetch(`${getDelhiveryBaseUrl()}/api/cmu/create.json`, {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const waybill = extractWaybill(data);

  if (!response.ok || !waybill) {
    return {
      ok: false,
      data,
      error: typeof data?.rmk === "string" ? data.rmk : "Delhivery did not return an AWB / waybill.",
    };
  }

  return { ok: true, waybill, data };
}

export async function trackDelhiveryShipment(waybill: string) {
  const clean = waybill.trim();
  const token = getDelhiveryToken();
  if (!clean) return { error: "Waybill is required." };

  if (!token) {
    return {
      mock: true,
      tracking: {
        waybill: clean,
        current_status: "Ready for dispatch",
        provider: "Delhivery",
        scans: ["Order packed at Doomra workshop", "Waiting for live Delhivery token / AWB sync"],
      },
    };
  }

  const url = new URL("/api/v1/packages/json/", getDelhiveryBaseUrl());
  url.searchParams.set("waybill", clean);
  url.searchParams.set("verbose", "2");

  const response = await fetch(url, {
    headers: {
      Authorization: `Token ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  const tracking = await response.json().catch(() => ({}));
  return { tracking, status: response.status, ok: response.ok };
}
