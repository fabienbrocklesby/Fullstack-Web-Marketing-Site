module.exports = (config, { strapi }) => {
  return async (ctx, next) => {
    console.log('=== AUTH DEBUG ===');
    console.log('Request URL:', ctx.request.url);
    console.log('Request Method:', ctx.request.method);
    console.log('Authorization Header:', ctx.request.headers.authorization);
    console.log('User State:', ctx.state.user);
    
    await next();
    
    console.log('Response Status:', ctx.response.status);
    console.log('Response Body:', ctx.response.body);
    console.log('=== END DEBUG ===');
  };
};
