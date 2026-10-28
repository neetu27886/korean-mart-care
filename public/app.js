/* ==========================================================================
   Korean Mart Care — KC Bazar Style Storefront & Control App (Netlify Ready)
   ========================================================================== */

const STORAGE_STATE_KEY = 'kmc_store_state_v1';
const STORAGE_CART_KEY = 'kmc_cart_v1';
const STORAGE_WISHLIST_KEY = 'kmc_wishlist_v1';
const STORAGE_CLOUD_CFG_KEY = 'kmc_cloud_config_v1';
const STORAGE_GITHUB_CFG_KEY = 'kmc_github_config_v1';
const STORAGE_PRICE_LOCK_KEY = 'kmc_price_locks_v1';

const AppState = {
  baseCatalog: {
    settings: {},
    brands: [],
    categories: [],
    products: []
  },
  storeState: {
    settings: {
      siteName: 'Korean Mart Care',
      tagline: '100% Authentic Korean Skincare in Bangladesh',
      logoUrl: '',
      deliveryCharge: 110,
      deliveryNote: 'সারা বাংলাদেশে হোম ডেলিভারি চার্জ ১১০ টাকা (২৪-৪৮ ঘণ্টার মধ্যে ডেলিভারি)',
      messengerLink: 'https://www.facebook.com/share/1DkbSM7DHq/?mibextid=wwXIfr',
      facebookPage: 'https://www.facebook.com/share/1DkbSM7DHq/?mibextid=wwXIfr',
      instagramLink: 'https://www.instagram.com/korean_mart_care?mdxt=ZDZkajRwaHMybmpk&utm_source=qr',
      announcementText:
        '🎉 Korean Mart Care — ১০০% অথেনটিক কোরিয়ান স্কিনকেয়ার প্রোডাক্ট | অর্ডারের ২৪ ঘণ্টার মাঝে কনফার্মেশন এবং ২৪-৪৮ ঘণ্টার মাঝে সারা বাংলাদেশে হোম ডেলিভারি (ডেলিভারি চার্জ ১১০ টাকা)',
      heroTitle: 'Korean Mart Care — Original Skin Care Collection',
      heroSubtitle:
        'দক্ষিণ কোরিয়া থেকে সরাসরি আমদানিকৃত ১০০% অরিজিনাল স্কিনকেয়ার প্রোডাক্ট। ডেলিভারি ম্যানের সামনে পণ্য চেক করে রিসিভ করার সুবিধা!'
    },
    productOverrides: {},
    priceLocks: {},
    customProducts: [],
    deletedProductIds: [],
    brandOverrides: {},
    customBrands: [],
    orders: []
  },
  products: [],
  brands: [],
  categories: [],
  activeCategory: 'all',
  activeBrand: 'all',
  searchQuery: '',
  sortBy: 'featured',
  visibleCount: 24,
  adminVisibleCount: 30,
  wishlistOnly: false,
  cart: [],
  wishlist: [],
  editingImages: [],
  isControlAppOpen: false
};

/* ==================== UTILITY HELPERS ==================== */
function formatPrice(num) {
  const n = Math.round(Number(num) || 0);
  return '৳ ' + n.toLocaleString('en-IN');
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function slugify(str = '') {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast-msg';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, 3000);
}

function getProductShareUrl(product) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.pathname = `/product/${encodeURIComponent(product.slug || String(product.id))}`;
  return url.toString();
}

function fileToOptimizedDataUrl(file, maxWidth = 900, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        resolve(canvas.toDataURL(mime, quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ==================== PRICE LOCK ENGINE (KC Bazar-এর আগের রেট লক) ==================== */
function priceLockOf(id) {
  const locks = AppState.storeState.priceLocks || {};
  return locks[String(id)] || null;
}

function priceLockCount() {
  return Object.keys(AppState.storeState.priceLocks || {}).length;
}

function applyPriceLockToProduct(prod, idStr) {
  const lock = priceLockOf(idStr);
  if (!lock) return prod;
  const sale = Number(lock.salePrice) || 0;
  const reg = Number(lock.regularPrice) || 0;
  if (sale > 0) prod.salePrice = sale;
  if (reg > 0) prod.regularPrice = Math.max(reg, sale || Number(prod.salePrice) || 0);
  prod.priceLocked = true;
  prod.priceLockedAt = Number(lock.lockedAt) || 0;
  prod.priceLockSource = lock.source || 'owner';
  return prod;
}

function setPriceLock(id, salePrice, regularPrice, source = 'owner') {
  const idStr = String(id);
  const sale = Number(salePrice) || 0;
  const reg = Math.max(Number(regularPrice) || 0, sale);
  if (sale <= 0) return;
  AppState.storeState.priceLocks = AppState.storeState.priceLocks || {};
  AppState.storeState.priceLocks[idStr] = {
    salePrice: sale,
    regularPrice: reg,
    lockedAt: Date.now(),
    source
  };
  persistPriceLocks();
}

function removePriceLock(id) {
  const idStr = String(id);
  if (AppState.storeState.priceLocks) {
    delete AppState.storeState.priceLocks[idStr];
  }
  const ov = (AppState.storeState.productOverrides || {})[idStr];
  if (ov && (Object.prototype.hasOwnProperty.call(ov, 'salePrice') || Object.prototype.hasOwnProperty.call(ov, 'regularPrice'))) {
    delete ov.salePrice;
    delete ov.regularPrice;
    if (!Object.keys(ov).length) {
      delete AppState.storeState.productOverrides[idStr];
    }
  }
  persistPriceLocks();
}

function persistPriceLocks() {
  try {
    localStorage.setItem(STORAGE_PRICE_LOCK_KEY, JSON.stringify(AppState.storeState.priceLocks || {}));
  } catch (e) {}
}

function loadLocalPriceLocks() {
  try {
    const raw = localStorage.getItem(STORAGE_PRICE_LOCK_KEY);
    if (!raw) return;
    const localLocks = JSON.parse(raw) || {};
    const cur = AppState.storeState.priceLocks || {};
    for (const [id, lk] of Object.entries(localLocks)) {
      if (!lk) continue;
      const ex = cur[id];
      const newAt = Number(lk.lockedAt) || 0;
      const oldAt = Number(ex?.lockedAt) || 0;
      if (!ex || newAt >= oldAt) cur[id] = lk;
    }
    AppState.storeState.priceLocks = cur;
  } catch (e) {}
}

async function relockPricesFromKcBazarOldRate(silent = true) {
  try {
    const res = await fetch('/data/catalog.json?t=' + Date.now());
    if (!res.ok) throw new Error('catalog fetch failed');
    const cat = await res.json();
    const now = Date.now();
    const locks = {};
    for (const p of cat.products || []) {
      const sale = Number(p.salePrice) || 0;
      if (sale <= 0) continue;
      locks[String(p.id)] = {
        salePrice: sale,
        regularPrice: Math.max(Number(p.regularPrice) || 0, sale),
        lockedAt: now,
        source: 'kcbazar_old_rate'
      };
    }
    AppState.storeState.priceLocks = locks;
    AppState.storeState.settings.priceRateMode = 'old_kcbazar';
    persistPriceLocks();
    if (!silent) showToast('🔒 ' + Object.keys(locks).length + 'টি প্রোডাক্টে KC Bazar-এর আগের রেট আবার লক করা হয়েছে!');
    return Object.keys(locks).length;
  } catch (e) {
    if (!silent) showToast('আগের রেট ফিরিয়ে আনতে সমস্যা হয়েছে।');
    return 0;
  }
}

/* ==================== PRODUCT DATA EXPORT (ADS / ONLINE STORE FEED) ==================== */
function kmcStripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = String(html || '');
  tmp.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
  tmp.querySelectorAll('li').forEach((li) => {
    li.textContent = '• ' + (li.textContent || '').trim() + '\n';
  });
  const txt = tmp.textContent || '';
  return txt.replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
}

function kmcSiteUrl() {
  const configured = (AppState.storeState.settings.siteUrl || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  return window.location.origin;
}

function kmcProductLink(p) {
  const slug = p.slug || slugify(p.name || 'product');
  return kmcSiteUrl() + '/product/' + encodeURIComponent(slug);
}

function kmcProductImages(p) {
  return (p.images || []).filter((u) => typeof u === 'string' && u.trim().length > 0);
}

function csvEscapeCell(val) {
  const s = val === null || val === undefined ? '' : String(val);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsvText(headers, rows) {
  const lines = [headers.map(csvEscapeCell).join(',')];
  for (const row of rows) lines.push(row.map(csvEscapeCell).join(','));
  return '\ufeff' + lines.join('\r\n');
}

var KMC_CRC_TABLE = (function () {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function kmcCrc32Bytes(bytes) {
  let crc = 0 ^ -1;
  for (let i = 0; i < bytes.length; i++) crc = (crc >>> 8) ^ KMC_CRC_TABLE[(crc ^ bytes[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function kmcZipBlob(files, mime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  const u16 = (n) => [n & 255, (n >>> 8) & 255];
  const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = kmcCrc32Bytes(f.data);
    const size = f.data.length;
    const local = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length), ...u16(0)]);
    chunks.push(local, nameBytes, f.data);
    const cd = new Uint8Array([0x50, 0x4b, 0x01, 0x02, 20, 0, 20, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(crc), ...u32(size), ...u32(size), ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]);
    central.push(cd, nameBytes);
    offset += local.length + nameBytes.length + size;
  }
  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const end = new Uint8Array([0x50, 0x4b, 0x05, 0x06, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), ...u16(0)]);
  return new Blob([...chunks, ...central, end], { type: mime });
}

function kmcXmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function kmcColName(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildXlsxBlob(headers, rows, sheetName = 'Products') {
  const enc = new TextEncoder();
  let sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  [headers, ...rows].forEach((row, r) => {
    sheet += '<row r="' + (r + 1) + '">';
    row.forEach((val, c) => {
      let v = val === null || val === undefined ? '' : String(val);
      if (v.length > 32000) v = v.slice(0, 32000);
      sheet += '<c r="' + kmcColName(c) + (r + 1) + '" t="inlineStr"><is><t xml:space="preserve">' + kmcXmlEsc(v) + '</t></is></c>';
    });
    sheet += '</row>';
  });
  sheet += '</sheetData></worksheet>';
  const files = [
    { name: '[Content_Types].xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>') },
    { name: '_rels/.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') },
    { name: 'xl/workbook.xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + kmcXmlEsc(sheetName).slice(0, 30) + '" sheetId="1" r:id="rId1"/></sheets></workbook>') },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>') },
    { name: 'xl/worksheets/sheet1.xml', data: enc.encode(sheet) }
  ];
  return kmcZipBlob(files);
}

function downloadBlobFile(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function getExportProducts() {
  const b = document.getElementById('exportBrandFilter')?.value || 'all';
  const c = document.getElementById('exportCategoryFilter')?.value || 'all';
  return (AppState.products || []).filter((p) => {
    if (b !== 'all' && p.brandSlug !== b) return false;
    if (c !== 'all' && p.primaryCategorySlug !== c) return false;
    return true;
  });
}

function customColumnValue(header, p) {
  const h = String(header || '').toLowerCase().replace(/[^a-z0-9ঀ-৿]+/g, ' ').trim();
  const imgs = kmcProductImages(p);
  const has = (...keys) => keys.some((k) => h.includes(k));
  if (has('image link', 'image_link', 'main image', 'primary image', 'image 1', 'img1', 'thumbnail', 'ছবি ১', 'ছবি 1')) return imgs[0] || '';
  if (has('image 2', 'image2', 'img2', 'ছবি ২', 'ছবি 2')) return imgs[1] || '';
  if (has('additional image', 'additional_image', 'extra image', 'other image')) return imgs.slice(1).join(',');
  if (has('image', 'img', 'photo', 'ছবি', 'picture')) return imgs.join(',');
  if (has('compare', 'regular', 'mrp', 'original', 'old price', 'strike')) return String(p.regularPrice || '');
  if (has('sale', 'discount', 'offer', 'current price', 'selling')) {
    if (has('percent', '%', 'rate')) return String(p.discountPercent || 0);
    return String(p.salePrice || '');
  }
  if (has('price')) return String(p.salePrice || '');
  if (has('link', 'url', 'লিঙ্ক')) return kmcProductLink(p);
  if (has('sku', 'code', 'আইডি', 'id')) return String(p.sku || p.id || '');
  if (has('brand', 'vendor', 'ব্র্যান্ড')) return p.brand || 'Korean Skincare';
  if (has('categor', 'type', 'ক্যাটাগরি', 'collection')) return p.primaryCategory || 'Skin Care';
  if (has('stock', 'inventory', 'available', 'স্টক')) return p.inStock === false ? '0' : 'In Stock';
  if (has('weight', 'size', 'volume', 'পরিমাণ')) return p.weight || '';
  if (has('desc', 'detail', 'বিবরণ', 'body')) return kmcStripHtml(p.description || '');
  if (has('title', 'name', 'product', 'নাম')) return p.name || '';
  if (has('sold', 'order')) return String(p.soldCount || 0);
  return '';
}

function buildExportTable(format) {
  const products = getExportProducts();
  const stamp = new Date().toISOString().slice(0, 10);
  let headers = [];
  let rows = [];

  if (format === 'full') {
    headers = ['Product ID', 'Product Name', 'Brand', 'Category', 'SKU', 'Size / Weight', 'Regular Price (BDT)', 'Sale Price (BDT)', 'Discount %', 'Stock Status', 'Sold Count', 'Product Link', 'Main Image URL', 'All Image URLs', 'Description (Plain Text)', 'Description (HTML)'];
    rows = products.map((p) => [
      p.id, p.name, p.brand || 'Korean Skincare', p.primaryCategory || 'Skin Care', p.sku || '', p.weight || '',
      p.regularPrice || 0, p.salePrice || 0, p.discountPercent || 0, p.inStock === false ? 'Out of Stock' : 'In Stock',
      p.soldCount || 0, kmcProductLink(p), kmcProductImages(p)[0] || '', kmcProductImages(p).join(' , '),
      kmcStripHtml(p.description || ''), p.description || ''
    ]);
  } else if (format === 'meta') {
    headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'additional_image_link', 'brand', 'google_product_category', 'fb_product_category', 'quantity_to_sell_on_facebook'];
    rows = products.map((p) => [
      String(p.id), (p.name || '').slice(0, 200), kmcStripHtml(p.description || p.name || '').slice(0, 5000),
      p.inStock === false ? 'out of stock' : 'in stock', 'new', (Number(p.salePrice) || 0) + ' BDT',
      kmcProductLink(p), kmcProductImages(p)[0] || '', kmcProductImages(p).slice(1).join(','),
      p.brand || 'Korean Skincare', 'Health & Beauty > Personal Care > Cosmetics > Skin Care',
      'Health & Beauty', p.inStock === false ? 0 : 999
    ]);
  } else if (format === 'shopify') {
    headers = ['Handle', 'Title', 'Body (HTML)', 'Vendor', 'Type', 'Tags', 'Published', 'Variant SKU', 'Variant Grams', 'Variant Inventory Qty', 'Variant Price', 'Variant Compare At Price', 'Image Src', 'Image Alt Text', 'Status'];
    const seen = new Set();
    products.forEach((p) => {
      const handle = p.slug || slugify(p.name || 'product');
      const imgs = kmcProductImages(p);
      const base = [handle, p.name, p.description || '', p.brand || 'Korean Skincare', p.primaryCategory || 'Skin Care', (p.brand || '') + ', Korean Skincare, Skin Care', 'TRUE', p.sku || '', '0', p.inStock === false ? '0' : '99', p.salePrice || 0, p.regularPrice || 0];
      if (!imgs.length) {
        rows.push([...base, '', '', 'active']);
      } else {
        imgs.forEach((img, idx) => {
          if (idx === 0) {
            rows.push([...base, img, p.name, 'active']);
            seen.add(handle);
          } else {
            rows.push([handle, '', '', '', '', '', '', '', '', '', '', '', img, p.name, 'active']);
          }
        });
      }
    });
  } else if (format === 'pricelist') {
    headers = ['#', 'Product Name', 'Brand', 'Size / Weight', 'Regular Price', 'Sale Price', 'Discount', 'Image 1', 'Image 2', 'Image 3', 'Product Link'];
    rows = products.map((p, i) => {
      const imgs = kmcProductImages(p);
      return [i + 1, p.name, p.brand || '', p.weight || '', p.regularPrice || 0, p.salePrice || 0,
        (p.discountPercent || 0) + '%', imgs[0] || '', imgs[1] || '', imgs[2] || '', kmcProductLink(p)];
    });
  } else if (format === 'custom') {
    const raw = (document.getElementById('exportCustomColumns')?.value || '').trim();
    headers = raw
      ? raw.split(/,|\n/).map((s) => s.trim()).filter(Boolean)
      : ['Product Name', 'Brand', 'Sale Price', 'Image URL', 'Product Link'];
    rows = products.map((p) => headers.map((h) => customColumnValue(h, p)));
  } else {
    headers = ['Product ID', 'Product Name', 'Brand', 'Sale Price', 'Image'];
    rows = products.map((p) => [p.id, p.name, p.brand || '', p.salePrice || 0, kmcProductImages(p)[0] || '']);
  }

  return { headers, rows, products, stamp };
}

function renderExportPreview() {
  const box = document.getElementById('exportPreview');
  if (!box) return;
  const format = document.getElementById('exportFormatSelect')?.value || 'full';
  document.getElementById('customColumnsWrap')?.classList.toggle('hidden', format !== 'custom');

  const { headers, rows } = buildExportTable(format);
  const countEl = document.getElementById('exportProductCount');
  if (countEl) countEl.textContent = rows.length + 'টি প্রোডাক্ট';

  const previewRows = rows.slice(0, 5);
  box.innerHTML =
    '<div class="export-preview-head">👀 প্রিভিউ (প্রথম ' + previewRows.length + 'টি প্রোডাক্ট • মোট ' + rows.length + 'টি)</div>' +
    '<div class="export-preview-scroll"><table class="export-preview-table"><thead><tr>' +
    headers.map((h) => '<th>' + escapeHtml(h) + '</th>').join('') +
    '</tr></thead><tbody>' +
    previewRows
      .map((r) => '<tr>' + r.map((c) => '<td>' + escapeHtml(String(c).slice(0, 90)) + '</td>').join('') + '</tr>')
      .join('') +
    '</tbody></table></div>';
}

function runExportDownload(kind) {
  const format = document.getElementById('exportFormatSelect')?.value || 'full';
  const { headers, rows, stamp } = buildExportTable(format);
  if (!rows.length) {
    showToast('কোনো প্রোডাক্ট পাওয়া যায়নি।');
    return;
  }
  const base = 'korean-mart-care-' + format + '-' + stamp;
  try {
    if (kind === 'csv') {
      downloadBlobFile(base + '.csv', new Blob([toCsvText(headers, rows)], { type: 'text/csv;charset=utf-8' }));
      showToast('⬇️ CSV ফাইল ডাউনলোড শুরু হয়েছে (' + rows.length + 'টি প্রোডাক্ট)');
    } else if (kind === 'xlsx') {
      const blob = buildXlsxBlob(headers, rows, 'Products');
      downloadBlobFile(base + '.xlsx', blob);
      showToast('⬇️ Excel (.xlsx) ফাইল ডাউনলোড শুরু হয়েছে (' + rows.length + 'টি প্রোডাক্ট)');
    } else if (kind === 'json') {
      const objs = rows.map((r) => {
        const o = {};
        headers.forEach((h, i) => (o[h] = r[i]));
        return o;
      });
      downloadBlobFile(base + '.json', new Blob([JSON.stringify(objs, null, 2)], { type: 'application/json;charset=utf-8' }));
      showToast('⬇️ JSON ফাইল ডাউনলোড শুরু হয়েছে');
    } else if (kind === 'copy') {
      const tsv = [headers.join('\t'), ...rows.map((r) => r.map((c) => String(c).replace(/\t|\n/g, ' ')).join('\t'))].join('\n');
      navigator.clipboard?.writeText(tsv).then(
        () => showToast('📋 সব ডাটা কপি হয়েছে — Excel/Google Sheet-এ পেস্ট করুন!'),
        () => showToast('কপি করা যায়নি, ডাউনলোড বাটন ব্যবহার করুন।')
      );
    }
  } catch (e) {
    showToast('ফাইল তৈরি করতে সমস্যা হয়েছে: ' + e.message);
  }
}

/* ==================== AUTHENTICITY VERIFICATION BANNER ==================== */
function renderAuthenticityBanner() {
  const sec = document.getElementById('authenticBannerSection');
  if (!sec) return;
  const s = AppState.storeState.settings || {};
  const enabled = s.authenticBannerEnabled !== false;
  sec.classList.toggle('hidden', !enabled);
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  };
  setTxt('authenticBannerBadge', s.authenticBannerBadge);
  setTxt('authenticBannerTitle', s.authenticBannerTitle);
  setTxt('authenticBannerSubtitle', s.authenticBannerSubtitle);
  setTxt('authenticBannerGuarantee', s.authenticBannerGuarantee);
  const cta = document.getElementById('authenticBannerCta');
  if (cta && s.authenticBannerCta) cta.textContent = s.authenticBannerCta;
  const img = document.getElementById('authenticBannerImg');
  if (img) {
    img.src = s.authenticBannerImage || 'images/authentic-verified-poster.jpg';
  }
}

/* ==================== DATA INITIALIZATION & MERGING ==================== */
async function initApp() {
  try {
    const savedCart = localStorage.getItem(STORAGE_CART_KEY);
    if (savedCart) AppState.cart = JSON.parse(savedCart);
    const savedWish = localStorage.getItem(STORAGE_WISHLIST_KEY);
    if (savedWish) AppState.wishlist = JSON.parse(savedWish);
  } catch (e) {}

  try {
    if (window.__EMBEDDED_CATALOG__) {
      AppState.baseCatalog = window.__EMBEDDED_CATALOG__;
    } else {
      const catRes = await fetch('/data/catalog.json');
      if (catRes.ok) {
        AppState.baseCatalog = await catRes.json();
      }
    }
  } catch (err) {
    console.error('Error loading base catalog:', err);
  }

  try {
    const staticRes = await fetch('/data/store-state.json?t=' + Date.now());
    if (staticRes.ok) {
      mergeIntoStoreState(await staticRes.json());
    }
  } catch (e) {}

  try {
    const apiRes = await fetch('/api/store');
    if (apiRes.ok) {
      mergeIntoStoreState(await apiRes.json());
    }
  } catch (e) {}

  await pullExternalCloudStateIfConfigured(false);
  await pullGitHubStateIfConfigured(false);

  try {
    const localRaw = localStorage.getItem(STORAGE_STATE_KEY);
    if (localRaw) {
      mergeIntoStoreState(JSON.parse(localRaw));
    }
  } catch (e) {}

  loadLocalPriceLocks();

  recomputeCatalog();
  renderAll();
  bindEvents();
  handleInitialUrlRouting();

  // Background live auto-sync with KC Bazar Skin Care updates
  if (AppState.storeState.settings.autoSyncKcBazar !== false) {
    autoSyncWithKcBazarLive(false, false);
    syncCatalogFromGitHubIfNewer(false);
  }
}

function mergeIntoStoreState(incoming) {
  if (!incoming || typeof incoming !== 'object') return;
  if (incoming.settings) {
    const incSet = { ...incoming.settings };
    if (!incSet.messengerLink || incSet.messengerLink.includes('m.me/KoreanMartCare') || incSet.messengerLink.includes('facebook.com/KoreanMartCare')) {
      incSet.messengerLink = 'https://www.facebook.com/share/1DkbSM7DHq/?mibextid=wwXIfr';
    }
    if (!incSet.instagramLink) {
      incSet.instagramLink = 'https://www.instagram.com/korean_mart_care?mdxt=ZDZkajRwaHMybmpk&utm_source=qr';
    }
    // Preserve existing uploaded logo if incoming has empty logoUrl
    if (!incSet.logoUrl && AppState.storeState.settings.logoUrl) {
      incSet.logoUrl = AppState.storeState.settings.logoUrl;
    }
    // Preserve custom fontFamily & fontSize if incoming doesn't specify them
    if (!incSet.fontFamily && AppState.storeState.settings.fontFamily) {
      incSet.fontFamily = AppState.storeState.settings.fontFamily;
    }
    if (!incSet.fontSize && AppState.storeState.settings.fontSize) {
      incSet.fontSize = AppState.storeState.settings.fontSize;
    }
    AppState.storeState.settings = { ...AppState.storeState.settings, ...incSet };
  }
  if (incoming.productOverrides) {
    AppState.storeState.productOverrides = { ...AppState.storeState.productOverrides, ...incoming.productOverrides };
  }
  if (incoming.priceLocks && typeof incoming.priceLocks === 'object') {
    const curLocks = AppState.storeState.priceLocks || {};
    for (const [lockId, incomingLock] of Object.entries(incoming.priceLocks)) {
      if (!incomingLock) continue;
      const existingLock = curLocks[lockId];
      const inAt = Number(incomingLock.lockedAt) || 0;
      const exAt = Number(existingLock?.lockedAt) || 0;
      if (!existingLock || inAt >= exAt) {
        curLocks[lockId] = {
          salePrice: Number(incomingLock.salePrice) || 0,
          regularPrice: Number(incomingLock.regularPrice) || 0,
          lockedAt: inAt || Date.now(),
          source: incomingLock.source || 'kcbazar_old_rate'
        };
      }
    }
    AppState.storeState.priceLocks = curLocks;
    persistPriceLocks();
  }
  if (Array.isArray(incoming.customProducts) && incoming.customProducts.length) {
    const existingIds = new Set(AppState.storeState.customProducts.map((p) => String(p.id)));
    for (const cp of incoming.customProducts) {
      if (!existingIds.has(String(cp.id))) {
        AppState.storeState.customProducts.push(cp);
      } else {
        AppState.storeState.customProducts = AppState.storeState.customProducts.map((p) =>
          String(p.id) === String(cp.id) ? cp : p
        );
      }
    }
  }
  if (Array.isArray(incoming.deletedProductIds)) {
    AppState.storeState.deletedProductIds = Array.from(
      new Set([...(AppState.storeState.deletedProductIds || []), ...incoming.deletedProductIds.map(String)])
    );
  }
  if (incoming.brandOverrides) {
    AppState.storeState.brandOverrides = { ...AppState.storeState.brandOverrides, ...incoming.brandOverrides };
  }
  if (Array.isArray(incoming.customBrands) && incoming.customBrands.length) {
    const existingSlugs = new Set(AppState.storeState.customBrands.map((b) => b.slug));
    for (const cb of incoming.customBrands) {
      if (!existingSlugs.has(cb.slug)) AppState.storeState.customBrands.push(cb);
    }
  }
  if (Array.isArray(incoming.orders) && incoming.orders.length) {
    const map = new Map();
    for (const o of [...incoming.orders, ...(AppState.storeState.orders || [])]) {
      if (o && o.id && !map.has(o.id)) map.set(o.id, o);
    }
    AppState.storeState.orders = Array.from(map.values());
  }
}

async function saveStoreState(toastText = 'পরিবর্তনগুলো লাইভ ওয়েবসাইটে সেভ হয়েছে!') {
  try {
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(AppState.storeState));
  } catch (e) {}
  persistPriceLocks();

  recomputeCatalog();
  renderAll();

  try {
    await fetch('/api/store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replaceFullState: AppState.storeState })
    });
  } catch (err) {}

  await pushExternalCloudStateIfConfigured();
  await pushGitHubStateIfConfigured();

  if (toastText) showToast(toastText);
}

function recomputeCatalog() {
  const deletedSet = new Set((AppState.storeState.deletedProductIds || []).map(String));
  const overrides = AppState.storeState.productOverrides || {};
  const customProds = AppState.storeState.customProducts || [];

  const mergedProducts = [];
  const seenIds = new Set();

  for (const cp of customProds) {
    const idStr = String(cp.id);
    if (deletedSet.has(idStr)) continue;
    const ov = overrides[idStr] || {};
    const prod = { ...cp, ...ov };
    applyPriceLockToProduct(prod, idStr);
    prod.regularPrice = Number(prod.regularPrice) || Number(prod.salePrice) || 0;
    prod.salePrice = Number(prod.salePrice) || prod.regularPrice;
    prod.discountPercent =
      prod.regularPrice > prod.salePrice && prod.regularPrice > 0
        ? Math.round(((prod.regularPrice - prod.salePrice) / prod.regularPrice) * 100)
        : 0;
    mergedProducts.push(prod);
    seenIds.add(idStr);
  }

  for (const bp of AppState.baseCatalog.products || []) {
    const idStr = String(bp.id);
    if (deletedSet.has(idStr) || seenIds.has(idStr)) continue;
    const ov = overrides[idStr] || {};
    const prod = {
      ...bp,
      ...ov,
      images: Array.isArray(ov.images) ? ov.images : [...(bp.images || [])]
    };
    applyPriceLockToProduct(prod, idStr);
    prod.regularPrice = Number(prod.regularPrice) || Number(prod.salePrice) || 0;
    prod.salePrice = Number(prod.salePrice) || prod.regularPrice;
    prod.discountPercent =
      prod.regularPrice > prod.salePrice && prod.regularPrice > 0
        ? Math.round(((prod.regularPrice - prod.salePrice) / prod.regularPrice) * 100)
        : 0;
    mergedProducts.push(prod);
    seenIds.add(idStr);
  }

  AppState.products = mergedProducts;

  const brandMap = new Map();
  for (const b of AppState.baseCatalog.brands || []) {
    brandMap.set(b.slug, { ...b, count: 0 });
  }
  for (const cb of AppState.storeState.customBrands || []) {
    brandMap.set(cb.slug, { ...cb, count: 0 });
  }
  for (const p of mergedProducts) {
    const bslug = p.brandSlug || slugify(p.brand || 'Korean Skincare');
    if (!brandMap.has(bslug)) {
      brandMap.set(bslug, {
        name: p.brand || 'Korean Skincare',
        slug: bslug,
        count: 0,
        logo: '',
        sampleImage: p.images?.[0] || '',
        featured: false
      });
    }
    const entry = brandMap.get(bslug);
    entry.count += 1;
    if (!entry.sampleImage && p.images?.[0]) entry.sampleImage = p.images[0];
  }

  const brandOverrides = AppState.storeState.brandOverrides || {};
  const finalBrands = [];
  for (const [slug, b] of brandMap.entries()) {
    if (slug === 'korean-skincare' || b.count === 0) continue;
    const bov = brandOverrides[slug] || {};
    finalBrands.push({ ...b, ...bov });
  }
  finalBrands.sort((a, b) => {
    if (a.slug === 'beauty-of-joseon') return -1;
    if (b.slug === 'beauty-of-joseon') return 1;
    return b.count - a.count;
  });
  AppState.brands = finalBrands;

  const catMap = new Map();
  for (const p of mergedProducts) {
    const cslug = p.primaryCategorySlug || slugify(p.primaryCategory || 'Skin Care');
    const cname = p.primaryCategory || 'Skin Care';
    if (!catMap.has(cslug)) {
      catMap.set(cslug, { name: cname, slug: cslug, count: 0 });
    }
    catMap.get(cslug).count += 1;
  }
  AppState.categories = Array.from(catMap.values()).sort((a, b) => b.count - a.count);
}

/* ==================== RENDERING FUNCTIONS ==================== */
function renderAll() {
  renderSiteBrandingAndSettings();
  renderAuthenticityBanner();
  renderTopCategoryNav();
  renderSideDrawerCategories();
  renderHeroSpotlight();
  renderBrandCollection();
  renderFilterSelects();
  renderProductsGrid();
  renderCartBadgeAndDrawer();
  renderWishlistBadge();
  renderFooterLists();
  if (AppState.isControlAppOpen) {
    renderAdminDashboard();
  }
}

function renderSiteBrandingAndSettings() {
  const s = AppState.storeState.settings;
  const deliveryFee = Number(s.deliveryCharge ?? 110);

  if (s.fontFamily) {
    document.documentElement.style.setProperty('--font-main', s.fontFamily);
    document.body.style.fontFamily = s.fontFamily;
  }
  if (s.fontSize) {
    document.documentElement.style.fontSize = s.fontSize;
  }

  document.title = `${s.siteName || 'Korean Mart Care'} | ${s.tagline || '100% Authentic Korean Skincare'}`;

  const annText =
    s.announcementText ||
    `✨ ${s.siteName || 'Korean Mart Care'} — ১০০% অথেনটিক কোরিয়ান স্কিনকেয়ার প্রোডাক্ট | অর্ডারের ২৪ ঘণ্টার মাঝে কনফার্মেশন এবং ২৪-৪৮ ঘণ্টার মাঝে সারা বাংলাদেশে হোম ডেলিভারি (ডেলিভারি চার্জ ৳${deliveryFee}) ✨`;
  const annPrimary = document.getElementById('announcementTextPrimary');
  const annDup = document.getElementById('announcementTextDuplicate');
  if (annPrimary) annPrimary.textContent = annText;
  if (annDup) annDup.textContent = annText;

  const defaultSvg = document.getElementById('defaultLogoSvg');
  const customImg = document.getElementById('customLogoImg');
  if (s.logoUrl && s.logoUrl.trim()) {
    defaultSvg?.classList.add('hidden');
    if (customImg) {
      customImg.src = s.logoUrl;
      customImg.classList.remove('hidden');
    }
  } else {
    defaultSvg?.classList.remove('hidden');
    customImg?.classList.add('hidden');
  }

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('headerSiteName', s.siteName || 'Korean Mart Care');
  setTxt('headerTagline', s.tagline || 'Authentic Korean Skincare');
  setTxt('heroHeading', s.heroTitle || 'Korean Mart Care — Original Skin Care Collection');
  setTxt('heroSubheading', s.heroSubtitle || '');
  setTxt('heroDeliveryBadgeTitle', `Delivery ৳${deliveryFee}`);
  setTxt('uniquenessStoreName', s.siteName || 'Korean Mart Care');
  setTxt('uniquenessDeliveryHeading', `✅ সারা বাংলাদেশে ৳${deliveryFee} টাকায় হোম ডেলিভারি`);
  setTxt(
    'uniquenessDeliveryDesc',
    `অর্ডারের ২৪ ঘণ্টার মধ্যে অর্ডার কনফার্মেশন এবং ২৪-৪৮ ঘণ্টার মধ্যে সারা বাংলাদেশে দ্রুত হোম ডেলিভারি (ডেলিভারি চার্জ মাত্র ৳${deliveryFee})।`
  );
  setTxt('drawerDeliveryChargeText', deliveryFee);
  setTxt('footerSiteName', s.siteName || 'Korean Mart Care');
  setTxt('footerCopyName', s.siteName || 'Korean Mart Care');
  setTxt('footerDeliveryCharge', `৳ ${deliveryFee}`);
  setTxt('adminHeaderSiteName', s.siteName || 'Korean Mart Care');
}

function renderTopCategoryNav() {
  const nav = document.getElementById('topCategoryNav');
  if (!nav) return;

  const topCats = AppState.categories.slice(0, 12);
  let html = `
    <button type="button" class="cat-nav-pill ${AppState.activeCategory === 'all' && !AppState.wishlistOnly ? 'active' : ''}" data-cat-slug="all">
      All Skin Care <span class="cat-nav-count">(${AppState.products.length})</span>
    </button>
  `;

  for (const c of topCats) {
    const isActive = AppState.activeCategory === c.slug && !AppState.wishlistOnly;
    html += `
      <button type="button" class="cat-nav-pill ${isActive ? 'active' : ''}" data-cat-slug="${escapeHtml(c.slug)}">
        ${escapeHtml(c.name)} <span class="cat-nav-count">(${c.count})</span>
      </button>
    `;
  }
  nav.innerHTML = html;
}

/* Render Left Slide-Out Drawer Menu (Exact Match to IMG_7789.png) */
function renderSideDrawerCategories() {
  const ul = document.getElementById('kcbDrawerCategoryList');
  if (!ul) return;

  const deliveryFee = Number(AppState.storeState.settings.deliveryCharge ?? 110);

  // Pink Line-Art SVG Icons matching KC Bazar's drawer
  const faceSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M9 10h.01M15 10h.01M9.5 15a3.5 3.5 0 0 0 5 0"/></svg>`;
  const dropSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`;
  const sunSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/></svg>`;
  const jarSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M6 4h12v4H6z"/></svg>`;
  const studentSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`;
  const giftSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/></svg>`;
  const stampSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M8 12l2.5 2.5L16 9"/></svg>`;
  const truckSvg = `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>`;

  const drawerItems = [
    {
      label: 'Shop Now',
      slug: 'all',
      icon: truckSvg,
      badge: `<span class="kcb-teal-delivery-badge">সারাদেশে ডেলিভারি চার্জ ৳${deliveryFee}!</span>`,
      chevron: false
    },
    { label: 'Skin Care', slug: 'all', icon: faceSvg, chevron: true },
    { label: 'Serum, Essence & Ampoule', slug: 'serum-essence-ampoule', icon: dropSvg, chevron: true },
    { label: 'Moisturizer & Cream', slug: 'moisturizer', icon: jarSvg, chevron: true },
    { label: 'Sunscreen & Sun Stick', slug: 'sunscreen', icon: sunSvg, chevron: true },
    { label: 'Cleanser & Foam', slug: 'cleanser', icon: faceSvg, chevron: true },
    { label: 'Toner & Toner Pads', slug: 'toner', icon: dropSvg, chevron: true },
    { label: 'Student Pack', slug: 'student-pack', icon: studentSvg, chevron: false },
    {
      label: 'Combo',
      slug: 'combo-set',
      icon: giftSvg,
      badge: `<span class="kcb-offer-red-badge">OFFER</span>`,
      chevron: false
    },
    { label: 'Trial Version', slug: 'trial-version', icon: stampSvg, chevron: false },
    { label: 'Sheet Mask', slug: 'sheet-mask', icon: faceSvg, chevron: false },
    { label: 'Soothing Gel', slug: 'soothing-gel', icon: jarSvg, chevron: true },
    { label: 'Melasma Solution', slug: 'melasma-solution', icon: dropSvg, chevron: true },
    { label: 'Cleansing Balm & Oil', slug: 'cleansing-balm', icon: jarSvg, chevron: true },
    { label: 'Scrubs & Exfoliants', slug: 'scrubs-exfoliants', icon: faceSvg, chevron: true }
  ];

  ul.innerHTML = drawerItems
    .map(
      (item) => `
      <li class="kcb-cat-row" data-cat-slug="${escapeHtml(item.slug)}">
        <div class="kcb-cat-link">
          <span class="kcb-pink-icon">${item.icon}</span>
          <span>${escapeHtml(item.label)}</span>
          ${item.badge || ''}
        </div>
        ${item.chevron ? `<div class="kcb-cat-chevron">›</div>` : ''}
      </li>
    `
    )
    .join('');
}

function renderHeroSpotlight() {
  const wrap = document.getElementById('heroSpotlightWrap');
  if (!wrap) return;

  const featured =
    AppState.products.find((p) => p.slug === 'beauty-of-joseon-matte-sun-stick') ||
    AppState.products[0];
  if (!featured) return;

  const mainImg = featured.images?.[0] || '';
  const hasDiscount = featured.regularPrice > featured.salePrice;

  wrap.innerHTML = `
    <div class="hero-spotlight-card">
      ${featured.discountPercent > 0 ? `<span class="spotlight-badge">-${featured.discountPercent}%</span>` : `<span class="spotlight-badge">HOT</span>`}
      <div class="spotlight-img-box" data-open-product="${escapeHtml(featured.slug)}" style="cursor:pointer;">
        <img src="${escapeHtml(mainImg)}" alt="${escapeHtml(featured.name)}" loading="eager" />
        ${featured.images.length > 1 ? `<span class="multi-photo-pill">📸 ${featured.images.length}</span>` : ''}
      </div>
      <div class="spotlight-info">
        <span class="spotlight-brand">${escapeHtml(featured.brand)}</span>
        <h3 data-open-product="${escapeHtml(featured.slug)}" style="cursor:pointer;">${escapeHtml(featured.name)}</h3>
        <div class="spotlight-price-row">
          ${hasDiscount ? `<del>${formatPrice(featured.regularPrice)}</del>` : ''}
          <strong>${formatPrice(featured.salePrice)}</strong>
        </div>
        <div class="spotlight-actions">
          <button type="button" class="btn-kcb-pink" style="padding:7px 12px; font-size:0.8rem;" data-add-cart="${featured.id}">
            Add To Cart
          </button>
          <button type="button" class="btn-kcb-green" style="padding:7px 12px; font-size:0.8rem;" data-buy-now="${featured.id}">
            Buy Now
          </button>
          <button type="button" class="btn-kcb-outline" style="padding:7px 10px; font-size:0.78rem;" data-open-product="${escapeHtml(featured.slug)}">
            Details
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderBrandCollection() {
  const track = document.getElementById('brandCardsTrack');
  const countSpan = document.getElementById('totalBrandsCount');
  const clearBtn = document.getElementById('clearBrandFilterBtn');
  if (countSpan) countSpan.textContent = AppState.brands.length;
  if (clearBtn) {
    clearBtn.style.display = AppState.activeBrand !== 'all' ? 'inline-flex' : 'none';
  }
  if (!track) return;

  const displayBrands = AppState.brands.slice(0, 28);
  track.innerHTML = displayBrands
    .map((b) => {
      const thumb = b.logo || b.sampleImage || '';
      const activeClass = AppState.activeBrand === b.slug ? 'active' : '';
      return `
        <div class="brand-card ${activeClass}" data-brand-slug="${escapeHtml(b.slug)}">
          <div class="brand-card-thumb">
            <img src="${escapeHtml(thumb)}" alt="${escapeHtml(b.name)}" loading="lazy" />
          </div>
          <div class="brand-card-name">${escapeHtml(b.name)}</div>
          <div class="brand-card-count">${b.count} Products</div>
        </div>
      `;
    })
    .join('');
}

function renderFilterSelects() {
  const catSelect = document.getElementById('categorySelectFilter');
  const brandSelect = document.getElementById('brandSelectFilter');

  if (catSelect) {
    catSelect.innerHTML =
      `<option value="all">All Skin Care (${AppState.products.length})</option>` +
      AppState.categories
        .map(
          (c) =>
            `<option value="${escapeHtml(c.slug)}" ${AppState.activeCategory === c.slug ? 'selected' : ''}>${escapeHtml(c.name)} (${c.count})</option>`
        )
        .join('');
  }

  if (brandSelect) {
    brandSelect.innerHTML =
      `<option value="all">All Brands (${AppState.brands.length})</option>` +
      AppState.brands
        .map(
          (b) =>
            `<option value="${escapeHtml(b.slug)}" ${AppState.activeBrand === b.slug ? 'selected' : ''}>${escapeHtml(b.name)} (${b.count})</option>`
        )
        .join('');
  }
}

function getFilteredProducts() {
  let list = [...AppState.products];

  if (AppState.wishlistOnly) {
    const wishSet = new Set(AppState.wishlist.map(String));
    list = list.filter((p) => wishSet.has(String(p.id)));
  }

  if (AppState.activeCategory !== 'all') {
    list = list.filter(
      (p) =>
        p.primaryCategorySlug === AppState.activeCategory ||
        (p.categories || []).some((c) => c.slug === AppState.activeCategory)
    );
  }

  if (AppState.activeBrand !== 'all') {
    list = list.filter((p) => p.brandSlug === AppState.activeBrand);
  }

  if (AppState.searchQuery.trim()) {
    const q = AppState.searchQuery.toLowerCase().trim();
    list = list.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.primaryCategory || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
    );
  }

  if (AppState.sortBy === 'price_asc') {
    list.sort((a, b) => a.salePrice - b.salePrice);
  } else if (AppState.sortBy === 'price_desc') {
    list.sort((a, b) => b.salePrice - a.salePrice);
  } else if (AppState.sortBy === 'discount') {
    list.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
  } else if (AppState.sortBy === 'multi_image') {
    list.sort((a, b) => (b.images?.length || 0) - (a.images?.length || 0));
  }

  return list;
}

function renderProductsGrid() {
  const grid = document.getElementById('productsGrid');
  const heading = document.getElementById('catalogDynamicHeading');
  const countText = document.getElementById('catalogCountText');
  const activeFiltersBar = document.getElementById('activeFiltersBar');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  const progressText = document.getElementById('paginationProgressText');

  if (!grid) return;

  const filtered = getFilteredProducts();
  const visible = filtered.slice(0, AppState.visibleCount);

  let titleText = 'All Korean Skin Care Products';
  if (AppState.wishlistOnly) {
    titleText = '❤️ Saved Skincare Wishlist';
  } else if (AppState.activeBrand !== 'all') {
    const bObj = AppState.brands.find((b) => b.slug === AppState.activeBrand);
    titleText = `${bObj ? bObj.name : AppState.activeBrand} — Skin Care`;
  } else if (AppState.activeCategory !== 'all') {
    const cObj = AppState.categories.find((c) => c.slug === AppState.activeCategory);
    titleText = `${cObj ? cObj.name : AppState.activeCategory} — Skin Care`;
  }
  if (heading) heading.textContent = titleText;
  if (countText) {
    countText.textContent = `Showing ${visible.length} of ${filtered.length} results • Delivery Charge ৳${AppState.storeState.settings.deliveryCharge ?? 110}`;
  }

  const chips = [];
  if (AppState.activeBrand !== 'all') {
    const bObj = AppState.brands.find((b) => b.slug === AppState.activeBrand);
    chips.push(
      `<span class="filter-chip">Brand: ${escapeHtml(bObj ? bObj.name : AppState.activeBrand)} <button type="button" data-clear-filter="brand">✕</button></span>`
    );
  }
  if (AppState.activeCategory !== 'all') {
    const cObj = AppState.categories.find((c) => c.slug === AppState.activeCategory);
    chips.push(
      `<span class="filter-chip">Category: ${escapeHtml(cObj ? cObj.name : AppState.activeCategory)} <button type="button" data-clear-filter="category">✕</button></span>`
    );
  }
  if (AppState.searchQuery.trim()) {
    chips.push(
      `<span class="filter-chip">Search: "${escapeHtml(AppState.searchQuery)}" <button type="button" data-clear-filter="search">✕</button></span>`
    );
  }
  if (AppState.wishlistOnly) {
    chips.push(
      `<span class="filter-chip">Wishlist <button type="button" data-clear-filter="wishlist">✕</button></span>`
    );
  }

  if (activeFiltersBar) {
    if (chips.length) {
      activeFiltersBar.classList.remove('hidden');
      activeFiltersBar.innerHTML =
        chips.join('') +
        `<button type="button" class="btn-kcb-outline" style="padding:3px 10px; font-size:0.76rem;" data-clear-filter="all">Clear All</button>`;
    } else {
      activeFiltersBar.classList.add('hidden');
      activeFiltersBar.innerHTML = '';
    }
  }

  if (visible.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding: 42px 20px; border:1px solid var(--border-light); border-radius:8px;">
        <h3 style="margin-bottom:8px;">কোনো প্রোডাক্ট পাওয়া যায়নি</h3>
        <button type="button" class="btn-kcb-pink" data-clear-filter="all">সব প্রোডাক্ট দেখুন</button>
      </div>
    `;
    loadMoreWrap?.classList.add('hidden');
    return;
  }

  const wishSet = new Set(AppState.wishlist.map(String));

  grid.innerHTML = visible
    .map((p) => {
      const images =
        p.images && p.images.length
          ? p.images
          : ['https://kcbazar.com/wp-content/uploads/2023/09/Beauty-Of-Joseon-Matte-Sun-Stick-Mugwort-Camelia-SPF-50-PA-18-g-2.jpg'];
      const hasMulti = images.length > 1;
      const hasDiscount = p.regularPrice > p.salePrice;
      const isWished = wishSet.has(String(p.id));

      const slidesHtml = images
        .map(
          (imgUrl, idx) => `
          <div class="card-slide" data-open-product="${escapeHtml(p.slug)}">
            <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(p.name)} - Image ${idx + 1}" loading="lazy" />
          </div>
        `
        )
        .join('');

      const dotsHtml = hasMulti
        ? `
          <div class="card-img-dots">
            ${images
              .slice(0, 6)
              .map(
                (_, idx) =>
                  `<button type="button" class="card-dot ${idx === 0 ? 'active' : ''}" data-card-dot="${idx}" aria-label="View image ${idx + 1}"></button>`
              )
              .join('')}
          </div>
          <span class="multi-photo-pill" data-card-counter>1/${images.length}</span>
        `
        : '';

      return `
        <article class="product-card" data-product-card="${p.id}">
          <div class="card-media-wrap">
            <div class="card-top-badges">
              ${p.discountPercent > 0 ? `<span class="discount-badge">-${p.discountPercent}%</span>` : ''}
              ${!p.inStock ? `<span class="out-stock-badge">Sold Out</span>` : ''}
            </div>

            <div class="card-floating-actions">
              <button type="button" class="icon-circle-btn ${isWished ? 'wishlisted' : ''}" data-toggle-wish="${p.id}" title="Wishlist">
                ${isWished ? '♥' : '♡'}
              </button>
              <button type="button" class="icon-circle-btn" data-share-product="${p.id}" title="Share Link">
                🔗
              </button>
            </div>

            <div class="card-image-scroller" data-card-scroller="${p.id}">
              ${slidesHtml}
            </div>

            ${
              hasMulti
                ? `
              <button type="button" class="card-img-arrow prev" data-card-scroll-dir="-1" aria-label="Previous image">‹</button>
              <button type="button" class="card-img-arrow next" data-card-scroll-dir="1" aria-label="Next image">›</button>
              ${dotsHtml}
            `
                : ''
            }
          </div>

          <div class="card-body">
            <div class="card-meta-row">
              <button type="button" class="card-brand-btn" data-brand-slug="${escapeHtml(p.brandSlug)}">
                ${escapeHtml(p.brand)}
              </button>
              <span class="card-cat-tag">${escapeHtml(p.primaryCategory)}</span>
            </div>

            <h3 class="card-title" data-open-product="${escapeHtml(p.slug)}" title="${escapeHtml(p.name)}">
              ${escapeHtml(p.name)}
            </h3>

            <div class="card-price-block">
              <div class="price-pair">
                ${hasDiscount ? `<span class="price-regular">${formatPrice(p.regularPrice)}</span>` : ''}
                <span class="price-sale">${formatPrice(p.salePrice)}</span>
              </div>
              ${p.soldCount > 0 ? `<span class="sold-count-tag">Sold: ${p.soldCount} pcs</span>` : ''}
            </div>

            <div class="card-cta-group">
              <button type="button" class="btn-card-cart" data-add-cart="${p.id}">
                Add To Cart
              </button>
              <button type="button" class="btn-buy-now" data-buy-now="${p.id}">
                Buy Now
              </button>
            </div>

          </div>
        </article>
      `;
    })
    .join('');

  grid.querySelectorAll('.card-image-scroller').forEach((scroller) => {
    scroller.addEventListener('scroll', () => {
      const card = scroller.closest('.product-card');
      if (!card) return;
      const w = scroller.clientWidth || 1;
      const idx = Math.round(scroller.scrollLeft / w);
      const total = scroller.querySelectorAll('.card-slide').length;
      const counter = card.querySelector('[data-card-counter]');
      if (counter) counter.textContent = `${Math.min(idx + 1, total)}/${total}`;
      card.querySelectorAll('.card-dot').forEach((dot, dIdx) => {
        dot.classList.toggle('active', dIdx === idx);
      });
    });
  });

  if (loadMoreWrap) {
    if (filtered.length > visible.length) {
      loadMoreWrap.classList.remove('hidden');
      if (progressText) {
        progressText.textContent = `Showing ${visible.length} of ${filtered.length} products`;
      }
    } else {
      loadMoreWrap.classList.add('hidden');
    }
  }
}

/* ==================== PRODUCT DETAIL MODAL (EXACT MATCH TO IMG_7790.png) ==================== */
function openProductDetailBySlugOrId(slugOrId) {
  const key = String(slugOrId).trim();
  const product = AppState.products.find((p) => p.slug === key || String(p.id) === key);
  if (!product) {
    showToast('প্রোডাক্টটি পাওয়া যায়নি!');
    return;
  }

  const modal = document.getElementById('productDetailModal');
  const body = document.getElementById('productDetailModalBody');
  if (!modal || !body) return;

  try {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('product');
    newUrl.pathname = `/product/${encodeURIComponent(product.slug)}`;
    window.history.replaceState({}, '', newUrl.toString());
  } catch (e) {}

  const images =
    product.images && product.images.length
      ? product.images
      : ['https://kcbazar.com/wp-content/uploads/2023/09/Beauty-Of-Joseon-Matte-Sun-Stick-Mugwort-Camelia-SPF-50-PA-18-g-2.jpg'];
  const hasMulti = images.length > 1;
  const hasDiscount = product.regularPrice > product.salePrice;
  const deliveryFee = Number(AppState.storeState.settings.deliveryCharge ?? 110);
  const shareUrl = getProductShareUrl(product);
  const siteName = AppState.storeState.settings.siteName || 'Korean Mart Care';

  const defaultDescHtml = `
    <h3>${escapeHtml(product.name)}</h3>
    <p><strong>Brand:</strong> ${escapeHtml(product.brand)} | <strong>Category:</strong> ${escapeHtml(product.primaryCategory)}</p>
    <p>দক্ষিণ কোরিয়া থেকে সরাসরি আমদানিকৃত ১০০% অথেনটিক স্কিনকেয়ার প্রোডাক্ট।</p>
  `;

  body.innerHTML = `
    <div class="pd-top-grid">
      <!-- Left: Main Image + Horizontal Thumbnail Strip with < and > arrows (Exact IMG_7790.png) -->
      <div class="pd-gallery-col">
        <div class="pd-main-slider-wrap">
          <div class="pd-main-scroller" id="pdMainScroller">
            ${images
              .map(
                (src, idx) => `
              <div class="pd-main-slide">
                <img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)} - Photo ${idx + 1}" />
              </div>
            `
              )
              .join('')}
          </div>
          ${
            hasMulti
              ? `
            <button type="button" class="pd-slider-arrow prev" id="pdSlidePrevBtn" aria-label="Previous image">‹</button>
            <button type="button" class="pd-slider-arrow next" id="pdSlideNextBtn" aria-label="Next image">›</button>
          `
              : ''
          }
        </div>

        ${
          hasMulti
            ? `
          <div class="pd-thumbs-carousel-row">
            <button type="button" class="carousel-arrow prev" id="pdThumbsPrev" aria-label="Previous thumbnails">‹</button>
            <div class="pd-thumbs-strip" id="pdThumbsStrip">
              ${images
                .map(
                  (src, idx) => `
                <button type="button" class="pd-thumb-btn ${idx === 0 ? 'active' : ''}" data-pd-thumb="${idx}">
                  <img src="${escapeHtml(src)}" alt="Thumbnail ${idx + 1}" />
                </button>
              `
                )
                .join('')}
            </div>
            <button type="button" class="carousel-arrow next" id="pdThumbsNext" aria-label="Next thumbnails">›</button>
          </div>
        `
            : ''
        }
      </div>

      <!-- Right: Breadcrumbs, Brand Box, Title, Pink Price, [- 1 + | Add To Cart | Buy Now], 2x2 Green Box (Exact IMG_7790.png) -->
      <div class="pd-info-col">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div class="pd-breadcrumb">
            Home / <span>Skin Care</span> / <span>${escapeHtml(product.primaryCategory)}</span>
          </div>
        </div>

        <!-- Clean Bordered Brand Logo Box (Like DABO box in IMG_7790.png) -->
        <div class="pd-brand-logo-box" data-brand-slug="${escapeHtml(product.brandSlug)}" title="View all ${escapeHtml(product.brand)} products">
          <strong>${escapeHtml(product.brand)}</strong>
        </div>

        <h1 class="pd-title">${escapeHtml(product.name)}</h1>

        <div class="pd-price-line">
          ${hasDiscount ? `<span class="pd-price-regular">${formatPrice(product.regularPrice)}</span>` : ''}
          <span class="pd-price-sale">${formatPrice(product.salePrice)}</span>
          ${product.soldCount > 0 ? `<span class="pd-sold-badge">Sold: ${product.soldCount} pcs</span>` : ''}
        </div>

        <!-- Single Horizontal Row: [- | 1 | +] + Pink [Add To Cart] + Green [Buy Now] (Exact IMG_7790.png) -->
        <div class="pd-kcb-action-row">
          <div class="kcb-qty-box">
            <button type="button" class="kcb-qty-btn" id="pdQtyMinus">-</button>
            <input type="number" id="pdQtyInput" class="kcb-qty-input" value="1" min="1" max="99" />
            <button type="button" class="kcb-qty-btn" id="pdQtyPlus">+</button>
          </div>

          <button type="button" class="pd-btn-add-cart" id="pdAddToCartBtn">
            Add To Cart
          </button>

          <button type="button" class="pd-btn-buy-now" id="pdBuyNowBtn">
            Buy Now
          </button>
        </div>

        <!-- 2x2 Light-Green Bordered Feature Box (Exact Match to IMG_7790.png, with Delivery ৳110 instead of Free Delivery) -->
        <div class="kcb-green-trust-box" style="margin-bottom:4px;">
          <div class="kcb-trust-item">
            <svg class="kcb-green-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="3"></rect>
              <path d="M9 3v6h6V3"></path>
            </svg>
            <span>We imported this</span>
          </div>
          <div class="kcb-trust-item">
            <svg class="kcb-green-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M9 12l2 2 4-4"></path>
            </svg>
            <span>100% Authentic</span>
          </div>
          <div class="kcb-trust-item">
            <svg class="kcb-green-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span>Delivery ৳${deliveryFee}</span>
          </div>
          <div class="kcb-trust-item">
            <svg class="kcb-green-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="3" width="15" height="13"></rect>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
              <circle cx="5.5" cy="18.5" r="2.5"></circle>
              <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
            <span>2-3 Days Delivery</span>
          </div>
        </div>

        <!-- Product Share Link Box -->
        <div class="pd-share-card">
          <div class="pd-share-header">
            <span>🔗 Product Share Link</span>
            <span>এক ক্লিকে কপি বা শেয়ার করুন</span>
          </div>
          <div class="pd-share-url-row">
            <input type="text" class="pd-share-url-input" id="pdShareUrlInput" value="${escapeHtml(shareUrl)}" readonly />
            <button type="button" class="btn-kcb-pink-sm" id="pdCopyShareUrlBtn">Copy Link</button>
          </div>
          <div class="pd-social-share-btns">
            <button type="button" class="share-pill-btn" data-social-share="instagram">📸 Instagram</button>
            <button type="button" class="share-pill-btn" data-social-share="facebook">🔵 Facebook</button>
            <button type="button" class="share-pill-btn" data-social-share="telegram">✈️ Telegram</button>
            <button type="button" class="share-pill-btn" data-social-share="native">📲 Share</button>
          </div>
        </div>

        <div class="pd-meta-list">
          ${product.sku ? `<span><strong>SKU:</strong> ${escapeHtml(product.sku)}</span>` : ''}
          <span><strong>Category:</strong> ${escapeHtml(product.primaryCategory)}</span>
          ${product.weight ? `<span><strong>Weight:</strong> ${escapeHtml(product.weight)}</span>` : ''}
        </div>
      </div>
    </div>

    <!-- Product Description, Additional Info & Delivery Tabs -->
    <div class="pd-tabs-section">
      <div class="pd-tabs-nav">
        <button type="button" class="pd-tab-btn active" data-pd-tab="desc">Description</button>
        <button type="button" class="pd-tab-btn" data-pd-tab="info">Additional information</button>
        <button type="button" class="pd-tab-btn" data-pd-tab="shipping">Shipping & Delivery (৳${deliveryFee})</button>
        <button type="button" class="pd-tab-btn" data-pd-tab="unique">Our Uniqueness</button>
      </div>

      <div class="pd-tab-content" id="pdTabDesc">
        ${product.description ? product.description : defaultDescHtml}
      </div>

      <div class="pd-tab-content hidden" id="pdTabInfo">
        <table class="pd-info-table">
          <tbody>
            <tr>
              <th>Brand</th>
              <td>${escapeHtml(product.brand)}</td>
            </tr>
            <tr>
              <th>Category</th>
              <td>Skin Care / ${escapeHtml(product.primaryCategory)}</td>
            </tr>
            ${product.weight ? `<tr><th>Weight</th><td>${escapeHtml(product.weight)}</td></tr>` : ''}
            ${product.sku ? `<tr><th>SKU</th><td>${escapeHtml(product.sku)}</td></tr>` : ''}
          </tbody>
        </table>
      </div>

      <div class="pd-tab-content hidden" id="pdTabShipping">
        <h3>Delivery Options Overview — ${escapeHtml(siteName)}</h3>
        <p>আমাদের ওয়েবসাইট থেকে অর্ডার করার পর ২৪ ঘণ্টার মাঝে Messenger/Instagram-এ অর্ডার কনফার্ম করা হবে। কনফার্ম হওয়ার ২৪-৪৮ ঘণ্টার মাঝে আপনি আপনার অর্ডারটি হাতে পেয়ে যাবেন।</p>
        <ul>
          <li><strong>হোম ডেলিভারি চার্জ:</strong> <strong>৳ ${deliveryFee} টাকা</strong> (সারা বাংলাদেশে হোম ডেলিভারি)।</li>
          <li><strong>ক্যাশ অন ডেলিভারি:</strong> পণ্য অর্ডারের সময় কোনো অগ্রিম চার্জ নিচ্ছি না। ডেলিভারি ম্যানের সামনেই পণ্য খুলে চেক করে রিসিভ করবেন।</li>
        </ul>
      </div>

      <div class="pd-tab-content hidden" id="pdTabUnique">
        <h3>কেন ${escapeHtml(siteName)} অনন্য?</h3>
        <ul>
          <li>সরাসরি দক্ষিণ কোরিয়া থেকে আমদানিকৃত ১০০% অরিজিনাল স্কিনকেয়ার প্রোডাক্ট।</li>
          <li>আমরা কোনো লোকাল সোর্সিং করি না, ফলে প্রতিটি পণ্যের অথেন্টিসিটি নিয়ে শতভাগ নিশ্চিন্ত থাকতে পারেন।</li>
        </ul>
      </div>
    </div>
  `;

  modal.classList.remove('hidden');

  // Wire up multi-image carousel & thumbnail strip inside Product Detail Modal
  const mainScroller = document.getElementById('pdMainScroller');
  const prevBtn = document.getElementById('pdSlidePrevBtn');
  const nextBtn = document.getElementById('pdSlideNextBtn');
  const thumbsStrip = document.getElementById('pdThumbsStrip');
  const thumbBtns = body.querySelectorAll('[data-pd-thumb]');

  const scrollToSlide = (idx) => {
    if (!mainScroller) return;
    const total = images.length;
    const target = ((idx % total) + total) % total;
    mainScroller.scrollTo({
      left: target * mainScroller.clientWidth,
      behavior: 'smooth'
    });
  };

  if (mainScroller) {
    mainScroller.addEventListener('scroll', () => {
      const w = mainScroller.clientWidth || 1;
      const idx = Math.round(mainScroller.scrollLeft / w);
      thumbBtns.forEach((btn, bIdx) => btn.classList.toggle('active', bIdx === idx));
    });
  }
  prevBtn?.addEventListener('click', () => {
    const w = mainScroller.clientWidth || 1;
    const cur = Math.round(mainScroller.scrollLeft / w);
    scrollToSlide(cur - 1);
  });
  nextBtn?.addEventListener('click', () => {
    const w = mainScroller.clientWidth || 1;
    const cur = Math.round(mainScroller.scrollLeft / w);
    scrollToSlide(cur + 1);
  });
  document.getElementById('pdThumbsPrev')?.addEventListener('click', () => {
    thumbsStrip?.scrollBy({ left: -180, behavior: 'smooth' });
  });
  document.getElementById('pdThumbsNext')?.addEventListener('click', () => {
    thumbsStrip?.scrollBy({ left: 180, behavior: 'smooth' });
  });
  thumbBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      scrollToSlide(Number(btn.getAttribute('data-pd-thumb')));
    });
  });

  // Quantity controls
  const qtyInput = document.getElementById('pdQtyInput');
  document.getElementById('pdQtyMinus')?.addEventListener('click', () => {
    qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
  });
  document.getElementById('pdQtyPlus')?.addEventListener('click', () => {
    qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1);
  });

  // Add To Cart & Buy Now
  document.getElementById('pdAddToCartBtn')?.addEventListener('click', () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    addToCart(product.id, qty, true);
  });
  document.getElementById('pdBuyNowBtn')?.addEventListener('click', () => {
    const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
    addToCart(product.id, qty, false);
    closeProductDetail();
    openCartDrawer(true);
  });

  // Share Link Copy & Social Share
  document.getElementById('pdCopyShareUrlBtn')?.addEventListener('click', () => {
    copyTextToClipboard(shareUrl, 'প্রোডাক্টের শেয়ার লিংক কপি হয়েছে!');
  });

  body.querySelectorAll('[data-social-share]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-social-share');
      const text = `${product.name} — ${formatPrice(product.salePrice)} at ${siteName}`;
      if (type === 'instagram') {
        copyTextToClipboard(shareUrl, 'লিঙ্ক কপি হয়েছে! Instagram ওপেন হচ্ছে...');
        const igLink = AppState.storeState.settings.instagramLink || 'https://www.instagram.com/korean_mart_care?mdxt=ZDZkajRwaHMybmpk&utm_source=qr';
        window.open(igLink, '_blank');
      } else if (type === 'facebook') {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, '_blank');
      } else if (type === 'telegram') {
        window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`, '_blank');
      } else if (type === 'native') {
        if (navigator.share) {
          navigator.share({ title: product.name, text, url: shareUrl }).catch(() => {});
        } else {
          copyTextToClipboard(shareUrl, 'প্রোডাক্টের শেয়ার লিংক কপি হয়েছে!');
        }
      }
    });
  });

  // Tabs switching
  body.querySelectorAll('[data-pd-tab]').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const target = tabBtn.getAttribute('data-pd-tab');
      body.querySelectorAll('[data-pd-tab]').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
      document.getElementById('pdTabDesc')?.classList.toggle('hidden', target !== 'desc');
      document.getElementById('pdTabInfo')?.classList.toggle('hidden', target !== 'info');
      document.getElementById('pdTabShipping')?.classList.toggle('hidden', target !== 'shipping');
      document.getElementById('pdTabUnique')?.classList.toggle('hidden', target !== 'unique');
    });
  });
}

function closeProductDetail() {
  document.getElementById('productDetailModal')?.classList.add('hidden');
  try {
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('product');
    if (newUrl.pathname.startsWith('/product/')) {
      newUrl.pathname = '/';
    }
    window.history.replaceState({}, '', newUrl.toString());
  } catch (e) {}
}

function copyTextToClipboard(text, successMsg = 'কপি হয়েছে!') {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => showToast(successMsg)).catch(() => fallbackCopy(text, successMsg));
  } else {
    fallbackCopy(text, successMsg);
  }
}

function fallbackCopy(text, successMsg) {
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast(successMsg);
  } catch (e) {}
  ta.remove();
}

/* ==================== CART, WISHLIST & ORDER CHECKOUT ==================== */
function addToCart(productId, qty = 1, showToastNotif = true) {
  const prod = AppState.products.find((p) => String(p.id) === String(productId));
  if (!prod) return;

  const existing = AppState.cart.find((item) => String(item.productId) === String(productId));
  if (existing) {
    existing.qty = Math.min(99, existing.qty + qty);
  } else {
    AppState.cart.push({ productId: prod.id, qty });
  }

  localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(AppState.cart));
  renderCartBadgeAndDrawer();
  if (showToastNotif) {
    showToast(`🛍️ "${prod.name.slice(0, 30)}..." কার্টে যোগ হয়েছে!`);
  }
}

function updateCartQty(productId, delta) {
  AppState.cart = AppState.cart
    .map((item) => {
      if (String(item.productId) === String(productId)) {
        return { ...item, qty: item.qty + delta };
      }
      return item;
    })
    .filter((item) => item.qty > 0);

  localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(AppState.cart));
  renderCartBadgeAndDrawer();
}

function renderCartBadgeAndDrawer() {
  const totalCount = AppState.cart.reduce((sum, i) => sum + (Number(i.qty) || 0), 0);
  const badge = document.getElementById('cartCountBadge');
  const mobBadge = document.getElementById('mobCartCount');
  if (badge) badge.textContent = totalCount;
  if (mobBadge) mobBadge.textContent = totalCount;

  const listEl = document.getElementById('cartItemsList');
  const subEl = document.getElementById('checkoutSubtotal');
  const delEl = document.getElementById('checkoutDeliveryFee');
  const grandEl = document.getElementById('checkoutGrandTotal');

  if (!listEl) return;

  const deliveryFee = Number(AppState.storeState.settings.deliveryCharge ?? 110);
  let subtotal = 0;

  const detailedItems = [];
  for (const ci of AppState.cart) {
    const prod = AppState.products.find((p) => String(p.id) === String(ci.productId));
    if (prod) {
      const lineTotal = prod.salePrice * ci.qty;
      subtotal += lineTotal;
      detailedItems.push({ prod, qty: ci.qty, lineTotal });
    }
  }

  if (detailedItems.length === 0) {
    listEl.innerHTML = `
      <div style="text-align:center; padding:22px 12px; background:#F9F9F9; border-radius:6px; color:var(--text-muted);">
        আপনার কার্ট খালি। যেকোনো প্রোডাক্টে <strong>Buy Now</strong> বা <strong>Add To Cart</strong> বাটনে ক্লিক করুন।
      </div>
    `;
  } else {
    listEl.innerHTML = detailedItems
      .map(
        ({ prod, qty, lineTotal }) => `
        <div class="cart-item-row">
          <img src="${escapeHtml(prod.images?.[0] || '')}" alt="${escapeHtml(prod.name)}" />
          <div>
            <div class="cart-item-title">${escapeHtml(prod.name)}</div>
            <div class="cart-item-price">${formatPrice(prod.salePrice)} × ${qty} = ${formatPrice(lineTotal)}</div>
          </div>
          <div class="cart-qty-mini">
            <button type="button" data-cart-delta="-1" data-cart-prod="${prod.id}">−</button>
            <span>${qty}</span>
            <button type="button" data-cart-delta="1" data-cart-prod="${prod.id}">+</button>
          </div>
        </div>
      `
      )
      .join('');
  }

  const grandTotal = detailedItems.length > 0 ? subtotal + deliveryFee : 0;
  if (subEl) subEl.textContent = formatPrice(subtotal);
  if (delEl) delEl.textContent = formatPrice(deliveryFee);
  if (grandEl) grandEl.textContent = formatPrice(grandTotal);
}

function openCartDrawer(focusForm = false) {
  const backdrop = document.getElementById('cartDrawerBackdrop');
  if (!backdrop) return;
  renderCartBadgeAndDrawer();
  backdrop.classList.remove('hidden');
  if (focusForm) {
    setTimeout(() => document.getElementById('orderCustomerName')?.focus(), 150);
  }
}

function closeCartDrawer() {
  document.getElementById('cartDrawerBackdrop')?.classList.add('hidden');
}

async function processOrderSubmission(channel = 'whatsapp') {
  if (AppState.cart.length === 0) {
    showToast('অর্ডার করার জন্য অন্তত ১টি প্রোডাক্ট কার্টে যোগ করুন!');
    return;
  }

  const name = document.getElementById('orderCustomerName')?.value.trim();
  const phone = document.getElementById('orderCustomerPhone')?.value.trim();
  const address = document.getElementById('orderCustomerAddress')?.value.trim();
  const note = document.getElementById('orderCustomerNote')?.value.trim();

  if (!name || !phone || !address) {
    showToast('অনুগ্রহ করে আপনার নাম, মোবাইল নাম্বার এবং সম্পূর্ণ ঠিকানা পূরণ করুন।');
    return;
  }

  const s = AppState.storeState.settings;
  const deliveryFee = Number(s.deliveryCharge ?? 110);
  let subtotal = 0;
  const orderItems = [];

  for (const ci of AppState.cart) {
    const prod = AppState.products.find((p) => String(p.id) === String(ci.productId));
    if (prod) {
      const lineTotal = prod.salePrice * ci.qty;
      subtotal += lineTotal;
      orderItems.push({
        id: prod.id,
        name: prod.name,
        sku: prod.sku || '',
        qty: ci.qty,
        price: prod.salePrice,
        lineTotal,
        shareUrl: getProductShareUrl(prod)
      });
    }
  }

  const totalPayable = subtotal + deliveryFee;
  const orderId = 'KMC-' + Date.now().toString().slice(-6);

  const newOrder = {
    id: orderId,
    createdAt: new Date().toISOString(),
    status: 'Pending',
    customerName: name,
    customerPhone: phone,
    customerAddress: address,
    customerNote: note,
    items: orderItems,
    subtotal,
    deliveryCharge: deliveryFee,
    totalPayable,
    channel
  };

  AppState.storeState.orders = [newOrder, ...(AppState.storeState.orders || [])];
  try {
    localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(AppState.storeState));
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newOrder)
    }).catch(() => {});
  } catch (e) {}

  const lines = [
    `🛍️ *NEW SKINCARE ORDER — ${s.siteName || 'Korean Mart Care'}*`,
    `Order ID: #${orderId}`,
    `────────────────────`,
    `👤 *Name:* ${name}`,
    `📞 *Phone:* ${phone}`,
    `📍 *Address:* ${address}`,
    note ? `📝 *Note:* ${note}` : null,
    `────────────────────`,
    `📦 *Ordered Products:*`,
    ...orderItems.map(
      (it, idx) =>
        `${idx + 1}. ${it.name}\n   Qty: ${it.qty} × ৳${it.price} = ৳${it.lineTotal}\n   Link: ${it.shareUrl}`
    ),
    `────────────────────`,
    `💵 Subtotal: ৳${subtotal}`,
    `🚚 Delivery Charge: ৳${deliveryFee}`,
    `✨ *Total Payable (COD): ৳${totalPayable}*`
  ].filter(Boolean);

  const messageText = lines.join('\n');

  AppState.cart = [];
  localStorage.setItem(STORAGE_CART_KEY, JSON.stringify(AppState.cart));
  renderCartBadgeAndDrawer();
  if (AppState.isControlAppOpen) renderAdminDashboard();

  if (channel === 'instagram') {
    copyTextToClipboard(messageText, 'অর্ডার ডিটেইলস কপি হয়েছে! Instagram ইনবক্সে পেস্ট করে পাঠিয়ে দিন।');
    const igLink = s.instagramLink || 'https://www.instagram.com/korean_mart_care?mdxt=ZDZkajRwaHMybmpk&utm_source=qr';
    setTimeout(() => window.open(igLink, '_blank'), 450);
  } else if (channel === 'messenger') {
    copyTextToClipboard(messageText, 'অর্ডার ডিটেইলস কপি হয়েছে! Facebook / Messenger-এ পেস্ট করে পাঠিয়ে দিন।');
    const msgLink = s.messengerLink || 'https://www.facebook.com/share/1DkbSM7DHq/?mibextid=wwXIfr';
    setTimeout(() => window.open(msgLink, '_blank'), 450);
  } else {
    showToast(`🎉 ধন্যবাদ ${name}! আপনার অর্ডার #${orderId} সফলভাবে গৃহীত হয়েছে।`);
  }

  closeCartDrawer();
}

function toggleWishlist(productId) {
  const idStr = String(productId);
  const idx = AppState.wishlist.map(String).indexOf(idStr);
  if (idx >= 0) {
    AppState.wishlist.splice(idx, 1);
    showToast('Wishlist থেকে সরানো হয়েছে');
  } else {
    AppState.wishlist.push(productId);
    showToast('❤️ Wishlist-এ সেভ করা হয়েছে!');
  }
  localStorage.setItem(STORAGE_WISHLIST_KEY, JSON.stringify(AppState.wishlist));
  renderWishlistBadge();
  renderProductsGrid();
}

function renderWishlistBadge() {
  const badge = document.getElementById('wishlistCountBadge');
  if (badge) badge.textContent = AppState.wishlist.length;
}


/* ==================== OWNER PIN GATE (পাবলিক থেকে Control App লুকানো) ==================== */
const ADMIN_UNLOCK_KEY = 'kmc_admin_unlock_v1';
const ADMIN_UNLOCK_HOURS = 12;

function kmcFallbackHash(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = (h1 ^ c) >>> 0;
    h1 = Math.imul(h1, 16777619) >>> 0;
    h2 = (h2 + c * (i + 7)) >>> 0;
    h2 = Math.imul(h2, 2654435761) >>> 0;
  }
  return ('f' + h1.toString(16) + h2.toString(16)).padStart(20, '0');
}

async function hashAdminPin(pin) {
  const text = 'kmc::' + String(pin || '').trim();
  try {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch (e) {}
  return kmcFallbackHash(text);
}

function adminUnlockIsValid() {
  try {
    const raw = localStorage.getItem(ADMIN_UNLOCK_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.at) return false;
    return Date.now() - Number(data.at) < ADMIN_UNLOCK_HOURS * 60 * 60 * 1000;
  } catch (e) {
    return false;
  }
}

function markAdminUnlocked() {
  try {
    localStorage.setItem(ADMIN_UNLOCK_KEY, JSON.stringify({ at: Date.now() }));
  } catch (e) {}
}

function lockAdminAgain(notify = true) {
  try {
    localStorage.removeItem(ADMIN_UNLOCK_KEY);
  } catch (e) {}
  toggleControlApp(false);
  if (notify) showToast('🔒 Control App আবার লক করা হয়েছে।');
}

function showAdminPinGate() {
  const gate = document.getElementById('adminPinGate');
  if (!gate) return;
  gate.classList.remove('hidden');
  const input = document.getElementById('adminPinGateInput');
  const err = document.getElementById('adminPinGateError');
  if (err) err.classList.add('hidden');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 80);
  }
}

function hideAdminPinGate() {
  document.getElementById('adminPinGate')?.classList.add('hidden');
}

async function verifyAdminPin(pin) {
  const s = AppState.storeState.settings || {};
  const entered = String(pin || '').trim();
  if (!entered) return false;

  // পুরনো পদ্ধতি: সেটিংসে সরাসরি PIN থাকলে
  if (s.adminPin && entered === String(s.adminPin).trim()) return true;

  const enteredHash = await hashAdminPin(entered);
  const enteredFallback = kmcFallbackHash('kmc::' + entered);

  // নতুন পদ্ধতি: হ্যাশ (SHA-256 অথবা fallback — যেটি মিলে যায়)
  if (s.adminPinHash && enteredHash === s.adminPinHash) return true;
  if (s.adminPinHashFallback && enteredFallback === s.adminPinHashFallback) return true;

  return false;
}

function requestControlApp() {
  if (adminUnlockIsValid()) {
    hideAdminPinGate();
    toggleControlApp(true);
    return;
  }
  showAdminPinGate();
}

async function setAdminPin(newPin) {
  const pin = String(newPin || '').trim();
  if (pin.length < 4) {
    showToast('⚠️ PIN কমপক্ষে ৪ ডিজিটের হতে হবে।');
    return false;
  }
  AppState.storeState.settings.adminPinHash = await hashAdminPin(pin);
  AppState.storeState.settings.adminPinHashFallback = kmcFallbackHash('kmc::' + pin);
  delete AppState.storeState.settings.adminPin;
  markAdminUnlocked();
  await saveStoreState('🔑 নতুন অ্যাডমিন PIN সেভ হয়েছে!');
  return true;
}

function initAdminPinGate() {
  const gate = document.getElementById('adminPinGate');
  if (!gate) return;

  const submit = async () => {
    const input = document.getElementById('adminPinGateInput');
    const err = document.getElementById('adminPinGateError');
    const ok = await verifyAdminPin(input?.value);
    if (!ok) {
      err?.classList.remove('hidden');
      if (input) {
        input.value = '';
        input.focus();
      }
      return;
    }
    markAdminUnlocked();
    hideAdminPinGate();
    toggleControlApp(true);
    showToast('✅ স্বাগতম! Control App আনলক হয়েছে।');
  };

  document.getElementById('adminPinGateSubmitBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    submit();
  });
  document.getElementById('adminPinGateCancelBtn')?.addEventListener('click', () => hideAdminPinGate());
  document.getElementById('adminPinGateInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  });
  gate.addEventListener('click', (e) => {
    if (e.target === gate) hideAdminPinGate();
  });

  // গোপন এন্ট্রি: লোগোতে ৫ বার দ্রুত ট্যাপ করলে PIN স্ক্রিন আসবে
  const logoArea = document.querySelector('.brand-logo-showcase-frame') || document.getElementById('headerLogoWrap');
  if (logoArea) {
    let taps = 0;
    let timer = null;
    logoArea.addEventListener('click', () => {
      taps++;
      clearTimeout(timer);
      timer = setTimeout(() => (taps = 0), 1200);
      if (taps >= 5) {
        taps = 0;
        requestControlApp();
      }
    });
  }

  document.getElementById('saveAdminPinBtn')?.addEventListener('click', async () => {
    const val = document.getElementById('adminPinInput')?.value.trim();
    if (!val) {
      showToast('আগে নতুন PIN লিখুন।');
      return;
    }
    const ok = await setAdminPin(val);
    const el = document.getElementById('adminPinInput');
    if (ok && el) el.value = '';
  });

  document.getElementById('lockAdminAppBtn')?.addEventListener('click', () => lockAdminAgain());
}

/* ==================== CONTROL APP (ADMIN PANEL) FUNCTIONS ==================== */
function toggleControlApp(forceOpen) {
  AppState.isControlAppOpen =
    typeof forceOpen === 'boolean' ? forceOpen : !AppState.isControlAppOpen;

  const storeView = document.getElementById('storefrontView');
  const adminView = document.getElementById('controlAppView');

  if (AppState.isControlAppOpen) {
    if (!adminUnlockIsValid() && forceOpen) {
      AppState.isControlAppOpen = false;
      showAdminPinGate();
      return;
    }
    storeView?.classList.add('hidden');
    adminView?.classList.remove('hidden');
    renderAdminDashboard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    adminView?.classList.add('hidden');
    storeView?.classList.remove('hidden');
  }
}

function renderAdminDashboard() {
  const s = AppState.storeState.settings;
  const setTxt = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };

  setTxt('statTotalProducts', AppState.products.length);
  setTxt('statTotalBrands', AppState.brands.length);
  setTxt('statDeliveryCharge', `৳ ${s.deliveryCharge ?? 110}`);
  setTxt('statTotalOrders', (AppState.storeState.orders || []).length);
  setTxt('adminTabOrderCount', (AppState.storeState.orders || []).length);

  const adminBrandSel = document.getElementById('adminBrandFilter');
  const adminCatSel = document.getElementById('adminCategoryFilter');
  if (adminBrandSel && adminBrandSel.options.length <= 1) {
    adminBrandSel.innerHTML =
      `<option value="all">সব ব্র্যান্ড (${AppState.brands.length})</option>` +
      AppState.brands.map((b) => `<option value="${escapeHtml(b.slug)}">${escapeHtml(b.name)} (${b.count})</option>`).join('');
  }
  if (adminCatSel && adminCatSel.options.length <= 1) {
    adminCatSel.innerHTML =
      `<option value="all">সব ক্যাটাগরি (${AppState.categories.length})</option>` +
      AppState.categories.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)} (${c.count})</option>`).join('');
  }

  const dl = document.getElementById('brandSuggestionsList');
  if (dl) {
    dl.innerHTML = AppState.brands.map((b) => `<option value="${escapeHtml(b.name)}"></option>`).join('');
  }

  const modeSel = document.getElementById('quickPriceRateModeSelect');
  if (modeSel) modeSel.value = s.priceRateMode || 'old_kcbazar';
  setTxt('priceLockStatsText', `🔒 ${priceLockCount()}টি প্রোডাক্টের দাম লক করা আছে`);

  const expBrand = document.getElementById('exportBrandFilter');
  const expCat = document.getElementById('exportCategoryFilter');
  if (expBrand && expBrand.options.length <= 1) {
    expBrand.innerHTML =
      `<option value="all">সব ব্র্যান্ড (${AppState.brands.length})</option>` +
      AppState.brands.map((b) => `<option value="${escapeHtml(b.slug)}">${escapeHtml(b.name)}</option>`).join('');
  }
  if (expCat && expCat.options.length <= 1) {
    expCat.innerHTML =
      `<option value="all">সব ক্যাটাগরি (${AppState.categories.length})</option>` +
      AppState.categories.map((c) => `<option value="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</option>`).join('');
  }
  renderExportPreview();

  renderAdminProductsList();
  renderAdminBrandingForm();
  renderAdminBrandsGrid();
  renderAdminOrdersList();
  renderAuthenticityBannerAdminForm();
}

function renderAdminProductsList() {
  const listEl = document.getElementById('adminProductsList');
  const loadMoreBtn = document.getElementById('adminLoadMoreProductsBtn');
  if (!listEl) return;

  const q = (document.getElementById('adminProductSearch')?.value || '').toLowerCase().trim();
  const bFilter = document.getElementById('adminBrandFilter')?.value || 'all';
  const cFilter = document.getElementById('adminCategoryFilter')?.value || 'all';

  let filtered = AppState.products.filter((p) => {
    if (bFilter !== 'all' && p.brandSlug !== bFilter) return false;
    if (cFilter !== 'all' && p.primaryCategorySlug !== cFilter) return false;
    if (q) {
      return (
        (p.name || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const visible = filtered.slice(0, AppState.adminVisibleCount);
  if (loadMoreBtn) {
    loadMoreBtn.style.display = filtered.length > visible.length ? 'inline-flex' : 'none';
  }

  listEl.innerHTML = visible
    .map((p) => {
      const thumb = p.images?.[0] || '';
      return `
        <div class="admin-prod-row">
          <img class="admin-prod-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(p.name)}" loading="lazy" />

          <div class="admin-prod-info">
            <h4>${escapeHtml(p.name)}</h4>
            <div class="admin-prod-sub">
              <span>🏷️ <strong>${escapeHtml(p.brand)}</strong></span>
              <span>📂 ${escapeHtml(p.primaryCategory)}</span>
              <span>📸 <strong>${(p.images || []).length}টি ছবি</strong></span>
            </div>
          </div>

          <div class="admin-quick-price-box">
            <label class="quick-price-field">
              Sale Price (৳)
              <input type="number" value="${p.salePrice}" data-inline-sale="${p.id}" />
            </label>
            <label class="quick-price-field">
              Regular (৳)
              <input type="number" value="${p.regularPrice}" data-inline-reg="${p.id}" />
            </label>
            <button type="button" class="btn-kcb-green" style="padding:7px 11px; font-size:0.78rem;" data-save-inline-price="${p.id}">
              💾 দাম সেভ
            </button>
            <div class="price-lock-chip ${p.priceLocked ? 'locked' : ''}">
              ${p.priceLocked
                ? `🔒 লক করা দাম • <button type="button" class="unlock-price-btn" data-unlock-price="${p.id}">আনলক</button>`
                : '🔓 KC Bazar রেট'}
            </div>
          </div>

          <div class="admin-prod-actions">
            <button type="button" class="btn-kcb-pink-sm" data-admin-edit-prod="${p.id}">
              📸 ছবি ও এডিট
            </button>
            <button type="button" class="btn-kcb-outline" style="padding:6px 10px;" data-admin-del-prod="${p.id}">
              🗑️
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderAdminBrandingForm() {
  const s = AppState.storeState.settings;
  const previewImg = document.getElementById('adminLogoPreviewImg');
  const placeholder = document.getElementById('adminLogoDefaultPlaceholder');
  const quickPreviewImg = document.getElementById('quickLogoPreviewImg');
  const quickPlaceholder = document.getElementById('quickLogoDefaultBadge');
  const urlInput = document.getElementById('logoUrlInput');

  if (s.logoUrl && s.logoUrl.trim()) {
    if (previewImg) {
      previewImg.src = s.logoUrl;
      previewImg.classList.remove('hidden');
    }
    placeholder?.classList.add('hidden');
    if (quickPreviewImg) {
      quickPreviewImg.src = s.logoUrl;
      quickPreviewImg.classList.remove('hidden');
    }
    quickPlaceholder?.classList.add('hidden');
    if (urlInput) urlInput.value = s.logoUrl.startsWith('data:') ? '' : s.logoUrl;
  } else {
    previewImg?.classList.add('hidden');
    placeholder?.classList.remove('hidden');
    quickPreviewImg?.classList.add('hidden');
    quickPlaceholder?.classList.remove('hidden');
    if (urlInput) urlInput.value = '';
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };

  setVal('settingSiteName', s.siteName || 'Korean Mart Care');
  setVal('settingTagline', s.tagline || '');
  setVal('settingDeliveryCharge', s.deliveryCharge ?? 110);
  setVal('quickDeliveryChargeInput', s.deliveryCharge ?? 110);
  setVal('settingFontFamily', s.fontFamily || "'Jost', 'Hind Siliguri', sans-serif");
  setVal('quickFontFamilySelect', s.fontFamily || "'Jost', 'Hind Siliguri', sans-serif");
  setVal('settingFontSize', s.fontSize || '100%');
  setVal('quickFontSizeSelect', s.fontSize || '100%');
  setVal('settingInstagramLink', s.instagramLink || 'https://www.instagram.com/korean_mart_care?mdxt=ZDZkajRwaHMybmpk&utm_source=qr');
  setVal('settingMessengerLink', s.messengerLink || 'https://www.facebook.com/share/1DkbSM7DHq/?mibextid=wwXIfr');
  setVal('settingAnnouncementText', s.announcementText || '');
  setVal('quickAnnouncementInput', s.announcementText || '');
  setVal('settingHeroTitle', s.heroTitle || '');
  setVal('settingHeroSubtitle', s.heroSubtitle || '');

  try {
    const rawGh = localStorage.getItem(STORAGE_GITHUB_CFG_KEY);
    if (rawGh) {
      const gh = JSON.parse(rawGh);
      if (gh.token) setVal('quickGithubTokenInput', gh.token);
    }
  } catch (e) {}
}

function renderAdminBrandsGrid() {
  const grid = document.getElementById('adminBrandsGrid');
  if (!grid) return;

  grid.innerHTML = AppState.brands
    .slice(0, 48)
    .map((b) => {
      const thumb = b.logo || b.sampleImage || '';
      return `
        <div class="brand-card" style="cursor:default;">
          <div class="brand-card-thumb">
            <img src="${escapeHtml(thumb)}" alt="${escapeHtml(b.name)}" loading="lazy" />
          </div>
          <div class="brand-card-name">${escapeHtml(b.name)}</div>
          <div class="brand-card-count">${b.count} Products</div>
          <label class="btn-kcb-outline file-upload-label" style="margin-top:8px; width:100%; font-size:0.75rem; padding:5px;">
            <input type="file" accept="image/*" data-brand-logo-upload="${escapeHtml(b.slug)}" hidden />
            📤 ব্র্যান্ড লোগো
          </label>
        </div>
      `;
    })
    .join('');
}

function renderAdminOrdersList() {
  const container = document.getElementById('adminOrdersContainer');
  if (!container) return;

  const orders = AppState.storeState.orders || [];
  if (orders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:32px 16px; color:var(--text-muted);">
        এখনো কোনো অর্ডার আসেনি।
      </div>
    `;
    return;
  }

  container.innerHTML = orders
    .map((o) => {
      const dateStr = o.createdAt ? new Date(o.createdAt).toLocaleString('bn-BD') : '';
      const cleanWa = String(o.customerPhone || '').replace(/[^0-9]/g, '');
      const waPhone = cleanWa.startsWith('88') ? cleanWa : '88' + cleanWa;

      return `
        <div style="border:1px solid var(--border-light); border-radius:8px; padding:14px; margin-bottom:10px;">
          <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:8px; border-bottom:1px solid var(--border-light); padding-bottom:8px;">
            <div>
              <strong>Order #${escapeHtml(o.id)}</strong> • <span style="color:var(--text-muted); font-size:0.8rem;">${escapeHtml(dateStr)}</span>
              <div>👤 <strong>${escapeHtml(o.customerName)}</strong> | 📞 ${escapeHtml(o.customerPhone)}</div>
              <div style="font-size:0.83rem; color:#555;">📍 ঠিকানা: ${escapeHtml(o.customerAddress)}</div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <select class="admin-select" style="width:auto;" data-order-status-select="${escapeHtml(o.id)}">
                ${['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled']
                  .map((st) => `<option value="${st}" ${o.status === st ? 'selected' : ''}>${st}</option>`)
                  .join('')}
              </select>
              <a href="https://wa.me/${waPhone}" target="_blank" rel="noopener" class="btn-kcb-green" style="padding:6px 12px; font-size:0.8rem;">
                💬 কাস্টমারের WhatsApp
              </a>
            </div>
          </div>
          <div style="font-size:0.85rem; margin-bottom:6px;">
            ${(o.items || [])
              .map(
                (it) =>
                  `<div>• ${escapeHtml(it.name)} — <strong>${it.qty} × ${formatPrice(it.price)} = ${formatPrice(it.lineTotal)}</strong></div>`
              )
              .join('')}
          </div>
          <div style="font-weight:700; color:var(--kcb-pink);">
            Subtotal: ${formatPrice(o.subtotal)} + ডেলিভারি: ${formatPrice(o.deliveryCharge)} = সর্বমোট: ${formatPrice(o.totalPayable)}
          </div>
        </div>
      `;
    })
    .join('');
}

function openAdminProductEditor(productId = null) {
  const modal = document.getElementById('adminEditProductModal');
  const titleEl = document.getElementById('adminEditModalTitle');
  const delBtn = document.getElementById('deleteProductFromModalBtn');
  if (!modal) return;

  let prod = null;
  if (productId !== null && productId !== undefined) {
    prod = AppState.products.find((p) => String(p.id) === String(productId));
  }

  if (prod) {
    if (titleEl) titleEl.textContent = `✏️ এডিট প্রোডাক্ট: ${prod.name.slice(0, 42)}...`;
    document.getElementById('editProdId').value = prod.id;
    document.getElementById('editProdName').value = prod.name || '';
    document.getElementById('editProdBrand').value = prod.brand || '';
    document.getElementById('editProdSalePrice').value = prod.salePrice || '';
    document.getElementById('editProdRegularPrice').value = prod.regularPrice || prod.salePrice || '';
    document.getElementById('editProdInStock').value = prod.inStock !== false ? 'true' : 'false';
    document.getElementById('editProdCategory').value = prod.primaryCategory || 'Skin Care';
    document.getElementById('editProdWeight').value = prod.weight || '';
    document.getElementById('editProdSku').value = prod.sku || '';
    document.getElementById('editProdDescription').value = prod.description || '';
    AppState.editingImages = [...(prod.images || [])];
    if (delBtn) delBtn.style.display = 'inline-flex';
  } else {
    if (titleEl) titleEl.textContent = '➕ নতুন স্কিনকেয়ার প্রোডাক্ট যোগ করুন';
    document.getElementById('editProdId').value = '';
    document.getElementById('editProdName').value = '';
    document.getElementById('editProdBrand').value = 'Beauty of Joseon';
    document.getElementById('editProdSalePrice').value = '';
    document.getElementById('editProdRegularPrice').value = '';
    document.getElementById('editProdInStock').value = 'true';
    document.getElementById('editProdCategory').value = 'Sunscreen';
    document.getElementById('editProdWeight').value = '';
    document.getElementById('editProdSku').value = '';
    document.getElementById('editProdDescription').value = '';
    AppState.editingImages = [];
    if (delBtn) delBtn.style.display = 'none';
  }

  renderEditingImagesGrid();
  modal.classList.remove('hidden');
}

function renderEditingImagesGrid() {
  const grid = document.getElementById('editProdImagesList');
  if (!grid) return;

  if (AppState.editingImages.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align:center; padding:16px; color:var(--text-muted); font-size:0.84rem;">
        কোনো ছবি নেই। উপরে <strong>📤 নতুন ছবি আপলোড করুন</strong> বাটনে ক্লিক করে ছবি যোগ করুন।
      </div>
    `;
    return;
  }

  grid.innerHTML = AppState.editingImages
    .map(
      (src, idx) => `
      <div class="edit-img-card">
        ${idx === 0 ? `<span class="edit-img-badge">Main</span>` : `<span class="edit-img-badge" style="background:#333;">#${idx + 1}</span>`}
        <img src="${escapeHtml(src)}" alt="Product Image ${idx + 1}" />
        <div class="edit-img-actions">
          ${idx > 0 ? `<button type="button" class="btn-main-img" data-make-main-img="${idx}">⭐ Main</button>` : ''}
          <button type="button" class="btn-del-img" data-delete-edit-img="${idx}">🗑️ Delete</button>
        </div>
      </div>
    `
    )
    .join('');
}

function renderFooterLists() {
  const fb = document.getElementById('footerBrandsList');
  const fc = document.getElementById('footerCategoriesList');

  if (fb) {
    fb.innerHTML = AppState.brands
      .slice(0, 7)
      .map(
        (b) =>
          `<li><button type="button" class="footer-link-btn" data-brand-slug="${escapeHtml(b.slug)}">${escapeHtml(b.name)} (${b.count})</button></li>`
      )
      .join('');
  }

  if (fc) {
    fc.innerHTML = AppState.categories
      .slice(0, 7)
      .map(
        (c) =>
          `<li><button type="button" class="footer-link-btn" data-cat-slug="${escapeHtml(c.slug)}">${escapeHtml(c.name)} (${c.count})</button></li>`
      )
      .join('');
  }
}

async function pullExternalCloudStateIfConfigured(notify = false) {
  try {
    const rawCfg = localStorage.getItem(STORAGE_CLOUD_CFG_KEY);
    if (!rawCfg) return;
    const { url, apiKey } = JSON.parse(rawCfg);
    if (!url) return;

    const inputUrl = document.getElementById('cloudBinUrlInput');
    const inputKey = document.getElementById('cloudApiKeyInput');
    if (inputUrl) inputUrl.value = url;
    if (inputKey && apiKey) inputKey.value = apiKey;

    const headers = { Accept: 'application/json' };
    if (apiKey) headers['X-Master-Key'] = apiKey;

    const res = await fetch(url, { headers });
    if (res.ok) {
      const json = await res.json();
      mergeIntoStoreState(json.record || json);
      recomputeCatalog();
      renderAll();
      if (notify) showToast('☁️ ক্লাউড থেকে লেটেস্ট ডাটা সিঙ্ক হয়েছে!');
    }
  } catch (e) {
    if (notify) showToast('ক্লাউড সিঙ্ক থেকে ডাটা আনতে সমস্যা হয়েছে।');
  }
}

async function pushExternalCloudStateIfConfigured() {
  try {
    const rawCfg = localStorage.getItem(STORAGE_CLOUD_CFG_KEY);
    if (!rawCfg) return;
    const { url, apiKey } = JSON.parse(rawCfg);
    if (!url) return;

    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-Master-Key'] = apiKey;

    if (url.includes('/api/store')) {
      await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ replaceFullState: AppState.storeState })
      });
    } else {
      await fetch(url, {
        method: 'PUT',
        headers,
        body: JSON.stringify(AppState.storeState)
      });
    }
  } catch (e) {}
}

async function pullGitHubStateIfConfigured(notify = false) {
  try {
    const rawCfg = localStorage.getItem(STORAGE_GITHUB_CFG_KEY);
    const parsedCfg = rawCfg ? JSON.parse(rawCfg) : {};
    const repo = parsedCfg.repo || 'neetu27886/korean-mart-care';
    const branch = parsedCfg.branch || 'main';
    const token = parsedCfg.token || '';

    const repoInput = document.getElementById('githubRepoInput');
    const branchInput = document.getElementById('githubBranchInput');
    const tokenInput = document.getElementById('githubTokenInput');
    if (repoInput) repoInput.value = repo;
    if (branchInput) branchInput.value = branch;
    if (tokenInput && token) tokenInput.value = token;

    const headers = { Accept: 'application/vnd.github.v3+json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    // Try public/data/store-state.json first, then data/store-state.json
    for (const filePath of ['public/data/store-state.json', 'data/store-state.json']) {
      const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`;
      const res = await fetch(apiUrl, { headers });
      if (res.ok) {
        const meta = await res.json();
        if (meta && meta.content) {
          const decoded = decodeURIComponent(escape(atob(meta.content.replace(/\s/g, ''))));
          mergeIntoStoreState(JSON.parse(decoded));
          recomputeCatalog();
          renderAll();
          if (notify) showToast('🐙 GitHub থেকে লেটেস্ট ডাটা সফলভাবে সিঙ্ক হয়েছে!');
          return;
        }
      }
    }
    // Fallback: raw.githubusercontent.com (API rate-limit নেই) — দাম/লোগো/সেটিংস সবসময় লোড হবে
    try {
      const rawBase = `https://raw.githubusercontent.com/${repo}/${branch || 'main'}/`;
      for (const rawPath of ['public/data/store-state.json', 'data/store-state.json']) {
        const rawRes = await fetch(rawBase + rawPath + '?t=' + Math.floor(Date.now() / 60000));
        if (rawRes.ok) {
          const rawText = await rawRes.text();
          mergeIntoStoreState(JSON.parse(rawText));
          recomputeCatalog();
          renderAll();
          return;
        }
      }
    } catch (err) {}
    if (notify) showToast('GitHub Repo-তে store-state.json পাওয়া যায়নি। প্রথমে পুশ করুন।');
  } catch (e) {
    if (notify) showToast('GitHub থেকে ডাটা আনতে সমস্যা হয়েছে।');
  }
}

async function pushGitHubStateIfConfigured(notifySuccess = false) {
  try {
    const rawCfg = localStorage.getItem(STORAGE_GITHUB_CFG_KEY);
    if (!rawCfg) return;
    const { repo, branch = 'main', token } = JSON.parse(rawCfg);
    if (!repo || !token) return;

    const headers = {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    };

    const jsonStr = JSON.stringify(AppState.storeState, null, 2);
    const contentBase64 = btoa(unescape(encodeURIComponent(jsonStr)));

    let targetPath = 'public/data/store-state.json';
    let sha = undefined;

    for (const candidate of ['public/data/store-state.json', 'data/store-state.json']) {
      const checkRes = await fetch(
        `https://api.github.com/repos/${repo}/contents/${candidate}?ref=${encodeURIComponent(branch || 'main')}`,
        { headers }
      );
      if (checkRes.ok) {
        const fileData = await checkRes.json();
        targetPath = candidate;
        sha = fileData.sha;
        break;
      }
    }

    const bodyPayload = {
      message: `Update Korean Mart Care store state via Control App (${new Date().toISOString()})`,
      content: contentBase64,
      branch: branch || 'main'
    };
    if (sha) bodyPayload.sha = sha;

    const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${targetPath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(bodyPayload)
    });

    if (putRes.ok && notifySuccess) {
      showToast('🐙 GitHub Repository ও Netlify-তে সফলভাবে লাইভ আপডেট হয়েছে!');
    } else if (!putRes.ok && notifySuccess) {
      const errJson = await putRes.json().catch(() => ({}));
      showToast(`GitHub Push Error: ${errJson.message || putRes.status}`);
    }
  } catch (e) {
    if (notifySuccess) showToast('GitHub-এ পুশ করতে সমস্যা হয়েছে। Repo ও Token চেক করুন।');
  }
}

/* GitHub Actions নতুন প্রোডাক্ট যোগ করলে Netlify build ছাড়াও সাইটে দেখাবে */
async function syncCatalogFromGitHubIfNewer(force = false) {
  const GH_CATALOG =
    'https://raw.githubusercontent.com/neetu27886/korean-mart-care/main/public/data/catalog.json';
  const CHECK_KEY = 'kmc_gh_catalog_check_v1';
  try {
    if (!force) {
      const last = Number(localStorage.getItem(CHECK_KEY) || 0);
      if (Date.now() - last < 3 * 60 * 60 * 1000) return 0;
    }
    const res = await fetch(GH_CATALOG + '?t=' + Math.floor(Date.now() / 3600000));
    if (!res.ok) return 0;
    const cat = await res.json();
    if (!cat || !Array.isArray(cat.products)) return 0;

    const existing = new Map((AppState.baseCatalog.products || []).map((p) => [String(p.id), p]));
    let added = 0;
    for (const p of cat.products) {
      const idStr = String(p.id);
      if (!existing.has(idStr)) {
        AppState.baseCatalog.products.push(p);
        existing.set(idStr, p);
        added++;
      } else {
        const old = existing.get(idStr);
        old.inStock = p.inStock;
        old.soldCount = p.soldCount || old.soldCount;
        if (Array.isArray(p.images) && p.images.length) old.images = p.images;
      }
    }
    if (Array.isArray(cat.brands) && cat.brands.length) {
      const haveBrands = new Set((AppState.baseCatalog.brands || []).map((b) => b.slug));
      for (const b of cat.brands) if (!haveBrands.has(b.slug)) AppState.baseCatalog.brands.push(b);
    }
    localStorage.setItem(CHECK_KEY, String(Date.now()));
    if (added) {
      recomputeCatalog();
      renderAll();
    }
    return added;
  } catch (e) {
    return 0;
  }
}

async function autoSyncWithKcBazarLive(fullSync = false, notifyUser = false) {
  const statusEl = document.getElementById('kcbAutoSyncStatusText');
  const toggleEl = document.getElementById('toggleKcbAutoSyncCheckbox');
  if (toggleEl) {
    toggleEl.checked = AppState.storeState.settings.autoSyncKcBazar !== false;
  }

  if (notifyUser && statusEl) {
    statusEl.textContent = '⏳ KC Bazar ওয়েবসাইট থেকে নতুন প্রোডাক্ট ও দাম সিঙ্ক হচ্ছে...';
  }

  try {
    const endpoint = fullSync ? '/api/kcbazar-auto-sync?full=1&force=1' : '/api/kcbazar-auto-sync';
    let data = {};
    try {
      const res = await fetch(endpoint);
      if (res.ok) data = await res.json();
    } catch (apiErr) {}

    let liveItems = Array.isArray(data.products) ? data.products : [];
    let syncedAt = data.syncedAt;
    if (!liveItems.length) {
      // Netlify function unavailable হলে GitHub Actions-এর সর্বশেষ ক্যাটালগ ব্যবহার হবে
      try {
        const ghRes = await fetch(
          'https://raw.githubusercontent.com/neetu27886/korean-mart-care/main/public/data/catalog.json?t=' +
            Math.floor(Date.now() / 3600000)
        );
        if (ghRes.ok) {
          const ghCat = await ghRes.json();
          liveItems = Array.isArray(ghCat.products) ? ghCat.products : [];
          syncedAt = ghCat.lastSyncedAt;
        }
      } catch (ghErr) {}
    }
    if (!liveItems.length) return;

    const existingMap = new Map((AppState.baseCatalog.products || []).map((p) => [String(p.id), p]));
    let addedCount = 0;
    let updatedPriceCount = 0;
    let lockedCount = 0;

    const useNewKcBazarRate = AppState.storeState.settings.priceRateMode === 'new_kcbazar';

    for (const liveProd of liveItems) {
      const idStr = String(liveProd.id);
      const oldProd = existingMap.get(idStr);
      if (!oldProd) {
        AppState.baseCatalog.products.unshift(liveProd);
        existingMap.set(idStr, liveProd);
        addedCount++;
      } else {
        const hasLock = Boolean(priceLockOf(idStr));
        if (useNewKcBazarRate && !hasLock) {
          if (oldProd.salePrice !== liveProd.salePrice || oldProd.regularPrice !== liveProd.regularPrice) {
            updatedPriceCount++;
          }
          Object.assign(oldProd, {
            regularPrice: liveProd.regularPrice,
            salePrice: liveProd.salePrice,
            discountPercent: liveProd.discountPercent,
            inStock: liveProd.inStock,
            soldCount: liveProd.soldCount || oldProd.soldCount,
            images: liveProd.images?.length ? liveProd.images : oldProd.images
          });
        } else {
          // 🔒 Price lock active: KC Bazar-এর নতুন দাম আর কখনো আগের দামকে বদলাবে না
          if (hasLock) lockedCount++;
          Object.assign(oldProd, {
            inStock: liveProd.inStock,
            soldCount: liveProd.soldCount || oldProd.soldCount,
            images: liveProd.images?.length ? liveProd.images : oldProd.images
          });
        }
      }
    }

    recomputeCatalog();
    renderAll();

    const syncTime = new Date(syncedAt || Date.now()).toLocaleTimeString('bn-BD');
    if (statusEl) {
      statusEl.textContent = `✅ সর্বশেষ Auto-Sync: ${syncTime} (${liveItems.length}টি প্রোডাক্ট চেক — নতুন: ${addedCount}টি, দাম আপডেট: ${updatedPriceCount}টি, 🔒 লক করা দাম অপরিবর্তিত: ${lockedCount}টি)`;
    }
    if (notifyUser) {
      await saveStoreState(`🔄 KC Bazar Auto-Sync সম্পন্ন! (নতুন প্রোডাক্ট: ${addedCount}টি, দাম/স্টক আপডেট: ${updatedPriceCount}টি)`);
    }
  } catch (err) {
    if (notifyUser) {
      showToast('KC Bazar Auto-Sync করতে সমস্যা হয়েছে।');
    }
  }
}

function handleInitialUrlRouting() {
  const params = new URLSearchParams(window.location.search);
  let prodSlug = params.get('product');
  if (!prodSlug && window.location.pathname.startsWith('/product/')) {
    prodSlug = decodeURIComponent(window.location.pathname.replace(/^\/product\//, '').replace(/\/+$/, ''));
  }
  const appMode = params.get('app');

  if (appMode === 'admin' || window.location.hash === '#admin' || window.location.pathname === '/admin') {
    if (adminUnlockIsValid()) {
      toggleControlApp(true);
    } else {
      setTimeout(showAdminPinGate, 400);
    }
  }
  if (prodSlug) {
    openProductDetailBySlugOrId(prodSlug);
  }
}

/* ==================== EVENT BINDINGS ==================== */
function bindEvents() {
  // Left Slide-Out CATEGORIES | MENU Drawer
  const sideMenuBackdrop = document.getElementById('sideMenuBackdrop');
  const openSideMenu = () => sideMenuBackdrop?.classList.remove('hidden');
  const closeSideMenu = () => sideMenuBackdrop?.classList.add('hidden');

  document.getElementById('openSideMenuBtn')?.addEventListener('click', openSideMenu);
  document.getElementById('botNavMenu')?.addEventListener('click', openSideMenu);
  sideMenuBackdrop?.addEventListener('click', (e) => {
    if (e.target.id === 'sideMenuBackdrop') closeSideMenu();
  });

  // Switch between CATEGORIES and MENU tabs in Left Drawer
  document.querySelectorAll('[data-drawer-tab]').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const tab = tabBtn.getAttribute('data-drawer-tab');
      document.querySelectorAll('[data-drawer-tab]').forEach((b) => b.classList.remove('active'));
      tabBtn.classList.add('active');
      document.getElementById('drawerTabCategories')?.classList.toggle('hidden', tab !== 'categories');
      document.getElementById('drawerTabMenu')?.classList.toggle('hidden', tab !== 'menu');
    });
  });

  // Menu tab actions inside Left Drawer
  document.querySelectorAll('[data-menu-action]').forEach((row) => {
    row.addEventListener('click', () => {
      const act = row.getAttribute('data-menu-action');
      closeSideMenu();
      if (act === 'home') {
        toggleControlApp(false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (act === 'all-skincare') {
        AppState.activeCategory = 'all';
        AppState.activeBrand = 'all';
        toggleControlApp(false);
        renderAll();
        document.getElementById('catalogSection')?.scrollIntoView({ behavior: 'smooth' });
      } else if (act === 'brands') {
        document.getElementById('openBrandsModalBtn')?.click();
      } else if (act === 'featured-product') {
        openProductDetailBySlugOrId('beauty-of-joseon-matte-sun-stick');
      } else if (act === 'cart') {
        openCartDrawer(false);
      } else if (act === 'instagram') {
        const igLink = AppState.storeState.settings.instagramLink || 'https://www.instagram.com/korean_mart_care?mdxt=ZDZkajRwaHMybmpk&utm_source=qr';
        window.open(igLink, '_blank');
      } else if (act === 'messenger') {
        const msgLink = AppState.storeState.settings.messengerLink || 'https://www.facebook.com/share/1DkbSM7DHq/?mibextid=wwXIfr';
        window.open(msgLink, '_blank');
      }
    });
  });

  // Control App — শুধুমাত্র মালিকের জন্য (PIN দিয়ে সুরক্ষিত)
  initAdminPinGate();
  document.getElementById('backToStorefrontBtn')?.addEventListener('click', () => toggleControlApp(false));

  // Hero Featured Sun Stick button
  document.getElementById('heroFeaturedProductBtn')?.addEventListener('click', () => {
    openProductDetailBySlugOrId('beauty-of-joseon-matte-sun-stick');
  });

  // Brand Home Link resets filters
  document.getElementById('brandHomeLink')?.addEventListener('click', () => {
    AppState.activeBrand = 'all';
    AppState.activeCategory = 'all';
    AppState.searchQuery = '';
    AppState.wishlistOnly = false;
    toggleControlApp(false);
    renderAll();
  });

  // Global Search Input + Live Suggestions
  const searchInput = document.getElementById('globalSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const searchDropdown = document.getElementById('searchDropdown');

  searchInput?.addEventListener('input', () => {
    const val = searchInput.value;
    AppState.searchQuery = val;
    AppState.visibleCount = 24;
    clearSearchBtn?.classList.toggle('hidden', !val);
    renderProductsGrid();

    const q = val.toLowerCase().trim();
    if (!q) {
      searchDropdown?.classList.add('hidden');
      return;
    }

    const matches = AppState.products
      .filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q) ||
          (p.primaryCategory || '').toLowerCase().includes(q)
      )
      .slice(0, 8);

    if (searchDropdown) {
      if (matches.length === 0) {
        searchDropdown.classList.add('hidden');
      } else {
        searchDropdown.classList.remove('hidden');
        searchDropdown.innerHTML = matches
          .map(
            (m) => `
            <div class="search-suggestion-item" data-open-product="${escapeHtml(m.slug)}">
              <img src="${escapeHtml(m.images?.[0] || '')}" alt="${escapeHtml(m.name)}" />
              <div class="search-suggestion-meta">
                <div class="search-suggestion-title">${escapeHtml(m.name)}</div>
                <div class="search-suggestion-sub">${escapeHtml(m.brand)} • ${escapeHtml(m.primaryCategory)}</div>
              </div>
              <div class="search-suggestion-price">${formatPrice(m.salePrice)}</div>
            </div>
          `
          )
          .join('');
      }
    }
  });

  document.getElementById('searchSubmitBtn')?.addEventListener('click', () => {
    searchDropdown?.classList.add('hidden');
    document.getElementById('catalogSection')?.scrollIntoView({ behavior: 'smooth' });
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    AppState.searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    searchDropdown?.classList.add('hidden');
    renderProductsGrid();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.header-search-wrap')) {
      searchDropdown?.classList.add('hidden');
    }
  });

  // Brand Carousel Scroll Arrows
  const brandTrack = document.getElementById('brandCardsTrack');
  document.getElementById('brandScrollPrev')?.addEventListener('click', () => {
    brandTrack?.scrollBy({ left: -500, behavior: 'smooth' });
  });
  document.getElementById('brandScrollNext')?.addEventListener('click', () => {
    brandTrack?.scrollBy({ left: 500, behavior: 'smooth' });
  });
  document.getElementById('clearBrandFilterBtn')?.addEventListener('click', () => {
    AppState.activeBrand = 'all';
    renderAll();
  });

  // Toolbar Filter Selects
  document.getElementById('categorySelectFilter')?.addEventListener('change', (e) => {
    AppState.activeCategory = e.target.value;
    AppState.wishlistOnly = false;
    AppState.visibleCount = 24;
    renderAll();
  });

  document.getElementById('brandSelectFilter')?.addEventListener('change', (e) => {
    AppState.activeBrand = e.target.value;
    AppState.wishlistOnly = false;
    AppState.visibleCount = 24;
    renderAll();
  });

  document.getElementById('sortSelectFilter')?.addEventListener('change', (e) => {
    AppState.sortBy = e.target.value;
    renderProductsGrid();
  });

  document.getElementById('loadMoreBtn')?.addEventListener('click', () => {
    AppState.visibleCount += 24;
    renderProductsGrid();
  });

  document.getElementById('openWishlistBtn')?.addEventListener('click', () => {
    AppState.wishlistOnly = !AppState.wishlistOnly;
    toggleControlApp(false);
    renderAll();
    document.getElementById('catalogSection')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Cart Drawer Open / Close
  document.getElementById('openCartBtn')?.addEventListener('click', () => openCartDrawer(false));
  document.getElementById('footerOpenCartBtn')?.addEventListener('click', () => openCartDrawer(false));
  document.getElementById('closeCartDrawerBtn')?.addEventListener('click', closeCartDrawer);
  document.getElementById('cartDrawerBackdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'cartDrawerBackdrop') closeCartDrawer();
  });

  // Checkout Order Submissions
  document.getElementById('checkoutOrderForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    processOrderSubmission('messenger');
  });
  document.getElementById('orderViaInstagramBtn')?.addEventListener('click', () => {
    processOrderSubmission('instagram');
  });
  document.getElementById('orderDirectWebsiteBtn')?.addEventListener('click', () => {
    processOrderSubmission('website');
  });

  // Close Product Detail Modal
  document.getElementById('closeProductDetailModal')?.addEventListener('click', closeProductDetail);
  document.getElementById('productDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'productDetailModal') closeProductDetail();
  });

  // All Brands Modal
  const openAllBrandsModal = () => {
    const modal = document.getElementById('allBrandsModal');
    if (!modal) return;
    renderAllBrandsModalGrid('');
    modal.classList.remove('hidden');
  };
  document.getElementById('openBrandsModalBtn')?.addEventListener('click', openAllBrandsModal);
  document.getElementById('viewAllBrandsBtn')?.addEventListener('click', openAllBrandsModal);
  document.getElementById('closeAllBrandsModal')?.addEventListener('click', () => {
    document.getElementById('allBrandsModal')?.classList.add('hidden');
  });
  document.getElementById('brandModalSearchInput')?.addEventListener('input', (e) => {
    renderAllBrandsModalGrid(e.target.value);
  });

  // Sticky 5-Item Bottom Bar Events (Instagram, Messenger, Cart, My Account, Menu)
  document.getElementById('botNavInstagram')?.addEventListener('click', () => {
    const igLink = AppState.storeState.settings.instagramLink || 'https://www.instagram.com/korean_mart_care?mdxt=ZDZkajRwaHMybmpk&utm_source=qr';
    window.open(igLink, '_blank');
  });
  document.getElementById('botNavMessenger')?.addEventListener('click', () => {
    const msgLink = AppState.storeState.settings.messengerLink || 'https://www.facebook.com/share/1DkbSM7DHq/?mibextid=wwXIfr';
    window.open(msgLink, '_blank');
  });
  document.getElementById('botNavCart')?.addEventListener('click', () => openCartDrawer(false));
  document.getElementById('botNavAccount')?.addEventListener('click', () => openCartDrawer(true));

  // Delegated Click Events
  document.addEventListener('click', (e) => {
    const arrowBtn = e.target.closest('[data-card-scroll-dir]');
    if (arrowBtn) {
      e.stopPropagation();
      const dir = Number(arrowBtn.getAttribute('data-card-scroll-dir'));
      const card = arrowBtn.closest('.product-card');
      const scroller = card?.querySelector('.card-image-scroller');
      if (scroller) {
        const w = scroller.clientWidth || 240;
        const total = scroller.querySelectorAll('.card-slide').length;
        const cur = Math.round(scroller.scrollLeft / w);
        const next = ((cur + dir) % total + total) % total;
        scroller.scrollTo({ left: next * w, behavior: 'smooth' });
      }
      return;
    }

    const dotBtn = e.target.closest('[data-card-dot]');
    if (dotBtn) {
      e.stopPropagation();
      const idx = Number(dotBtn.getAttribute('data-card-dot'));
      const card = dotBtn.closest('.product-card');
      const scroller = card?.querySelector('.card-image-scroller');
      if (scroller) {
        scroller.scrollTo({ left: idx * scroller.clientWidth, behavior: 'smooth' });
      }
      return;
    }

    const openProdTrigger = e.target.closest('[data-open-product]');
    if (openProdTrigger) {
      const slug = openProdTrigger.getAttribute('data-open-product');
      searchDropdown?.classList.add('hidden');
      openProductDetailBySlugOrId(slug);
      return;
    }

    const buyNowBtn = e.target.closest('[data-buy-now]');
    if (buyNowBtn) {
      const pid = buyNowBtn.getAttribute('data-buy-now');
      addToCart(pid, 1, false);
      openCartDrawer(true);
      return;
    }

    const addCartBtn = e.target.closest('[data-add-cart]');
    if (addCartBtn) {
      const pid = addCartBtn.getAttribute('data-add-cart');
      addToCart(pid, 1, true);
      return;
    }

    const shareBtn = e.target.closest('[data-share-product]');
    if (shareBtn) {
      const pid = shareBtn.getAttribute('data-share-product');
      const prod = AppState.products.find((p) => String(p.id) === String(pid));
      if (prod) {
        copyTextToClipboard(getProductShareUrl(prod), `🔗 "${prod.name.slice(0, 28)}..." এর শেয়ার লিংক কপি হয়েছে!`);
      }
      return;
    }

    const wishBtn = e.target.closest('[data-toggle-wish]');
    if (wishBtn) {
      toggleWishlist(wishBtn.getAttribute('data-toggle-wish'));
      return;
    }

    const brandTrigger = e.target.closest('[data-brand-slug]');
    if (brandTrigger) {
      const bslug = brandTrigger.getAttribute('data-brand-slug');
      AppState.activeBrand = AppState.activeBrand === bslug ? 'all' : bslug;
      AppState.wishlistOnly = false;
      AppState.visibleCount = 24;
      document.getElementById('allBrandsModal')?.classList.add('hidden');
      closeProductDetail();
      closeSideMenu();
      toggleControlApp(false);
      renderAll();
      document.getElementById('catalogSection')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const catTrigger = e.target.closest('[data-cat-slug]');
    if (catTrigger) {
      AppState.activeCategory = catTrigger.getAttribute('data-cat-slug');
      AppState.wishlistOnly = false;
      AppState.visibleCount = 24;
      closeSideMenu();
      toggleControlApp(false);
      renderAll();
      document.getElementById('catalogSection')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const clearChip = e.target.closest('[data-clear-filter]');
    if (clearChip) {
      const type = clearChip.getAttribute('data-clear-filter');
      if (type === 'brand' || type === 'all') AppState.activeBrand = 'all';
      if (type === 'category' || type === 'all') AppState.activeCategory = 'all';
      if (type === 'wishlist' || type === 'all') AppState.wishlistOnly = false;
      if (type === 'search' || type === 'all') {
        AppState.searchQuery = '';
        if (searchInput) searchInput.value = '';
        clearSearchBtn?.classList.add('hidden');
      }
      renderAll();
      return;
    }

    const cartDeltaBtn = e.target.closest('[data-cart-delta]');
    if (cartDeltaBtn) {
      const pid = cartDeltaBtn.getAttribute('data-cart-prod');
      const delta = Number(cartDeltaBtn.getAttribute('data-cart-delta'));
      updateCartQty(pid, delta);
      return;
    }

    const adminEditBtn = e.target.closest('[data-admin-edit-prod]');
    if (adminEditBtn) {
      const pid = adminEditBtn.getAttribute('data-admin-edit-prod');
      closeProductDetail();
      openAdminProductEditor(pid);
      return;
    }

    const unlockBtn = e.target.closest('[data-unlock-price]');
    if (unlockBtn) {
      const pid = unlockBtn.getAttribute('data-unlock-price');
      removePriceLock(pid);
      saveStoreState('🔓 এই প্রোডাক্টের দাম আনলক হয়েছে — এখন KC Bazar-এর রেট অনুযায়ী চলবে।');
      return;
    }

    const saveInlineBtn = e.target.closest('[data-save-inline-price]');
    if (saveInlineBtn) {
      const pid = saveInlineBtn.getAttribute('data-save-inline-price');
      const saleInput = document.querySelector(`[data-inline-sale="${pid}"]`);
      const regInput = document.querySelector(`[data-inline-reg="${pid}"]`);
      const newSale = Number(saleInput?.value) || 0;
      const newReg = Number(regInput?.value) || newSale;
      if (newSale > 0) {
        const existingOv = AppState.storeState.productOverrides[pid] || {};
        AppState.storeState.productOverrides[pid] = {
          ...existingOv,
          salePrice: newSale,
          regularPrice: Math.max(newReg, newSale)
        };
        setPriceLock(pid, newSale, Math.max(newReg, newSale), 'owner');
        saveStoreState('💰 প্রোডাক্টের নতুন দাম আপডেট হয়েছে!');
      }
      return;
    }

    const adminDelBtn = e.target.closest('[data-admin-del-prod]');
    if (adminDelBtn) {
      const pid = adminDelBtn.getAttribute('data-admin-del-prod');
      if (!AppState.storeState.deletedProductIds.includes(String(pid))) {
        AppState.storeState.deletedProductIds.push(String(pid));
      }
      saveStoreState('🗑️ প্রোডাক্টটি ওয়েবসাইট থেকে ডিলিট করা হয়েছে!');
      return;
    }

    const delImgBtn = e.target.closest('[data-delete-edit-img]');
    if (delImgBtn) {
      const idx = Number(delImgBtn.getAttribute('data-delete-edit-img'));
      AppState.editingImages.splice(idx, 1);
      renderEditingImagesGrid();
      showToast('📸 ছবিটি তালিকা থেকে সরানো হয়েছে');
      return;
    }

    const mainImgBtn = e.target.closest('[data-make-main-img]');
    if (mainImgBtn) {
      const idx = Number(mainImgBtn.getAttribute('data-make-main-img'));
      const [chosen] = AppState.editingImages.splice(idx, 1);
      AppState.editingImages.unshift(chosen);
      renderEditingImagesGrid();
      return;
    }
  });

  /* ==================== ADMIN CONTROL APP EVENTS ==================== */
  document.querySelectorAll('[data-admin-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-admin-tab');
      document.querySelectorAll('[data-admin-tab]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      document.getElementById('adminPanelProducts')?.classList.toggle('hidden', tab !== 'products');
      document.getElementById('adminPanelBranding')?.classList.toggle('hidden', tab !== 'branding');
      document.getElementById('adminPanelKcbazar')?.classList.toggle('hidden', tab !== 'kcbazar');
      document.getElementById('adminPanelBrands')?.classList.toggle('hidden', tab !== 'brands');
      document.getElementById('adminPanelOrders')?.classList.toggle('hidden', tab !== 'orders');
      document.getElementById('adminPanelCloud')?.classList.toggle('hidden', tab !== 'cloud');
    });
  });

  document.getElementById('adminProductSearch')?.addEventListener('input', () => {
    AppState.adminVisibleCount = 30;
    renderAdminProductsList();
  });
  document.getElementById('adminBrandFilter')?.addEventListener('change', () => {
    AppState.adminVisibleCount = 30;
    renderAdminProductsList();
  });
  document.getElementById('adminCategoryFilter')?.addEventListener('change', () => {
    AppState.adminVisibleCount = 30;
    renderAdminProductsList();
  });
  document.getElementById('adminLoadMoreProductsBtn')?.addEventListener('click', () => {
    AppState.adminVisibleCount += 30;
    renderAdminProductsList();
  });

  document.getElementById('adminAddNewProductBtn')?.addEventListener('click', () => {
    openAdminProductEditor(null);
  });

  const closeEditModal = () => document.getElementById('adminEditProductModal')?.classList.add('hidden');
  document.getElementById('closeAdminEditModal')?.addEventListener('click', closeEditModal);
  document.getElementById('cancelAdminEditBtn')?.addEventListener('click', closeEditModal);

  document.getElementById('editProdPhotoUpload')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    showToast(`📤 ${files.length}টি ছবি আপলোড হচ্ছে...`);
    for (const file of files) {
      try {
        const dataUrl = await fileToOptimizedDataUrl(file, 900, 0.84);
        AppState.editingImages.push(dataUrl);
      } catch (err) {}
    }
    e.target.value = '';
    renderEditingImagesGrid();
    showToast('✅ নতুন ছবি যুক্ত হয়েছে!');
  });

  document.getElementById('addImageByUrlBtn')?.addEventListener('click', () => {
    const inp = document.getElementById('editProdNewImageUrl');
    const url = inp?.value.trim();
    if (!url) return;
    AppState.editingImages.push(url);
    inp.value = '';
    renderEditingImagesGrid();
  });

  document.getElementById('adminProductEditForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const idVal = document.getElementById('editProdId').value.trim();
    const name = document.getElementById('editProdName').value.trim();
    const brand = document.getElementById('editProdBrand').value.trim() || 'Korean Skincare';
    const salePrice = Number(document.getElementById('editProdSalePrice').value) || 0;
    const regularPrice = Math.max(Number(document.getElementById('editProdRegularPrice').value) || salePrice, salePrice);
    const inStock = document.getElementById('editProdInStock').value === 'true';
    const primaryCategory = document.getElementById('editProdCategory').value.trim() || 'Skin Care';
    const weight = document.getElementById('editProdWeight').value.trim();
    const sku = document.getElementById('editProdSku').value.trim();
    const description = document.getElementById('editProdDescription').value.trim();

    const images = AppState.editingImages.length
      ? [...AppState.editingImages]
      : ['https://kcbazar.com/wp-content/uploads/2023/09/Beauty-Of-Joseon-Matte-Sun-Stick-Mugwort-Camelia-SPF-50-PA-18-g-2.jpg'];

    if (idVal) {
      AppState.storeState.productOverrides[idVal] = {
        ...(AppState.storeState.productOverrides[idVal] || {}),
        name,
        brand,
        brandSlug: slugify(brand),
        salePrice,
        regularPrice,
        inStock,
        primaryCategory,
        primaryCategorySlug: slugify(primaryCategory),
        weight,
        sku,
        description,
        images
      };
      setPriceLock(idVal, salePrice, regularPrice, 'owner');
    } else {
      const newId = Date.now();
      AppState.storeState.customProducts.unshift({
        id: newId,
        name,
        slug: slugify(name) + '-' + String(newId).slice(-4),
        sku,
        brand,
        brandSlug: slugify(brand),
        regularPrice,
        salePrice,
        discountPercent: regularPrice > salePrice ? Math.round(((regularPrice - salePrice) / regularPrice) * 100) : 0,
        soldCount: 0,
        inStock,
        images,
        categories: [{ name: primaryCategory, slug: slugify(primaryCategory) }],
        primaryCategory,
        primaryCategorySlug: slugify(primaryCategory),
        weight,
        description
      });
    }

    closeEditModal();
    await saveStoreState('✅ প্রোডাক্টের ছবি, দাম ও বিবরণ সফলভাবে আপডেট হয়েছে!');
  });

  document.getElementById('deleteProductFromModalBtn')?.addEventListener('click', async () => {
    const idVal = document.getElementById('editProdId').value.trim();
    if (!idVal) return;
    if (!AppState.storeState.deletedProductIds.includes(String(idVal))) {
      AppState.storeState.deletedProductIds.push(String(idVal));
    }
    closeEditModal();
    await saveStoreState('🗑️ প্রোডাক্টটি ডিলিট করা হয়েছে!');
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToOptimizedDataUrl(file, 500, 0.9);
      AppState.storeState.settings.logoUrl = dataUrl;
      e.target.value = '';
      await saveStoreState('🎨 নতুন লোগো সফলভাবে আপলোড হয়েছে!');
    } catch (err) {
      showToast('লোগো আপলোড করতে সমস্যা হয়েছে।');
    }
  };

  document.getElementById('logoFileInput')?.addEventListener('change', handleLogoUpload);
  document.getElementById('quickLogoFileInput')?.addEventListener('change', handleLogoUpload);

  document.getElementById('applyLogoUrlBtn')?.addEventListener('click', async () => {
    const url = document.getElementById('logoUrlInput')?.value.trim();
    if (!url) return;
    AppState.storeState.settings.logoUrl = url;
    await saveStoreState('🎨 লোগো URL সফলভাবে সেট হয়েছে!');
  });

  const handleLogoRemove = async () => {
    AppState.storeState.settings.logoUrl = '';
    await saveStoreState('♻️ ডিফল্ট Korean Mart Care লোগো রিসেট করা হয়েছে!');
  };
  document.getElementById('removeLogoBtn')?.addEventListener('click', handleLogoRemove);
  document.getElementById('quickRemoveLogoBtn')?.addEventListener('click', handleLogoRemove);

  document.getElementById('saveQuickControlsBtn')?.addEventListener('click', async () => {
    const s = AppState.storeState.settings;
    const delVal = document.getElementById('quickDeliveryChargeInput')?.value;
    if (delVal !== undefined && delVal !== '') {
      s.deliveryCharge = Number(delVal);
    }
    const fontFam = document.getElementById('quickFontFamilySelect')?.value;
    if (fontFam) s.fontFamily = fontFam;
    const fontSz = document.getElementById('quickFontSizeSelect')?.value;
    if (fontSz) s.fontSize = fontSz;

    const quickAnn = document.getElementById('quickAnnouncementInput')?.value.trim();
    if (quickAnn) {
      s.announcementText = quickAnn;
    }

    const quickTok = document.getElementById('quickGithubTokenInput')?.value.trim();
    if (quickTok) {
      const repo = document.getElementById('githubRepoInput')?.value.trim() || 'neetu27886/korean-mart-care';
      const branch = document.getElementById('githubBranchInput')?.value.trim() || 'main';
      localStorage.setItem(STORAGE_GITHUB_CFG_KEY, JSON.stringify({ repo, branch, token: quickTok }));
      const tokInput = document.getElementById('githubTokenInput');
      if (tokInput) tokInput.value = quickTok;
    }

    await saveStoreState('✅ লোগো, রানিং ব্যানার, ফন্ট ও ডেলিভারি চার্জ সফলভাবে সেভ ও আপডেট হয়েছে!');
  });


  /* ---------- PRICE RATE MODE (KC Bazar আগের রেট লক / নতুন রেট) ---------- */
  document.getElementById('quickPriceRateModeSelect')?.addEventListener('change', async (e) => {
    const mode = e.target.value;
    const s = AppState.storeState.settings;
    if (mode === 'new_kcbazar') {
      const ok = window.confirm(
        'সতর্কতা: KC Bazar-এর বর্তমান নতুন রেট চালু করলে আপনার সব প্রোডাক্টের লক করা (আগের) দাম মুছে যাবে এবং KC Bazar-এর আজকের দাম দেখাবে। আপনি কি নিশ্চিত?'
      );
      if (!ok) {
        e.target.value = s.priceRateMode || 'old_kcbazar';
        return;
      }
      AppState.storeState.priceLocks = {};
      const ovs = AppState.storeState.productOverrides || {};
      for (const [oid, ov] of Object.entries(ovs)) {
        if (ov && (Object.prototype.hasOwnProperty.call(ov, 'salePrice') || Object.prototype.hasOwnProperty.call(ov, 'regularPrice'))) {
          delete ov.salePrice;
          delete ov.regularPrice;
          if (!Object.keys(ov).length) delete ovs[oid];
        }
      }
      persistPriceLocks();
      s.priceRateMode = 'new_kcbazar';
      await saveStoreState('🔄 KC Bazar-এর বর্তমান নতুন রেট চালু হয়েছে!');
      autoSyncWithKcBazarLive(true, true);
      return;
    }
    s.priceRateMode = 'old_kcbazar';
    if (priceLockCount() === 0) {
      const total = await relockPricesFromKcBazarOldRate(true);
      if (total) showToast(`🔒 ${total}টি প্রোডাক্টে KC Bazar-এর আগের রেট লক করা হয়েছে!`);
    }
    await saveStoreState('🔒 KC Bazar-এর আগের রেট লক করা আছে — Auto-Sync দাম বদলাতে পারবে না।');
  });

  document.getElementById('restoreOldRatesBtn')?.addEventListener('click', async () => {
    const ok = window.confirm('KC Bazar-এর আগের (কম) রেট আবার সব প্রোডাক্টে ফিরিয়ে আনতে চান?');
    if (!ok) return;
    const total = await relockPricesFromKcBazarOldRate(true);
    if (!total) {
      showToast('আগের রেট ফিরিয়ে আনতে সমস্যা হয়েছে।');
      return;
    }
    AppState.storeState.settings.priceRateMode = 'old_kcbazar';
    await saveStoreState(`🔒 ${total}টি প্রোডাক্টে KC Bazar-এর আগের রেট আবার লক ও সেভ হয়েছে!`);
    renderAdminProductsList();
  });

  /* ---------- PRODUCT DATA EXPORT (ADS / ONLINE STORE) ---------- */
  ['exportFormatSelect', 'exportBrandFilter', 'exportCategoryFilter'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', renderExportPreview);
  });
  document.getElementById('exportCustomColumns')?.addEventListener('input', () => {
    window.clearTimeout(window.__kmcExportPreviewTimer);
    window.__kmcExportPreviewTimer = window.setTimeout(renderExportPreview, 400);
  });
  document.getElementById('exportCsvBtn')?.addEventListener('click', () => runExportDownload('csv'));
  document.getElementById('exportXlsxBtn')?.addEventListener('click', () => runExportDownload('xlsx'));
  document.getElementById('exportJsonBtn')?.addEventListener('click', () => runExportDownload('json'));
  document.getElementById('exportCopyBtn')?.addEventListener('click', () => runExportDownload('copy'));

  /* ---------- AUTHENTICITY BANNER CONTROLS ---------- */
  document.getElementById('authenticBannerFileInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToOptimizedDataUrl(file, 1100, 0.86);
      AppState.storeState.settings.authenticBannerImage = dataUrl;
      renderAuthenticityBanner();
      renderAuthenticityBannerAdminForm();
      showToast('🖼️ নতুন ব্যানার ছবি আপলোড হয়েছে — এখন "ব্যানার সেভ করুন" চাপুন।');
    } catch (err) {
      showToast('ছবি আপলোড করা যায়নি।');
    }
  });

  document.getElementById('saveAuthenticBannerBtn')?.addEventListener('click', async () => {
    const s = AppState.storeState.settings;
    const val = (id) => document.getElementById(id)?.value.trim();
    s.authenticBannerEnabled = Boolean(document.getElementById('authenticBannerEnabledToggle')?.checked);
    s.authenticBannerBadge = val('authenticBannerBadgeInput') || s.authenticBannerBadge;
    s.authenticBannerTitle = val('authenticBannerTitleInput') || s.authenticBannerTitle;
    s.authenticBannerSubtitle = val('authenticBannerSubtitleInput') || s.authenticBannerSubtitle;
    s.authenticBannerGuarantee = val('authenticBannerGuaranteeInput') || s.authenticBannerGuarantee;
    s.authenticBannerCta = val('authenticBannerCtaInput') || s.authenticBannerCta;
    const imgUrl = val('authenticBannerUrlInput');
    if (imgUrl) s.authenticBannerImage = imgUrl;
    renderAuthenticityBanner();
    await saveStoreState('🛡️ অথেনটিক ভেরিফাইড ব্যানার সেভ হয়েছে!');
  });

  document.getElementById('resetAuthenticBannerImgBtn')?.addEventListener('click', async () => {
    AppState.storeState.settings.authenticBannerImage = 'images/authentic-verified-poster.jpg';
    renderAuthenticityBanner();
    renderAuthenticityBannerAdminForm();
    showToast('♻️ ডিফল্ট ভেরিফিকেশন ব্যানার ছবি ফিরিয়ে আনা হয়েছে — সেভ করুন।');
  });

  document.getElementById('quickNetlifyJumpBtn')?.addEventListener('click', () => {
    document.querySelector('[data-admin-tab="cloud"]')?.click();
    setTimeout(() => {
      document.getElementById('netlifyDeployCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const el = document.getElementById('netlifyDeployCard');
      if (el) {
        el.style.transition = 'box-shadow .4s';
        el.style.boxShadow = '0 0 0 4px rgba(0, 173, 159, .35)';
        setTimeout(() => (el.style.boxShadow = ''), 1600);
      }
    }, 150);
  });

  initNetlifyDeployControls();

  document.querySelectorAll('[data-jump-tab]').forEach((card) => {
    card.addEventListener('click', () => {
      const targetTab = card.getAttribute('data-jump-tab');
      const tabBtn = document.querySelector(`[data-admin-tab="${targetTab}"]`);
      tabBtn?.click();
      tabBtn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  document.getElementById('siteSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const s = AppState.storeState.settings;
    s.siteName = document.getElementById('settingSiteName')?.value.trim() || 'Korean Mart Care';
    s.tagline = document.getElementById('settingTagline')?.value.trim() || '';
    s.deliveryCharge = Number(document.getElementById('settingDeliveryCharge')?.value ?? 110);
    s.fontFamily = document.getElementById('settingFontFamily')?.value || "'Jost', 'Hind Siliguri', sans-serif";
    s.fontSize = document.getElementById('settingFontSize')?.value || '100%';
    s.instagramLink = document.getElementById('settingInstagramLink')?.value.trim() || 'https://www.instagram.com/korean_mart_care?mdxt=ZDZkajRwaHMybmpk&utm_source=qr';
    s.messengerLink = document.getElementById('settingMessengerLink')?.value.trim() || 'https://www.facebook.com/share/1DkbSM7DHq/?mibextid=wwXIfr';
    s.announcementText = document.getElementById('settingAnnouncementText')?.value.trim() || '';
    s.heroTitle = document.getElementById('settingHeroTitle')?.value.trim() || '';
    s.heroSubtitle = document.getElementById('settingHeroSubtitle')?.value.trim() || '';

    await saveStoreState('⚙️ পেজের নাম, ফন্ট, ডেলিভারি চার্জ ও সেটিংস আপডেট হয়েছে!');
  });

  const runKcBazarImport = async (payload) => {
    const resultsBox = document.getElementById('kcbazarImportResults');
    if (!resultsBox) return;
    resultsBox.innerHTML = `<div style="padding:14px; color:var(--kcb-pink); font-weight:700;">⏳ KC Bazar ওয়েবসাইট থেকে সরাসরি ডাটা আনা হচ্ছে...</div>`;

    try {
      const res = await fetch('/api/kcbazar-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.products?.length) {
        resultsBox.innerHTML = `<div style="padding:14px; color:red;">${escapeHtml(data.error || 'কোনো প্রোডাক্ট পাওয়া যায়নি।')}</div>`;
        return;
      }

      resultsBox.innerHTML = data.products
        .map(
          (p, idx) => `
          <div class="product-card" style="padding:10px;">
            <img src="${escapeHtml(p.images?.[0] || '')}" alt="${escapeHtml(p.name)}" style="width:100%; aspect-ratio:1/1; object-fit:cover; border-radius:6px; margin-bottom:6px;" />
            <div style="font-size:0.74rem; font-weight:700; color:var(--kcb-pink);">${escapeHtml(p.brand)} • 📸 ${p.images?.length || 1} Photos</div>
            <h4 style="font-size:0.88rem; margin:4px 0;">${escapeHtml(p.name)}</h4>
            <div style="font-weight:700; color:var(--kcb-pink); margin-bottom:8px;">
              <del style="color:#888; font-weight:400; font-size:0.8rem;">${formatPrice(p.regularPrice)}</del> ${formatPrice(p.salePrice)}
            </div>
            <button type="button" class="btn-kcb-green btn-block" style="padding:7px;" data-import-kcb-idx="${idx}">
              ✅ ওয়েবসাইটে যোগ করুন
            </button>
          </div>
        `
        )
        .join('');

      resultsBox.querySelectorAll('[data-import-kcb-idx]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const item = data.products[Number(btn.getAttribute('data-import-kcb-idx'))];
          if (!item) return;
          AppState.storeState.deletedProductIds = (AppState.storeState.deletedProductIds || []).filter(
            (id) => String(id) !== String(item.id)
          );
          const existsInBase = (AppState.baseCatalog.products || []).some(
            (bp) => String(bp.id) === String(item.id)
          );
          if (existsInBase) {
            AppState.storeState.productOverrides[item.id] = item;
          } else {
            AppState.storeState.customProducts = [
              item,
              ...(AppState.storeState.customProducts || []).filter((cp) => String(cp.id) !== String(item.id))
            ];
          }
          await saveStoreState(`🎉 "${item.name.slice(0, 30)}..." ওয়েবসাইটে যুক্ত হয়েছে!`);
        });
      });
    } catch (err) {
      resultsBox.innerHTML = `<div style="padding:14px; color:red;">KC Bazar সংযোগ ত্রুটি: ${escapeHtml(err.message)}</div>`;
    }
  };

  document.getElementById('toggleKcbAutoSyncCheckbox')?.addEventListener('change', async (e) => {
    AppState.storeState.settings.autoSyncKcBazar = Boolean(e.target.checked);
    const statusEl = document.getElementById('kcbAutoSyncStatusText');
    if (statusEl) {
      statusEl.textContent = e.target.checked
        ? '✅ Auto-Sync স্ট্যাটাস: চালু আছে (Connected to kcbazar.com Skin Care API)'
        : '⏸️ Auto-Sync স্ট্যাটাস: বন্ধ করা হয়েছে';
    }
    await saveStoreState(
      e.target.checked
        ? '🟢 KC Bazar Auto-Sync চালু করা হয়েছে!'
        : '⏸️ KC Bazar Auto-Sync বন্ধ করা হয়েছে।'
    );
  });

  document.getElementById('runFullKcbAutoSyncBtn')?.addEventListener('click', () => {
    autoSyncWithKcBazarLive(true, true);
  });

  document.getElementById('fetchKcBazarUrlBtn')?.addEventListener('click', () => {
    const url = document.getElementById('kcbazarUrlInput')?.value.trim();
    if (!url) return;
    runKcBazarImport({ url });
  });

  document.getElementById('searchKcBazarLiveBtn')?.addEventListener('click', () => {
    const search = document.getElementById('kcbazarLiveSearchInput')?.value.trim();
    if (!search) return;
    runKcBazarImport({ search });
  });

  document.addEventListener('change', async (e) => {
    const brandUploadInput = e.target.closest('[data-brand-logo-upload]');
    if (brandUploadInput) {
      const slug = brandUploadInput.getAttribute('data-brand-logo-upload');
      const file = brandUploadInput.files?.[0];
      if (!file || !slug) return;
      const dataUrl = await fileToOptimizedDataUrl(file, 300, 0.85);
      AppState.storeState.brandOverrides[slug] = {
        ...(AppState.storeState.brandOverrides[slug] || {}),
        logo: dataUrl
      };
      await saveStoreState('🏷️ ব্র্যান্ড লোগো আপডেট হয়েছে!');
    }

    const statusSel = e.target.closest('[data-order-status-select]');
    if (statusSel) {
      const oid = statusSel.getAttribute('data-order-status-select');
      const newStatus = statusSel.value;
      AppState.storeState.orders = (AppState.storeState.orders || []).map((o) =>
        o.id === oid ? { ...o, status: newStatus } : o
      );
      fetch(`/api/orders/${encodeURIComponent(oid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      }).catch(() => {});
      await saveStoreState(`📦 অর্ডার #${oid} স্ট্যাটাস "${newStatus}" করা হয়েছে!`);
    }
  });

  document.getElementById('addNewBrandBtn')?.addEventListener('click', async () => {
    const name = prompt('নতুন কোরিয়ান ব্র্যান্ডের নাম লিখুন:');
    if (!name || !name.trim()) return;
    const slug = slugify(name);
    AppState.storeState.customBrands.push({
      name: name.trim(),
      slug,
      count: 0,
      logo: '',
      featured: true
    });
    await saveStoreState(`🏷️ "${name.trim()}" ব্র্যান্ড যুক্ত হয়েছে!`);
  });

  document.getElementById('clearAllOrdersBtn')?.addEventListener('click', async () => {
    if (!confirm('আপনি কি সব অর্ডার হিস্ট্রি মুছে ফেলতে চান?')) return;
    AppState.storeState.orders = [];
    await saveStoreState('সব অর্ডার ক্লিয়ার করা হয়েছে।');
  });

  document.getElementById('deployFullSiteToGithubBtn')?.addEventListener('click', async () => {
    const repo = document.getElementById('githubRepoInput')?.value.trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    const branch = document.getElementById('githubBranchInput')?.value.trim() || 'main';
    const token = document.getElementById('githubTokenInput')?.value.trim();
    const prog = document.getElementById('githubDeployProgressText');

    if (!repo || !token) {
      showToast('অনুগ্রহ করে GitHub Repo (যেমন: username/korean-mart-care) এবং Token দিন!');
      return;
    }

    localStorage.setItem(STORAGE_GITHUB_CFG_KEY, JSON.stringify({ repo, branch, token }));
    if (prog) prog.textContent = '⏳ আপনার GitHub Repository-তে সম্পূর্ণ ওয়েবসাইটের সব ফোল্ডার ও ফাইল আপলোড হচ্ছে (১০-১৫ সেকেন্ড অপেক্ষা করুন)...';

    try {
      const res = await fetch('/api/github-full-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo, branch, token })
      });
      const data = await res.json();
      if (res.ok && data.status === 'ok') {
        if (prog) prog.textContent = `🎉 অভিনন্দন! সম্পূর্ণ ওয়েবসাইট (${data.uploadedFiles}টি ফাইল ও public ফোল্ডার) আপনার GitHub-এ সফলভাবে আপলোড হয়েছে! এখন Netlify নিজে থেকেই সাইটটি Live করে দেবে!`;
        showToast('🎉 GitHub-এ পুরো ওয়েবসাইট সফলভাবে আপলোড হয়েছে!');
      } else {
        if (prog) prog.textContent = `❌ ত্রুটি: ${data.error || 'GitHub আপলোড ব্যর্থ হয়েছে। Repo ও Token চেক করুন।'}`;
        showToast(data.error || 'GitHub আপলোড ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      if (prog) prog.textContent = `❌ সংযোগ ত্রুটি: ${err.message}`;
    }
  });

  document.getElementById('saveGithubSyncBtn')?.addEventListener('click', async () => {
    const repo = document.getElementById('githubRepoInput')?.value.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
    const branch = document.getElementById('githubBranchInput')?.value.trim() || 'main';
    const token = document.getElementById('githubTokenInput')?.value.trim();
    if (!repo || !token) {
      showToast('অনুগ্রহ করে GitHub Repo (username/repo) এবং Personal Access Token দিন!');
      return;
    }
    localStorage.setItem(STORAGE_GITHUB_CFG_KEY, JSON.stringify({ repo, branch, token }));
    showToast('⏳ GitHub-এ কানেক্ট ও লাইভ ডাটা পুশ হচ্ছে...');
    await pushGitHubStateIfConfigured(true);
  });

  document.getElementById('pullFromGithubBtn')?.addEventListener('click', () => {
    pullGitHubStateIfConfigured(true);
  });

  document.getElementById('saveCloudConfigBtn')?.addEventListener('click', async () => {
    const url = document.getElementById('cloudBinUrlInput')?.value.trim();
    const apiKey = document.getElementById('cloudApiKeyInput')?.value.trim();
    localStorage.setItem(STORAGE_CLOUD_CFG_KEY, JSON.stringify({ url, apiKey }));
    await pushExternalCloudStateIfConfigured();
    showToast('☁️ ক্লাউড সিঙ্ক সেভ ও সিঙ্ক হয়েছে!');
  });

  document.getElementById('pullFromCloudBtn')?.addEventListener('click', () => {
    pullExternalCloudStateIfConfigured(true);
  });

  document.getElementById('exportFullStoreJsonBtn')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(AppState.storeState, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `korean-mart-care-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    showToast('📥 ব্যাকআপ ফাইল ডাউনলোড হয়েছে!');
  });

  document.getElementById('importStoreJsonInput')?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        mergeIntoStoreState(JSON.parse(ev.target.result));
        await saveStoreState('📤 ডাটা ফাইল সফলভাবে রিস্টোর হয়েছে!');
      } catch (err) {
        showToast('ভুল ফাইল ফরম্যাট!');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('resetAllOverridesBtn')?.addEventListener('click', async () => {
    if (!confirm('আপনি কি সব কাস্টম পরিবর্তন রিসেট করে ডিফল্ট অবস্থায় ফিরতে চান?')) return;
    AppState.storeState.productOverrides = {};
    AppState.storeState.customProducts = [];
    AppState.storeState.deletedProductIds = [];
    AppState.storeState.brandOverrides = {};
    AppState.storeState.settings.logoUrl = '';
    AppState.storeState.settings.deliveryCharge = 110;
    await saveStoreState('♻️ ওয়েবসাইট ডিফল্ট অবস্থায় রিসেট হয়েছে!');
  });
}

function renderAllBrandsModalGrid(query = '') {
  const grid = document.getElementById('allBrandsModalGrid');
  if (!grid) return;
  const q = query.toLowerCase().trim();
  const filtered = AppState.brands.filter((b) => !q || b.name.toLowerCase().includes(q));

  grid.innerHTML = filtered
    .map((b) => {
      const thumb = b.logo || b.sampleImage || '';
      return `
        <div class="brand-card ${AppState.activeBrand === b.slug ? 'active' : ''}" data-brand-slug="${escapeHtml(b.slug)}">
          <div class="brand-card-thumb">
            <img src="${escapeHtml(thumb)}" alt="${escapeHtml(b.name)}" loading="lazy" />
          </div>
          <div class="brand-card-name">${escapeHtml(b.name)}</div>
          <div class="brand-card-count">${b.count} Products</div>
        </div>
      `;
    })
    .join('');
}

document.addEventListener('DOMContentLoaded', initApp);


/* ==================== NETLIFY LIVE DEPLOY (BUILD CREDIT ছাড়াই) ==================== */
const STORAGE_NETLIFY_CFG_KEY = 'kmc_netlify_cfg_v1';

const NETLIFY_PUBLISH_FILES = [
  'index.html',
  'app.js',
  'styles.css',
  'manifest.json',
  '_redirects',
  'data/catalog.json',
  'data/store-state.json',
  'images/authentic-verified-poster.jpg',
  'images/authentic-verified-wide.jpg',
  'images/authentic-ads-banner.jpg',
  'downloads/korean-mart-care-product-feed.csv',
  'downloads/korean-mart-care-product-feed.xlsx',
  'downloads/korean-mart-care-price-list.csv',
  'downloads/korean-mart-care-meta-catalog.csv'
];

function getNetlifyCfg() {
  try {
    const raw = localStorage.getItem(STORAGE_NETLIFY_CFG_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    return {
      token: cfg.token || document.getElementById('netlifyTokenInput')?.value.trim() || '',
      site: cfg.site || document.getElementById('netlifySiteInput')?.value.trim() || 'korean-mart-care-official'
    };
  } catch (e) {
    return { token: '', site: 'korean-mart-care-official' };
  }
}

function saveNetlifyCfg(token, site) {
  try {
    localStorage.setItem(STORAGE_NETLIFY_CFG_KEY, JSON.stringify({ token, site }));
  } catch (e) {}
}

function setNetlifyStatus(text, kind = '') {
  const el = document.getElementById('netlifyDeployStatus');
  if (!el) return;
  el.classList.remove('hidden', 'error', 'busy');
  if (kind) el.classList.add(kind);
  el.innerHTML = text;
}

function netlifyNormalizeSite(site) {
  return String(site || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .replace(/\.netlify\.app$/i, '');
}

async function netlifyResolveSite(token, site) {
  const name = netlifyNormalizeSite(site);
  if (!name) throw new Error('Netlify সাইটের নাম দিন।');

  const commonHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };

  let res = await fetch(`https://api.netlify.com/api/v1/sites/${encodeURIComponent(name)}`, {
    headers: commonHeaders
  });
  if (res.ok) return await res.json();

  if (res.status === 401 || res.status === 403) {
    throw new Error('Netlify টোকেনটি সঠিক নয় বা মেয়াদ শেষ। নতুন Personal access token তৈরি করুন।');
  }

  // fallback: search list of sites
  res = await fetch(`https://api.netlify.com/api/v1/sites?per_page=100`, { headers: commonHeaders });
  if (res.ok) {
    const list = await res.json();
    const found = (Array.isArray(list) ? list : []).find(
      (s) =>
        String(s.name || '').toLowerCase() === name.toLowerCase() ||
        String(s.custom_domain || '').toLowerCase() === name.toLowerCase() ||
        String(s.url || '').includes(name)
    );
    if (found) return found;
  }
  throw new Error(`“${name}” নামে কোনো Netlify সাইট পাওয়া যায়নি। সাইটের নাম/URL ঠিক করে দিন।`);
}

async function buildPublishZipFromGitHub(repo, branch) {
  const base = `https://raw.githubusercontent.com/${repo}/${branch}/public/`;
  const enc = new TextEncoder();
  const files = [];
  let fetched = 0;

  for (const relPath of NETLIFY_PUBLISH_FILES) {
    try {
      const res = await fetch(base + relPath + '?t=' + Date.now());
      if (!res.ok) continue;
      const buf = new Uint8Array(await res.arrayBuffer());
      files.push({ name: relPath, data: buf });
      fetched++;
    } catch (e) {}
  }

  if (!files.length) {
    throw new Error('GitHub থেকে ফাইল আনা যায়নি — আগে “GitHub-এ পুশ করুন” চাপুন।');
  }

  return { blob: kmcZipBlob(files, 'application/zip'), count: fetched };
}

async function netlifyDeployNow() {
  const cfg = getNetlifyCfg();
  const tokenInput = document.getElementById('netlifyTokenInput');
  const siteInput = document.getElementById('netlifySiteInput');
  const token = (tokenInput?.value || cfg.token || '').trim();
  const site = (siteInput?.value || cfg.site || '').trim();

  if (!token) {
    setNetlifyStatus('⚠️ আগে Netlify Personal Access Token বসান। উপরের ধাপ ১ অনুযায়ী টোকেন তৈরি করুন।', 'error');
    return;
  }

  const btn = document.getElementById('netlifyDeployBtn');
  if (btn) btn.disabled = true;

  try {
    setNetlifyStatus('⏳ ১/৩ — Netlify সাইট খোঁজা হচ্ছে...', 'busy');
    const siteObj = await netlifyResolveSite(token, site);
    saveNetlifyCfg(token, siteObj.name || site);

    setNetlifyStatus('⏳ ২/৩ — সর্বশেষ ফাইলগুলো GitHub থেকে আনা হচ্ছে...', 'busy');
    let ghRepo = document.getElementById('githubRepoInput')?.value.trim() || 'neetu27886/korean-mart-care';
    let ghBranch = document.getElementById('githubBranchInput')?.value.trim() || 'main';

    // আগে বর্তমান দাম/সেটিংস GitHub-এ সেভ করে নেওয়া (যাতে লাইভ ডিপ্লয়ে সেগুলোই যায়)
    try {
      await pushGitHubStateIfConfigured(false);
    } catch (e) {}

    const { blob, count } = await buildPublishZipFromGitHub(ghRepo, ghBranch);

    setNetlifyStatus(`⏳ ৩/৩ — ${count}টি ফাইল (${Math.round(blob.size / 1024 / 1024 * 10) / 10} MB) Netlify-তে আপলোড হচ্ছে...`, 'busy');

    const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteObj.id}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/zip'
      },
      body: blob
    });

    if (!deployRes.ok) {
      const errTxt = await deployRes.text().catch(() => '');
      throw new Error(`Netlify ডিপ্লয় ব্যর্থ (${deployRes.status}): ${errTxt.slice(0, 160)}`);
    }

    const deploy = await deployRes.json();
    setNetlifyStatus(`⏳ ডিপ্লয় শুরু হয়েছে (ID: ${deploy.id}) — লাইভ হওয়ার অপেক্ষা...`, 'busy');

    const liveUrl = deploy.ssl_url || siteObj.ssl_url || siteObj.url || `https://${siteObj.name}.netlify.app`;
    let state = deploy.state || 'processing';
    for (let i = 0; i < 20 && state !== 'ready' && state !== 'error'; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const stRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
        });
        if (stRes.ok) {
          const st = await stRes.json();
          state = st.state || state;
          setNetlifyStatus(`⏳ ডিপ্লয় হচ্ছে... (${state})`, 'busy');
        }
      } catch (e) {}
    }

    if (state === 'error') {
      setNetlifyStatus('❌ Netlify ডিপ্লয় ব্যর্থ হয়েছে। আবার চেষ্টা করুন।', 'error');
      return;
    }

    setNetlifyStatus(
      `✅ ডিপ্লয় সফল! ${count}টি ফাইল লাইভ হয়েছে। <a href="${liveUrl}" target="_blank" rel="noopener">${liveUrl}</a><br>
       <a href="${liveUrl}" target="_blank" rel="noopener" class="btn-kcb-green" style="display:inline-block; margin-top:8px; padding:8px 14px; text-decoration:none;">🔗 নতুন সাইট দেখুন</a>
       &nbsp;<button type="button" class="btn-kcb-outline" onclick="window.location.reload()" style="padding:8px 14px;">🔄 রিফ্রেশ</button>`
    );
    showToast('🚀 ওয়েবসাইট লাইভ ডিপ্লয় সফল হয়েছে!');
  } catch (err) {
    setNetlifyStatus(`❌ ${err.message || 'ডিপ্লয় করা যায়নি।'}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function netlifyCheckConnection() {
  const token = (document.getElementById('netlifyTokenInput')?.value || getNetlifyCfg().token || '').trim();
  const site = document.getElementById('netlifySiteInput')?.value || getNetlifyCfg().site;
  if (!token) {
    setNetlifyStatus('⚠️ আগে Netlify Personal Access Token বসান।', 'error');
    return;
  }
  setNetlifyStatus('⏳ চেক করা হচ্ছে...', 'busy');
  try {
    const siteObj = await netlifyResolveSite(token, site);
    saveNetlifyCfg(token, siteObj.name || site);
    setNetlifyStatus(
      `✅ সংযোগ ঠিক আছে!<br>সাইট: <strong>${siteObj.name}</strong><br>লাইভ URL: <a href="${siteObj.ssl_url || siteObj.url}" target="_blank" rel="noopener">${siteObj.ssl_url || siteObj.url}</a><br>এখন “🚀 এখনই লাইভ ডিপ্লয় করুন” চাপুন।`
    );
    if (document.getElementById('netlifySiteInput')) {
      document.getElementById('netlifySiteInput').value = siteObj.name || site;
    }
  } catch (err) {
    setNetlifyStatus(`❌ ${err.message}`, 'error');
  }
}

function initNetlifyDeployControls() {
  try {
    const cfg = JSON.parse(localStorage.getItem(STORAGE_NETLIFY_CFG_KEY) || '{}');
    const tokInput = document.getElementById('netlifyTokenInput');
    const siteInput = document.getElementById('netlifySiteInput');
    if (tokInput && cfg.token) tokInput.value = cfg.token;
    if (siteInput && cfg.site) siteInput.value = cfg.site;
  } catch (e) {}

  document.getElementById('netlifyCheckBtn')?.addEventListener('click', netlifyCheckConnection);

  document.getElementById('netlifyDeployBtn')?.addEventListener('click', async () => {
    const ok = window.confirm(
      'আপনার সর্বশেষ দাম, ছবি ও সেটিংস GitHub-এ সেভ হয়ে তারপর সেগুলোই Netlify-তে লাইভ ডিপ্লয় হবে। চালিয়ে যাবেন?'
    );
    if (!ok) return;
    await netlifyDeployNow();
  });
}

/* ==================== AUTHENTICITY BANNER ADMIN FORM SYNC ==================== */
function renderAuthenticityBannerAdminForm() {
  const s = AppState.storeState.settings || {};
  const clean = (v) => String(v || '').replace(/\s+/g, ' ').trim();
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = v || '';
  };

  const toggle = document.getElementById('authenticBannerEnabledToggle');
  if (toggle) toggle.checked = s.authenticBannerEnabled !== false;

  if (!s.authenticBannerTitle) {
    s.authenticBannerTitle = clean(document.getElementById('authenticBannerTitle')?.textContent) ||
      'আমাদের সব প্রোডাক্ট অফিশিয়ালি ভেরিফাইড প্রুফ সহ পাবেন';
  }
  if (!s.authenticBannerSubtitle) {
    s.authenticBannerSubtitle = clean(document.getElementById('authenticBannerSubtitle')?.textContent) ||
      'প্রতিটি প্রোডাক্টের গায়ে থাকে অরিজিনাল হলোগ্রাম QR স্টিকার।';
  }
  if (!s.authenticBannerBadge) {
    s.authenticBannerBadge = clean(document.getElementById('authenticBannerBadge')?.textContent) ||
      '🛡️ 100% AUTHENTIC · OFFICIAL SCAN VERIFIED';
  }
  if (!s.authenticBannerGuarantee) {
    s.authenticBannerGuarantee = clean(document.getElementById('authenticBannerGuarantee')?.textContent) ||
      '✅ ফেক প্রমাণ করতে পারলে ডাবল টাকা ক্যাশব্যাক!';
  }
  if (!s.authenticBannerCta) {
    s.authenticBannerCta = clean(document.getElementById('authenticBannerCta')?.textContent) ||
      'ভেরিফাইড প্রোডাক্টগুলো দেখুন';
  }

  setVal('authenticBannerBadgeInput', s.authenticBannerBadge);
  setVal('authenticBannerTitleInput', s.authenticBannerTitle);
  setVal('authenticBannerSubtitleInput', s.authenticBannerSubtitle);
  setVal('authenticBannerGuaranteeInput', s.authenticBannerGuarantee);
  setVal('authenticBannerCtaInput', s.authenticBannerCta);
  setVal('authenticBannerUrlInput', String(s.authenticBannerImage || '').startsWith('data:') ? '' : s.authenticBannerImage || '');

  const prev = document.getElementById('authenticBannerAdminPreview');
  if (prev) prev.src = s.authenticBannerImage || 'images/authentic-verified-poster.jpg';
}
