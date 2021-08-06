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
  if (!sql) return {};
  // split columns from "from ______" part of the query
  const matches = sql.replace(
    /[\n\r]+/g, ' '
  ).match(
    /select\s+(.*)\s+from\s+(.*)/i
  );
  if (!matches || matches.length !== 3) {
    return {};
  }
  const [_, row_mappings, from_clause ] = matches;
  const mappings_array = row_mappings.split(/,\s?/).map((mapping) => {
    const [ table, index ] = mapping.split(/\s+as\s+/i);
    if (!table || !index) {
      return {};
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
const config_state = props['config'];
delete props['config'];

class App extends Component {
  state = {
    editor: editor_state,
    config: config_state,
    // db_name (only one open at a time)
    rule_adder_opened: null,
    new_rule_name: '',
  };

  strip_colname(og_col) {
    if (!og_col) return '';
    let col = og_col;
    if (col.startsWith("[")) col = col.slice(1,);
    if (col.endsWith("]")) col = col.slice(0,-1);
    col = col.replace('\\[', '[').replace('\\]', ']')
    return col;
  }

  compare_colnames(cola, colb) {
    if (this.strip_colname(cola) === this.strip_colname(colb)) return true;
    return false;
  }

  mapping_changed(db_name, rule_name, index_col, mappings, from_clause, e) {
    mappings[index_col] = e.target.value; // index_col => new table_col
    const column_sql = Object.entries(mappings).map(([icol, tcol]) => {
      if (tcol.match(/\s/)) {
        if (tcol.startsWith("[")) tcol = tcol.slice(1,);
        if (tcol.endsWith("]")) tcol = tcol.slice(0,-1);
        tcol = tcol.replace('[', '\\[').replace(']', '\\]')
      }
      return `[${tcol}] as ${icol}`;
    }).join(", ");
    const sql = `select ${column_sql} from ${from_clause}`;
    const newConfig = Object.assign({}, this.state.config);
    newConfig[db_name][rule_name].sql = sql;
    this.setState({
      config: newConfig
    });
  }

  get_option(value, label, selected) {
    if (selected)
      return html`<option value="${value}" selected>${label}</option>`;
    else
      return html`<option value="${value}">${label}</option>`;
  }

  table_row(index_col, table_col, available_table_columns,
            mappings, from_clause, db_name, rule_name) {
    const title_case = (s) => s[0] + s.slice(1,s.length);
    const placeholder = this.props.help_text[index_col];
    const html_options = available_table_columns.map((col) => {
      let selected = false;
      if (this.compare_colnames(table_col, col)) {
        selected = true;
      }
      return this.get_option(col, title_case(col), selected);
    });
     return html`<tr>
      <td>
				<div class="tooltip">${title_case(index_col)}
					<span class="tooltiptext">${placeholder}</span>
				</div> 
      </td>
      <td class="mapping">
        <select name=${index_col} onChange=${(e) => {
          this.mapping_changed(db_name, rule_name, index_col, mappings, from_clause, e);
        }}>
          <option value="">-</option>
          ${html_options}
        </select>
      </td>
    </tr>`;
  }

  onInput = (key, e) => {
    const { value } = e.target;
    this.setState({
      [key]: value
    })
  }

  remove_rule(db_name, rule_name) {
    const newConfig = Object.assign({}, this.state.config);
    delete newConfig[db_name][rule_name];
    const newEditor = Object.assign({}, this.state.editor);
    delete newEditor[db_name][rule_name];
    this.setState({
      editor: newEditor,
      config: newConfig,
    });
  }

  add_rule(db_name) {
    const rule_name = this.state.new_rule_name;
    const newConfig = Object.assign({}, this.state.config);
    newConfig[db_name][rule_name] = {sql: ''};
    const newEditor = Object.assign({}, this.state.editor);
    newEditor[db_name][rule_name] = SQL;
    this.setState({
      editor: newEditor,
      config: newConfig,
      new_rule_name: '',
      rule_adder_opened: db_name,
    });
    setTimeout(() => {
      document.getElementById(`${db_name}--${rule_name}`).scrollIntoView();
    }, 250);
  }

  rule_adder(db_name) {
    if (this.state.rule_adder_opened === db_name) {
      // show the rule adder UI
      let avail_tables = Object.keys(this.props.dbs[db_name]).map((name) => {
        return html`<code>${name}</code> `;
      });
      if (avail_tables && avail_tables.length) {
        avail_tables = html`<div class='columns'>
          <b>Tables/views in database:</b> ${avail_tables}
        </div>`;
      }

      return html`<div>
        ${avail_tables}
        <input type="text"
          value=${this.state.new_rule_name}
          onInput=${this.onInput.bind(this, 'new_rule_name')} />
        <button onClick=${this.add_rule.bind(this, db_name)}>Save</button>
        <button onClick=${() => {
          this.setState({
            rule_adder_opened: null
          });
        }}>Cancel</button>
      </div>`;
    }

    // show a button to open the rule new adder
    return html`<button onClick=${() => {
      this.setState({
        new_rule_name: '',
        rule_adder_opened: db_name,
      });
    }}>Add new rule</button>`;
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
    let toggle_msg = "Use column mapper";
    if (this.state.editor[db_name][rule_name] === COL_MAP) {
      toggle_msg = "Use SQL editor";
    }
    return html`<button onClick=${() => {
      this.toggle_editor(db_name, rule_name);
    }}>${toggle_msg}</button>`;
  }

  column_mapper(available_table_columns, sql, db_name, rule_name) {
    const { mappings=[], from_clause='' } = try_parse_query(sql);
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
      return this.table_row(
        index_col, table_col, available_table_columns,
        mappings, from_clause, db_name, rule_name
      );
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
      editor = this.column_mapper(available_table_columns, sql, db_name, rule_name);
    } else {
      editor = this.sql_editor(db_name, rule_name, sql, available_table_columns);
    }

    let toggle = null;
    if (available_table_columns && available_table_columns.length) {
      toggle = this.show_toggle_btn(db_name, rule_name);
    }

    let show_columns = null;
    if (available_table_columns && available_table_columns.length) {
      show_columns = available_table_columns.map((col) => {
        return html`<code>${col}</code> `;
      });
      show_columns = html`<div class='columns'>
        <b>Available columns for table '${rule_name}':</b>
        <br/>
        ${show_columns}
      </div>`;
    }
    return html`<div>
      <h3 id="${db_name}--${rule_name}">Rule: ${rule_name}</h3>
      <button onClick=${() => {
        this.remove_rule(db_name, rule_name)
      }}>Remove rule ${rule_name}</button>
      ${show_columns}
      ${editor}
      <br/>
      ${toggle}
    </div>`;
  }

  db_config(db_name, rules) {
    if (!this.state.config[db_name]) {
      return html`<div>
        <h2>Database: ${db_name}</h2>
        <p>No indexes have been set for this database.</p>
      </div>`;
    }

    const rule_editors = [];
    Object.entries(rules).forEach(([rule_name, {sql}]) => {
      rule_editors.push(this.rule_editor.call(this, db_name, rule_name, sql));
    })
    return html`<div>
      <h2>Database: ${db_name}</h2>
      ${this.rule_adder(db_name)}
      ${rule_editors}
    </div>`;
  }

  config_editor() {
    let raw_code = null;
    let btn_text = "Show raw config";
    const cfg_json = JSON.stringify(this.state.config, null, 2);
    if (this.state.show_config) {
      btn_text = "Hide raw config";
      raw_code = html`<textarea name="config" rows=20 cols=80>${cfg_json}</textarea>`;
    } else {
      raw_code = html`<input type="hidden" name="config" value="${cfg_json}" />`;
    }
    return html`<div>
      <form method="post">
        ${raw_code}
        <input type="hidden" name="csrftoken" value="${this.props.csrftoken}" />
        <input type="submit" value="Save config" />
        <button onClick=${(e) => {
          this.setState({
            show_config: !this.state.show_config
          });
          e.preventDefault();
          e.stopPropagation();
        }}>${btn_text}</button>
      </form>
    </div>`;
  }

  render(props, state) {
    this.props = props;
    const rules = Object.keys(this.props.dbs).map((db_name) => {
      return this.db_config(db_name, state.config[db_name]);
    }).filter(x=>x);
    return html`<div>
      <h1>Dogsheep Search Index Config</h1>
      <p>Dogsheep is a search index for the data in this datasette instance!
      This is an interface allowing you to edit the indexing settings. Things
      that you add here will be turned into possible search results.
      </p>
      <p><b>How it works</b></p>
      <p>Each database can have any number of index <i>rules</i>. Rules are 
      bascally queries that get ran against the database, the results of
      which will be available as search results. A rule is typically
      named after a table or database view, but it doesn't have to be.
      You are free to use the SQL editor directly and use complicated
      cross-table joins and even cross-DB queries. One thing to remember
      is that search results will be given a name based on the database
      name and the rule name. So if you give your rule a wild name, don't
      be surprised when your results show up under that name, even if it's
      just pulling records from a table!
      </p>
      ${this.config_editor()}
      ${rules}
    </div>`;
  }
}

render(html`<${App} ...${props} />`, document.body);
