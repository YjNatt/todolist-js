const { dbQuery } = require('./db-query');
const bcrypt = require('bcrypt');

module.exports = class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }

  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.some(todo => !todo.done);
  }

  async authenticate(username, password) {
    const FIND_HASHED_PASSWORD = 'SELECT * FROM users ' +
                      'WHERE username = $1';

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password);
  }

  // Returns a copy of the list of todos in the indicated todo list by sorted by
  // completion status and title (case-insensitive).
  async sortTodos(todoList) {
    const FIND_TODOS = 'SELECT * FROM todos ' +
                       'WHERE todolist_id = $1 ' +
                          'AND username = $2 ' +
                       'ORDER BY done ASC, title ASC';

    let results = await dbQuery(FIND_TODOS, todoList.id, this.username);
    return results.rows;
  }

  // Returns a copy of the indicated todo in the indicated todo list.
  // Returns `undefined` if either the todo list or todo is not found.
  // Note that both IDs must be numeric.
  async loadTodo(todoListId, todoId) {
    const FIND_TODO = 'SELECT * FROM todos ' +
                      'WHERE todolist_id = $1 ' +
                        'AND id = $2 ' +
                        'AND username = $3';
    let result = await dbQuery(FIND_TODO, todoListId, todoId, this.username);
    return result.rows[0];
  }

  // Returns a promise that resolves to a todo list with the speciefied ID.
  // The todo list contains the todos for that list. The todos are not sorted.
  // If todo list is not found `undefined` is returned.
  async loadTodoList(todoListId) {
    const FIND_TODOLIST = 'SELECT * FROM todolists WHERE id = $1 AND username = $2';
    const FIND_TODOS = 'SELECT * FROM todos WHERE todolist_id = $1 AND username = $2';
    let resultTodoList = dbQuery(FIND_TODOLIST, todoListId, this.username);
    let resultTodos = dbQuery(FIND_TODOS, todoListId, this.username);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);

    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    todoList.todos = resultBoth[1].rows;
    return todoList;
  }

  // Returns a promise which resolves to a sorted list of todo lists
  // and along with all their todos. Lists are sorted by completion status
  // and title. Todos are unsorted.
  async sortedTodoLists() {
    const FIND_TODOLISTS = 'SELECT * FROM todolists' +
                           '  WHERE username = $1' +
                           '  ORDER BY lower(title) ASC';

    const FIND_TODOS = 'SELECT * FROM todos ' +
                       '  WHERE username = $1';

    let resultTodoLists = dbQuery(FIND_TODOLISTS, this.username);
    let resultTodos = dbQuery(FIND_TODOS, this.username);
    let resultBoth = await Promise.all([resultTodoLists, resultTodos])

    let allTodoLists = resultBoth[0].rows;
    let allTodos = resultBoth[1].rows;
    if (!allTodoLists || !allTodos) return undefined;

    allTodoLists.forEach(todoList => {
      todoList.todos = allTodos.filter(todo => {
        return todoList.id = todo.todolist_id;
      });
    });

    return this._partitionTodoLists(allTodoLists);
  }

  // Delete a todo list from todo lists. Returns `true` if success otherwise `false`
  // ID argument must be a number
  async deletedTodoList(todoListId) {
    const DELETE_TODOLIST = 'DELETE FROM todolists WHERE id = $1 AND username = $2';

    let result = await dbQuery(DELETE_TODOLIST, todoListId, this.username);
    return result.rowCount > 0;
  }

  async setTodoListTitle(todoListId, title) {
    const UPDATE_TODOLIST_TITLE = 'UPDATE todolists ' +
                                  'SET title = $1 ' +
                                  'WHERE id = $2 ' +
                                    'AND username = $3';

    let result = await dbQuery(UPDATE_TODOLIST_TITLE, title, todoListId, this.username);
    return result.rowCount > 0;
  }

  async existsTodoListTitle(title) {
    const TODOLIST_TITLE_EXIST = 'SELECT null FROM todolists ' +
                                 'WHERE title = $1 ' +
                                  'AND username = $2';

    let result = await(TODOLIST_TITLE_EXIST, title, this.username);
    result.rowCount > 0;
  }

  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  async createTodoList(title) {
    const CREATE_TODOLIST = 'INSERT INTO todolists (title, username) VALUES ($1, $2)';

    try {
      let result = await dbQuery(CREATE_TODOLIST, title, this.username);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  // Toggle a todo between the done and not done state.
  // Returns `true` on success, `false` if the todo or todo list
  // doesn't exist. The id arguments must be numeric
  async toggleDoneTodo(todoListId, todoId) {
    const TOGGLE_DONE = 'UPDATE todos ' +
                        'SET done = NOT done ' +
                        'WHERE todolist_id = $1 ' +
                          'AND id = $2 ' +
                          'AND username = $3';

    let result = await dbQuery(TOGGLE_DONE, todoListId, todoId, this.username);

    return result.rowCount > 0;
  }

  // Delete the specified todo from the specified todo list.
  // Returns `true` on success, `false` if the todo or todo list doesn't exist.
  // The id arguments must be numeric
  async deletedTodo(todoListId, todoId) {
    const DELETE_TODO = 'DELETE FROM todos ' +
                        'WHERE todolist_id = $1 ' +
                          'AND id = $2 ' +
                          'AND username = $3';

    let result = await dbQuery(DELETE_TODO, todoListId, todoId, this.username);
    return result.rowCount > 0;
  }

  // Mark all todos on the todo list as done. Returns `true` on success,
  // `false` if the todo list doesn't exist. The todo list ID must be numeric
  async completeAllTodos(todoListId) {
    const UPDATE_TODOLIST = 'UPDATE todos SET done = TRUE ' +
                            'WHERE todolist_id = $1 ' +
                              'AND NOT done ' +
                              'AND username = $2';
    let result = await dbQuery(UPDATE_TODOLIST, todoListId, this.username);
    return result.rowCount > 0;
  }

  async createTodo(todoListId, title) {
    const CREATE_TODO = 'INSERT INTO todos (todolist_id, title, username) ' +
                        'VALUES ($1, $2, $3)'

    let result = await dbQuery(CREATE_TODO, todoListId, title, this.username);
    return result.rowCount > 0;
  }

  _partitionTodoLists(todoLists) {
    let undone = [];
    let done = [];

    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) {
        done.push(todoList);
      } else {
        undone.push(todoList);
      }
    });

    return undone.concat(done);
  }
};