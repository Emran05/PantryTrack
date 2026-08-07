import { supabase } from './supabase';
import { getDefaultExpirationDate } from './helpers';
import { parseReceiptGemini, parseReceiptTextGemini, hasApiKey, hasUserKey, hasProjectKey } from './gemini';
import { checkRateLimit, consumeRateToken, formatResetTime } from './rateLimit';

// `ilike` treats % and _ as wildcards. Escape user input so a name like
// "100% Juice" or "ice_cream" matches literally during duplicate checks.
function escapeIlike(str) {
  return str.replace(/\\/g, '\\\\').replace(/[%_]/g, '\\$&');
}

// --- Profiles ---

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    throw error;
  }
  return data;
}

export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...updates })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Seed first_name / last_name from auth.user_metadata into the profiles row
// when the profile is missing or has blank names. Covers Google OAuth users
// (no signup form) and email signups when the project lacks a handle_new_user
// DB trigger. Idempotent — safe to call on every login.
export async function ensureProfileFromMetadata(user) {
  if (!user) return;
  const metaFirst =
    user.user_metadata?.first_name ||
    user.user_metadata?.given_name ||
    '';
  const metaLast =
    user.user_metadata?.last_name ||
    user.user_metadata?.family_name ||
    '';
  // If we have nothing useful to seed, don't touch the row.
  if (!metaFirst && !metaLast) return;

  try {
    const existing = await getProfile(user.id);
    const needsFirst = !existing?.first_name && metaFirst;
    const needsLast = !existing?.last_name && metaLast;
    if (!needsFirst && !needsLast) return;

    const updates = { id: user.id };
    if (needsFirst) updates.first_name = metaFirst;
    if (needsLast) updates.last_name = metaLast;

    const { error } = await supabase.from('profiles').upsert(updates);
    if (error) {
      console.error('Failed to seed profile from auth metadata:', error);
    }
  } catch (err) {
    console.error('ensureProfileFromMetadata error:', err);
  }
}

// --- Pantries & Members ---

export async function getUserPantries() {
  const { data, error } = await supabase
    .from('pantries')
    .select(`
      id,
      name,
      pantry_members!inner (role)
    `);
  if (error) throw error;
  return data;
}

export async function createPantry(name) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');
  
  // Create pantry
  const { data: pantry, error: pantryError } = await supabase
    .from('pantries')
    .insert({ name, created_by: user.id })
    .select()
    .single();
    
  if (pantryError) {
    console.error('Failed to create pantry:', pantryError);
    throw pantryError;
  }
  
  // Add self as owner — don't use .select().single() here;
  // the SELECT RLS policy can interfere right after insert
  const { error: memberError } = await supabase
    .from('pantry_members')
    .insert({ pantry_id: pantry.id, user_id: user.id, role: 'owner' });
    
  if (memberError) {
    console.error('Failed to add self as pantry member:', memberError);
    // Clean up the orphaned pantry
    await supabase.from('pantries').delete().eq('id', pantry.id);
    throw memberError;
  }
  
  return pantry;
}

export async function getPantryMembers(pantryId) {
  const { data, error } = await supabase
    .from('pantry_members')
    .select(`
      id,
      user_id,
      email,
      role
    `)
    .eq('pantry_id', pantryId);
  if (error) throw error;
  return data;
}

// Members joined to their profile (first_name, last_name, venmo_handle).
// Done as two queries because pantry_members → profiles isn't a declared FK
// in this repo, and PostgREST won't infer the join.
export async function getMembersWithProfiles(pantryId) {
  const members = await getPantryMembers(pantryId);
  if (!members || members.length === 0) return [];

  const userIds = members.map((m) => m.user_id).filter(Boolean);
  if (userIds.length === 0) return members.map((m) => ({ ...m, profile: null }));

  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, venmo_handle')
    .in('id', userIds);

  if (profErr) {
    console.error('Failed to load profiles for members', profErr);
    return members.map((m) => ({ ...m, profile: null }));
  }

  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  return members.map((m) => ({ ...m, profile: byId[m.user_id] || null }));
}

export async function joinPantryById(pantryId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not logged in');

  // Check if already a member
  const { data: existing } = await supabase
    .from('pantry_members')
    .select('id')
    .eq('pantry_id', pantryId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const err = new Error('You are already a member of this home');
    err.code = 'ALREADY_MEMBER';
    throw err;
  }

  const { error } = await supabase
    .from('pantry_members')
    .insert({ pantry_id: pantryId, user_id: user.id, email: user.email, role: 'member' });

  if (error) throw error;
}

// --- Areas ---
export async function getAreas(pantryId) {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('pantry_id', pantryId)
    .order('name');
  if (error) throw error;
  return data;
}

export async function createArea(pantryId, name) {
  const { data, error } = await supabase
    .from('areas')
    .insert({ pantry_id: pantryId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteArea(areaId) {
  const { error } = await supabase
    .from('areas')
    .delete()
    .eq('id', areaId);
  if (error) throw error;
}

// --- Pantry Items ---
export async function getPantryItems(pantryId) {
  const { data, error } = await supabase
    .from('pantry_items')
    .select(`
      id,
      pantry_id,
      area_id,
      name,
      category,
      quantity,
      unit,
      expiration_date,
      created_at,
      notes,
      areas ( name )
    `)
    .eq('pantry_id', pantryId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  
  // map to UI format
  return data.map(item => ({
    ...item,
    createdAt: item.created_at,
    expirationDate: item.expiration_date,
    areaName: item.areas?.name
  }));
}

// Fetch one item, scoped to a pantry so a stale URL can't surface another
// home's row. Returns null when not found (or not visible under RLS).
export async function getPantryItem(itemId, pantryId) {
  const { data, error } = await supabase
    .from('pantry_items')
    .select(`
      id,
      pantry_id,
      area_id,
      name,
      category,
      quantity,
      unit,
      expiration_date,
      created_at,
      notes,
      areas ( name )
    `)
    .eq('id', itemId)
    .eq('pantry_id', pantryId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data,
    createdAt: data.created_at,
    expirationDate: data.expiration_date,
    areaName: data.areas?.name,
  };
}

export async function addPantryItem(pantryId, item, { skipDuplicateCheck = false } = {}) {
  const trimmedName = (item.name || '').trim();
  if (!trimmedName) {
    throw new Error('Item name cannot be blank');
  }

  if (!skipDuplicateCheck) {
    const { data: existing } = await supabase
      .from('pantry_items')
      .select('id, name, quantity, unit')
      .eq('pantry_id', pantryId)
      .ilike('name', escapeIlike(trimmedName))
      .maybeSingle();

    if (existing) {
      const err = new Error(`"${trimmedName}" is already in your pantry`);
      err.code = 'DUPLICATE_ITEM';
      err.existing = existing;
      throw err;
    }
  }

  const payload = {
    pantry_id: pantryId,
    area_id: item.area_id && item.area_id !== '' ? item.area_id : null,
    name: trimmedName,
    category: item.category || 'other',
    quantity: item.quantity || 1,
    unit: item.unit || 'pcs',
    expiration_date: item.expirationDate || null,
    notes: item.notes || ''
  };
  const { data, error } = await supabase
    .from('pantry_items')
    .insert(payload)
    .select(`
      *,
      areas ( name )
    `)
    .single();
  if (error) throw error;

  return {
    ...data,
    expirationDate: data.expiration_date,
    areaName: data.areas?.name
  };
}

export async function updatePantryItem(itemId, updates) {
  const payload = { ...updates };

  // Empty strings on UUID/date columns cause Postgres errors. Coerce to null.
  if (updates.expirationDate !== undefined) {
    payload.expiration_date = updates.expirationDate || null;
    delete payload.expirationDate;
  }
  if (updates.area_id !== undefined) {
    payload.area_id = updates.area_id || null;
  }
  if (updates.name !== undefined) {
    const trimmed = (updates.name || '').trim();
    if (!trimmed) throw new Error('Item name cannot be blank');
    payload.name = trimmed;
  }

  const { data, error } = await supabase
    .from('pantry_items')
    .update(payload)
    .eq('id', itemId)
    .select(`
      *,
      areas ( name )
    `)
    .single();
  if (error) throw error;

  return {
    ...data,
    expirationDate: data.expiration_date,
    areaName: data.areas?.name
  };
}

export async function deletePantryItem(itemId) {
  const { error } = await supabase
    .from('pantry_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

// Decrement an item's quantity; delete the row if it would go to zero.
// Returns { removed, prevQty, newQty, name, category, unit, id, ... } so the
// caller can decide whether to log a waste event, prompt restock, etc.
export async function consumePantryItem(itemId, amountToConsume, pantryId) {
  if (amountToConsume <= 0) throw new Error('amountToConsume must be positive');

  // Preferred path: one row-locked transaction server-side. The read-then-write
  // fallback below loses a write when two housemates use the same item at once,
  // so only fall back when the RPC is genuinely missing (unapplied migrations).
  if (pantryId) {
    const { data, error } = await supabase.rpc('consume_pantry_item_atomic', {
      p_pantry_id: pantryId,
      p_item_id: itemId,
      p_qty: amountToConsume,
    });
    if (!error) {
      const row = (data || [])[0];
      if (row) {
        return {
          id: row.item_id,
          name: row.item_name,
          prevQty: row.prev_qty,
          newQty: row.new_qty,
          removed: row.removed,
        };
      }
    } else if (error.code !== 'PGRST202') {
      throw error;
    } else {
      console.warn('consume_pantry_item_atomic missing — apply supabase/migrations. Falling back to read-then-write.');
    }
  }

  const { data: current, error: getErr } = await supabase
    .from('pantry_items')
    .select('id, name, quantity, unit, category')
    .eq('id', itemId)
    .single();
  if (getErr) throw getErr;

  // Round to 2dp so 0.1 + 0.2 doesn't yield 0.30000000000000004 in the UI.
  const newQty = Math.max(0, Math.round((current.quantity - amountToConsume) * 100) / 100);

  if (newQty === 0) {
    const { error: delErr } = await supabase
      .from('pantry_items')
      .delete()
      .eq('id', itemId);
    if (delErr) throw delErr;
    return { ...current, removed: true, prevQty: current.quantity, newQty: 0 };
  }

  const { data, error } = await supabase
    .from('pantry_items')
    .update({ quantity: newQty })
    .eq('id', itemId)
    .select(`*, areas ( name )`)
    .single();
  if (error) throw error;

  return {
    ...data,
    expirationDate: data.expiration_date,
    areaName: data.areas?.name,
    removed: false,
    prevQty: current.quantity,
    newQty,
  };
}

// --- Shopping List ---
export async function getShoppingList(pantryId) {
  const { data, error } = await supabase
    .from('shopping_items')
    .select('*')
    .eq('pantry_id', pantryId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  
  return data.map(item => ({
    ...item,
    isChecked: item.is_checked,
    category: item.category || 'other'
  }));
}

export async function addShoppingItem(pantryId, item, { skipDuplicateCheck = false } = {}) {
  const trimmedName = (item.name || '').trim();
  if (!trimmedName) throw new Error('Item name cannot be blank');

  if (!skipDuplicateCheck) {
    const { data: existing } = await supabase
      .from('shopping_items')
      .select('id, name, quantity, unit')
      .eq('pantry_id', pantryId)
      .ilike('name', escapeIlike(trimmedName))
      .maybeSingle();

    if (existing) {
      const err = new Error(`"${trimmedName}" is already on your list`);
      err.code = 'DUPLICATE_ITEM';
      err.existing = existing;
      throw err;
    }
  }

  const payload = {
    pantry_id: pantryId,
    name: trimmedName,
    quantity: item.quantity || 1,
    unit: item.unit || 'pcs',
    category: item.category || 'other',
    is_checked: false
  };
  const { data, error } = await supabase
    .from('shopping_items')
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return { ...data, isChecked: data.is_checked };
}

export async function updateShoppingItem(itemId, updates) {
  const payload = { ...updates };
  if (updates.isChecked !== undefined) {
    payload.is_checked = updates.isChecked;
    delete payload.isChecked;
  }
  
  const { data, error } = await supabase
    .from('shopping_items')
    .update(payload)
    .eq('id', itemId)
    .select()
    .single();
  if (error) throw error;
  return { ...data, isChecked: data.is_checked };
}

export async function deleteShoppingItem(itemId) {
  const { error } = await supabase
    .from('shopping_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

// Returns { moved, failed }. Primary path is the move_checked_to_pantry RPC —
// one transaction, so an insert can never land without its shopping-row delete
// (the old client loop could half-complete on a dropped connection). Falls back
// to the loop when the migration hasn't been applied yet.
export async function moveCheckedToPantry(pantryId) {
  const shoppingItems = await getShoppingList(pantryId);
  const checked = shoppingItems.filter((i) => i.isChecked);

  if (checked.length === 0) return { moved: 0, failed: 0 };

  // Expiration defaults are computed here because the category → shelf-life
  // mapping lives in helpers.js, not the database.
  const moves = checked.map((item) => ({
    id: item.id,
    expiration_date: getDefaultExpirationDate(item.category || 'other') || '',
  }));

  const { data, error } = await supabase.rpc('move_checked_to_pantry', {
    p_pantry_id: pantryId,
    p_moves: moves,
  });
  if (!error) {
    return { moved: data?.moved ?? 0, failed: data?.failed ?? 0 };
  }
  if (error.code !== 'PGRST202') throw error;
  console.warn('move_checked_to_pantry RPC missing — apply supabase/migrations. Falling back to per-item moves.');

  // Fallback: add all checked items in parallel (skip per-item duplicate check —
  // users intentionally restock items they've run out of), then delete only the
  // shopping rows whose insert succeeded.
  const addResults = await Promise.allSettled(checked.map(item => {
    const category = item.category || 'other';
    return addPantryItem(pantryId, {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category,
      expirationDate: getDefaultExpirationDate(category)
    }, { skipDuplicateCheck: true });
  }));

  const landed = checked.filter((_, i) => addResults[i].status === 'fulfilled');
  const failed = checked.length - landed.length;
  addResults
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.error('Failed to move item to pantry:', r.reason));

  const deleteResults = await Promise.allSettled(landed.map(item => deleteShoppingItem(item.id)));
  deleteResults
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.error('Failed to remove moved shopping item:', r.reason));

  return { moved: landed.length, failed };
}

// All-or-nothing receipt import via the import_receipt_items RPC. Returns
// { added, failed, atomic }. Falls back to per-item inserts (which can
// partially land) when the migration hasn't been applied yet.
export async function importReceiptItems(pantryId, items) {
  const payload = items.map((item) => ({
    name: item.name,
    category: item.category || 'other',
    quantity: item.quantity || 1,
    unit: item.unit || 'pcs',
    expiration_date: item.expirationDate || '',
    area_id: item.area_id || '',
    notes: item.notes || '',
  }));

  const { data, error } = await supabase.rpc('import_receipt_items', {
    p_pantry_id: pantryId,
    p_items: payload,
  });
  if (!error) {
    return { added: data ?? payload.length, failed: 0, atomic: true };
  }
  if (error.code !== 'PGRST202') throw error;
  console.warn('import_receipt_items RPC missing — apply supabase/migrations. Falling back to per-item inserts.');

  const results = await Promise.allSettled(
    items.map((item) => addPantryItem(pantryId, item, { skipDuplicateCheck: true }))
  );
  const added = results.filter((r) => r.status === 'fulfilled').length;
  results
    .filter((r) => r.status === 'rejected')
    .forEach((r) => console.error('Failed to import receipt item:', r.reason));
  return { added, failed: results.length - added, atomic: false };
}

// Shared rate-limit pre-flight for any "receipts" path (image or OCR-text).
// Picks the right tier given which keys are configured and which buckets have
// tokens, then invokes `parser({ skipUser })` against gemini.js. If a mid-call
// fallback fires, the project bucket is also charged so quota matches reality.
async function withReceiptRateLimit(parser) {
  if (!hasApiKey()) {
    const err = new Error('Receipt scanning needs a Gemini API key — add one in Settings.');
    err.code = 'NO_API_KEY';
    throw err;
  }

  const userAvailable = hasUserKey();
  const projectAvailable = hasProjectKey();
  const userLimit = userAvailable ? checkRateLimit('receipts_user') : null;
  const projectLimit = projectAvailable ? checkRateLimit('receipts_project') : null;

  let preferredTier;
  let skipUser;
  if (userAvailable && userLimit.allowed) {
    preferredTier = 'user';
    skipUser = false;
  } else if (projectAvailable && projectLimit.allowed) {
    preferredTier = 'project';
    skipUser = userAvailable;
  } else {
    const resets = [userLimit?.resetIn, projectLimit?.resetIn].filter((v) => v != null);
    const resetIn = resets.length ? Math.min(...resets) : 0;
    const err = new Error(`Receipt scan limit reached — try again in ${formatResetTime(resetIn)}.`);
    err.code = 'RATE_LIMITED';
    err.resetIn = resetIn;
    err.resetLabel = formatResetTime(resetIn);
    err.tier = userAvailable && !userLimit.allowed ? 'user' : 'project';
    throw err;
  }

  consumeRateToken(`receipts_${preferredTier}`);
  const result = await parser({ skipUser });
  if (preferredTier === 'user' && result.tier === 'project') {
    consumeRateToken('receipts_project');
  }
  return result; // { items, tier, fellBack }
}

/**
 * Parse OCR-extracted receipt text into pantry items via Gemini.
 * Primary scan path — much cheaper than Vision because there are no image tokens.
 *
 * Returns { items, tier, fellBack }.
 */
export async function processReceiptText(rawText, lines) {
  return withReceiptRateLimit((tierOpts) => parseReceiptTextGemini(rawText, lines, tierOpts));
}

/**
 * Parse a receipt image directly via Gemini Vision. Used as a fallback when
 * the browser OCR returns nothing usable (very dark photo, weird crop, etc.).
 *
 * Returns { items, tier, fellBack }.
 */
export async function processReceiptImage(imageBase64, mimeType = 'image/jpeg') {
  return withReceiptRateLimit((tierOpts) => parseReceiptGemini(imageBase64, mimeType, tierOpts));
}

/**
 * Consume several pantry items in ONE transaction ("I cooked this").
 * All deductions land or none do — a partial deduction leaves the user with a
 * pantry that silently disagrees with what they actually cooked.
 * Falls back to per-item writes only when the RPC is missing (unapplied
 * migrations), and reports that it did so.
 */
export async function consumePantryItems(pantryId, entries) {
  const payload = entries.map(({ id, qty }) => ({ id, qty }));

  const { data, error } = await supabase.rpc('consume_pantry_items', {
    p_pantry_id: pantryId,
    p_items: payload,
  });
  if (!error) {
    return {
      atomic: true,
      results: (data ?? []).map((r) => ({
        id: r.item_id,
        name: r.item_name,
        prevQty: r.prev_qty,
        newQty: r.new_qty,
        removed: r.removed,
      })),
    };
  }
  if (error.code !== 'PGRST202') throw error;
  console.warn('consume_pantry_items RPC missing — apply supabase/migrations. Falling back to per-item writes.');

  const settled = await Promise.allSettled(
    entries.map(({ id, qty }) => consumePantryItem(id, qty))
  );
  settled.filter((r) => r.status === 'rejected')
    .forEach((r) => console.error('Consume failed:', r.reason));
  return {
    atomic: false,
    results: settled.filter((r) => r.status === 'fulfilled').map((r) => ({
      id: r.value.id, name: r.value.name, prevQty: r.value.prevQty,
      newQty: r.value.newQty, removed: r.value.removed,
    })),
    failed: settled.filter((r) => r.status === 'rejected').length,
  };
}

/** Rename a household you belong to. */
export async function renamePantry(pantryId, name) {
  const { error } = await supabase.rpc('rename_pantry', { p_pantry_id: pantryId, p_name: name });
  if (error) throw error;
}

/**
 * Leave a household. If you were its last member it is deleted along with its
 * contents (an orphaned household is invisible but keeps holding rows).
 * Returns 'left' or 'deleted' so the UI can say what actually happened.
 */
export async function leavePantry(pantryId) {
  const { data, error } = await supabase.rpc('leave_pantry', { p_pantry_id: pantryId });
  if (error) throw error;
  return data;
}
