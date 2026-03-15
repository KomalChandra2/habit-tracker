const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const habitsList = document.getElementById('habits-list');
const emptyMsg = document.getElementById('empty-msg');

// ---- Dual Storage Persistence (IndexedDB + LocalStorage Backup) ----

const DB_NAME = 'HabitTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'habits';

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function loadHabits() {
    let habitsArr = [];
    
    // 1. Try loading from IndexedDB
    try {
        const db = await openDB();
        habitsArr = await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.warn('IndexedDB load failed:', e);
    }

    // 2. Fallback/Sync with LocalStorage
    const localBackup = JSON.parse(localStorage.getItem('habits_backup')) || [];
    
    // If IndexedDB is empty but LocalStorage has data, use LocalStorage (Recovery)
    if (habitsArr.length === 0 && localBackup.length > 0) {
        habitsArr = localBackup;
        console.log('Restored from LocalStorage backup');
    } 
    // If both have data, merge or prefer the one with more/newer data (simplified: prefer IndexedDB)
    else if (habitsArr.length > 0) {
        // Sync LocalStorage to match IndexedDB
        localStorage.setItem('habits_backup', JSON.stringify(habitsArr));
    }

    return habitsArr;
}

async function saveAllHabits(updatedHabits) {
    // 1. Save to LocalStorage immediately (synchronous backup)
    localStorage.setItem('habits_backup', JSON.stringify(updatedHabits));

    // 2. Save to IndexedDB (asynchronous primary)
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        updatedHabits.forEach(h => store.put(h));
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error('IndexedDB save failed:', e);
    }
}

// ---- App State ----

let habits = [];

function updateEmptyState() {
    emptyMsg.classList.toggle('visible', habits.length === 0);
}

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
            habits[index].completed = checkbox.checked;
            await saveAllHabits(habits);
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
            habits.splice(index, 1);
            await saveAllHabits(habits);
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

    habits.push({ id: Date.now(), text, completed: false });
    habitInput.value = '';
    await saveAllHabits(habits);
    renderHabits();
});

// ---- Initialize ----

async function init() {
    habits = await loadHabits();
    renderHabits();
}

init();
