import { TSDocParser, ParserContext, DocComment, DocBlock } from '@microsoft/tsdoc';

class NewCodeTSDocValidator {
    private parser: TSDocParser;
    private readonly results: {
        file: string;
        line: number;
        message: string;
        severity: 'error' | 'warning';
    }[];

    constructor() {
        this.parser = new TSDocParser();
        this.results = [];
    }

    // Punto de entrada público
    public validate(file: string, _content: string, lines: string[]): void {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('/**')) {
                const docLines = [line];
                let j = i + 1;
                while (j < lines.length && !lines[j].includes('*/')) {
                    docLines.push(lines[j].trim());
                    j++;
                }
                if (j < lines.length) {
                    docLines.push(lines[j].trim());
                    this.validateDocBlock(docLines.join('\n'), file, i + 1);
                }
                i = j;
            }
        }
    }

    // Valida cada bloque de comentario
    private validateDocBlock(docContent: string, file: string, lineNumber: number): void {
        this.validateTSDocContent(docContent, file, lineNumber);
    }

    // Valida el contenido de la documentación TSDoc
    private validateTSDocContent(docContent: string, file: string, lineNumber: number): void {
        const parserContext: ParserContext = this.parser.parseString(docContent);

        try {
            const docComment: DocComment = parserContext.docComment;

            // Verificar errores de sintaxis del parser
            if (parserContext.log.messages.length > 0) {
                this.results.push({
                    file,
                    line: lineNumber,
                    message: `Error de sintaxis TSDoc: ${parserContext.log.messages[0].text}`,
                    severity: 'error',
                });
                return;
            }

            // Validar que tenga al menos un bloque de descripción o parámetro
            const hasParams = docComment.customBlocks.some(
                (block: DocBlock) => block.blockTag.tagName === '@param'
            );

            const hasSummary = docComment.summarySection.getChildNodes().length > 0;

            if (!hasSummary && !hasParams) {
                this.results.push({
                    file,
                    line: lineNumber,
                    message: 'El bloque de documentación debe contener una descripción o @param.',
                    severity: 'warning',
                });
            }
        } catch (error: any) {
            this.results.push({
                file,
                line: lineNumber,
                message: `Error inesperado al validar TSDoc: ${error.message}`,
                severity: 'error',
            });
        }
    }

    // Devuelve los resultados de validación
    public getResults(): typeof this.results {
        return this.results;
    }
}

// Si este archivo se ejecuta directamente
async function main(): Promise<void> {
    const fileContent = `
  /**
   * Esta función suma dos números.
   * @param a Primer número
   * @param b Segundo número
   */
  function sumar(a: number, b: number): number {
    return a + b;
  }
  `;
    const lines = fileContent.split('\n');

    const validator = new NewCodeTSDocValidator();
    validator.validate('ejemplo.ts', fileContent, lines);

    const results = validator.getResults();
    if (results.length > 0) {
        console.log('Errores encontrados:');
        for (const r of results) {
            console.log(`[${r.severity.toUpperCase()}] ${r.file}:${r.line} - ${r.message}`);
        }
    } else {
        console.log('Sin errores TSDoc.');
    }
}

main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
