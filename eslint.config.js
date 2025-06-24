import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import tsdocPlugin from 'eslint-plugin-tsdoc';
import vueParser from 'vue-eslint-parser';
import jsdoc from 'eslint-plugin-jsdoc';
import vue from 'eslint-plugin-vue';

export default [
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.vue", "**/*.js"],
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
                "contexts": ["any"],
                "descriptionStyle": "body"
            }],
            "jsdoc/match-description": ["error", {
                "matchDescription": "^[A-Z][a-zA-Z0-9,.'\"\\- \\(\\)]*$",
                "message": "La descripción debe estar en inglés y comenzar con mayúscula"
            }],
            // El resto de las reglas se mantienen igual...
        }
    },
    // Desactiva TSDoc solo en archivos JS, manteniendo tus reglas JSDoc
    {
        files: ["**/*.js"],
        rules: {
            "tsdoc/syntax": "off"
        }
    },
    // Opcional: sección explícita para archivos JS (puedes dejarla si quieres reglas extra)
    {
        files: ["**/*.js"],
        plugins: {
            "jsdoc": jsdoc
        },
        rules: {
            "jsdoc/check-tag-names": "error",
            "jsdoc/check-types": "error",
            "jsdoc/require-param": "warn",
            "jsdoc/require-returns": "warn"
        }
    }
];