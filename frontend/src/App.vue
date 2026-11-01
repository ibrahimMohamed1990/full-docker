
<script setup>
import { ref, onMounted } from 'vue'

const tasks = ref([])
const newTitle = ref('')
const editingId = ref(null)
const editingTitle = ref('')
const loading = ref(false)
const error = ref('')

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }

  return data
}

async function loadTasks() {
  try {
    error.value = ''
    tasks.value = await request('/api/tasks')
  } catch (e) {
    error.value = e.message
  }
}

async function addTask() {
  const title = newTitle.value.trim()
  if (!title || loading.value) return

  try {
    loading.value = true
    error.value = ''

    const task = await request('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title }),
    })

    tasks.value.push(task)
    newTitle.value = ''
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

async function toggleTask(task) {
  try {
    error.value = ''

    const updated = await request(`/api/tasks/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify({ completed: !task.completed }),
    })

    Object.assign(task, updated)
  } catch (e) {
    error.value = e.message
  }
}

function startEditing(task) {
  editingId.value = task.id
  editingTitle.value = task.title
}

async function saveEdit(task) {
  const title = editingTitle.value.trim()
  if (!title) return

  try {
    error.value = ''

    const updated = await request(`/api/tasks/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify({ title , completed:false}),
    })

    Object.assign(task, updated)
    editingId.value = null
  } catch (e) {
    error.value = e.message
  }
}

async function deleteTask(id) {
  try {
    error.value = ''

    await request(`/api/tasks/${id}`, {
      method: 'DELETE',
    })

    tasks.value = tasks.value.filter(task => task.id !== id)
  } catch (e) {
    error.value = e.message
  }
}

onMounted(loadTasks)
</script>

<template>
  <main>
    <h1>Task Manager</h1>

    <form @submit.prevent="addTask">
      <input
        v-model="newTitle"
        placeholder="Enter a task..."
        maxlength="200"
      />
      <button type="submit" :disabled="loading || !newTitle.trim()">
        Add Task
      </button>
    </form>

    <p v-if="error" style="color: red">{{ error }}</p>

    <p v-if="tasks.length === 0">No tasks yet.</p>

    <ul>
      <li v-for="task in tasks" :key="task.id">
        <template v-if="editingId === task.id">
          <input v-model="editingTitle" maxlength="200" />
          <button @click="saveEdit(task)">Save</button>
          <button @click="editingId = null">Cancel</button>
        </template>

        <template v-else>
          <label>
            <input
              type="checkbox"
              :checked="task.completed"
              @change="toggleTask(task)"
            />
            <span :style="{
              textDecoration: task.completed ? 'line-through' : 'none'
            }">
              {{ task.title }}
            </span>
          </label>

          <button @click="startEditing(task)">Edit</button>
          <button @click="deleteTask(task.id)">Delete</button>
        </template>
      </li>
    </ul>
  </main>
</template>

<style>
body {
  font-family: Arial, sans-serif;
  margin: 40px;
}

main {
  max-width: 650px;
  margin: auto;
}

form {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

form input {
  flex: 1;
}

li {
  margin-bottom: 12px;
}

button {
  cursor: pointer;
  margin-left: 5px;
}
</style>
