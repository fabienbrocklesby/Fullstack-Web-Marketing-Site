const normalizeEmail = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : value;

const extractCustomerId = (customerField) => {
  if (!customerField) {
    return null;
  }

  if (typeof customerField === "number") {
    return customerField;
  }

  if (typeof customerField === "string") {
    const parsed = Number(customerField);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (Array.isArray(customerField?.connect) && customerField.connect.length) {
    const target = customerField.connect[0];
    if (typeof target === "object") {
      return target.id ?? null;
    }
    return target ?? null;
  }

  if (customerField.set) {
    return customerField.set;
  }

  return null;
};

const syncCustomerEmailField = async (strapi, data) => {
  if (!data) {
    return data;
  }

  if (Object.prototype.hasOwnProperty.call(data, "customerEmail")) {
    const normalized = normalizeEmail(data.customerEmail);
    data.customerEmail = normalized || null;
  }

  const customerId = extractCustomerId(data.customer);

  if (!customerId) {
    return data;
  }

  try {
    const customer = await strapi.entityService.findOne(
      "api::customer.customer",
      customerId,
      { fields: ["email"] },
    );

    if (customer?.email) {
      const normalizedCustomerEmail = normalizeEmail(customer.email);
      if (
        data.customerEmail &&
        data.customerEmail !== normalizedCustomerEmail &&
        strapi?.log?.warn
      ) {
        strapi.log.warn(
          `[license-key] customerEmail mismatch for customer ${customerId}, overriding with canonical email`,
        );
      }

      data.customerEmail = normalizedCustomerEmail;
    }
  } catch (error) {
    if (strapi?.log?.error) {
      strapi.log.error(
        `[license-key] Failed to sync customer email for customer ${customerId}: ${error.message}`,
      );
    }
  }

  return data;
};

const linkPendingLicensesToCustomer = async (strapi, customerId, email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!strapi || !customerId || !normalizedEmail) {
    return 0;
  }

  const pendingLicenses = await strapi.entityService.findMany(
    "api::license-key.license-key",
    {
      filters: {
        $and: [
          { customerEmail: { $eqi: normalizedEmail } },
          { customer: { id: { $null: true } } },
        ],
      },
      fields: ["id"],
    },
  );

  if (!pendingLicenses.length) {
    return 0;
  }

  await Promise.all(
    pendingLicenses.map(({ id }) =>
      strapi.entityService.update("api::license-key.license-key", id, {
        data: { customer: customerId, customerEmail: normalizedEmail },
      }),
    ),
  );

  if (strapi?.log?.info) {
    strapi.log.info(
      `[license-key] Linked ${pendingLicenses.length} pending license key(s) to customer ${customerId}`,
    );
  }

  return pendingLicenses.length;
};

module.exports = {
  normalizeEmail,
  extractCustomerId,
  syncCustomerEmailField,
  linkPendingLicensesToCustomer,
};
