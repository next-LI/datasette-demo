import asyncio
from html import escape
import os
import re
import urllib.parse
import yaml
import json
import sqlite3
from sqlite_utils import Database

from datasette import hookimpl
from datasette.utils.asgi import Response
# COLUMNS: dict (key => data_type)
# CATEGORIES: list of dicts: {"id": 1, "name": "created"}
from dogsheep_beta.utils import COLUMNS


help_text = {
    "key": "A unique (within that type) primary key",
    "title": "The title for the item",
    "search_1": "A larger chunk of text to be included in the search index",
    "search_2": "Another text field to index",
    "search_3": "Another text field to index",
    "timestamp": "An ISO8601 timestamp, e.g. 2020-09-02T21:00:21",

    "category": "An integer category ID, matching a category ID in Dogsheep's categories table",
    "is_public": "An integer (0 or 1, defaults to 0 if not set) specifying if this is public or not",
}
managed_str = '/* dont edit! managed by plugin */'


@hookimpl
def register_routes():
    return [
        (r"^/-/dogsheep-cli/?$", dogsheep_cli)
    ]


@hookimpl
def menu_links(datasette, actor):
    # async def inner():
    #     if actor and actor.get("id") == "root":
    #         return True
    #     allowed = await datasette.permission_allowed(
    #         actor, "dogsheep-editor", default=False
    #     )
    #     if allowed:
    #         return [{
    #             "href": datasette.urls.path("/-/dogsheep-cli"),
    #             "label": "Dogsheep CLI"
    #         }]
    return [{
        "href": datasette.urls.path("/-/dogsheep-cli"),
        "label": "Dogsheep CLI"
    }]


async def run_async_cli(args):
    # https://stackoverflow.com/questions/636561/how-can-i-run-an-external-command-asynchronously-from-python
    proc = await asyncio.create_subprocess_exec(
        *filter(lambda x: x, args),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await proc.communicate()
    return stdout.decode("utf-8"), stderr.decode("utf-8")


async def handle_post(db_path, cfg_path, request, datasette):
    tokenize = ""
    # tokenize = "--tokenize none"

    # db name -> table name -> index mapping data
    post_vars = await request.post_vars()
    index_json_str = post_vars['config'].strip()
    index_data = yaml.load(index_json_str, Loader=yaml.SafeLoader)

    # TODO: write index_data (new dogsheep config)
    # with open(cfg_path, "w") as f:
    #     f.write(yaml.dump(index_data))

    args = ["dogsheep-beta", "index", db_path, cfg_path, tokenize]
    stdout, stderr = await run_async_cli(args)
    stdout_block = ''
    if stderr:
        stdout_block = f'<b>Dogsheep Error Log:</b><br/><pre>{stdout}</pre>'
    return Response.html(f"""
        <h1>Dogsheep Run Log</h1>
        <b>Logs:</b><br/>
        <pre>{stderr}</pre><br/>
        {stdout_block}
    """)


async def ignore_table(db, name):
    # ignore FTS meta tables
    if name.endswith("_fts"):
        return True
    if re.match(f".*_fts_[a-z]+$", name):
        return True
    # non-tables (index, virtual, triggers, etc)
    is_tbl_q = "select * from sqlite_master where type=? and name=?"
    if not (await db.execute(is_tbl_q, ('table', name))).first():
        return True
    return False


def convert_sql_to_maps(sql):
    # break up sql into column mappings and table/etc conditions
    # ignoring our 'managed' signature
    managed_esc = managed_str.replace("*", r"\*")
    parts_re = r"select\s+(.*)\s+from\s+(.*)" + f"\\s+{managed_esc}$"
    parts_matches = re.match(parts_re, sql.strip())
    mappings, conditions = [], None
    if not parts_matches:
        return mappings, conditions

    col_maps = {}

    all_mappings, conditions = parts_matches.groups()
    # we require a space after comma  here
    for col_as_key_str in re.split(r',\s+', all_mappings):
        key_map_matches = re.match(r"^(.*)\s+as\s+(.*)$", col_as_key_str)
        col_key, key = key_map_matches.groups()
        col_maps[key] = col_key.strip()

    if conditions:
        conditions = f"from {conditions}"
    return conditions, col_maps


def get_dogsheep_categories(db_path):
    index_db = Database(sqlite3.connect(db_path))
    categories = []
    for row in index_db.execute("select * from categories"):
        categories.append({
            "id": row[0],
            "name": row[1],
        })
    return categories


async def dogsheep_cli(scope, receive, datasette, request):
    db_path = os.path.join("dogsheep", "index.db")
    cfg_path = os.path.join("dogsheep", "config.yml")

    if request.method == "POST":
        return await handle_post(db_path, cfg_path, request, datasette)

    config = yaml.load(open(cfg_path, "r"), Loader=yaml.SafeLoader)

    # db name -> table/view name -> columns
    dbs = {}
    for db_name, db in datasette.databases.items():
        if db.is_memory:
            continue

        if db.path not in dbs:
            dbs[db.path] = {}

        for name in (await db.table_names()) + (await db.view_names()):
            if await ignore_table(db, name):
                continue

            results = await db.execute(
                f"PRAGMA table_info('{name}');"
            )
            dbs[db.path][name] = [ r['name'] for r in results.rows ]

    dogsheep_columns = list(COLUMNS.keys())
    dogsheep_categories = get_dogsheep_categories(db_path)
    return Response.html(
        await datasette.render_template(
            "dogsheep_cli.html", {
                "config": json.dumps(config),
                "dbs": json.dumps(dbs),
                "help_text": json.dumps(help_text),
                "dogsheep_columns": json.dumps(dogsheep_columns),
                "dogsheep_categories": json.dumps(dogsheep_categories)
            }, request=request
        )
    )
