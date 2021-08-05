import { html, Component, render } from 'https://unpkg.com/htm/preact/standalone.module.js';

// Constants for displaying SQL editor or column mapper UI
const SQL = 1;
const COL_MAP = 2;

/**
 * Try to split a query into column mappings and 'from ____'
 * query parts for use in a simplified (non-SQL editor)
 * UI. When this fails, we return undefined, which means we'll
 * have to use the SQL query editor.
 */
function try_parse_query(sql) {
  // split columns from "from ______" part of the query
  const matches = sql.replace(
    /[\n\r]+/g, ' '
  ).match(
    /select\s+(.*)\s+from\s+(.*)/i
  );
  if (matches.length !== 3) {
    console.error("Couldn't parse SQL:", sql);
    return;
  }
  const [_, row_mappings, from_clause ] = matches;
  const mappings_array = row_mappings.split(/,\s?/).map((mapping) => {
    const [ table, index ] = mapping.split(/\s+as\s+/i);
    if (!table || !index) {
      console.error("Couldn't parse mapping:", mapping);
      return;
    }
    return {
      "index_col": index,
      "table_col": table,
    }
  }).filter(x=>x);
  const mappings = {};
  mappings_array.forEach(({index_col, table_col}) => {
    mappings[index_col] = table_col;
  });
  return {
    "mappings": mappings,
    "from_clause": from_clause,
  };
}

const json_str = document.getElementById('props').textContent;
/**
 * Props keys:
 *
 * csrftoken: string
 * config: db_name -> table_rule_name (usually table name) -> sql -> query for indexing
 * dbs: db_name -> table/view_name -> [ column1, column2, ... ]
 * help_text: dogsheep_col -> help text str
 * dogsheep_columns: [ key, title, search_1, ... all possible dogsheep cols ]
 * dogsheep_categories: [ {id: int, name: category str}, ... ]
 *
 * State:
 *
 * Controlling if a SQL editor or column mapper is displayed:
 * editor: db_name -> table_rule_name -> SQL|COL_MAP
 */
const props = JSON.parse(json_str);
// check index configs to see if we can parse the SQL back into
// column mapped arrays. if so, we'll use the col mapper UI.
const editor_state = {};
Object.entries(props.dbs).map(([db_name, tables]) => {
  const db_conf = props.config[db_name];
  if (editor_state[db_name] === undefined) editor_state[db_name] = {};
  Object.entries(tables).map(([table_name, _]) => {
    if (!db_conf) return;
    const table_conf = db_conf[table_name]
    if (!table_conf || !table_conf.sql) return;
    if (try_parse_query(table_conf.sql)) {
      editor_state[db_name][table_name] = COL_MAP;
    }
    return;
  });
});

props.name = "world";
window.PROPS = props;
window.EDITOR_STATE = editor_state;

class App extends Component {
  state = { editor: editor_state };

  get_option(value, label, selected) {
    if (selected)
      return html`<option value="${value}" selected>${label}</option>`;
    else
      return html`<option value="${value}">${label}</option>`;
  }

  table_row(index_col, table_col, available_table_columns) {
    const title_case = (s) => s[0] + s.slice(1,s.length);
    const placeholder = this.props.help_text[index_col];
    const html_options = available_table_columns.map((col) => {
      let selected = false;
      if (table_col === col) {
        selected = true;
      }
      return this.get_option(col, title_case(col), selected);
    });
    return html`<tr>
      <td class="key">
        <div class="tooltip">${title_case(index_col)}
          <span class="tooltiptext">${placeholder}</span>
        </div>
      </td>
      <td class="mapping">
        <select name=${index_col}>
          <option value="">-</option>
          ${html_options}
        </select>
      </td>
    </tr>`;
  }

  toggle_editor(db_name, rule_name) {
    const newEditor = Object.assign({}, this.state.editor);
    if (newEditor[db_name][rule_name] === COL_MAP) {
      delete newEditor[db_name][rule_name];
    } else {
      newEditor[db_name][rule_name] = COL_MAP;
    }
    this.setState({
      editor: newEditor
    });
  }

  show_toggle_btn(db_name, rule_name) {
    return html`<button onClick=${() => {
      this.toggle_editor(db_name, rule_name);
    }}>Use column mapper</button>`;
  }

  column_mapper(available_table_columns, sql) {
    const { mappings, from_clause } = try_parse_query(sql);
    const mappable_fields = [
      "key",
      "title",
      "search_1", 
      "search_2", 
      "search_3", 
      "timestamp",
    ];
    const html_opts = mappable_fields.map((index_col) => {
      const table_col = mappings[index_col];
      return this.table_row(index_col, table_col, available_table_columns);
    });
    return html`<div>
      <table>
        <thead>
          <tr>
            <th>Search index column</th>
            <th>Column from data</th>
          </tr>
        </thead>
        <tbody>
          ${html_opts}
          <input type="hidden" name="from_clause" value="${from_clause}" />
        </tbody>
      </table>
    </div>`;
  }

  sql_editor(db_name, rule_name, sql, available_table_columns) {
    return html`<div>
      <textarea rows="10" cols="75">${sql}</textarea>
    </div>`;
  }

  rule_editor(db_name, rule_name, sql) {
    const db_state = this.state.editor[db_name];
    const available_table_columns = this.props.dbs[db_name][rule_name] || [];
    let editor = null;
    if (db_state && db_state[rule_name] === COL_MAP) {
      editor = this.column_mapper(available_table_columns, sql);
    } else {
      editor = this.sql_editor(db_name, rule_name, sql, available_table_columns);
    }

    let toggle = null;
    if (available_table_columns && available_table_columns.length) {
      toggle = this.show_toggle_btn(db_name, rule_name);
    }

    return html`<div>
      <h3>${rule_name}</h3>
      ${editor}
      <br/>
      ${toggle}
    </div>`;
  }

  db_config([db_name, rules]) {
    const rule_editors = [];
    Object.entries(rules).forEach(([rule_name, {sql}]) => {
      rule_editors.push(this.rule_editor.call(this, db_name, rule_name, sql));
    })
    return html`<div>
      <h2>${db_name}</h2>
      ${rule_editors}
    </div>`;
  }

  render(props, state) {
    this.props = props;
    const rules = Object.entries(props.config).map(this.db_config.bind(this));
    return html`<div>
      <h1>Hello ${props.name}!</h1>
      ${rules}
    </div>`;
  }
}

render(html`<${App} ...${props} />`, document.body);
