import asyncio

from datasette import hookimpl


async def run_async_cli(args):
    # 1. check to see if the git repo exists
    #   a. if not do clone
    #   b. if it does exist, pull/reset to remote
    # 2. add all files
    # 3. commit
    # 4. push

    # https://stackoverflow.com/questions/636561/how-can-i-run-an-external-command-asynchronously-from-python

    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )

    # do something else while ls is working

    # if proc takes very long to complete, the CPUs are free to use cycles for
    # other processes
    stdout, stderr = await proc.communicate()

    return stdout, stderr
