import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import vueParser from 'vue-eslint-parser';
import jsdoc from 'eslint-plugin-jsdoc';

export default [
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                extraFileExtensions: [".vue"],
                parser: vueParser
            }
        },
        plugins: {
            "@typescript-eslint": typescript,
            "tsdoc": tsdocPlugin,
            "jsdoc": jsdoc
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

            // Tipos explícitos
            "@typescript-eslint/explicit-function-return-type": ["error", {
                "allowExpressions": false,
                "allowTypedFunctionExpressions": false
            }],
            "@typescript-eslint/explicit-member-accessibility": ["error", {
                "accessibility": "explicit"
            }],
            "@typescript-eslint/explicit-module-boundary-types": "error",

            // Reglas Vue
            "vue/component-api-style": ["error", ["script-setup"]],
            "vue/require-explicit-emits": "error",
            "vue/require-prop-types": "error",

            // Control de calidad
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": ["error", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],

            // Convenciones de nombres
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    "selector": "variable",
                    "format": ["camelCase", "UPPER_CASE", "PascalCase"]
                },
                {
                    "selector": "function",
                    "format": ["camelCase"]
                },
                {
                    "selector": "interface",
                    "format": ["PascalCase"],
                    "prefix": ["I"]
                },
                {
                    "selector": "typeAlias",
                    "format": ["PascalCase"],
                    "prefix": ["T"]
                }
            ]
        }
    }
];