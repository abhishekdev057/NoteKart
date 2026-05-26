export type Product = {
  id: string;
  name: string;
  slug: string;
  category: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
  description: string;
  specs: Record<string, string>;
  images: string[];
  isCustomizable: boolean;
  isFeatured: boolean;
  createdAt?: string;
};

export type CustomRequest = {
  id: string;
  customerName: string;
  mobile: string;
  notes: string;
  quantity: number;
  imageUrl?: string | null;
  status: string;
  createdAt?: string;
};

export type DeliveryProvider = "review" | "delhivery" | "post_office" | "manual";

export type Order = {
  id: string;
  customerName: string;
  mobile: string;
  address: string;
  items: Array<{ productId: string; name: string; quantity: number; price: number }>;
  amount: number;
  paymentStatus: string;
  deliveryStatus: string;
  shiprocketAwb?: string | null;
  deliveryProvider?: DeliveryProvider | null;
  deliveryTrackingNumber?: string | null;
  deliveryNotes?: string | null;
  phonepePaymentId?: string | null;
  createdAt?: string;
};
