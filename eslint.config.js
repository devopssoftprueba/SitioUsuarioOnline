import jsdoc from 'eslint-plugin-jsdoc';

const commonSettings = {
    mode: "permissive",
    ignorePrivate: true,
    ignoreInternal: true,
    ignoreParsingErrors: true
};

export default [
    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "module",
            ecmaVersion: 2022
        },
        plugins: {
            jsdoc
        },
        rules: {
            "jsdoc/require-jsdoc": "error",
            "jsdoc/require-description": "error",
            // Valida que la descripción esté en inglés (sin palabras comunes en español)
            "jsdoc/match-description": ["error", {
                matchDescription: "^(?!.*\\b(el|la|de|una|un|este|esta|es|y|los|las|para|con|sin|por|en)\\b).*$"
            }]
        },
        settings: {
            jsdoc: commonSettings
        }
    }
];
