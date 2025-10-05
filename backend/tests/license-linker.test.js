const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeEmail,
  extractCustomerId,
  syncCustomerEmailField,
  linkPendingLicensesToCustomer,
} = require("../src/utils/license-linker");

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Foo@Example.Com  "), "foo@example.com");
  assert.equal(normalizeEmail(null), null);
});

test("extractCustomerId supports multiple shapes", () => {
  assert.equal(extractCustomerId(42), 42);
  assert.equal(extractCustomerId("7"), 7);
  assert.equal(
    extractCustomerId({ connect: [{ id: 9 }] }),
    9,
  );
  assert.equal(extractCustomerId({ set: 13 }), 13);
  assert.equal(extractCustomerId({}), null);
});

test("syncCustomerEmailField populates email from relation", async () => {
  const data = { customer: 5 };
  const findCalls = [];
  const strapiMock = {
    entityService: {
      findOne: async (uid, id, options) => {
        findCalls.push({ uid, id, options });
        return { email: "test+ALIAS@Example.com" };
      },
    },
    log: {
      warn: () => { },
      error: () => { },
    },
  };

  await syncCustomerEmailField(strapiMock, data);

  assert.deepEqual(findCalls, [
    {
      uid: "api::customer.customer",
      id: 5,
      options: { fields: ["email"] },
    },
  ]);
  assert.equal(data.customerEmail, "test+alias@example.com");
});

test("syncCustomerEmailField overrides mismatched email", async () => {
  let warned = false;
  const data = { customer: 3, customerEmail: "different@example.com" };
  const strapiMock = {
    entityService: {
      findOne: async () => ({ email: "correct@example.com" }),
    },
    log: {
      warn: () => {
        warned = true;
      },
      error: () => { },
    },
  };

  await syncCustomerEmailField(strapiMock, data);

  assert.equal(data.customerEmail, "correct@example.com");
  assert.equal(warned, true);
});

test("linkPendingLicensesToCustomer attaches all pending licenses", async () => {
  const updates = [];
  const strapiMock = {
    entityService: {
      findMany: async (uid, options) => {
        assert.equal(uid, "api::license-key.license-key");
        assert.deepEqual(options.filters.$and[0], {
          customerEmail: { $eqi: "pending@example.com" },
        });
        assert.deepEqual(options.filters.$and[1], {
          customer: { id: { $null: true } },
        });
        return [{ id: 11 }, { id: 12 }];
      },
      update: async (uid, id, payload) => {
        assert.equal(uid, "api::license-key.license-key");
        updates.push({ id, payload });
      },
    },
    log: {
      info: () => { },
      warn: () => { },
      error: () => { },
    },
  };

  const linked = await linkPendingLicensesToCustomer(
    strapiMock,
    77,
    "Pending@Example.com",
  );

  assert.equal(linked, 2);
  assert.deepEqual(updates, [
    {
      id: 11,
      payload: {
        data: { customer: 77, customerEmail: "pending@example.com" },
      },
    },
    {
      id: 12,
      payload: {
        data: { customer: 77, customerEmail: "pending@example.com" },
      },
    },
  ]);
});

test("linkPendingLicensesToCustomer skips when email missing", async () => {
  const strapiMock = {
    entityService: {
      findMany: async () => {
        throw new Error("should not be called");
      },
      update: async () => {
        throw new Error("should not be called");
      },
    },
  };

  const linked = await linkPendingLicensesToCustomer(strapiMock, 1, null);
  assert.equal(linked, 0);
});
