const SeedData = require('./seed-data');
const deepCopy = require('./deep-copy');
const { sortTodoLists, sortTodos } = require('./sort');
const nextId = require("./next-id");

module.exports = class SessionPersistence {
  constructor(session) {
    this._todoList = session.todoList || deepCopy(SeedData);
    session.todoList = this._todoList;
  }

  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }

  // Returns a copy of the list of todos in the indicated todo list by sorted by
  // completion status and title (case-insensitive).
  sortTodos(todoList) {
    let undone = todoList.todos.filter(todo => !todo.done);
    let done = todoList.todos.filter(todo => todo.done);
    return deepCopy(sortTodos(undone, done));
  }

  // Returns a copy of the indicated todo in the indicated todo list.
  // Returns `undefined` if either the todo list or todo is not found.
  // Note that both IDs must be numeric.
  loadTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    return deepCopy(todo);
  }

  loadTodoList(todoListId) {
    let todoList = this._findTodoList(todoListId);
    return deepCopy(todoList);
  }

  sortedTodoLists() {
    let todoLists = deepCopy(this._todoList);
    let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    return sortTodoLists(undone, done);
  }

  // Delete a todo list from todo lists. Returns `true` if success otherwise `false`
  // ID argument must be a number
  deletedTodoList(todoListId) {
    let todoListIndex = this._todoList.findIndex(todoList => todoList.id === todoListId);

    if (todoListIndex === -1) return false;

    this._todoList.splice(todoListIndex, 1);
    return true;
  }

  setTodoListTitle(todoListId, title) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    todoList.title = title;
    return true;
  }

  existsTodoListTitle(title) {
    return this._todoList.some(todoList => todoList.title === title);
  }

  createTodoList(title) {
    this._todoList.push({
      title,
      todos: [],
      id: nextId(),
    })

    return true;
  }

  // Toggle a todo between the done and not done state.
  // Returns `true` on success, `false` if the todo or todo list
  // doesn't exist. The id arguments must be numeric
  toggleDoneTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    if (!todo) return false;

    todo.done = !todo.done;
    return true;
  }

  // Delete the specified todo from the specified todo list.
  // Returns `true` on success, `false` if the todo or todo list doesn't exist.
  // The id arguments must be numeric
  deletedTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    let todoIndex = todoList.todos.findIndex(todo => todo.id === todoId);
    if (todoIndex === -1) return false;

    todoList.todos.splice(todoIndex, 1);
    return true;
  }

  // Mark all todos on the todo list as done. Returns `true` on success,
  // `false` if the todo list doesn't exist. The todo list ID must be numeric
  completeAllTodos(todoListId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    todoList.todos.filter(todo => !todo.done)
                  .forEach(todo => todo.done = true);
    return true;
  }

  createTodo(todoListId, title) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    todoList.todos.push({
      title,
      id: nextId(),
      done: false,
    });

    return true;
  }

  isUniqueConstraingViolation(_error) {
    return false;
  }

  // Returns a reference to the todo list with the indicated ID.
  // Returns `undefined` if not found. `todoListId` must be numeric.
  _findTodoList(todoListId) {
    return this._todoList.find(todoList => todoList.id === todoListId);
  }

  // Returns a reference to the indicated todo in the indicated todo list.
  // Returns `undefined` if either the todo list or the todo is not found. Note
  // that both id's must be numeric.
  _findTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return undefined;

    return todoList.todos.find(todo => todo.id === todoId);
  }
};