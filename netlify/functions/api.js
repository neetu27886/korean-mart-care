const https = require('https');

let memoryStoreState = {
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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const reqPath = event.path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '');
  let body = {};
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch (e) {}

  if (reqPath === '/store' && event.httpMethod === 'GET') {
    return { statusCode: 200, headers, body: JSON.stringify(memoryStoreState) };
  }

  if (reqPath === '/store' && event.httpMethod === 'POST') {
    if (body.settings) memoryStoreState.settings = { ...memoryStoreState.settings, ...body.settings };
    if (body.productOverrides) memoryStoreState.productOverrides = { ...memoryStoreState.productOverrides, ...body.productOverrides };
    if (Array.isArray(body.customProducts)) memoryStoreState.customProducts = body.customProducts;
    if (Array.isArray(body.deletedProductIds)) memoryStoreState.deletedProductIds = body.deletedProductIds;
    if (body.brandOverrides) memoryStoreState.brandOverrides = { ...memoryStoreState.brandOverrides, ...body.brandOverrides };
    if (Array.isArray(body.customBrands)) memoryStoreState.customBrands = body.customBrands;
    if (Array.isArray(body.orders)) memoryStoreState.orders = body.orders;
    if (body.replaceFullState) Object.assign(memoryStoreState, body.replaceFullState);
    memoryStoreState.updatedAt = new Date().toISOString();
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', state: memoryStoreState }) };
  }

  if (reqPath === '/orders' && event.httpMethod === 'POST') {
    const order = {
      id: 'KMC-' + Date.now().toString().slice(-6),
      createdAt: new Date().toISOString(),
      status: 'Pending',
      ...body
    };
    memoryStoreState.orders = [order, ...(memoryStoreState.orders || [])];
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', order }) };
  }

  if (reqPath.startsWith('/orders/') && event.httpMethod === 'PATCH') {
    const id = reqPath.split('/')[2];
    memoryStoreState.orders = (memoryStoreState.orders || []).map((o) =>
      o.id === id ? { ...o, status: body.status || o.status } : o
    );
    return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', orders: memoryStoreState.orders }) };
  }

  if (reqPath === '/kcbazar-import' && event.httpMethod === 'POST') {
    try {
      const { url, search } = body;
      let apiUrl = '';
      if (url) {
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
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Product not found on KC Bazar' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ status: 'ok', products: rawItems.map(normalizeKcBazarProduct) }) };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  if (reqPath === '/kcbazar-auto-sync') {
    try {
      const qs = event.queryStringParameters || {};
      const maxPages = qs.full === '1' || body.full === true ? 4 : 1;
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
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'ok',
          syncedAt: new Date().toISOString(),
          products: collected
        })
      };
    } catch (err) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
    }
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Route not found' }) };
};
