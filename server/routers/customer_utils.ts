import { getCustomerByNumber, createCustomer, updateCustomer } from "../db";

export async function ensureCustomerRecord(input: {
  clientNumber: string;
  clientName: string;
  phone?: string;
  taxId?: string;
  zone: string;
  sourceChannel?: "facebook" | "tiktok" | "marketplace" | "referral" | "other";
  customerType?: "retail" | "wholesale";
}) {
  let customer = await getCustomerByNumber(input.clientNumber);

  if (!customer) {
    await createCustomer({
      clientNumber: input.clientNumber,
      name: input.clientName,
      phone: input.phone || input.clientNumber,
      taxId: input.taxId || undefined,
      zone: input.zone,
      sourceChannel: input.sourceChannel || "other",
      customerType: input.customerType || "retail",
    });
    customer = await getCustomerByNumber(input.clientNumber);
  } else {
    const updates: Record<string, string> = {};

    if (input.clientName.trim() && input.clientName !== customer.name) {
      updates.name = input.clientName;
    }

    if (input.zone.trim() && input.zone !== customer.zone) {
      updates.zone = input.zone;
    }
    
    if (input.phone && input.phone !== customer.phone) {
      updates.phone = input.phone;
    }

    if (input.taxId && input.taxId !== customer.taxId) {
      updates.taxId = input.taxId;
    }

    if (input.sourceChannel && (!customer.sourceChannel || customer.sourceChannel === "other")) {
      (updates as any).sourceChannel = input.sourceChannel;
    }
    
    if (input.customerType && input.customerType !== customer.customerType) {
      (updates as any).customerType = input.customerType;
    }

    if (Object.keys(updates).length > 0) {
      await updateCustomer(customer.id, updates);
      customer = await getCustomerByNumber(input.clientNumber);
    }
  }

  return customer;
}
