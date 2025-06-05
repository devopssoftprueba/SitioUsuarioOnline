import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import tsdocPlugin from 'eslint-plugin-tsdoc';

export default [
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.vue"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                extraFileExtensions: [".vue"], // Importante para archivos Vue
                parser: "vue-eslint-parser"    // Parser específico para Vue
            }
        },
        plugins: {
            "@typescript-eslint": typescript,
            "tsdoc": tsdocPlugin
        },
        rules: {
            // Documentación obligatoria
            "tsdoc/syntax": "warn",
            "@typescript-eslint/explicit-function-return-type": ["error", {
                "allowExpressions": false,
                "allowTypedFunctionExpressions": false
            }],
            "@typescript-eslint/explicit-member-accessibility": ["error", {
                "accessibility": "explicit"
            }],

            // Forzar documentación en funciones y métodos
            "@typescript-eslint/explicit-module-boundary-types": "error",

            // Documentación obligatoria para todas las declaraciones
            "@typescript-eslint/require-jsdoc": ["error", {
                "require": {
                    "FunctionDeclaration": true,
                    "MethodDefinition": true,
                    "PropertyDefinition": true,
                    "ClassDeclaration": true,
                    "ArrowFunctionExpression": true,
                    "VariableDeclaration": true
                }
            }],

            // Regla específica para Vue
            "vue/component-api-style": ["error", ["script-setup"]],
            "vue/require-explicit-emits": "error",
            "vue/require-prop-types": "error",

            // Otras reglas (se mantienen igual)
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/no-unused-vars": ["error", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_"
            }],
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    "selector": "variable",
                    "format": ["camelCase", "UPPER_CASE"]
                },
                {
                    "selector": "function",
                    "format": ["camelCase"]
                }
            ]
        }
    }
];