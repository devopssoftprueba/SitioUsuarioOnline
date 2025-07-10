import jsdoc from 'eslint-plugin-jsdoc';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import vue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';

const commonSettings = {
    mode: "permissive",
    ignorePrivate: true,
    ignoreInternal: true,
    ignoreParsingErrors: true
};

export default [
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                ecmaVersion: 2022,
                sourceType: "module",
                parser: typescriptParser,
                extraFileExtensions: [".vue"]
            }
        },
        plugins: {
            "@typescript-eslint": typescript,
            "tsdoc": tsdocPlugin,
            "vue": vue,
            "jsdoc": jsdoc
        },
        rules: {
            "tsdoc/syntax": ["error", {
                "supportedTags": ["extends"]
            }],
            "@typescript-eslint/no-unused-vars": "off",
            "@typescript-eslint/no-explicit-any": "off"
        },
        settings: {
            jsdoc: commonSettings
        }
    },
    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "module",
            ecmaVersion: 2022
        },
        plugins: {
            "jsdoc": jsdoc
        },
        rules: {
            "jsdoc/require-jsdoc": "error",
            "jsdoc/require-description": "error",
            "jsdoc/match-description": ["error", {
                "matchDescription": "^[A-Z][a-zA-Z0-9,.'\"\\- \\(\\)]*$"
            }]
        },
        settings: {
            jsdoc: commonSettings
        }
    }
];