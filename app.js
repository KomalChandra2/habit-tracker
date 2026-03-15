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
    renderHabits();
}

/**
 * 3. ADD HABIT
 */
async function addHabit(text) {
    // Optimistic UI update
    const tempHabit = { id: Date.now(), text, completed: false, isTemp: true };
    habits.push(tempHabit);
    renderHabits();

    const { data, error } = await supabaseClient
        .from('habits')
        .insert([{ text, completed: false }])
        .select();

    if (error) {
        console.error("Add Error:", error);
        habits = habits.filter(h => h.id !== tempHabit.id); // Revert
        renderHabits();
        return;
    }

    // Replace temp with real
    const idx = habits.findIndex(h => h.id === tempHabit.id);
    if (idx !== -1) habits[idx] = data[0];
    renderHabits();
}

/**
 * 4. TOGGLE HABIT
 */
async function toggleHabit(id, completed) {
    // Update locally first
    const habit = habits.find(h => h.id === id);
    if (habit) habit.completed = completed;
    renderHabits();

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
    renderHabits();

    const { error } = await supabaseClient
        .from('habits')
        .delete()
        .eq('id', id);

    if (error) {
        console.error("Delete Error:", error);
    }
}

/**
 * 6. UI RENDERING
 */
function renderHabits() {
    loadingEl.classList.add('hidden');
    habitsList.innerHTML = '';
    
    if (habits.length === 0) {
        habitsList.innerHTML = '<div class="loading-msg">No habits yet. Let\'s start!</div>';
        updateCount();
        return;
    }

    habits.forEach(habit => {
        const li = document.createElement('li');
        li.className = `habit-item ${habit.completed ? 'completed' : ''}`;
        
        li.innerHTML = `
            <input type="checkbox" class="habit-checkbox" ${habit.completed ? 'checked' : ''}>
            <span class="habit-text">${habit.text}</span>
            <button class="delete-btn" title="Delete"></button>
        `;

        // Checkbox Toggle
        li.querySelector('.habit-checkbox').onchange = (e) => {
            toggleHabit(habit.id, e.target.checked);
        };

        // Delete Button
        li.querySelector('.delete-btn').onclick = () => {
            deleteHabit(habit.id);
        };

        habitsList.appendChild(li);
    });

    updateCount();
}

function updateCount() {
    const countEl = document.getElementById('habits-count');
    if (!countEl) return;
    
    const remaining = habits.filter(h => !h.completed).length;
    countEl.textContent = `${remaining} remaining`;
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
    }
};

// Start
init();
