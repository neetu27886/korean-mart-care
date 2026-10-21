#!/usr/bin/env node
/**
 * Korean Mart Care — Automated KC Bazar Skin Care Catalog Sync Script
 * Fetches all Skin Care (category=196) products from https://kcbazar.com/wp-json/wc/store/v1/products,
 * strips "free delivery" text, preserves 110 TK delivery setting, and updates public/data/catalog.json.
 * Runs automatically via GitHub Actions (.github/workflows/kcbazar-auto-sync.yml) or `npm run sync-kcbazar`.
 */

const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '..', 'public', 'data', 'catalog.json');
const SKIN_CARE_CATEGORY_ID = 196;

const EXCLUDE_KEYWORDS = [
  'lipstick', 'lip tint', 'blush', 'mascara', 'eyeliner', 'eyeshadow',
  'nail', 'cushion', 'foundation', 'concealer', 'highlighter', 'contour',
  'brow', 'shampoo', 'conditioner', 'hair oil', 'hair serum', 'hair mask',
  'body wash', 'shower gel', 'body lotion', 'toothpaste', 'toothbrush', 'perfume'
];

function stripFreeDelivery(html = '') {
  if (!html) return '';
  return html
    .replace(/সারাদেশে শর্তহীন ফ্রী হোম ডেলিভারি[^<।!\n]*/gi, '')
    .replace(/ফ্রী হোম ডেলিভারি/gi, 'হোম ডেলিভারি চার্জ ১১০ টাকা')
    .replace(/ফ্রি হোম ডেলিভারি/gi, 'হোম ডেলিভারি চার্জ ১১০ টাকা')
    .replace(/free\s+home\s+delivery[^<.\n]*/gi, 'Home delivery charge 110 TK')
    .replace(/free\s+delivery[^<.\n]*/gi, 'Delivery charge 110 TK');
}

function parseKcbazarProduct(raw) {
  const name = raw.name || '';
  const nameLower = name.toLowerCase();

  for (const kw of EXCLUDE_KEYWORDS) {
    if (nameLower.includes(kw)) return null;
  }

  const priceHtml = raw.price_html || '';
  const delMatch = priceHtml.match(/<del[\s\S]*?([\d,]+(?:\.\d+)?)\s*<\/bdi>/i);
  const insMatch = priceHtml.match(/<ins[\s\S]*?([\d,]+(?:\.\d+)?)\s*<\/bdi>/i);
  const soldMatch = priceHtml.match(/Sold:\s*([\d,]+)\s*pcs/i);

  let regularPrice = parseInt(raw.prices?.regular_price || raw.prices?.price || '0', 10) || 0;
  let salePrice = parseInt(raw.prices?.sale_price || raw.prices?.price || '0', 10) || regularPrice;

  if (delMatch) regularPrice = Math.round(parseFloat(delMatch[1].replace(/,/g, '')));
  if (insMatch) salePrice = Math.round(parseFloat(insMatch[1].replace(/,/g, '')));
  if (!salePrice && regularPrice) salePrice = regularPrice;
  if (!regularPrice && salePrice) regularPrice = salePrice;

  const discountPercent =
    regularPrice > salePrice && regularPrice > 0
      ? Math.round(((regularPrice - salePrice) / regularPrice) * 100)
      : 0;
  const soldCount = soldMatch ? parseInt(soldMatch[1].replace(/,/g, ''), 10) || 0 : 0;

  let brand = 'Korean Skincare';
  let brandSlug = 'korean-skincare';
  let weight = '';

  for (const attr of raw.attributes || []) {
    if (attr.taxonomy === 'pa_brand' && attr.terms && attr.terms.length) {
      brand = attr.terms[0].name;
      brandSlug = attr.terms[0].slug;
    } else if (attr.taxonomy === 'pa_weight' && attr.terms && attr.terms.length) {
      weight = attr.terms.map((t) => t.name).join(', ');
    }
  }

  const images = (raw.images || []).map((img) => img.src).filter(Boolean);
  if (!images.length) return null;

  const categories = (raw.categories || []).map((c) => ({
    id: c.id,
    name: c.name.replace(/&amp;/g, '&'),
    slug: c.slug
  }));

  const specificCat =
    categories.find((c) => !['skin-care', 'skin-care-solution', 'all-products'].includes(c.slug)) ||
    categories[0] || { name: 'Skin Care', slug: 'skin-care' };

  const isTrial =
    categories.some((c) => c.slug === 'trial-version') ||
    nameLower.includes('1.5ml') ||
    salePrice < 100;

  return {
    id: raw.id,
    name: name.replace(/&amp;/g, '&'),
    slug: raw.slug,
    sku: raw.sku || '',
    brand,
    brandSlug,
    regularPrice,
    salePrice,
    discountPercent,
    soldCount,
    inStock: Boolean(raw.is_in_stock),
    isTrial,
    images,
    categories,
    primaryCategory: specificCat.name,
    primaryCategorySlug: specificCat.slug,
    weight,
    description: stripFreeDelivery(raw.description || ''),
    kcbazarUrl: raw.permalink || `https://kcbazar.com/product/${raw.slug}/`
  };
}

async function runSync() {
  console.log('🔄 Starting automated KC Bazar Skin Care sync...');
  let existingCatalog = { settings: {}, brands: [], categories: [], products: [] };
  if (fs.existsSync(CATALOG_PATH)) {
    try {
      existingCatalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    } catch (e) {}
  }

  const existingProdMap = new Map((existingCatalog.products || []).map((p) => [String(p.id), p]));
  const allProductsMap = new Map();
  // Seed with existing products so previous rates are preserved
  for (const ep of existingCatalog.products || []) {
    allProductsMap.set(ep.id, ep);
  }

  for (let page = 1; page <= 12; page++) {
    const url = `https://kcbazar.com/wp-json/wc/store/v1/products?category=${SKIN_CARE_CATEGORY_ID}&per_page=100&page=${page}`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; KoreanMartCareAutoSync/1.0)',
          Accept: 'application/json'
        }
      });
      if (!res.ok) break;
      const items = await res.json();
      if (!Array.isArray(items) || items.length === 0) break;

      for (const raw of items) {
        const parsed = parseKcbazarProduct(raw);
        if (parsed) {
          const prev = existingProdMap.get(String(parsed.id));
          if (prev && prev.salePrice > 0) {
            // Preserve previous rate (old salePrice / regularPrice / discountPercent)
            parsed.salePrice = prev.salePrice;
            parsed.regularPrice = prev.regularPrice || parsed.regularPrice;
            parsed.discountPercent = prev.discountPercent ?? parsed.discountPercent;
          }
          allProductsMap.set(parsed.id, parsed);
        }
      }
      console.log(`  Page ${page}: fetched ${items.length} items (total curated: ${allProductsMap.size})`);
      if (items.length < 100) break;
    } catch (err) {
      console.error(`  Error on page ${page}:`, err.message);
      break;
    }
  }

  if (allProductsMap.size < 50) {
    console.log('⚠️ Too few products returned from KC Bazar, keeping existing catalog safe.');
    return;
  }

  const products = Array.from(allProductsMap.values());
  products.sort((a, b) => {
    if (a.slug === 'beauty-of-joseon-matte-sun-stick') return -1;
    if (b.slug === 'beauty-of-joseon-matte-sun-stick') return 1;
    if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
    if (Boolean(a.isTrial) !== Boolean(b.isTrial)) return a.isTrial ? 1 : -1;
    if ((b.images?.length || 0) !== (a.images?.length || 0)) {
      return (b.images?.length || 0) - (a.images?.length || 0);
    }
    return (b.soldCount || 0) - (a.soldCount || 0);
  });

  // Rebuild brands & categories summary
  const brandMap = new Map();
  const catMap = new Map();
  for (const p of products) {
    if (p.brandSlug && p.brandSlug !== 'korean-skincare') {
      if (!brandMap.has(p.brandSlug)) {
        brandMap.set(p.brandSlug, {
          name: p.brand,
          slug: p.brandSlug,
          count: 0,
          sampleImage: p.images?.[0] || '',
          featured: true
        });
      }
      brandMap.get(p.brandSlug).count += 1;
    }
    if (p.primaryCategorySlug) {
      if (!catMap.has(p.primaryCategorySlug)) {
        catMap.set(p.primaryCategorySlug, {
          name: p.primaryCategory,
          slug: p.primaryCategorySlug,
          count: 0
        });
      }
      catMap.get(p.primaryCategorySlug).count += 1;
    }
  }

  const updatedCatalog = {
    ...existingCatalog,
    lastSyncedAt: new Date().toISOString(),
    brands: Array.from(brandMap.values()).sort((a, b) => b.count - a.count),
    categories: Array.from(catMap.values()).sort((a, b) => b.count - a.count),
    products
  };

  fs.writeFileSync(CATALOG_PATH, JSON.stringify(updatedCatalog), 'utf8');
  console.log(`✅ Synced ${products.length} Skin Care products and ${updatedCatalog.brands.length} brands into public/data/catalog.json`);
}

runSync();
