export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['lib', 'demo', 'docs', 'deps', 'release']],
  },
};
