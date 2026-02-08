export interface CandidateScores {
  cost: number;       // 0–1, lower price relative to budget = higher
  delivery: number;   // 0–1, meets deadline = 1, late = penalized
  preference: number; // 0–1, match to stated preferences
  coherence: number;  // 0–1, compatibility with other selected items
  total: number;      // weighted composite
}

export interface ProductCandidate {
  id: string;
  title: string;
  price: number;
  currency: string;
  deliveryEstimate: string | null;
  deliveryDays: number | null;
  variants: string[];
  retailerName: string;
  retailerDomain: string;
  productUrl: string;
  imageUrl: string | null;
  inStock: boolean;
  scores: CandidateScores;
  explanation: string;
}

export interface SpecItem {
  id: string;
  specId: string;
  name: string;
  constraints: {
    category?: string;
    brand?: string[];
    color?: string[];
    size?: string;
    style?: string;
    mustHaves?: string[];
    niceToHaves?: string[];
    keywords?: string[];
  };
  budgetAllocation: number;
  locked: boolean;
}

export interface ShoppingSpec {
  id: string;
  sessionId: string;
  budget: number;
  deliveryDeadline: string | null;
  preferences: {
    style?: string;
    occasion?: string;
    gender?: string;
    ageGroup?: string;
  };
  mustHaves: string[];
  niceToHaves: string[];
  items: SpecItem[];
  status: "draft" | "finalized";
  createdAt: string;
}

export interface CartItemEntry {
  id: string;
  cartId: string;
  itemId: string;
  candidateId: string;
  candidate: ProductCandidate;
  locked: boolean;
  addedAt: string;
}

export interface CartState {
  id: string;
  sessionId: string;
  status: "active" | "checked_out";
  items: CartItemEntry[];
  totalCost: number;
  budgetRemaining: number;
  latestDelivery: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RetailerCheckoutPlan {
  retailerName: string;
  retailerDomain: string;
  items: {
    title: string;
    price: number;
    variant: string;
  }[];
  subtotal: number;
  estimatedDelivery: string;
  orderId: string;
  autofillPreview: {
    field: string;
    value: string;
  }[];
}

export interface CheckoutPlan {
  id: string;
  cartId: string;
  paymentInfo: {
    cardLastFour: string;
    cardType: string;
    billingName: string;
  };
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  retailerPlans: RetailerCheckoutPlan[];
  grandTotal: number;
  deliveryTimeline: string;
  createdAt: string;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface Session {
  id: string;
  title: string;
  createdAt: string;
}

export type AppPhase = "discovery" | "cart" | "checkout";

export interface ItemRunResult {
  itemId: string;
  itemName: string;
  candidates: ProductCandidate[];
  query: string;
}

// Discovery progress tracking
export type DiscoveryStepName = "search" | "extract" | "rank";
export type DiscoveryStepStatus =
  | "pending"
  | "in_progress"
  | "complete"
  | "error";

export interface ItemProgress {
  itemId: string;
  itemName: string;
  steps: Record<DiscoveryStepName, DiscoveryStepStatus>;
}

export type DiscoveryEvent =
  | {
      type: "item-step";
      itemId: string;
      itemName: string;
      step: DiscoveryStepName;
      status: DiscoveryStepStatus;
    }
  | {
      type: "item-complete";
      itemId: string;
      itemName: string;
      candidates: ProductCandidate[];
      query: string;
    }
  | { type: "done" }
  | { type: "error"; message: string };
