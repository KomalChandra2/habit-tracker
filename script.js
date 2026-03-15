const habitForm = document.getElementById('habit-form');
const habitInput = document.getElementById('habit-input');
const habitsList = document.getElementById('habits-list');
const emptyMsg = document.getElementById('empty-msg');

// Load habits from LocalStorage
let habits = JSON.parse(localStorage.getItem('simple_habits')) || [];

function saveHabits() {
    localStorage.setItem('simple_habits', JSON.stringify(habits));
}

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
        checkbox.addEventListener('change', () => {
            habits[index].completed = checkbox.checked;
            saveHabits();
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
        deleteBtn.addEventListener('click', () => {
            habits.splice(index, 1);
            saveHabits();
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
habitForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const text = habitInput.value.trim();
    if (!text) return;

    habits.push({ text, completed: false });
    habitInput.value = '';
    saveHabits();
    renderHabits();
});

// Initial render
renderHabits();
