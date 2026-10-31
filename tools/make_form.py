"""Creates the Google Form that the page sends its answers to: one short-answer
question per answer key, so every answer lands in its own column of the
Responses sheet. Writes work/form.json with the form id, the formResponse
address, and each key's entry.N field name for app.js.

    python3 tools/make_form.py

Uses gws on the personal account. It creates a new form and never sends anything.
"""
import json, os, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENV = {**os.environ, "GOOGLE_WORKSPACE_CLI_CONFIG_DIR": os.path.expanduser("~/.config/gws-personal")}

HOOKS = [("attempt", "Attempt 78"), ("nearmiss", "Near-miss slow-mo"), ("pov", "POV"),
         ("zoom", "Zoom out"), ("plain", "Straight in")]
EDITS = [("cys", "Can you solve this", ["Countdown ring", "Rewind reveal", "Wipe reveal"]),
         ("wl", "Which one wins", ["Knockout grid", "Study and sweep", "Head to head"]),
         ("ftw", "How many tries", ["Death counter", "The wall", "Rewind"])]

# (answer key, question title, long answer)
QUESTIONS = [(f"p1_{k}", f"Part 1. {n}: keep watching (%)", False) for k, n in HOOKS]
QUESTIONS += [("p1_rank", "Part 1. Openings ranked for keep watching, best first", True),
              ("p1_rank_download", "Part 1. Openings ranked for download, best first", True)]
QUESTIONS += [(f"p1_{k}_ai", f"Part 1. {n}: feels AI-made (1 to 5)", False) for k, n in HOOKS]
for k, n, _ in EDITS:
    QUESTIONS += [(f"p2_{k}_watch", f"Part 2. {n}: how long they'd watch each (0 to 100, highest first)", False),
                  (f"p2_{k}_download", f"Part 2. {n}: most likely to download", False)]
QUESTIONS += [("p3_plots", "Part 3. Story first lines ranked, best first", True),
              ("p3_plot_text", "Part 3. Sibling stories (full plot) ranked, best first", True),
              ("p3_caption", "Part 3. Caption look", False),
              ("p3_hook", "Part 3. Story opening", False),
              ("p3_narration", "Part 3. Narration speed", False)]
QUESTIONS += [("seen", "Have you seen Bounce Puzzle videos on social media?", False),
              ("played", "Have you played Bounce Puzzle?", False),
              ("far", "How far did you get?", False),
              ("where", "Where do you watch short videos most?", False),
              ("else", "Anything else?", True),
              ("name", "Name", False),
              ("sid", "Response ID (matches early saves to the final send)", False),
              ("finished", "Finished (yes = pressed Send, no = left early)", False)]


def gws(*args, body=None, params=None):
    cmd = ["gws", "forms", "forms", *args]
    if params:
        cmd += ["--params", json.dumps(params)]
    if body:
        cmd += ["--json", json.dumps(body)]
    out = subprocess.run(cmd, env=ENV, capture_output=True, text=True, check=True).stdout
    return json.loads(out[out.index("{"):])


form = gws("create", body={"info": {"title": "Bounce Puzzle feedback v2", "documentTitle": "Bounce Puzzle feedback v2"}})
fid = form["formId"]
reqs = [{"updateFormInfo": {"info": {"description": "Answers from the feedback page. Each column is one question on the page."},
                            "updateMask": "description"}}]
for i, (key, title, long) in enumerate(QUESTIONS):
    reqs.append({"createItem": {"location": {"index": i}, "item": {
        "title": title, "questionItem": {"question": {"textQuestion": {"paragraph": long}}}}}})
gws("batchUpdate", params={"formId": fid}, body={"requests": reqs})
gws("setPublishSettings", params={"formId": fid},
    body={"publishSettings": {"publishState": {"isPublished": True, "isAcceptingResponses": True}}})

got = gws("get", params={"formId": fid})
items = [it for it in got["items"] if "questionItem" in it]
assert len(items) == len(QUESTIONS), (len(items), len(QUESTIONS))
fields = {}
for (key, title, _), it in zip(QUESTIONS, items):
    assert it["title"] == title, (it["title"], title)
    fields[key] = "entry." + str(int(it["questionItem"]["question"]["questionId"], 16))
uri = got["responderUri"]
out = {"formId": fid, "responderUri": uri, "formResponse": uri.replace("/viewform", "/formResponse"), "fields": fields}
(ROOT / "work/form.json").write_text(json.dumps(out, indent=1))
print(fid, uri, len(fields), "fields")
