import { v4 as uuidv4 } from "uuid";
import { query } from "@/lib/db";
import type {
  CartState,
  CheckoutPlan,
  RetailerCheckoutPlan,
} from "@/lib/types";

interface PaymentInfo {
  cardLastFour: string;
  cardType: string;
  billingName: string;
}

interface ShippingAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

function generateOrderId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 12; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export async function generateCheckoutPlan(
  cart: CartState,
  paymentInfo: PaymentInfo,
  shippingAddress: ShippingAddress
): Promise<CheckoutPlan> {
  // Group items by retailer
  const retailerGroups: Record<string, typeof cart.items> = {};
  for (const item of cart.items) {
    const key = item.candidate.retailerDomain;
    if (!retailerGroups[key]) {
      retailerGroups[key] = [];
    }
    retailerGroups[key].push(item);
  }

  const retailerPlans: RetailerCheckoutPlan[] = Object.entries(
    retailerGroups
  ).map(([domain, items]) => {
    const subtotal = items.reduce(
      (sum, item) => sum + item.candidate.price,
      0
    );

    // Find latest delivery from this retailer's items
    let estimatedDelivery = "3-5 business days";
    for (const item of items) {
      if (item.candidate.deliveryEstimate) {
        estimatedDelivery = item.candidate.deliveryEstimate;
      }
    }

    return {
      retailerName: items[0].candidate.retailerName,
      retailerDomain: domain,
      items: items.map((item) => ({
        title: item.candidate.title,
        price: item.candidate.price,
        variant: item.candidate.variants.join(", ") || "Standard",
      })),
      subtotal: Math.round(subtotal * 100) / 100,
      estimatedDelivery,
      orderId: generateOrderId(),
      autofillPreview: [
        { field: "Full Name", value: shippingAddress.name },
        { field: "Street Address", value: shippingAddress.street },
        {
          field: "City, State, ZIP",
          value: `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}`,
        },
        { field: "Country", value: shippingAddress.country },
        {
          field: "Payment",
          value: `${paymentInfo.cardType} ending in ${paymentInfo.cardLastFour}`,
        },
        { field: "Billing Name", value: paymentInfo.billingName },
      ],
    };
  });

  const grandTotal = retailerPlans.reduce(
    (sum, plan) => sum + plan.subtotal,
    0
  );

  // Determine delivery timeline
  const deliveryTimeline =
    retailerPlans.length === 1
      ? retailerPlans[0].estimatedDelivery
      : `${retailerPlans.length} separate orders, delivery varies by retailer`;

  const planId = uuidv4();
  const checkoutPlan: CheckoutPlan = {
    id: planId,
    cartId: cart.id,
    paymentInfo,
    shippingAddress,
    retailerPlans,
    grandTotal: Math.round(grandTotal * 100) / 100,
    deliveryTimeline,
    createdAt: new Date().toISOString(),
  };

  // Mark cart as checked out
  await query("UPDATE carts SET status = $1, updated_at = NOW() WHERE id = $2", [
    "checked_out",
    cart.id,
  ]);

  // Persist checkout plan
  await query(
    `INSERT INTO checkout_plans (id, cart_id, payment_info_json, shipping_address_json, retailer_plans_json, order_summary_json)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      planId,
      cart.id,
      JSON.stringify(paymentInfo),
      JSON.stringify(shippingAddress),
      JSON.stringify(retailerPlans),
      JSON.stringify({ grandTotal, deliveryTimeline }),
    ]
  );

  return checkoutPlan;
}

export async function getCheckoutSummary(
  sessionId: string
): Promise<CheckoutPlan | null> {
  const rows = await query(
    `SELECT cp.* FROM checkout_plans cp
     JOIN carts c ON c.id = cp.cart_id
     WHERE c.session_id = $1
     ORDER BY cp.created_at DESC LIMIT 1`,
    [sessionId]
  );

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    id: row.id as string,
    cartId: row.cart_id as string,
    paymentInfo: row.payment_info_json as CheckoutPlan["paymentInfo"],
    shippingAddress: row.shipping_address_json as CheckoutPlan["shippingAddress"],
    retailerPlans: row.retailer_plans_json as RetailerCheckoutPlan[],
    grandTotal: (row.order_summary_json as { grandTotal: number }).grandTotal,
    deliveryTimeline: (row.order_summary_json as { deliveryTimeline: string }).deliveryTimeline,
    createdAt: (row.created_at as Date).toISOString(),
  };
}
