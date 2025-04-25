import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as ts from 'typescript';
import { TSDocParser } from '@microsoft/tsdoc';

// 🔹 Palabras prohibidas en español
const forbiddenWords = ['usuario', 'nombre', 'devuelve', 'crea una', 'nueva instancia', 'sistema', 'el nombre', 'representa', 'instancia'];

const contieneEspanol = (texto: string): boolean => {
    const contenido = texto.toLowerCase();
    return forbiddenWords.some(palabra => contenido.includes(palabra));
};

// 🔹 Archivos nuevos no versionados
const getUntrackedFiles = (): string[] => {
    try {
        const output = execSync('git ls-files --others --exclude-standard', { encoding: 'utf8' }).trim();
        return output ? output.split('\n').filter(f => f.match(/\.(ts|tsx)$/)) : [];
    } catch {
        return [];
    }
};

// 🔹 Obtener archivos modificados
const getModifiedFiles = (): string[] => {
    try {
        const stdin = process.env.GIT_STDIN || '';
        const [_, localSha, __, remoteSha] = stdin.split(' ');

        let diffCommand = '';

        if (remoteSha && localSha && remoteSha !== '0000000000000000000000000000000000000000') {
            diffCommand = `git diff --name-only ${remoteSha}..${localSha}`;
        } else {
            try {
                const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
                const upstream = execSync(`git rev-parse --abbrev-ref ${currentBranch}@{upstream} 2>/dev/null || echo ''`, { encoding: 'utf8' }).trim();
                diffCommand = upstream ? `git diff --name-only ${upstream}..HEAD` : 'git diff --name-only HEAD~10..HEAD';
            } catch {
                diffCommand = 'git diff --name-only HEAD~10..HEAD';
            }
        }

        const unstagedFiles = execSync('git diff --name-only', { encoding: 'utf8' }).trim();
        const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' }).trim();
        const filesFromDiff = execSync(diffCommand, { encoding: 'utf8' }).trim();

        const allFiles = [...unstagedFiles.split('\n'), ...stagedFiles.split('\n'), ...filesFromDiff.split('\n')]
            .filter(file => file.match(/\.(ts|tsx)$/))
            .filter(Boolean);

        const untrackedFiles = getUntrackedFiles();

        return [...new Set([...allFiles, ...untrackedFiles])];
    } catch (error) {
        console.error('❌ Error al obtener archivos modificados:', error);
        return [];
    }
};

// 🔹 Obtener líneas modificadas
const getModifiedLines = (filePath: string): { [lineNumber: number]: boolean } => {
    try {
        const modifiedLines: { [lineNumber: number]: boolean } = {};

        const gitDiff = execSync(`git diff -U0 ${filePath}`, { encoding: 'utf8' }).trim();
        const gitDiffStaged = execSync(`git diff --cached -U0 ${filePath}`, { encoding: 'utf8' }).trim();
        const allDiffs = [gitDiff, gitDiffStaged].join('\n');

        allDiffs.split('\n').forEach(line => {
            if (line.startsWith('@@')) {
                const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
                if (match) {
                    const startLine = parseInt(match[1]);
                    const lineCount = match[2] ? parseInt(match[2]) : 1;
                    for (let i = 0; i < lineCount; i++) {
                        modifiedLines[startLine + i] = true;
                    }
                }
            }
        });

        return modifiedLines;
    } catch (error) {
        console.error(`❌ Error al obtener líneas modificadas en ${filePath}:`, error);
        return {};
    }
};

// 🔹 Validar documentación TSDoc
const validateTSDoc = (filePath: string, isNewFile: boolean): boolean => {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const sourceFile = ts.createSourceFile(filePath, fileContent, ts.ScriptTarget.Latest, true);
    const parser = new TSDocParser();
    let isValid = true;
    const modifiedLines = getModifiedLines(filePath);

    function visit(node: ts.Node) {
        const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;

        if (!isNewFile && !modifiedLines[startLine]) return;

        if (
            ts.isFunctionDeclaration(node) ||
            ts.isMethodDeclaration(node) ||
            ts.isClassDeclaration(node) ||
            ts.isPropertyDeclaration(node)
        ) {
            const comments = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart()) || [];

            if (comments.length === 0) {
                console.error(`❌ Falta documentación en ${filePath}:${startLine}`);
                isValid = false;
            } else {
                comments.forEach(comment => {
                    const commentText = fileContent.substring(comment.pos, comment.end);
                    const parserContext = parser.parseString(commentText);

                    if (parserContext.log.messages.length > 0) {
                        console.error(`❌ Error de TSDoc en ${filePath}:${startLine}: ${parserContext.log.messages[0].text}`);
                        isValid = false;
                    }

                    const plainText = commentText.replace(/\/\*\*|\*\//g, '').replace(/\*\s?/g, '');
                    if (contieneEspanol(plainText)) {
                        console.error(`❌ La documentación debe estar en inglés (detectado español) en ${filePath}:${startLine}`);
                        isValid = false;
                    }
                });
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return isValid;
};

// 🔹 Ejecutar validación
const main = (): void => {
    const modifiedFiles = getModifiedFiles();
    const untrackedFiles = getUntrackedFiles();

    if (modifiedFiles.length === 0) {
        console.log('✅ No hay archivos TypeScript modificados.');
        return;
    }

    console.log(`🔍 Validando TSDoc e idioma en ${modifiedFiles.length} archivo(s)...`);
    let success = true;

    modifiedFiles.forEach(file => {
        const fullPath = path.resolve(process.cwd(), file);
        const isNewFile = untrackedFiles.includes(file);
        if (fs.existsSync(fullPath) && !validateTSDoc(fullPath, isNewFile)) {
            success = false;
        }
    });

    if (!success) {
        console.error('\n❌ Errores encontrados. Corrige la documentación antes de hacer push.\n');
        process.exit(1);
    } else {
        console.log('\n✅ Todos los archivos pasaron la validación.\n');
    }
};

console.log('🧪 Ejecutando validador TSDoc desde pre-push...');

main();
