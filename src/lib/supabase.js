import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hbkwbjkicmhtlsiiavjh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhia3diamtpY21odGxzaWlhdmpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MzYzNjksImV4cCI6MjA5MDQxMjM2OX0.Qs7j8w_TSBtt7HgyYqTDNeZikF6LRKE02UhTeR_kkVI';

export const supabase = createClient(supabaseUrl, supabaseKey);
