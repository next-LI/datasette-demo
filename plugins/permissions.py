import types

from datasette import hookimpl


admins = [
    # "brandon@bxroberts.org",
    "Jun-Kai.Teoh@newsday.com",
    "Tim.Healy@newsday.com",
    "Amanda.Fiscina@newsday.com",
]


@hookimpl
def permission_allowed(actor, action):
    if not actor: return
    # root gets everything
    if actor.get("id") == "root":
        return True
    if actor.get("gh_email") in admins:
        return True
