const {
  syncCustomerEmailField,
} = require("../../../../utils/license-linker");

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;
    await syncCustomerEmailField(strapi, data);
  },
  async beforeUpdate(event) {
    const { data } = event.params;
    await syncCustomerEmailField(strapi, data);
  },
};
