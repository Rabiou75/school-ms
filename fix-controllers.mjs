import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

// Payments controller
{
  const p = join(root, 'apps/api/src/payments/payments.controller.ts');
  let s = readFileSync(p, 'utf8');

  const before = `    const stream = await this.receipts.render(id, locale || 'fr');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="receipt-' + id + '.pdf"');
    stream.pipe(res);`;

  const after = `    const buffer = await this.receipts.render(id, locale || 'fr');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', 'attachment; filename="receipt-' + id + '.pdf"');
    res.end(buffer);`;

  if (s.includes(after)) {
    console.log('  = payments controller already buffered');
  } else if (s.includes(before)) {
    s = s.replace(before, after);
    writeFileSync(p, s, 'utf8');
    console.log('  + payments.controller.ts');
  } else {
    console.log('  ! payments controller anchor not found');
    // Fallback: replace any "stream.pipe(res)" with res.end(buffer)
    if (s.includes('stream.pipe(res)')) {
      s = s.replace(
        /const stream = await this\.receipts\.render\(id, locale \|\| 'fr'\);/,
        'const buffer = await this.receipts.render(id, locale || \'fr\');'
      );
      s = s.replace(
        /stream\.pipe\(res\);/,
        "res.setHeader('Content-Length', String(buffer.length));\n    res.end(buffer);"
      );
      writeFileSync(p, s, 'utf8');
      console.log('  + payments.controller.ts (fallback)');
    }
  }
}

// Exams controller
{
  const p = join(root, 'apps/api/src/exams/exams.controller.ts');
  let s = readFileSync(p, 'utf8');

  const before = `    const stream = await this.reportCard.render(id, studentId, locale || 'fr');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="bulletin-' + studentId + '.pdf"');
    stream.pipe(res);`;

  const after = `    const buffer = await this.reportCard.render(id, studentId, locale || 'fr');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Content-Disposition', 'attachment; filename="bulletin-' + studentId + '.pdf"');
    res.end(buffer);`;

  if (s.includes(after)) {
    console.log('  = exams controller already buffered');
  } else if (s.includes(before)) {
    s = s.replace(before, after);
    writeFileSync(p, s, 'utf8');
    console.log('  + exams.controller.ts');
  } else {
    console.log('  ! exams controller anchor not found');
    if (s.includes('stream.pipe(res)')) {
      s = s.replace(
        /const stream = await this\.reportCard\.render\(id, studentId, locale \|\| 'fr'\);/,
        'const buffer = await this.reportCard.render(id, studentId, locale || \'fr\');'
      );
      s = s.replace(
        /stream\.pipe\(res\);/,
        "res.setHeader('Content-Length', String(buffer.length));\n    res.end(buffer);"
      );
      writeFileSync(p, s, 'utf8');
      console.log('  + exams.controller.ts (fallback)');
    }
  }
}

console.log('\n✅ Controllers patched');