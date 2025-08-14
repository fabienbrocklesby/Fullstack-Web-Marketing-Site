module.exports = () => ({
  async track(event, payload) {
    strapi.log.info(
      `[JourneyTracker] ${event} ${JSON.stringify(payload || {})}`,
    );
  },
});
