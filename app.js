// Elements
const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const habitsList = document.getElementById('habits-list');
const statusDot = document.getElementById('status');
const loadingMsg = document.getElementById('loading');

// Config from User
const SUPABASE_URL = 'https://kejkzxftvtivnhomtmsg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_dDeETO6-dy05fSIcyJrZvQ_4llfu_Uf';

let supabaseClient = null;
let habits = [];

/**
 * 1. INITIALIZE SUPABASE
 */
function init() {
    try {
        if (window.supabase) {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            statusDot.classList.add('active');
            console.log("Supabase Ready");
            fetchHabits();
        } else {
            // Retry in case CDN is slow
            setTimeout(init, 500);
        }
    } catch (e) {
        console.error("Init Error:", e);
    }
}

/**
 * 2. FETCH HABITS
 */
async function fetchHabits() {
    const { data, error } = await supabaseClient
        .from('habits')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Fetch Error:", error);
        return;
    }

    habits = data || [];
    render();
}

/**
 * 3. ADD HABIT
 */
async function addHabit(text) {
    // Optimistic UI update
    const tempHabit = { id: Date.now(), text, completed: false, isTemp: true };
    habits.push(tempHabit);
    render();

    const { data, error } = await supabaseClient
        .from('habits')
        .insert([{ text, completed: false }])
        .select();

    if (error) {
        console.error("Add Error:", error);
        habits = habits.filter(h => h.id !== tempHabit.id); // Revert
        render();
        return;
    }

    // Replace temp with real
    const idx = habits.findIndex(h => h.id === tempHabit.id);
    if (idx !== -1) habits[idx] = data[0];
    render();
}

/**
 * 4. TOGGLE HABIT
 */
async function toggleHabit(id, completed) {
    // Update locally first
    const habit = habits.find(h => h.id === id);
    if (habit) habit.completed = completed;
    render();

    const { error } = await supabaseClient
        .from('habits')
        .update({ completed })
        .eq('id', id);

    if (error) {
        console.error("Toggle Error:", error);
        // We could revert here, but let's keep it simple for now
    }
}

/**
 * 5. DELETE HABIT
 */
async function deleteHabit(id) {
    // Update locally first
    habits = habits.filter(h => h.id !== id);
    render();

    const { error } = await supabaseClient
        .from('habits')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Delete Error:", error);
    }
}

/**
 * 6. RENDER UI
 */
function render() {
    loadingMsg.classList.add('hidden');
    habitsList.innerHTML = '';

    habits.forEach(habit => {
        const li = document.createElement('li');
        li.className = `habit-item ${habit.completed ? 'completed' : ''}`;

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'habit-checkbox';
        chk.checked = habit.completed;
        chk.onchange = () => toggleHabit(habit.id, chk.checked);

        const span = document.createElement('span');
        span.className = 'habit-text';
        span.textContent = habit.text;

        const del = document.createElement('button');
        del.className = 'delete-btn';
        del.innerHTML = '✕';
        del.onclick = () => deleteHabit(habit.id);

        li.appendChild(chk);
        li.appendChild(span);
        li.appendChild(del);
        habitsList.appendChild(li);
    });
}

/**
 * 7. EVENT LISTENERS
 */
habitForm.onsubmit = (e) => {
    e.preventDefault();
    const text = habitInput.value.trim();
    if (text) {
        addHabit(text);
        habitInput.value = '';
        habitInput.classList.add('hidden');
        document.querySelector('#add-btn .btn-text').textContent = "New Habit";
    }
};

// Add button interaction: Show input on click
document.getElementById('add-btn').onclick = (e) => {
    e.preventDefault();
    if (habitInput.classList.contains('hidden')) {
        habitInput.classList.remove('hidden');
        habitInput.focus();
        document.querySelector('#add-btn .btn-text').textContent = "Add";
    } else {
        habitForm.dispatchEvent(new Event('submit'));
    }
};

// Start
init();
