const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Allow framing and any host in preview environment
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

const STATE_PATH = path.join(__dirname, 'public', 'data', 'store-state.json');

function readStoreState() {
  try {
    if (fs.existsSync(STATE_PATH)) {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Error reading store state:', err);
  }
  return {
    settings: {
      siteName: 'Korean Mart Care',
      tagline: '100% Authentic Korean Skincare in Bangladesh',
      logoUrl: '',
      deliveryCharge: 110,
      deliveryNote: 'সারা বাংলাদেশে হোম ডেলিভারি চার্জ ১১০ টাকা (২৪-৪৮ ঘণ্টার মধ্যে ডেলিভারি)',
      whatsappNumber: '8801700000000',
      messengerLink: 'https://m.me/KoreanMartCare',
      facebookPage: 'https://facebook.com/KoreanMartCare',
      supportPhone: '+880 1700-000000',
      announcementText: '✨ Korean Mart Care-এ স্বাগতম! ১০০% অথেনটিক কোরিয়ান স্কিনকেয়ার প্রোডাক্ট | অর্ডারের ২৪-৪৮ ঘণ্টার মধ্যে সারা বাংলাদেশে হোম ডেলিভারি (ডেলিভারি চার্জ ১১০ টাকা) ✨',
      heroTitle: 'Authentic Korean Glass Skin Care',
      heroSubtitle: 'দক্ষিণ কোরিয়া থেকে সরাসরি আমদানিকৃত ১০০% অরিজিনাল স্কিনকেয়ার কালেকশন এখন Korean Mart Care-এ।',
      adminPin: '1234'
    },
    productOverrides: {},
    customProducts: [],
    deletedProductIds: [],
    brandOverrides: {},
    customBrands: [],
    orders: [],
    updatedAt: new Date().toISOString()
  };
}

function writeStoreState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8');
  return state;
}

// Helper to fetch JSON from KC Bazar WooCommerce Store API
function fetchJsonFromUrl(targetUrl) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      targetUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 20000
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error('Failed to parse response from KC Bazar'));
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

function decodeHtmlEntities(str = '') {
  return String(str)
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#038;|&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function normalizeKcBazarProduct(p) {
  const priceHtml = p.price_html || '';
  const fallbackPrice = parseInt(String(p.prices?.price || '0').replace(/,/g, ''), 10) || 0;

  let regularPrice = fallbackPrice;
  let salePrice = fallbackPrice;
  let soldCount = 0;

  const delMatch = priceHtml.match(/<del>[\s\S]*?([\d,]+)\s*<\/span><\/del>/i);
  const insMatch = priceHtml.match(/<ins>[\s\S]*?([\d,]+)\s*<\/span><\/ins>/i);
  const soldMatch = priceHtml.match(/Sold:\s*([\d,]+)\s*pcs/i);

  if (delMatch && insMatch) {
    regularPrice = parseInt(delMatch[1].replace(/,/g, ''), 10) || fallbackPrice;
    salePrice = parseInt(insMatch[1].replace(/,/g, ''), 10) || regularPrice;
  } else {
    const amounts = [...priceHtml.matchAll(/woocommerce-Price-currencySymbol[\s\S]*?<\/span>([\d,]+)<\/span>/gi)];
    if (amounts.length >= 2) {
      regularPrice = parseInt(amounts[0][1].replace(/,/g, ''), 10);
      salePrice = parseInt(amounts[1][1].replace(/,/g, ''), 10);
    } else if (amounts.length === 1) {
      regularPrice = parseInt(amounts[0][1].replace(/,/g, ''), 10);
      salePrice = regularPrice;
    }
  }
  if (soldMatch) {
    soldCount = parseInt(soldMatch[1].replace(/,/g, ''), 10) || 0;
  }

  let brandName = 'Korean Skincare';
  let brandSlug = 'korean-skincare';
  let weightVal = '';
  let skinType = '';

  for (const attr of p.attributes || []) {
    const tax = attr.taxonomy || '';
    const terms = attr.terms || [];
    if (tax === 'pa_brand' && terms.length) {
      brandName = decodeHtmlEntities(terms[0].name);
      brandSlug = terms[0].slug;
    } else if ((tax === 'pa_weight' || tax === 'pa_size') && terms.length && !weightVal) {
      weightVal = decodeHtmlEntities(terms[0].name);
    } else if (tax === 'pa_skin-type' && terms.length) {
      skinType = terms.map((t) => decodeHtmlEntities(t.name)).join(', ');
    }
  }

  const images = [];
  for (const img of p.images || []) {
    const src = img.src || img.thumbnail;
    if (src && !images.includes(src)) images.push(src);
  }

  const cats = [];
  for (const c of p.categories || []) {
    const cname = decodeHtmlEntities(c.name || '');
    const cslug = c.slug || '';
    if (cslug !== 'skin-care' && cslug !== 'skin-care-solution') {
      cats.push({ name: cname, slug: cslug });
    }
  }
  if (!cats.length) {
    cats.push({ name: 'Skin Care', slug: 'skin-care' });
  }

  let desc = p.description || p.short_description || '';
  desc = desc.replace(/free\s+delivery[\s\S]*?(?:<|$)/gi, '');

  const discountPercent =
    regularPrice > salePrice && regularPrice > 0
      ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
      : 0;

  return {
    id: p.id,
    name: decodeHtmlEntities(p.name || ''),
    slug: p.slug,
    sku: p.sku || '',
    brand: brandName,
    brandSlug,
    regularPrice,
    salePrice,
    discountPercent,
    soldCount,
    inStock: Boolean(p.is_in_stock !== false),
    images,
    categories: cats,
    primaryCategory: cats[0].name,
    primaryCategorySlug: cats[0].slug,
    weight: weightVal || (p.formatted_weight && p.formatted_weight !== 'N/A' ? p.formatted_weight : ''),
    skinType,
    description: desc,
    kcbazarUrl: p.permalink || `https://kcbazar.com/product/${p.slug}/`,
    isTrial: salePrice < 100
  };
}

// GET store state
app.get('/api/store', (req, res) => {
  res.json(readStoreState());
});

// POST store state updates (Admin App full control)
app.post('/api/store', (req, res) => {
  const current = readStoreState();
  const body = req.body || {};

  if (body.settings) {
    current.settings = { ...current.settings, ...body.settings };
  }
  if (body.productOverrides) {
    current.productOverrides = { ...current.productOverrides, ...body.productOverrides };
  }
  if (Array.isArray(body.customProducts)) {
    current.customProducts = body.customProducts;
  }
  if (Array.isArray(body.deletedProductIds)) {
    current.deletedProductIds = body.deletedProductIds;
  }
  if (body.brandOverrides) {
    current.brandOverrides = { ...current.brandOverrides, ...body.brandOverrides };
  }
  if (Array.isArray(body.customBrands)) {
    current.customBrands = body.customBrands;
  }
  if (Array.isArray(body.orders)) {
    current.orders = body.orders;
  }
  if (body.replaceFullState) {
    Object.assign(current, body.replaceFullState);
  }

  const saved = writeStoreState(current);
  res.json({ status: 'ok', state: saved });
});

// POST a new customer order
app.post('/api/orders', (req, res) => {
  const current = readStoreState();
  const order = {
    id: 'KMC-' + Date.now().toString().slice(-6),
    createdAt: new Date().toISOString(),
    status: 'Pending',
    ...req.body
  };
  current.orders = [order, ...(current.orders || [])];
  writeStoreState(current);
  res.json({ status: 'ok', order });
});

// PATCH order status
app.patch('/api/orders/:id', (req, res) => {
  const current = readStoreState();
  const { id } = req.params;
  const { status } = req.body;
  current.orders = (current.orders || []).map((o) =>
    o.id === id ? { ...o, status: status || o.status } : o
  );
  writeStoreState(current);
  res.json({ status: 'ok', orders: current.orders });
});

// POST import/sync product directly from KC Bazar link or search
app.post('/api/kcbazar-import', async (req, res) => {
  try {
    const { url, search } = req.body || {};
    let apiUrl = '';

    if (url) {
      // Extract slug from https://kcbazar.com/product/beauty-of-joseon-matte-sun-stick/
      const clean = String(url).trim().replace(/\/+$/, '');
      const parts = clean.split('/');
      const slug = parts[parts.length - 1];
      apiUrl = `https://kcbazar.com/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}`;
    } else if (search) {
      apiUrl = `https://kcbazar.com/wp-json/wc/store/v1/products?category=196&search=${encodeURIComponent(search)}&per_page=20`;
    } else {
      apiUrl = `https://kcbazar.com/wp-json/wc/store/v1/products?category=196&per_page=24&orderby=date`;
    }

    const rawItems = await fetchJsonFromUrl(apiUrl);
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return res.status(404).json({ error: 'KC Bazar-এ এই লিংক বা নামের কোনো প্রোডাক্ট পাওয়া যায়নি।' });
    }

    const products = rawItems.map(normalizeKcBazarProduct);
    res.json({ status: 'ok', products });
  } catch (err) {
    console.error('KC Bazar import error:', err);
    res.status(500).json({ error: err.message || 'KC Bazar থেকে ডাটা আনতে সমস্যা হয়েছে।' });
  }
});

let autoSyncCache = { timestamp: 0, products: [] };

// GET or POST live auto-sync with KC Bazar Skin Care updates
app.all('/api/kcbazar-auto-sync', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.body?.force === true;
    const maxPages = req.query.full === '1' || req.body?.full === true ? 5 : 1;
    const now = Date.now();

    if (!force && maxPages === 1 && autoSyncCache.products.length > 0 && now - autoSyncCache.timestamp < 10 * 60 * 1000) {
      return res.json({
        status: 'ok',
        cached: true,
        syncedAt: new Date(autoSyncCache.timestamp).toISOString(),
        products: autoSyncCache.products
      });
    }

    const collected = [];
    for (let page = 1; page <= maxPages; page++) {
      const apiUrl = `https://kcbazar.com/wp-json/wc/store/v1/products?category=196&per_page=80&page=${page}`;
      const rawItems = await fetchJsonFromUrl(apiUrl);
      if (!Array.isArray(rawItems) || rawItems.length === 0) break;
      for (const raw of rawItems) {
        collected.push(normalizeKcBazarProduct(raw));
      }
      if (rawItems.length < 80) break;
    }

    if (collected.length > 0) {
      autoSyncCache = { timestamp: now, products: collected };
    }

    res.json({
      status: 'ok',
      cached: false,
      syncedAt: new Date(now).toISOString(),
      products: collected
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'KC Bazar Auto-Sync ব্যর্থ হয়েছে।' });
  }
});

// Serve static frontend from public/
app.use(express.static(path.join(__dirname, 'public')));

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Korean Mart Care server running at http://0.0.0.0:${PORT}`);
});
