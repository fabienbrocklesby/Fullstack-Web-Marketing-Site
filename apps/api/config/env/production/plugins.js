module.exports = ({ env }) => ({
  upload: {
    config: {
      provider: "local",
      // sizeLimit belongs directly under config (providerOptions kept if you later add custom options)
      sizeLimit: 100000000, // 100MB
      providerOptions: {},
    },
  },
});
