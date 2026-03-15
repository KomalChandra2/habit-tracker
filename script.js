const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const habitsList = document.getElementById('habits-list');
const emptyMsg = document.getElementById('empty-msg');
const syncStatus = document.getElementById('sync-status');

console.log("🚀 App initializing...");

// ---- Supabase Configuration ----
const SUPABASE_URL = 'https://kejkzxftvtivnhomtmsg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dDeETO6-dy05fSIcyJrZvQ_4llfu_Uf';

let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Supabase client created.");
} catch (e) {
    console.error("❌ Failed to create Supabase client:", e);
    alert("Supabase Error: " + e.message);
}

// ---- App State ----
let habits = [];

function setSyncing(active) {
    if (active) syncStatus.classList.add('active');
    else syncStatus.classList.remove('active');
}

// ---- Data Persistence (Supabase Cloud Sync) ----

async function loadHabits() {
    console.log("📡 Fetching habits from cloud...");
    setSyncing(true);
    
    try {
        const { data, error } = await supabase
            .from('habits')
            .select('*')
            .order('created_at', { ascending: true });
        
        setSyncing(false);
        
        if (error) {
            console.error('Error fetching habits:', error);
            if (error.message.includes("relation \"habits\" does not exist")) {
                alert("⚠️ Database Table Not Found!\n\nPlease make sure you ran the SQL setup script in your Supabase dashboard.");
            } else {
                alert("❌ Sync Error: " + error.message);
            }
            return [];
        }
        
        console.log(`✅ Loaded ${data?.length || 0} habits.`);
        return data || [];
    } catch (e) {
        setSyncing(false);
        console.error("❌ Unexpected error during load:", e);
        return [];
    }
}

async function addHabit(text) {
    setSyncing(true);
    try {
        const { data, error } = await supabase
            .from('habits')
            .insert([{ text, completed: false }])
            .select();
        
        setSyncing(false);
        
        if (error) {
            alert("❌ Failed to add: " + error.message);
            return null;
        }
        return data[0];
    } catch (e) {
        setSyncing(false);
        console.error("❌ Add exception:", e);
        return null;
    }
}

async function toggleHabit(id, completed) {
    setSyncing(true);
    const { error } = await supabase
        .from('habits')
        .update({ completed })
        .eq('id', id);
    
    setSyncing(false);
    if (error) alert("❌ Update failed: " + error.message);
}

async function deleteHabit(id) {
    setSyncing(true);
    const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id);
    
    setSyncing(false);
    if (error) alert("❌ Delete failed: " + error.message);
}

// ---- UI Rendering ----

function updateEmptyState() {
    emptyMsg.classList.toggle('visible', habits.length === 0);
}

function renderHabits() {
    habitsList.innerHTML = '';

    habits.forEach((habit) => {
        const li = document.createElement('li');
        li.className = `habit-item${habit.completed ? ' completed' : ''}`;

        // Checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'habit-checkbox';
        checkbox.checked = habit.completed;
        checkbox.addEventListener('change', async () => {
            const originalState = !checkbox.checked;
            habit.completed = checkbox.checked;
            renderHabits();
            
            await toggleHabit(habit.id, habit.completed);
        });

        // Text
        const span = document.createElement('span');
        span.className = 'habit-text';
        span.textContent = habit.text;

        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = '✕';
        deleteBtn.title = 'Delete habit';
        deleteBtn.addEventListener('click', async () => {
            const originalHabits = [...habits];
            habits = habits.filter(h => h.id !== habit.id);
            renderHabits();
            
            await deleteHabit(habit.id);
        });

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteBtn);
        habitsList.appendChild(li);
    });

    updateEmptyState();
}

// Handle form submit
habitForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = habitInput.value.trim();
    if (!text) return;

    const originalText = habitInput.value;
    habitInput.value = '';
    
    const newHabit = await addHabit(text);
    if (newHabit) {
        habits.push(newHabit);
        renderHabits();
    } else {
        habitInput.value = originalText;
    }
});

// ---- Real-time Subscription ----

function subscribeToChanges() {
    try {
        supabase
            .channel('habits-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, async (payload) => {
                console.log("🔄 Remote change detected, syncing...");
                habits = await loadHabits();
                renderHabits();
            })
            .subscribe();
        console.log("✅ Real-time sync active.");
    } catch (e) {
        console.warn("⚠️ Real-time subscription failed:", e);
    }
}

// ---- Initialize ----

async function init() {
    try {
        habits = await loadHabits();
        renderHabits();
        subscribeToChanges();
        console.log("✨ App ready.");
    } catch (e) {
        console.error("❌ Init failed:", e);
    }
}

init();
