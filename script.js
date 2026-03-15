const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const habitsList = document.getElementById('habits-list');
const emptyMsg = document.getElementById('empty-msg');
const syncStatus = document.getElementById('sync-status');

// ---- Supabase Configuration ----
const SUPABASE_URL = 'https://kejkzxftvtivnhomtmsg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dDeETO6-dy05fSIcyJrZvQ_4llfu_Uf';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ---- App State ----
let habits = [];

function setSyncing(active) {
    if (active) syncStatus.classList.add('active');
    else syncStatus.classList.remove('active');
}

// ---- Data Persistence (Supabase Cloud Sync) ----

async function loadHabits() {
    setSyncing(true);
    const { data, error } = await supabase
        .from('habits')
        .select('*')
        .order('created_at', { ascending: true });
    
    setSyncing(false);
    
    if (error) {
        console.error('Error fetching habits:', error);
        return [];
    }
    return data;
}

async function addHabit(text) {
    setSyncing(true);
    const { data, error } = await supabase
        .from('habits')
        .insert([{ text, completed: false }])
        .select();
    
    setSyncing(false);
    
    if (error) {
        console.error('Error adding habit:', error);
        return null;
    }
    return data[0];
}

async function toggleHabit(id, completed) {
    setSyncing(true);
    const { error } = await supabase
        .from('habits')
        .update({ completed })
        .eq('id', id);
    
    setSyncing(false);
    
    if (error) console.error('Error updating habit:', error);
}

async function deleteHabit(id) {
    setSyncing(true);
    const { error } = await supabase
        .from('habits')
        .delete()
        .eq('id', id);
    
    setSyncing(false);
    
    if (error) console.error('Error deleting habit:', error);
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
            habit.completed = checkbox.checked;
            await toggleHabit(habit.id, habit.completed);
            renderHabits();
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
            await deleteHabit(habit.id);
            // Local update will happen via subscription or re-fetch
            habits = habits.filter(h => h.id !== habit.id);
            renderHabits();
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

    habitInput.value = '';
    const newHabit = await addHabit(text);
    if (newHabit) {
        habits.push(newHabit);
        renderHabits();
    }
});

// ---- Real-time Subscription ----

function subscribeToChanges() {
    supabase
        .channel('habits-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'habits' }, async (payload) => {
            // Re-fetch all to keep it simple and consistent across devices
            habits = await loadHabits();
            renderHabits();
        })
        .subscribe();
}

// ---- Initialize ----

async function init() {
    habits = await loadHabits();
    renderHabits();
    subscribeToChanges();
}

init();
