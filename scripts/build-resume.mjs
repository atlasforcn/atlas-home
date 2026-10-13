#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
if (process.argv.slice(2).some(argument => argument !== '--check')) {
    throw new Error('Usage: node scripts/build-resume.mjs [--check]');
}

// Load the same renderer used by the browser, without running browser startup.
const context = vm.createContext({
    document: {
        querySelector: () => null,
        addEventListener: () => {}
    }
});
vm.runInContext(readFileSync(resolve(root, 'script.js'), 'utf8'), context);
const renderDetails = vm.runInContext('renderResumeDetails', context);

const pages = [
    { html: 'index.html', markdown: 'resume.md', language: 'zh-Hant' },
    { html: 'en/index.html', markdown: 'resume-en.md', language: 'en' }
];
const startMarker = '<!-- resume-details:start -->';
const endMarker = '<!-- resume-details:end -->';
let stale = false;

for (const page of pages) {
    const path = resolve(root, page.html);
    const original = readFileSync(path, 'utf8');
    const details = renderDetails(readFileSync(resolve(root, page.markdown), 'utf8'), page.language);
    if (!details.includes('id="awards"') || !details.includes('id="skills"')) {
        throw new Error(`Missing required résumé sections for ${page.html}`);
    }

    // Limit writes to this container so unrelated page/head edits remain intact.
    const container = /(<div\b[^>]*\bid="resume-content"[^>]*>)([\s\S]*?)(<\/div>)/;
    if (!container.test(original)) throw new Error(`Missing résumé container in ${page.html}`);
    const updated = original.replace(container, (_, opening, body, closing) => {
        if (body.includes(startMarker) !== body.includes(endMarker)) {
            throw new Error(`Incomplete résumé build markers in ${page.html}`);
        }
        opening = opening.replace(/\s+data-resume-prerendered="[^"]*"/g, '')
            .replace(/\s+aria-busy="[^"]*"/g, '')
            .replace(/>$/, ' data-resume-prerendered="true" aria-busy="false">');
        return `${opening}\n${startMarker}\n${details}\n${endMarker}\n            ${closing}`;
    });

    if (updated === original) {
        console.log(`${page.html}: up to date`);
    } else if (checkOnly) {
        console.error(`${page.html}: stale résumé HTML; run node scripts/build-resume.mjs`);
        stale = true;
    } else {
        writeFileSync(path, updated);
        console.log(`${page.html}: rendered résumé details`);
    }
}

if (stale) process.exitCode = 1;
