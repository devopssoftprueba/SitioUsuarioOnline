module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint', 'tsdoc', 'import'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    rules: {
        'tsdoc/syntax': 'warn'
    },
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    env: {
        node: true,
        es6: true
    }
};