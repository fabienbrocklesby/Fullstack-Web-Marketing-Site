module.exports = (policyContext, config, { strapi }) => {
  // Check if user is authenticated
  if (!policyContext.state.user) {
    return false;
  }
  
  return true;
};
