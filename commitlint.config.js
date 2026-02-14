export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['lib', 'demo', 'e2e', 'docs', 'deps', 'release']],
  },
};
