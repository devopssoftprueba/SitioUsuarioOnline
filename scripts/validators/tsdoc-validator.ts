import { execSync } from 'child_process';
import * as fs from 'fs';
import rules from './tsdoc-rules';

const fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];

function getStagedFiles(): string[] {
    const diffOutput = execSync('git diff --staged --name-only').toString();
    return diffOutput
        .split('\n')
        .filter(file =>
            fileExtensions.some(ext => file.endsWith(ext)) &&
            fs.existsSync(file)
        );
}

function getAddedLines(file: string): string[] {
    const diff = execSync(`git diff --staged -U5 ${file}`).toString();
    return diff
        .split('\n')
        .filter(line => line.startsWith('+') && !line.startsWith('+++'))
        .map(line => line.slice(1));
}

function isDeclaration(line: string): boolean {
    const trimmed = line.trim();
    return (
        /^export\s+(async\s+)?(function|class|interface|type|enum)\s+/.test(trimmed) ||
        /^(async\s+)?(function|class|interface|type|enum)\s+/.test(trimmed)
    );
}

function getTSDocBlockBefore(lines: string[], index: number): string[] {
    let i = index - 1;
    const block: string[] = [];
    let insideDoc = false;

    while (i >= 0) {
        const line = lines[i].trim();
        if (line === '') {
            i--;
            continue;
        }

        if (line.startsWith('*/')) insideDoc = true;
        if (insideDoc) block.unshift(line);
        if (line.startsWith('/**')) break;

        i--;
    }

    return block.length > 0 ? block : [];
}

function extractDocText(docBlock: string[]): string {
    return docBlock
        .map(l => l.replace(/^\s*\*\s?/, '').trim())
        .filter(l => l && !l.startsWith('@'))
        .join(' ');
}

function isEnglish(text: string): boolean {
    if (!rules.enforceEnglish) return true;
    if (!text || text.length < 5) return false;

    const lower = text.toLowerCase();
    return !rules.spanishWords.some(word => lower.includes(word));
}

function checkTSDocInEnglish(file: string, addedLines: string[]): string[] {
    const lines = fs.readFileSync(file, 'utf-8').split('\n');
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!addedLines.includes(line.trim())) continue;
        if (!isDeclaration(line)) continue;

        const docBlock = getTSDocBlockBefore(lines, i);
        if (docBlock.length === 0) {
            errors.push(`${file}:${i + 1} - Missing TSDoc comment in English for: ${line.trim()}`);
            continue;
        }

        const content = extractDocText(docBlock);
        if (!isEnglish(content)) {
            errors.push(`${file}:${i + 1} - TSDoc must be in English (detected Spanish) for: ${line.trim()}`);
        }
    }

    return errors;
}

function main() {
    const stagedFiles = getStagedFiles();
    let allErrors: string[] = [];

    for (const file of stagedFiles) {
        const addedLines = getAddedLines(file);
        const errors = checkTSDocInEnglish(file, addedLines);
        allErrors = allErrors.concat(errors);
    }

    if (allErrors.length > 0) {
        console.error('\n🛑 TSDoc Validation Failed:\n');
        allErrors.forEach(e => console.error('  ' + e));
        console.error('\nPlease ensure new or modified declarations have TSDoc in English.\n');
        process.exit(1);
    } else {
        console.log('✅ All new or modified declarations are properly documented in English.');
    }
}

main();
