import * as XLSX from 'xlsx';
import { CATEGORY_META } from './dataLoader';

// ─── Supported file types ─────────────────────────────────────────────────────
export const SUPPORTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel',                                          // .xls
  'text/csv',                                                           // .csv
  'text/plain',
];
export const SUPPORTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

// ─── Category keyword detection ───────────────────────────────────────────────
const CATEGORY_KEYWORDS = {
  fruits:     ['банан', 'ябълк', 'портокал', 'лимон', 'ягод', 'праскова', 'круш', 'грозд', 'манго', 'диня', 'пъпеш', 'кайсия', 'череш', 'малин', 'боровинк',
               'banana', 'apple', 'orange', 'lemon', 'strawberry', 'peach', 'pear', 'grape', 'mango', 'watermelon', 'melon', 'apricot', 'cherry', 'raspberry', 'blueberry', 'kiwi', 'pineapple', 'плод', 'fruit'],
  vegetables: ['морков', 'домат', 'краставиц', 'лук', 'чесън', 'картоф', 'зеле', 'спанак', 'броколи', 'карфиол', 'тиквичк', 'патладж', 'чушк', 'целина', 'репичк',
               'carrot', 'tomato', 'cucumber', 'onion', 'garlic', 'potato', 'cabbage', 'spinach', 'broccoli', 'cauliflower', 'zucchini', 'eggplant', 'pepper', 'celery', 'radish', 'зеленч', 'vegetable'],
  bakery:     ['хляб', 'кроасан', 'кифл', 'питк', 'козунак', 'баниц', 'мекиц', 'погач', 'франзел', 'симид', 'хлебч', 'пай', 'тарт', 'мафин',
               'bread', 'croissant', 'roll', 'bun', 'pastry', 'cake', 'muffin', 'donut', 'bagel', 'waffle', 'toast', 'пекарн', 'bakery'],
  drinks:     ['вода', 'сок', 'кафе', 'чай', 'мляко', 'бира', 'вино', 'газирана', 'нектар', 'айран', 'енергийна', 'smoothie',
               'water', 'juice', 'coffee', 'tea', 'milk', 'beer', 'wine', 'soda', 'energy', 'drink', 'напитк', 'beverage'],
  snacks:     ['чипс', 'пуканки', 'бисквит', 'шоколад', 'бонбон', 'дъвк', 'вафл', 'крекер', 'ядк', 'фъстък', 'бадем', 'орех', 'кашу',
               'chips', 'popcorn', 'cookie', 'chocolate', 'candy', 'gum', 'wafer', 'cracker', 'nut', 'peanut', 'almond', 'walnut', 'cashew', 'снак', 'snack'],
  dairy:      ['сирене', 'кашкавал', 'масло', 'кисело мляко', 'извара', 'сметана', 'яйц',
               'cheese', 'butter', 'yogurt', 'cream', 'egg', 'dairy', 'млечн'],
  meat:       ['пиле', 'телешко', 'свинско', 'агнешко', 'пуешко', 'риба', 'скарид', 'наденица', 'кебап', 'кайма', 'пастет', 'шунка', 'салам',
               'chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'shrimp', 'sausage', 'mince', 'ham', 'meat', 'месо'],
  frozen:     ['замразен', 'ледено', 'сладолед',
               'frozen', 'ice cream', 'icecream'],
  household:  ['прах', 'препарат', 'сапун', 'шампоан', 'тоалетна', 'кърп', 'домакинск',
               'detergent', 'soap', 'shampoo', 'cleaning', 'household', 'домакинство'],
  cosmetics:  ['крем', 'лосион', 'парфюм', 'грим', 'козметик', 'тен',
               'cream', 'lotion', 'perfume', 'makeup', 'cosmetic'],
  pet_food:   ['кучешка', 'котешка', 'храна за', 'pet', 'dog', 'cat', 'животн'],
};

/**
 * Detect category from product name.
 */
export function detectCategory(name = '') {
  const lower = name.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return cat;
  }
  return 'mixed';
}

/**
 * Normalise a raw column header to one of: plu | name | category | difficulty | emoji | nameEn
 */
function normaliseHeader(h) {
  const s = String(h).toLowerCase().trim().replace(/[\s_\-]+/g, '');
  if (['plu', 'код', 'номер', 'code', 'id', 'артикул'].some(k => s.includes(k))) return 'plu';
  if (['name', 'имепродукт', 'продукт', 'наименование', 'артикул', 'název', 'bezeichnung'].some(k => s.includes(k)) || s === 'name' || s === 'имена' || s === 'иметовар') return 'name';
  if (['category', 'категор', 'categ', 'group', 'група', 'тип'].some(k => s.includes(k))) return 'category';
  if (['difficulty', 'трудност', 'сложност'].some(k => s.includes(k))) return 'difficulty';
  if (['emoji', 'икон', 'icon'].some(k => s.includes(k))) return 'emoji';
  if (['nameen', 'englishname', 'eng', 'английск'].some(k => s.includes(k))) return 'nameEn';
  return null;
}

/**
 * Normalise a category value string to an internal key.
 */
function normaliseCategory(raw = '') {
  const s = raw.toLowerCase().trim();
  const mapping = {
    // English
    fruit: 'fruits', fruits: 'fruits',
    vegetable: 'vegetables', vegetables: 'vegetables', veggie: 'vegetables', veggies: 'vegetables',
    bakery: 'bakery', bread: 'bakery', pastry: 'bakery',
    drink: 'drinks', drinks: 'drinks', beverage: 'drinks', beverages: 'drinks',
    snack: 'snacks', snacks: 'snacks',
    dairy: 'dairy',
    meat: 'meat',
    frozen: 'frozen',
    household: 'household',
    cosmetic: 'cosmetics', cosmetics: 'cosmetics',
    petfood: 'pet_food', 'pet food': 'pet_food', pet: 'pet_food',
    mixed: 'mixed', other: 'mixed',
    // Bulgarian
    плодове: 'fruits', зеленчуци: 'vegetables', пекарна: 'bakery', напитки: 'drinks',
    снаксове: 'snacks', млечни: 'dairy', месо: 'meat', замразени: 'frozen',
    домакинство: 'household', козметика: 'cosmetics', храназаживотни: 'pet_food',
  };
  const key = s.replace(/[\s_\-]+/g, '');
  return mapping[key] || mapping[s] || (CATEGORY_META[s] ? s : null);
}

// ─── Parse file into raw rows ─────────────────────────────────────────────────
export async function parseFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        resolve(rows);
      } catch (err) {
        reject(new Error('Cannot read file. It may be corrupted or in an unsupported format.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

// ─── Convert raw rows → products ─────────────────────────────────────────────
export function rowsToProducts(rows) {
  if (!rows || rows.length < 2) {
    return { products: [], errors: ['File is empty or has no data rows.'] };
  }

  // Find header row (first non-empty row)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    if (rows[i].some(cell => cell !== '')) { headerRowIndex = i; break; }
  }

  const rawHeaders = rows[headerRowIndex];
  const colMap = {}; // normalised key → column index
  rawHeaders.forEach((h, i) => {
    const norm = normaliseHeader(h);
    if (norm && !(norm in colMap)) colMap[norm] = i;
  });

  const errors = [];
  if (!('plu' in colMap)) errors.push('Could not find a PLU/Code column.');
  if (!('name' in colMap)) errors.push('Could not find a Name column.');
  if (errors.length) return { products: [], errors };

  const dataRows = rows.slice(headerRowIndex + 1);
  return { products: dataRows, colMap, errors: [] };
}

// ─── Validate & build product objects ────────────────────────────────────────
export function validateAndBuild(dataRows, colMap, existingProducts = []) {
  const existingPLUs = new Set(existingProducts.map(p => String(p.plu)));
  const seenPLUs = new Set();
  const valid = [];
  const report = { total: 0, valid: 0, duplicates: 0, invalidRows: 0, emptyRows: 0, details: [] };

  dataRows.forEach((row, idx) => {
    report.total++;
    const lineNum = idx + 2;

    // Skip empty rows
    if (row.every(cell => cell === '' || cell == null)) {
      report.emptyRows++;
      return;
    }

    const rawPLU  = String(row[colMap.plu] ?? '').trim();
    const rawName = String(row[colMap.name] ?? '').trim();

    if (!rawPLU) {
      report.invalidRows++;
      report.details.push({ line: lineNum, issue: 'Missing PLU', row: rawName || '(empty)' });
      return;
    }
    if (!rawName) {
      report.invalidRows++;
      report.details.push({ line: lineNum, issue: 'Missing name', row: rawPLU });
      return;
    }

    if (seenPLUs.has(rawPLU)) {
      report.duplicates++;
      report.details.push({ line: lineNum, issue: `Duplicate PLU ${rawPLU}`, row: rawName });
      return;
    }
    seenPLUs.add(rawPLU);

    // Category
    let category = 'mixed';
    if ('category' in colMap && row[colMap.category]) {
      category = normaliseCategory(String(row[colMap.category])) || detectCategory(rawName);
    } else {
      category = detectCategory(rawName);
    }

    const product = {
      plu:        rawPLU,
      id:         rawPLU,
      name:       rawName,
      nameEn:     'nameEn' in colMap ? String(row[colMap.nameEn] ?? '').trim() : '',
      category,
      difficulty: 'difficulty' in colMap ? String(row[colMap.difficulty] ?? 'easy').trim() : 'easy',
      emoji:      'emoji' in colMap ? String(row[colMap.emoji] ?? '').trim() : '',
      image:      '',
    };

    valid.push(product);
    report.valid++;
  });

  return { valid, report, existingPLUs };
}

// ─── Merge strategies ────────────────────────────────────────────────────────
export function applyMergeStrategy(strategy, newProducts, existingProducts) {
  switch (strategy) {
    case 'replace':
      return newProducts;

    case 'merge': {
      const byPLU = new Map(existingProducts.map(p => [p.plu, p]));
      newProducts.forEach(p => { if (!byPLU.has(p.plu)) byPLU.set(p.plu, p); });
      return [...byPLU.values()];
    }

    case 'update': {
      const byPLU = new Map(existingProducts.map(p => [p.plu, p]));
      newProducts.forEach(p => byPLU.set(p.plu, p));
      return [...byPLU.values()];
    }

    default:
      return newProducts;
  }
}

// ─── Export helpers ───────────────────────────────────────────────────────────
export function exportToExcel(products, filename = 'products.xlsx') {
  const rows = products.map(p => ({
    PLU:        p.plu,
    Name:       p.name,
    'Name (EN)': p.nameEn || '',
    Category:   p.category,
    Difficulty: p.difficulty || 'easy',
    Emoji:      p.emoji || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, filename);
}

export function exportToCSV(products, filename = 'products.csv') {
  const rows = products.map(p => ({
    PLU:      p.plu,
    Name:     p.name,
    NameEN:   p.nameEn || '',
    Category: p.category,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(products, filename = 'products.json') {
  const json = JSON.stringify(products, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function downloadTemplate() {
  const rows = [
    { PLU: '1', Name: 'Банани', 'Name (EN)': 'Bananas', Category: 'fruits', Difficulty: 'easy', Emoji: '🍌' },
    { PLU: '2', Name: 'Ябълки', 'Name (EN)': 'Apples',  Category: 'fruits', Difficulty: 'easy', Emoji: '🍎' },
    { PLU: '600', Name: 'Моркови', 'Name (EN)': 'Carrots', Category: 'vegetables', Difficulty: 'easy', Emoji: '🥕' },
  ];
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'products_template.xlsx');
}
