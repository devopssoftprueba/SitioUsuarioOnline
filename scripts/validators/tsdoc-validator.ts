import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as ts from 'typescript';
import { TSDocParser, ParserContext } from '@microsoft/tsdoc';

// Función para obtener las líneas modificadas en un archivo
const getModifiedLines = (filePath: string): { [lineNumber: number]: boolean } => {
    try {
        const modifiedLines: { [lineNumber: number]: boolean } = {};

        // Cambios no confirmados
        try {
            const gitDiff = execSync(`git diff -U0 ${filePath}`, { encoding: 'utf8' }).trim();
            const lines = gitDiff.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.startsWith('@@')) {
                    const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
                    if (match) {
                        const startLine = parseInt(match[1]);
                        const lineCount = match[2] ? parseInt(match[2]) : 1;

                        for (let j = 0; j < lineCount; j++) {
                            if (i + j + 1 < lines.length && lines[i + j + 1].startsWith('+')) {
                                modifiedLines[startLine + j] = true;
                            }
                        }
                    }
                }
            }
        } catch {}

        // Cambios staged
        try {
            const gitDiffStaged = execSync(`git diff --cached -U0 ${filePath}`, { encoding: 'utf8' }).trim();
            const lines = gitDiffStaged.split('\n');

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.startsWith('@@')) {
                    const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
                    if (match) {
                        const startLine = parseInt(match[1]);
                        const lineCount = match[2] ? parseInt(match[2]) : 1;

                        for (let j = 0; j < lineCount; j++) {
                            if (i + j + 1 < lines.length && lines[i + j + 1].startsWith('+')) {
                                modifiedLines[startLine + j] = true;
                            }
                        }
                    }
                }
            }
        } catch {}

        return modifiedLines;
    } catch (error) {
        console.error(`Error al obtener líneas modificadas para ${filePath}:`, error);
        return {};
    }
};

// Obtener archivos modificados
const getModifiedFiles = (): string[] => {
    try {
        const gitStatus = execSync('git diff --name-only', { encoding: 'utf8' }).trim();
        const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();

        const allModified = [...gitStatus.split('\n'), ...stagedFiles.split('\n')]
            .filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
            .filter(Boolean);

        return [...new Set(allModified)];
    } catch (error) {
        console.error('Error al obtener archivos modificados:', error);
        return [];
    }
};

// Heurística simple para validar que el comentario esté en inglés
const isEnglish = (text: string): boolean => {
    const cleanText = text.replace(/[*@{}/\\[\]]/g, '').trim();
    if (cleanText.length === 0) return true;
    const nonAsciiChars = cleanText.replace(/[a-zA-Z0-9\s.,?!;:'"()-]/g, '').length;
    const ratio = nonAsciiChars / cleanText.length;
    return ratio < 0.3;
};

// Verifica si el nodo necesita documentación
const needsDocumentation = (node: ts.Node): boolean => {
    if (ts.isVariableStatement(node)) {
        const declarations = node.declarationList.declarations;
        for (const decl of declarations) {
            if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
                return true;
            }
        }
    }

    return ts.isFunctionDeclaration(node) ||
        ts.isMethodDeclaration(node) ||
        ts.isClassDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node);
};

// Obtener comentarios JSDoc
const getJSDocComments = (node: ts.Node, sourceFile: ts.SourceFile): ts.CommentRange[] => {
    let comments: ts.CommentRange[] = [];
    const nodePos = node.getFullStart();
    const nodeText = sourceFile.text;

    let startPos = nodePos;
    while (startPos > 0 && /\s/.test(nodeText.charAt(startPos - 1))) {
        startPos--;
    }

    if (startPos > 3 && nodeText.substring(startPos - 3, startPos) === '*/\n') {
        let commentEnd = startPos - 3;
        let commentStart = nodeText.lastIndexOf('/**', commentEnd);
        if (commentStart >= 0) {
            comments.push({
                kind: ts.SyntaxKind.MultiLineCommentTrivia,
                pos: commentStart,
                end: commentEnd + 2
            });
        }
    }

    return comments;
};

// Validar TSDoc en un archivo
const validateTSDoc = (filePath: string): boolean => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);
    const parser = new TSDocParser();
    let isValid = true;
    const modifiedLines = getModifiedLines(filePath);

    const isNodeModified = (node: ts.Node): boolean => {
        const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
        const endLine = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
        for (let line = startLine; line <= endLine; line++) {
            if (modifiedLines[line]) return true;
        }
        return false;
    };

    function visit(node: ts.Node) {
        if (needsDocumentation(node)) {
            const isModified = isNodeModified(node);
            const comments = getJSDocComments(node, sourceFile);

            if (isModified) {
                if (comments.length === 0) {
                    let nodeName = 'desconocido';
                    if (
                        (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) &&
                        node.name &&
                        ts.isIdentifier(node.name)
                    ) {
                        nodeName = node.name.text;
                    }

                    console.error(`[ERROR] Falta documentación para '${nodeName}' en ${filePath}:${sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
                    isValid = false;
                } else {
                    for (const comment of comments) {
                        const commentText = fileContent.substring(comment.pos, comment.end);
                        if (!isEnglish(commentText)) {
                            console.error(`[ERROR] La documentación debe estar en inglés en ${filePath}:${sourceFile.getLineAndCharacterOfPosition(comment.pos).line + 1}`);
                            isValid = false;
                        }

                        const parserContext = parser.parseString(commentText);
                        if (parserContext.log.messages.length > 0) {
                            for (const message of parserContext.log.messages) {
                                console.error(`[ERROR] Error de TSDoc en ${filePath}:${sourceFile.getLineAndCharacterOfPosition(comment.pos).line + 1}: ${message.text}`);
                                isValid = false;
                            }
                        }
                    }
                }
            } else if (comments.length > 0) {
                for (const comment of comments) {
                    const commentText = fileContent.substring(comment.pos, comment.end);
                    if (!isEnglish(commentText)) {
                        console.error(`[ERROR] La documentación debe estar en inglés en ${filePath}:${sourceFile.getLineAndCharacterOfPosition(comment.pos).line + 1}`);
                        isValid = false;
                    }
                }
            }
        }

        ts.forEachChild(node, visit);
    }


    visit(sourceFile);
    return isValid;
};

// Función principal
const main = (): void => {
    const modifiedFiles = getModifiedFiles();

    if (modifiedFiles.length === 0) {
        console.log('No se encontraron archivos .ts o .tsx modificados.');
        return;
    }

    console.log(`Validando comentarios TSDoc en ${modifiedFiles.length} archivos modificados...`);
    let success = true;

    for (const file of modifiedFiles) {
        const fullPath = path.resolve(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
            console.log(`Verificando ${file}...`);
            if (!validateTSDoc(fullPath)) {
                success = false;
            }
        }
    }

    if (!success) {
        console.error('\n❌ Se encontraron errores en la documentación. Corrígelos antes de hacer commit.\n');
        process.exit(1);
    } else {
        console.log('\n✅ Todos los archivos pasaron la validación TSDoc.\n');
    }
};

main();
