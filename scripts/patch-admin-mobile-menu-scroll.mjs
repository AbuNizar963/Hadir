import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const file = 'lib/features/administration/widgets/admin_mobile_shell.dart';
const filePath = path.join(ROOT, file);
const source = fs.readFileSync(filePath, 'utf8');

const from = `    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [`;

const to = `    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      backgroundColor: Theme.of(context).colorScheme.surface,
      builder: (sheetContext) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(sheetContext).height * .86,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [`;

const closing = `            ],
          ),
        ),
      ),
    );`;
const closingReplacement = `              ],
            ),
          ),
        ),
      ),
    );`;

if (source.includes(to)) {
  console.log('Admin mobile menu is already scroll-safe.');
  process.exit(0);
}

if (!source.includes(from)) {
  throw new Error(`Expected admin menu builder block was not found in ${file}.`);
}

const start = source.indexOf(from);
const afterStart = start + from.length;
const end = source.indexOf(closing, afterStart);

if (end === -1) {
  throw new Error(`Expected admin menu closing block was not found in ${file}.`);
}

const occurrences = source.split(from).length - 1;
if (occurrences !== 1) {
  throw new Error(`Expected exactly one admin menu builder block, found ${occurrences}.`);
}

const updated =
  source.slice(0, start) +
  to +
  source.slice(afterStart, end) +
  closingReplacement +
  source.slice(end + closing.length);

if (!updated.includes('isScrollControlled: true')) {
  throw new Error(`Scroll control was not inserted into ${file}.`);
}
if (!updated.includes('SingleChildScrollView(')) {
  throw new Error(`Scrollable menu container was not inserted into ${file}.`);
}
if (updated.includes(from)) {
  throw new Error(`Original non-scrollable admin menu block remains in ${file}.`);
}

fs.writeFileSync(filePath, updated, 'utf8');
console.log('Admin mobile menu scroll patch applied successfully.');
