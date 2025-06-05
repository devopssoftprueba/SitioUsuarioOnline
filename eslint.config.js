import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import vueParser from 'vue-eslint-parser';
import jsdoc from 'eslint-plugin-jsdoc';
import vue from 'eslint-plugin-vue';

export default [
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
        languageOptions: {
            parser: vueParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                parser: typescriptParser,
                extraFileExtensions: [".vue"]
            }
        },
        plugins: {
            "@typescript-eslint": typescript,
            "tsdoc": tsdocPlugin,
            "jsdoc": jsdoc,
            "vue": vue
        },
        rules: {
            // Reglas TSDoc y JSDoc
            "tsdoc/syntax": "error",
            "jsdoc/require-jsdoc": ["error", {
                "publicOnly": true,
                "require": {
                    "FunctionDeclaration": true,
                    "MethodDefinition": true,
                    "ClassDeclaration": true,
                    "ArrowFunctionExpression": true,
                    "FunctionExpression": true,
                    "ClassExpression": true
                },
                "contexts": [
                    "TSInterfaceDeclaration",
                    "TSTypeAliasDeclaration",
                    "TSPropertySignature",
                    "TSMethodSignature",
                    "ClassProperty"
                ]
            }],
            "jsdoc/require-description": ["error", {
                "contexts": ["any"]
            }],
            "jsdoc/check-param-names": "error",
            "jsdoc/check-tag-names": "error",
            "jsdoc/check-types": "error",

            // Reglas Vue
            "vue/component-api-style": ["error", ["script-setup"]],
            "vue/require-explicit-emits": "error",
            "vue/require-prop-types": "error",
            "vue/script-setup-uses-vars": "error",

            // [Resto de reglas igual...]
        }
    }
];