module.exports = {
  root: true,
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  env: {
    node: true,
    es2022: true
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': 'warn'
  }
};
