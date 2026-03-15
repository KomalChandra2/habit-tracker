// Elements
const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const habitsList = document.getElementById('habits-list');
const emptyMsg = document.getElementById('empty-msg');
const syncStatus = document.getElementById('sync-status');

// Configuration
const SUPABASE_URL = 'https://kejkzxftvtivnhomtmsg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dDeETO6-dy05fSIcyJrZvQ_4llfu_Uf';

// State
let habits = [];
let supabase = null;

/**
 * INITIALIZATION
 * Ensure the UI works even if Supabase is slow or fails to load.
 */
function initSupabase() {
    try {
        if (window.supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            console.log("✅ Supabase initialized");
            return true;
        }
    } catch (e) {
        console.error("❌ Supabase init failed:", e);
    }
    console.warn("⚠️ Supabase not ready yet");
    return false;
}

function setSyncing(active) {
    if (syncStatus) {
        syncStatus.classList.toggle('active', active);
    }
}

/**
 * DATABASE OPERATIONS (Cloud Sync)
 */
async function loadHabitsFromCloud() {
    if (!supabase && !initSupabase()) return null;
    
    setSyncing(true);
    try {
        const { data, error } = await supabase
            .from('habits')
            .select('*')
            .order('created_at', { ascending: true });
        
        if (error) throw error;
        return data;
    } catch (e) {
        console.error("❌ Cloud load failed:", e);
        return null;
    } finally {
        setSyncing(false);
    }
}

async function saveHabitToCloud(text) {
    if (!supabase && !initSupabase()) return null;

    setSyncing(true);
    try {
        const { data, error } = await supabase
            .from('habits')
            .insert([{ text, completed: false }])
            .select();
        
        if (error) throw error;
        return data[0];
    } catch (e) {
        console.error("❌ Cloud save failed:", e);
        return null;
    } finally {
        setSyncing(false);
    }
}

async function toggleHabitInCloud(id, completed) {
    if (!supabase && !initSupabase()) return;

    setSyncing(true);
    try {
        await supabase.from('habits').update({ completed }).eq('id', id);
    } catch (e) {
        console.error("❌ Cloud update failed:", e);
    } finally {
        setSyncing(false);
    }
}

async function deleteHabitFromCloud(id) {
    if (!supabase && !initSupabase()) return;

    setSyncing(true);
    try {
        await supabase.from('habits').delete().eq('id', id);
    } catch (e) {
        console.error("❌ Cloud delete failed:", e);
    } finally {
        setSyncing(false);
    }
}

/**
 * UI RENDERING
 */
function renderHabits() {
    habitsList.innerHTML = '';
    
    habits.forEach((habit, index) => {
        const li = document.createElement('li');
        li.className = `habit-item${habit.completed ? ' completed' : ''}`;

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'habit-checkbox';
        checkbox.checked = habit.completed;
        checkbox.addEventListener('change', async () => {
            habit.completed = checkbox.checked;
            renderHabits(); // Instant UI update
            await toggleHabitInCloud(habit.id, habit.completed);
        });

        // Text
        const span = document.createElement('span');
        span.className = 'habit-text';
        span.textContent = habit.text;

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.addEventListener('click', async () => {
            habits.splice(index, 1);
            renderHabits(); // Instant UI update
            await deleteHabitFromCloud(habit.id);
        });

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        habitsList.appendChild(li);
    });

    emptyMsg.classList.toggle('visible', habits.length === 0);
}

/**
 * EVENT LISTENERS
 */
habitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const text = habitInput.value.trim();
    if (!text) return;

    // 1. Clear input immediately
    habitInput.value = '';

    // 2. Add to UI immediately (with a temp ID)
    const tempId = Date.now();
    const newHabit = { id: tempId, text, completed: false, isTemp: true };
    habits.push(newHabit);
    renderHabits();

    // 3. Save to Cloud in background
    const savedHabit = await saveHabitToCloud(text);
    if (savedHabit) {
        // Replace temp habit with real one from DB
        const idx = habits.findIndex(h => h.id === tempId);
        if (idx !== -1) {
            habits[idx] = savedHabit;
            renderHabits();
        }
    }
});

/**
 * REAL-TIME SYNC
 */
function setupRealtime() {
    if (!supabase) return;
    
    supabase
        .channel('habits-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, async () => {
            const data = await loadHabitsFromCloud();
            if (data) {
                habits = data;
                renderHabits();
            }
        })
        .subscribe();
}

/**
 * START THE APP
 */
async function startApp() {
    // Initial UI render (empty)
    renderHabits();

    // Wait for Supabase to be ready (retry for 3 seconds)
    let retries = 0;
    while (!initSupabase() && retries < 10) {
        await new Promise(r => setTimeout(r, 300));
        retries++;
    }

    // Load actual data
    const cloudData = await loadHabitsFromCloud();
    if (cloudData) {
        habits = cloudData;
        renderHabits();
        setupRealtime();
    }
}

startApp();
