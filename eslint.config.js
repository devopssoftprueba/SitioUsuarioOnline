import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import tsdocPlugin from 'eslint-plugin-tsdoc';

export default [
    {
        files: ["**/*.ts", "**/*.tsx"],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module"
            }
        },
        plugins: {
            "@typescript-eslint": typescript,
            "tsdoc": tsdocPlugin
        },
        rules: {
            // Reglas que bloquearán el push (error)
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/explicit-function-return-type": "error",
            "@typescript-eslint/no-unused-vars": "error",
            "@typescript-eslint/no-empty-function": "error",

            // Reglas que solo mostrarán advertencias
            "tsdoc/syntax": "error",
            "no-console": "warn",
            "@typescript-eslint/no-inferrable-types": "warn"
        }
    }
];