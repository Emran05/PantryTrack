import { supabase } from './supabase';

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
    .update(updates)
    .eq('id', userId)
    .select()
    .single();
    
  if (error) throw error;
  return data;
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
    
  if (pantryError) throw pantryError;
  
  // Add self as owner
  const { error: memberError } = await supabase
    .from('pantry_members')
    .insert({ pantry_id: pantry.id, user_id: user.id, role: 'owner' });
    
  if (memberError) throw memberError;
  
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

export async function inviteMemberByEmail(pantryId, email) {
  // We just insert their email into pantry_members. If they don't have an auth.users record yet,
  // user_id will be null. When they signup, we could link it, or if they exist, link their id.
  // For simplicity, let's just insert with email.
  const { data, error } = await supabase
    .from('pantry_members')
    .insert({ pantry_id: pantryId, email, role: 'member' })
    .select()
    .single();
  if (error) throw error;
  return data;
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

export async function addPantryItem(pantryId, item) {
  const payload = {
    pantry_id: pantryId,
    area_id: item.area_id || null,
    name: item.name,
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
  if (updates.expirationDate !== undefined) {
    payload.expiration_date = updates.expirationDate;
    delete payload.expirationDate;
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
    isChecked: item.is_checked
  }));
}

export async function addShoppingItem(pantryId, item) {
  const payload = {
    pantry_id: pantryId,
    name: item.name,
    quantity: item.quantity || 1,
    unit: item.unit || '',
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

export async function moveCheckedToPantry(pantryId) {
  const shoppingItems = await getShoppingList(pantryId);
  const checked = shoppingItems.filter((i) => i.isChecked);
  
  if (checked.length === 0) return 0;
  
  for (const item of checked) {
    await addPantryItem(pantryId, {
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: 'other'
    });
    await deleteShoppingItem(item.id);
  }
  
  return checked.length;
}

export async function processReceiptImage(imageBase64, mimeType = 'image/jpeg') {
  const { data, error } = await supabase.functions.invoke('process-receipt', {
    body: { imageBase64, mimeType }
  });
  if (error) throw error;
  return data.items || [];
}
