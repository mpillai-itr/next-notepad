/* UNSAVED EDIT */ /* UNSAVED EDIT */ // Notepad-style demo: a tiny todo module
const todos = [];

function addTodo(title, done = false) {
  todos.push({ title, done, created: Date.now() });
  return todos.length;
}

class TodoList {
  constructor(items) { this.items = items; }
  pending() { return this.items.filter((t) => !t.done); }
  toString() { return `${this.pending().length} pending`; }
}

addTodo('write report');
addTodo('review PR', true);
addTodo('call Alice');
console.log(String(new TodoList(todos)));
