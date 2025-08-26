import adapter from '@sveltejs/adapter-static';
const config = {
  kit: {
    adapter: adapter(),
    alias: {
      $ui: '../../packages/ui',
      $utils: '../../packages/utils'
    }
  }
};
export default config;
