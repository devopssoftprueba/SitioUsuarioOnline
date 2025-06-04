module.exports = {
    "parser": "@typescript-eslint/parser",
    "plugins": [
        "@typescript-eslint",
        "eslint-plugin-tsdoc"
    ],
    "extends": [
        "plugin:@typescript-eslint/recommended"
    ],
    "rules": {
        "tsdoc/syntax": "warn"
    }
};