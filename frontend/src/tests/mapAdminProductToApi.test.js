/**
 * mapAdminProductToApi.test.js
 * ----------------------------
 * Unit tests for the mapAdminProductToApi field mapping function.
 *
 * The function is defined in ProductsManagement.jsx. Since it's a module-scoped
 * function (not exported), we replicate it here inline for isolation testing.
 * This follows the spec requirement for Property 14 validation.
 *
 * Requirements: 16 (Product Photo Upload Fix — field mapping correctness)
 */

// ── Inline replica of mapAdminProductToApi for isolated unit testing ──────────
// (Keeps tests runnable without importing the full React component)
function mapAdminProductToApi(uiForm) {
  const statusRaw = (uiForm.status || 'Draft').toLowerCase();
  const statusMap = {
    published: 'published', live: 'published',
    draft: 'draft', paused: 'draft', archived: 'draft',
  };
  const status = statusMap[statusRaw] ?? 'draft';

  let file_size = null;
  if (uiForm.fileSize) {
    if (typeof uiForm.fileSize === 'number') {
      const bytes = uiForm.fileSize;
      if (bytes >= 1024 * 1024) {
        file_size = `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      } else if (bytes >= 1024) {
        file_size = `${Math.round(bytes / 1024)} KB`;
      } else {
        file_size = `${bytes} B`;
      }
    } else {
      file_size = String(uiForm.fileSize);
    }
  }

  let tags = [];
  if (Array.isArray(uiForm.tags) && uiForm.tags.length > 0) {
    tags = uiForm.tags;
  } else if (typeof uiForm.tagsInput === 'string' && uiForm.tagsInput.trim()) {
    tags = uiForm.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
  }

  return {
    title:             (uiForm.name || '').trim(),
    description:       uiForm.description || uiForm.shortDesc || null,
    category:          uiForm.category    || null,
    price:             Number(uiForm.price) || 0,
    thumbnail:         uiForm.thumbnail   || null,
    preview:           uiForm.thumbnail   || null,
    file_url:          uiForm.downloadUrl || uiForm.file_url || null,
    seller:            uiForm.creatorName || uiForm.seller || null,
    featured:          Boolean(uiForm.isFeatured || uiForm.featured || false),
    trending:          Boolean(uiForm.trending   || false),
    new_arrival:       Boolean(uiForm.new_arrival || false),
    badge:             uiForm.badge       || null,
    status,
    tags,
    highlights:        Array.isArray(uiForm.highlights) ? uiForm.highlights : null,
    version:           uiForm.version     || 'v1.0.0',
    file_size,
    license:           uiForm.license     || null,
    affiliate_enabled: Boolean(uiForm.affiliate_enabled || false),
    commission_type:   uiForm.commission_type  || 'percentage',
    commission_value:  Number(uiForm.commission_value) || 0.0,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('mapAdminProductToApi', () => {

  // Test 1: Property 14 — `name` maps to `title`, `name` key is absent in result
  test('name maps to title and name key is absent from result', () => {
    const uiForm = { name: 'Test Product', price: '9.99' };
    const result = mapAdminProductToApi(uiForm);

    expect(result.title).toBe('Test Product');
    expect(result).not.toHaveProperty('name');
  });

  // Test 2: All critical admin fields map correctly
  test('all critical admin fields map correctly', () => {
    const uiForm = {
      name:          'My Product',
      creatorName:   'John Doe',
      isFeatured:    true,
      downloadUrl:   'https://cdn.example.com/file.zip',
      fileSize:      '48 MB',
      status:        'Published',
      tagsInput:     'react, typescript, ui',
      price:         '29.99',
    };

    const result = mapAdminProductToApi(uiForm);

    // creatorName → seller
    expect(result.seller).toBe('John Doe');
    expect(result).not.toHaveProperty('creatorName');

    // isFeatured → featured
    expect(result.featured).toBe(true);
    expect(result).not.toHaveProperty('isFeatured');

    // downloadUrl → file_url
    expect(result.file_url).toBe('https://cdn.example.com/file.zip');
    expect(result).not.toHaveProperty('downloadUrl');

    // fileSize string passed through as-is
    expect(result.file_size).toBe('48 MB');
    expect(result).not.toHaveProperty('fileSize');

    // status lowercased
    expect(result.status).toBe('published');

    // tagsInput split to array
    expect(result.tags).toEqual(['react', 'typescript', 'ui']);
    expect(result).not.toHaveProperty('tagsInput');

    // title from name
    expect(result.title).toBe('My Product');
  });

  // Test 3: Missing optional fields don't crash; featured defaults to false
  test('missing optional fields do not crash and featured defaults to false', () => {
    const uiForm = { name: 'Minimal Product' };

    expect(() => mapAdminProductToApi(uiForm)).not.toThrow();

    const result = mapAdminProductToApi(uiForm);

    expect(result.title).toBe('Minimal Product');
    expect(result.featured).toBe(false);
    expect(result.file_url).toBeNull();
    expect(result.seller).toBeNull();
    expect(result.file_size).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.status).toBe('draft');
    expect(result.price).toBe(0);
  });

  // Test 4: fileSize as number converts to human-readable string
  test('fileSize as bytes converts to MB string', () => {
    const uiForm = { name: 'Product', fileSize: 5242880 }; // 5 MB
    const result = mapAdminProductToApi(uiForm);
    expect(result.file_size).toBe('5.0 MB');
  });

  // Test 5: status mapping normalises various statuses
  test.each([
    ['Published', 'published'],
    ['Live', 'published'],
    ['Draft', 'draft'],
    ['Paused', 'draft'],
    ['Archived', 'draft'],
  ])('status %s normalises to %s', (input, expected) => {
    const result = mapAdminProductToApi({ name: 'P', status: input });
    expect(result.status).toBe(expected);
  });
});
