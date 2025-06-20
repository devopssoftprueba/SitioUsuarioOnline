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
            // Regla actualizada para requerir descripciones
            "jsdoc/require-description": ["error", {
                "contexts": ["any"],
                "descriptionStyle": "body"
            }],
            // Regla para validar formato en inglés
            "jsdoc/match-description": ["error", {
                "matchDescription": "^[A-Z][a-zA-Z0-9,.'\"\\- \\(\\)]*$",
                "message": "La descripción debe estar en inglés y comenzar con mayúscula"
            }],
            // El resto de las reglas se mantienen igual...
        }
    }
];